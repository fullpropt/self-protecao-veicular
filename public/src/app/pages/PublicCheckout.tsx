import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { brandFullLogoUrl, brandName } from '../lib/brand';
import {
  extractWhatsappDigits,
  formatPreCheckoutWhatsappInput,
  loadPreCheckoutDraft,
  loadPreCheckoutSubmission,
  normalizePreCheckoutValues
} from '../lib/preCheckoutStorage';
import './public-checkout.css';

type CheckoutPlan = {
  key: string;
  name: string;
  amountCents: number;
  trialDays: number;
  accent: string;
  accentSoft: string;
  summary: string;
  bullets: string[];
};

type CheckoutFormValues = {
  email: string;
  whatsapp: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
};

type CheckoutConfigResponse = {
  success?: boolean;
  plan?: {
    key?: string;
    code?: string;
    name?: string;
    amount_cents?: number;
    trial_days?: number;
  };
  pagarme?: {
    public_key_configured?: boolean;
    public_key?: string;
  };
  error?: string;
};

const PLAN_CATALOG: Record<string, CheckoutPlan> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    amountCents: 9700,
    trialDays: 0,
    accent: '#22c55e',
    accentSoft: 'rgba(34, 197, 94, 0.16)',
    summary: '1 conexão WhatsApp e até 1000 contatos para começar sem fricção.',
    bullets: ['1 conexão WhatsApp', 'Até 1000 contatos', 'Fluxos e inbox incluídos']
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    amountCents: 19700,
    trialDays: 7,
    accent: '#00ffa3',
    accentSoft: 'rgba(0, 255, 163, 0.12)',
    summary: '3 conexões WhatsApp, contatos ilimitados e 7 dias grátis para ativar sem cobrança do plano hoje.',
    bullets: ['3 conexões WhatsApp', 'Contatos ilimitados', '7 dias grátis']
  },
  advanced: {
    key: 'advanced',
    name: 'Avançado',
    amountCents: 39700,
    trialDays: 0,
    accent: '#eab308',
    accentSoft: 'rgba(234, 179, 8, 0.16)',
    summary: '5 conexões WhatsApp, contatos ilimitados e operação mais robusta.',
    bullets: ['5 conexões WhatsApp', 'Contatos ilimitados', 'Escala para equipe']
  }
};

function normalizePlanKey(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'avancado' || normalized === 'avançado') return 'advanced';
  if (normalized === 'starter' || normalized === 'advanced' || normalized === 'premium') {
    return normalized;
  }
  return 'premium';
}

function readJsonSafely(response: Response) {
  return response.text().then((raw) => {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  });
}

function getFieldFromSearch(search: string, candidates: string[]) {
  const params = new URLSearchParams(search);
  for (const candidate of candidates) {
    const value = String(params.get(candidate) || '').trim();
    if (value) return value;
  }
  return '';
}

function digitsOnly(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function formatCurrencyBRL(amountCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format((Number(amountCents || 0) || 0) / 100);
}

function formatCardNumber(value: string) {
  return digitsOnly(value).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatCardExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function parseExpiryParts(value: string) {
  const digits = digitsOnly(value);
  if (digits.length !== 4) return { month: '', year: '' };
  const month = digits.slice(0, 2);
  const monthNumber = Number(month);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return { month: '', year: '' };
  }
  return { month, year: `20${digits.slice(2, 4)}` };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function detectCardBrand(number: string): string {
  const d = digitsOnly(number);
  if (/^4/.test(d)) return 'visa';
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^6(?:011|5)/.test(d)) return 'elo';
  return '';
}

function validateForm(values: CheckoutFormValues) {
  const errors: Partial<Record<keyof CheckoutFormValues, string>> = {};

  if (!isValidEmail(values.email)) errors.email = 'Informe um e-mail válido.';
  if (digitsOnly(values.whatsapp).length < 10) errors.whatsapp = 'Informe o WhatsApp com DDD.';
  if (String(values.cardHolderName || '').trim().length < 3) errors.cardHolderName = 'Nome igual ao do cartão.';
  if (digitsOnly(values.cardNumber).length < 13) errors.cardNumber = 'Número inválido.';
  if (!parseExpiryParts(values.cardExpiry).month) errors.cardExpiry = 'Validade inválida.';
  if (digitsOnly(values.cardCvv).length < 3) errors.cardCvv = 'CVV inválido.';

  return errors;
}

function resolveInitialValues(planKey: string, search: string) {
  const submission = loadPreCheckoutSubmission();
  const draft = loadPreCheckoutDraft();
  const baseSource =
    submission && submission.planKey === planKey
      ? submission
      : draft && draft.planKey === planKey
        ? { values: draft.values, leadCaptureId: null }
        : null;

  const prefillFromSearch = normalizePreCheckoutValues({
    fullName: getFieldFromSearch(search, ['prefill_name', 'name']),
    email: getFieldFromSearch(search, ['prefill_email', 'email']),
    whatsapp: getFieldFromSearch(search, ['prefill_whatsapp', 'whatsapp', 'phone']),
    companyName: '',
    primaryObjective: ''
  });

  const leadCaptureIdRaw = Number(getFieldFromSearch(search, ['lead_capture_id', 'leadCaptureId']));
  const leadCaptureId = Number.isInteger(leadCaptureIdRaw) && leadCaptureIdRaw > 0
    ? leadCaptureIdRaw
    : (baseSource?.leadCaptureId || null);

  const baseValues = baseSource?.values || normalizePreCheckoutValues(null);
  const resolved = normalizePreCheckoutValues({ ...baseValues, ...prefillFromSearch });

  return {
    values: {
      email: resolved.email,
      whatsapp: resolved.whatsapp,
      cardHolderName: resolved.fullName,
      cardNumber: '',
      cardExpiry: '',
      cardCvv: ''
    },
    leadCaptureId
  };
}

async function tokenizeCard(publicKey: string, values: CheckoutFormValues) {
  const expiry = parseExpiryParts(values.cardExpiry);
  const response = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(publicKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      type: 'card',
      card: {
        holder_name: String(values.cardHolderName || '').trim(),
        number: digitsOnly(values.cardNumber),
        exp_month: expiry.month,
        exp_year: expiry.year,
        cvv: digitsOnly(values.cardCvv)
      }
    })
  });

  const payload = await readJsonSafely(response) as {
    id?: string;
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!response.ok || !payload.id) {
    const fieldError = payload.errors && typeof payload.errors === 'object'
      ? Object.values(payload.errors).flat().find(Boolean)
      : '';
    throw new Error(String(fieldError || payload.message || 'Não foi possível validar o cartão agora.'));
  }

  return String(payload.id).trim();
}

function buildCardPayload(values: CheckoutFormValues) {
  const expiry = parseExpiryParts(values.cardExpiry);
  return {
    cardHolderName: String(values.cardHolderName || '').trim(),
    cardNumber: digitsOnly(values.cardNumber),
    cardExpMonth: expiry.month,
    cardExpYear: expiry.year,
    cardCvv: digitsOnly(values.cardCvv)
  };
}

function Field({
  label,
  error,
  full = false,
  half = false,
  children
}: {
  label: string;
  error?: string;
  full?: boolean;
  half?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`pco-field ${full ? 'full' : ''} ${half ? 'half' : ''} ${error ? 'has-error' : ''}`}>
      <label>{label}</label>
      {children}
      {error ? <small>{error}</small> : null}
    </div>
  );
}

// Minimalist card preview component
function CardPreview({ values }: { values: CheckoutFormValues }) {
  const brand = detectCardBrand(values.cardNumber);
  const displayNumber = values.cardNumber
    ? values.cardNumber.replace(/\s/g, '').padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim()
    : '•••• •••• •••• ••••';
  const displayExpiry = values.cardExpiry || 'MM/AA';
  const displayName = values.cardHolderName || 'SEU NOME';

  return (
    <div className="pco-card-preview">
      <div className="pco-card-chip" />
      <div className="pco-card-number">{displayNumber}</div>
      <div className="pco-card-bottom">
        <span className="pco-card-holder">{displayName.toUpperCase().slice(0, 22)}</span>
        <span className="pco-card-expiry">{displayExpiry}</span>
      </div>
      {brand && <div className={`pco-card-brand pco-card-brand--${brand}`} />}
    </div>
  );
}

export default function PublicCheckout() {
  const { planKey: planKeyParam } = useParams<{ planKey: string }>();
  const location = useLocation();
  const normalizedPlanKey = normalizePlanKey(planKeyParam);
  const plan = PLAN_CATALOG[normalizedPlanKey] || PLAN_CATALOG.premium;
  const initialState = useMemo(() => resolveInitialValues(plan.key, location.search), [location.search, plan.key]);

  const [values, setValues] = useState<CheckoutFormValues>(initialState.values);
  const [leadCaptureId, setLeadCaptureId] = useState<number | null>(initialState.leadCaptureId);
  const [config, setConfig] = useState<CheckoutConfigResponse | null>(null);
  const [configError, setConfigError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    setValues(initialState.values);
    setLeadCaptureId(initialState.leadCaptureId);
    setSubmitError('');
  }, [initialState]);

  useEffect(() => {
    document.title = `${brandName} | Checkout`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingConfig(true);
    setConfigError('');

    fetch(`/api/public/billing/checkout/${encodeURIComponent(plan.key)}/config`)
      .then(async (response) => {
        const payload = await readJsonSafely(response) as CheckoutConfigResponse;
        if (!response.ok || !payload.success) {
          throw new Error(String(payload.error || 'Não foi possível carregar o checkout agora.'));
        }
        if (!cancelled) setConfig(payload);
      })
      .catch((error) => {
        if (!cancelled) {
          setConfig(null);
          setConfigError(error instanceof Error ? error.message : 'Não foi possível carregar o checkout agora.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingConfig(false);
      });

    return () => {
      cancelled = true;
    };
  }, [plan.key]);

  const effectiveAmountCents = Number(config?.plan?.amount_cents || plan.amountCents || 0);
  const effectiveTrialDays = Number(config?.plan?.trial_days ?? plan.trialDays ?? 0);
  const pagarmePublicKey = String(config?.pagarme?.public_key || '').trim();
  const isPublicKeyConfigured = Boolean(config?.pagarme?.public_key_configured && pagarmePublicKey);
  const validationErrors = useMemo(() => validateForm(values), [values]);

  const themeStyle = useMemo<CSSProperties>(() => ({
    '--checkout-accent': plan.accent,
    '--checkout-accent-soft': plan.accentSoft
  } as CSSProperties), [plan.accent, plan.accentSoft]);

  const handleChange = (field: keyof CheckoutFormValues, nextValue: string) => {
    setSubmitError('');
    setValues((current) => {
      if (field === 'email') return { ...current, email: String(nextValue || '').trim().toLowerCase() };
      if (field === 'whatsapp') return { ...current, whatsapp: formatPreCheckoutWhatsappInput(nextValue) };
      if (field === 'cardNumber') return { ...current, cardNumber: formatCardNumber(nextValue) };
      if (field === 'cardExpiry') return { ...current, cardExpiry: formatCardExpiry(nextValue) };
      if (field === 'cardCvv') return { ...current, cardCvv: digitsOnly(nextValue).slice(0, 4) };
      return { ...current, [field]: nextValue };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Revise os campos antes de continuar.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const cardToken = isPublicKeyConfigured
        ? await tokenizeCard(pagarmePublicKey, values)
        : '';
      const response = await fetch(`/api/public/billing/checkout/${encodeURIComponent(plan.key)}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.cardHolderName,
          email: values.email,
          whatsapp: extractWhatsappDigits(values.whatsapp),
          companyName: '',
          primaryObjective: '',
          documentType: 'cpf',
          documentNumber: '',
          cardToken,
          ...(!cardToken ? buildCardPayload(values) : {}),
          leadCaptureId
        })
      });

      const payload = await readJsonSafely(response) as { redirect_url?: string; error?: string; };
      if (!response.ok || !payload.redirect_url) {
        throw new Error(String(payload.error || 'Não foi possível iniciar a assinatura agora.'));
      }

      window.location.assign(String(payload.redirect_url));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayLabel = effectiveTrialDays > 0 ? 'Hoje · R$ 0,00' : `Hoje · ${formatCurrencyBRL(effectiveAmountCents)}`;
  const renewalLabel = effectiveTrialDays > 0
    ? `Em ${effectiveTrialDays} dias · ${formatCurrencyBRL(effectiveAmountCents)}`
    : `A cada 30 dias · ${formatCurrencyBRL(effectiveAmountCents)}`;
  const ctaLabel = isSubmitting
    ? 'Processando...'
    : effectiveTrialDays > 0
      ? `Ativar ${effectiveTrialDays} dias grátis →`
      : 'Assinar agora →';

  return (
    <div className="pco-page" style={themeStyle}>
      {/* Header minimalista */}
      <header className="pco-header">
        <a href="#/planos" className="pco-logo" aria-label="Voltar para os planos">
          <img src={brandFullLogoUrl} alt={brandName} />
        </a>
        <div className="pco-secure-badge">
          <span className="pco-lock">🔒</span>
          <span>Pagamento seguro</span>
        </div>
      </header>

      <main className="pco-main">
        {/* Coluna esquerda — Formulário */}
        <section className="pco-form-col">
          {/* Eyebrow */}
          <div className="pco-eyebrow">
            <span className="pco-plan-badge">{plan.name}</span>
            {effectiveTrialDays > 0 && (
              <span className="pco-trial-badge">{effectiveTrialDays} dias grátis</span>
            )}
          </div>
          <h1 className="pco-title">
            {effectiveTrialDays > 0 ? 'Ative seu teste grátis' : 'Concluir assinatura'}
          </h1>
          <p className="pco-subtitle">
            {effectiveTrialDays > 0
              ? 'Nenhuma cobrança hoje. Cancele quando quiser.'
              : 'Preencha seus dados para ativar agora.'}
          </p>

          <form className="pco-form" onSubmit={handleSubmit} noValidate>
            {/* Seção: Contato */}
            <div className="pco-section-label">Seu contato</div>
            <div className="pco-fields-row">
              <Field label="E-mail" error={validationErrors.email} full>
                <input
                  className="pco-input"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@empresa.com"
                  value={values.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </Field>
              <Field label="WhatsApp (com DDD)" error={validationErrors.whatsapp} full>
                <input
                  className="pco-input"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                  value={values.whatsapp}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                />
              </Field>
            </div>

            {/* Seção: Cartão */}
            <div className="pco-section-label" style={{ marginTop: '28px' }}>Dados do cartão</div>

            <CardPreview values={values} />

            <div className="pco-fields-row" style={{ marginTop: '16px' }}>
              <Field label="Nome impresso no cartão" error={validationErrors.cardHolderName} full>
                <input
                  className="pco-input"
                  autoComplete="cc-name"
                  placeholder="Ex.: Ana Souza"
                  value={values.cardHolderName}
                  onChange={(e) => handleChange('cardHolderName', e.target.value)}
                />
              </Field>
              <Field label="Número do cartão" error={validationErrors.cardNumber} full>
                <input
                  className="pco-input pco-input--card"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  value={values.cardNumber}
                  onChange={(e) => handleChange('cardNumber', e.target.value)}
                />
              </Field>
              <Field label="Validade" error={validationErrors.cardExpiry} half>
                <input
                  className="pco-input"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  value={values.cardExpiry}
                  onChange={(e) => handleChange('cardExpiry', e.target.value)}
                />
              </Field>
              <Field label="CVV" error={validationErrors.cardCvv} half>
                <input
                  className="pco-input"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="•••"
                  value={values.cardCvv}
                  onChange={(e) => handleChange('cardCvv', e.target.value)}
                />
              </Field>
            </div>

            {/* Banners */}
            {isLoadingConfig && (
              <div className="pco-banner">Carregando checkout...</div>
            )}
            {configError && (
              <div className="pco-banner pco-banner--error">{configError}</div>
            )}
            {!isLoadingConfig && !configError && effectiveTrialDays > 0 && (
              <div className="pco-banner pco-banner--info">
                ✅ <strong>{effectiveTrialDays} dias grátis.</strong> Verificação temporária do cartão sem cobrança.
              </div>
            )}
            {submitError && (
              <div className="pco-banner pco-banner--error">{submitError}</div>
            )}

            {/* CTA */}
            <button
              className="pco-submit"
              type="submit"
              disabled={isSubmitting || isLoadingConfig}
            >
              {ctaLabel}
            </button>

            <p className="pco-foot-note">
              🔒 Pagamento processado com segurança pelo Pagar.me · SSL 256‑bit
            </p>
          </form>
        </section>

        {/* Coluna direita — Resumo */}
        <aside className="pco-summary-col">
          <div className="pco-summary-card">
            <div className="pco-summary-header">
              <span className="pco-summary-label">Resumo</span>
              <span className="pco-summary-plan-name">{plan.name}</span>
            </div>

            <ul className="pco-summary-bullets">
              {plan.bullets.map((b) => (
                <li key={b}>
                  <span className="pco-bullet-dot" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>

            <div className="pco-summary-divider" />

            <div className="pco-price-lines">
              <div className="pco-price-row">
                <span>{effectiveTrialDays > 0 ? 'Cobrança inicial' : 'Hoje'}</span>
                <strong className="pco-price-today">
                  {effectiveTrialDays > 0 ? 'R$ 0,00' : formatCurrencyBRL(effectiveAmountCents)}
                </strong>
              </div>
              <div className="pco-price-row">
                <span>{effectiveTrialDays > 0 ? `Após ${effectiveTrialDays} dias` : 'Renovação'}</span>
                <strong>{formatCurrencyBRL(effectiveAmountCents)}/mês</strong>
              </div>
            </div>

            <div className="pco-trust-list">
              <div className="pco-trust-item">✅ Cancele quando quiser</div>
              <div className="pco-trust-item">✅ Ativação imediata</div>
              <div className="pco-trust-item">✅ Sem contrato de fidelidade</div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
