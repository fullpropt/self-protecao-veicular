import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brandFullLogoUrl, brandName } from '../lib/brand';

const monthlyPrice = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
}).format(297);

const planFeatures = [
  'CRM com contatos, histórico de conversas e lead tracking',
  'Inbox para atendimento com mensagens e mídias',
  'Campanhas e disparos com fila e controle de envio',
  'Automações e fluxos para atendimento e follow-up',
  'Funil visual para acompanhar oportunidades',
  'Gestão de sessões WhatsApp direto no painel'
];

const testimonials = [
  {
    quote: 'Antes eu atendia tudo espalhado. Com o ZapVender consegui organizar o time, responder mais rapido e parar de perder lead no WhatsApp.',
    name: 'Carlos M.',
    role: 'Operacao comercial',
    metric: 'Mais controle no atendimento'
  },
  {
    quote: 'A melhor parte foi juntar CRM + inbox + automacao no mesmo painel. A equipe passou a acompanhar status dos contatos sem planilha paralela.',
    name: 'Juliana R.',
    role: 'Gestao de vendas',
    metric: 'Processo mais padronizado'
  },
  {
    quote: 'Para validacao comercial, o plano unico ajuda muito. O cliente entende a oferta em poucos segundos e a conversa avanca mais rapido.',
    name: 'Rafael S.',
    role: 'Parceiro comercial',
    metric: 'Menos friccao na oferta'
  }
];

const faqItems = [
  {
    question: 'Como funciona a cobranca do plano?',
    answer: 'O plano e mensal, com recorrencia de R$297. Voce pode adaptar a pagina para o gateway escolhido e incluir termos de renovacao, vencimento e inadimplencia.'
  },
  {
    question: 'Tem fidelidade ou contrato minimo?',
    answer: 'Nesta versao da pagina, a comunicacao foi preparada para plano mensal simples. Se houver fidelidade, acrescente essa regra no FAQ e no checkout.'
  },
  {
    question: 'O que esta incluso no plano de R$297?',
    answer: 'A proposta atual destaca os modulos principais: CRM, inbox, campanhas, automacoes, funil e gestao de sessoes WhatsApp. Ajuste a lista conforme sua operacao comercial.'
  },
  {
    question: 'Como fica a implantacao e onboarding?',
    answer: 'Voce pode incluir onboarding padrao (ex.: configuracao inicial e treinamento) ou vender implantacao separada. A estrutura da pagina suporta essa evolucao.'
  },
  {
    question: 'Posso trocar o CTA por checkout direto?',
    answer: 'Sim. Os botoes hoje apontam para login, mas podem ser conectados a checkout (Asaas, Stripe, Mercado Pago) ou WhatsApp comercial em poucos pontos do componente.'
  },
  {
    question: 'Posso criar planos Lite e Enterprise depois?',
    answer: 'Sim. A pagina ja inclui comparacao de planos futuros para facilitar esse upgrade sem refazer o layout completo.'
  }
];

const planRoadmap = [
  {
    name: 'ZapVender Pro',
    status: 'Atual',
    badgeClass: 'is-live',
    price: `${monthlyPrice}/mes`,
    description: 'Plano unico para vender agora com proposta clara e onboarding comercial simplificado.'
  },
  {
    name: 'ZapVender Equipe',
    status: 'Em breve',
    badgeClass: 'is-coming',
    price: 'Planejado',
    description: 'Versao para times maiores, com regras de equipe, permissoes e mais capacidade operacional.'
  },
  {
    name: 'ZapVender Enterprise',
    status: 'Em breve',
    badgeClass: 'is-coming',
    price: 'Sob consulta',
    description: 'Camada para operacoes com SLA, processos customizados e integracoes mais profundas.'
  }
];

const comparisonRows = [
  {
    feature: 'CRM + Inbox de atendimento',
    pro: 'Incluido',
    equipe: 'Incluido',
    enterprise: 'Incluido'
  },
  {
    feature: 'Campanhas + fila de envios',
    pro: 'Incluido',
    equipe: 'Incluido',
    enterprise: 'Incluido'
  },
  {
    feature: 'Automacoes e fluxos',
    pro: 'Incluido',
    equipe: 'Incluido',
    enterprise: 'Incluido'
  },
  {
    feature: 'Organizacao para equipe / permissoes',
    pro: 'Essencial',
    equipe: 'Avancado (planejado)',
    enterprise: 'Avancado'
  },
  {
    feature: 'Onboarding e suporte',
    pro: 'Padrao',
    equipe: 'Prioritario (planejado)',
    enterprise: 'SLA / consultivo'
  },
  {
    feature: 'Customizacoes e integracoes',
    pro: 'Sob avaliacao',
    equipe: 'Opcional',
    enterprise: 'Prioritario'
  }
];

export default function Planos() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${brandName} | Planos`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="sales-page">
      <style>{`
        .sales-page {
          --bg: #08161a;
          --bg-2: #0c1f24;
          --panel: rgba(9, 27, 31, 0.88);
          --panel-strong: rgba(8, 24, 27, 0.96);
          --line: rgba(146, 174, 180, 0.2);
          --text: #eef7f7;
          --muted: #a7c1c1;
          --brand: #23c66f;
          --brand-2: #15a34a;
          --accent: #f6b84e;
          color: var(--text);
          min-height: 100vh;
          background:
            radial-gradient(820px 420px at 90% 8%, rgba(35, 198, 111, 0.18) 0%, rgba(35, 198, 111, 0) 66%),
            radial-gradient(780px 460px at 8% 92%, rgba(246, 184, 78, 0.12) 0%, rgba(246, 184, 78, 0) 65%),
            linear-gradient(150deg, var(--bg) 0%, #071115 45%, var(--bg-2) 100%);
          position: relative;
          overflow-x: hidden;
        }

        .sales-page * {
          box-sizing: border-box;
        }

        .sales-page::before,
        .sales-page::after {
          content: '';
          position: fixed;
          inset: auto;
          pointer-events: none;
          z-index: 0;
          opacity: 0.45;
        }

        .sales-page::before {
          width: 360px;
          height: 360px;
          top: -80px;
          right: -60px;
          border-radius: 34px;
          border: 1px solid rgba(35, 198, 111, 0.2);
          transform: rotate(14deg);
          background: linear-gradient(135deg, rgba(35, 198, 111, 0.08), rgba(35, 198, 111, 0));
        }

        .sales-page::after {
          width: 300px;
          height: 300px;
          bottom: 20px;
          left: -80px;
          border-radius: 999px;
          border: 1px solid rgba(246, 184, 78, 0.16);
          background: radial-gradient(circle at 35% 35%, rgba(246, 184, 78, 0.14), rgba(246, 184, 78, 0));
        }

        .sales-shell {
          position: relative;
          z-index: 1;
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
          padding: 22px 0 44px;
          animation: page-enter 420ms ease-out;
        }

        .sales-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid var(--line);
          background: rgba(7, 19, 23, 0.68);
          backdrop-filter: blur(8px);
          margin-bottom: 22px;
        }

        .sales-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .sales-brand img {
          width: 128px;
          height: auto;
          display: block;
          filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35));
        }

        .sales-nav-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .sales-btn {
          appearance: none;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
          white-space: nowrap;
        }

        .sales-btn:hover {
          transform: translateY(-1px);
        }

        .sales-btn-outline {
          color: var(--text);
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.14);
        }

        .sales-btn-outline:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.24);
        }

        .sales-btn-primary {
          color: #04140b;
          background: linear-gradient(135deg, #35e084, var(--brand));
          box-shadow: 0 12px 28px rgba(21, 163, 74, 0.24);
        }

        .sales-btn-primary:hover {
          box-shadow: 0 18px 32px rgba(21, 163, 74, 0.3);
        }

        .sales-hero {
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: 18px;
          margin-bottom: 20px;
        }

        .hero-copy,
        .hero-card {
          border-radius: 22px;
          border: 1px solid var(--line);
          background: linear-gradient(165deg, rgba(10, 29, 33, 0.96), rgba(8, 23, 27, 0.94));
        }

        .hero-copy {
          padding: 26px;
          position: relative;
          overflow: hidden;
        }

        .hero-copy::before {
          content: '';
          position: absolute;
          inset: auto -40px -70px auto;
          width: 240px;
          height: 240px;
          border-radius: 26px;
          transform: rotate(18deg);
          background: linear-gradient(135deg, rgba(35, 198, 111, 0.12), rgba(35, 198, 111, 0));
          border: 1px solid rgba(35, 198, 111, 0.12);
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.28);
          background: rgba(35, 198, 111, 0.08);
          color: #bdf7d6;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .hero-badge::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #35e084;
          box-shadow: 0 0 0 6px rgba(53, 224, 132, 0.15);
        }

        .hero-title {
          margin: 0;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          font-size: clamp(30px, 4vw, 50px);
          line-height: 1.03;
          letter-spacing: -0.03em;
          max-width: 12ch;
        }

        .hero-title strong {
          color: #d2ffe6;
          text-shadow: 0 0 32px rgba(35, 198, 111, 0.14);
        }

        .hero-subtitle {
          margin: 14px 0 0;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.6;
          max-width: 56ch;
        }

        .hero-points {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 18px 0 0;
          padding: 0;
          list-style: none;
        }

        .hero-points li {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          padding: 11px 12px;
          font-size: 13px;
          color: #d7eaea;
        }

        .hero-cta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .hero-note {
          margin-top: 12px;
          color: #9bb5b5;
          font-size: 12px;
        }

        .hero-card {
          padding: 22px;
          display: grid;
          align-content: start;
          gap: 14px;
          background:
            linear-gradient(180deg, rgba(35, 198, 111, 0.08) 0%, rgba(35, 198, 111, 0) 42%),
            linear-gradient(165deg, rgba(9, 28, 32, 0.97), rgba(7, 21, 24, 0.97));
        }

        .price-kicker {
          color: #b6cccc;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.08em;
          font-size: 11px;
        }

        .price-name {
          margin: 0;
          font-size: 24px;
          line-height: 1.1;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          letter-spacing: -0.02em;
        }

        .price-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          margin-top: 2px;
          flex-wrap: wrap;
        }

        .price-value {
          font-size: clamp(34px, 4vw, 46px);
          line-height: 0.95;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #ecfff4;
        }

        .price-cycle {
          color: #bcd4d4;
          font-size: 14px;
          padding-bottom: 6px;
        }

        .price-highlight {
          border-radius: 14px;
          border: 1px solid rgba(246, 184, 78, 0.22);
          background: rgba(246, 184, 78, 0.08);
          color: #ffe5b3;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.4;
        }

        .price-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 9px;
        }

        .price-list li {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          padding: 10px 12px 10px 34px;
          position: relative;
          color: #ddeeed;
          font-size: 13px;
          line-height: 1.45;
        }

        .price-list li::before {
          content: '✓';
          position: absolute;
          left: 11px;
          top: 9px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: rgba(35, 198, 111, 0.14);
          color: #42e28e;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid rgba(35, 198, 111, 0.25);
        }

        .price-actions {
          display: grid;
          gap: 10px;
          margin-top: 2px;
        }

        .price-actions .sales-btn {
          text-align: center;
          justify-content: center;
          display: inline-flex;
          align-items: center;
          min-height: 44px;
        }

        .price-footnote {
          color: #93adad;
          font-size: 12px;
          line-height: 1.45;
        }

        .plans-section {
          border-radius: 22px;
          border: 1px solid var(--line);
          background: linear-gradient(180deg, rgba(7, 22, 25, 0.84), rgba(7, 20, 23, 0.94));
          padding: 20px;
        }

        .section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .section-title {
          margin: 0;
          font-size: 20px;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          letter-spacing: -0.02em;
        }

        .section-subtitle {
          color: var(--muted);
          font-size: 13px;
          margin: 0;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .plan-card {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(155deg, rgba(15, 37, 42, 0.95), rgba(10, 27, 31, 0.95)),
            linear-gradient(180deg, rgba(35, 198, 111, 0.06), rgba(35, 198, 111, 0));
          padding: 18px;
          display: grid;
          grid-template-columns: 1.2fr .8fr;
          gap: 16px;
          align-items: start;
        }

        .plan-labels {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .plan-chip {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d4eaea;
          background: rgba(255, 255, 255, 0.03);
        }

        .plan-chip.is-highlight {
          border-color: rgba(35, 198, 111, 0.28);
          background: rgba(35, 198, 111, 0.08);
          color: #c4ffd9;
        }

        .plan-title {
          margin: 0 0 8px;
          font-size: 22px;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
          letter-spacing: -0.02em;
        }

        .plan-description {
          margin: 0 0 14px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.55;
        }

        .plan-feature-grid {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .plan-feature-grid li {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          color: #dcecec;
          font-size: 13px;
          line-height: 1.45;
        }

        .plan-sidebar {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: var(--panel-strong);
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .plan-sidebar-price {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
        }

        .plan-sidebar-price strong {
          font-size: 30px;
          letter-spacing: -0.04em;
        }

        .plan-sidebar-price span {
          color: #b5cbcb;
          font-size: 13px;
        }

        .plan-sidebar-meta {
          margin: 0;
          color: #a7bdbd;
          font-size: 12px;
          line-height: 1.5;
        }

        .testimonials-section,
        .comparison-section {
          margin-top: 16px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          padding: 14px;
        }

        .testimonial-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .testimonial-card {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background:
            linear-gradient(165deg, rgba(16, 36, 40, 0.88), rgba(10, 26, 29, 0.94));
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .testimonial-quote {
          margin: 0;
          color: #dceeee;
          font-size: 13px;
          line-height: 1.6;
        }

        .testimonial-quote::before {
          content: '“';
          color: rgba(53, 224, 132, 0.9);
          font-size: 18px;
          line-height: 0;
          margin-right: 3px;
        }

        .testimonial-footer {
          display: grid;
          gap: 3px;
        }

        .testimonial-name {
          font-size: 13px;
          font-weight: 700;
          color: #f0fbfb;
        }

        .testimonial-role {
          color: #9fb9b9;
          font-size: 12px;
        }

        .testimonial-metric {
          margin-top: 2px;
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          border: 1px solid rgba(35, 198, 111, 0.2);
          background: rgba(35, 198, 111, 0.08);
          color: #bff6d5;
          font-size: 11px;
          padding: 5px 9px;
          font-weight: 700;
        }

        .roadmap-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .roadmap-card {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          padding: 12px;
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .roadmap-card.is-live {
          border-color: rgba(35, 198, 111, 0.22);
          background:
            linear-gradient(170deg, rgba(35, 198, 111, 0.07), rgba(255, 255, 255, 0.02));
        }

        .roadmap-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .roadmap-name {
          margin: 0;
          font-size: 15px;
          line-height: 1.2;
        }

        .roadmap-price {
          color: #d7ecec;
          font-weight: 700;
          font-size: 13px;
        }

        .roadmap-desc {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d5eaea;
          background: rgba(255, 255, 255, 0.03);
        }

        .status-badge.is-live {
          color: #bff6d5;
          border-color: rgba(35, 198, 111, 0.26);
          background: rgba(35, 198, 111, 0.08);
        }

        .status-badge.is-coming {
          color: #ffe6bb;
          border-color: rgba(246, 184, 78, 0.2);
          background: rgba(246, 184, 78, 0.07);
        }

        .comparison-note {
          margin: 0 0 10px;
          color: #a8c1c1;
          font-size: 12px;
          line-height: 1.55;
        }

        .comparison-table-wrap {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(4, 14, 16, 0.46);
        }

        .comparison-table {
          width: 100%;
          min-width: 660px;
          border-collapse: collapse;
        }

        .comparison-table th,
        .comparison-table td {
          padding: 11px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          text-align: left;
          vertical-align: top;
          font-size: 12px;
          line-height: 1.45;
        }

        .comparison-table thead th {
          color: #d7ecec;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.02);
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .comparison-table tbody tr:last-child td {
          border-bottom: none;
        }

        .comparison-table th:first-child,
        .comparison-table td:first-child {
          width: 34%;
          color: #eef8f8;
          font-weight: 600;
        }

        .comparison-table td:not(:first-child) {
          color: #bfd6d6;
        }

        .faq-grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .faq-item {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.02);
          padding: 12px;
        }

        .faq-item h3 {
          margin: 0 0 6px;
          font-size: 14px;
        }

        .faq-item p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
        }

        .bottom-cta {
          margin-top: 18px;
          border-radius: 18px;
          border: 1px solid rgba(35, 198, 111, 0.22);
          background:
            linear-gradient(145deg, rgba(13, 39, 31, 0.88), rgba(8, 23, 20, 0.9));
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .bottom-cta-title {
          margin: 0;
          font-size: 17px;
          letter-spacing: -0.02em;
        }

        .bottom-cta-text {
          margin: 3px 0 0;
          color: #a9c2bc;
          font-size: 13px;
        }

        @keyframes page-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sales-shell { animation: none; }
          .sales-btn { transition: none; }
          .sales-btn:hover { transform: none; }
        }

        @media (max-width: 980px) {
          .sales-hero {
            grid-template-columns: 1fr;
          }

          .plan-card {
            grid-template-columns: 1fr;
          }

          .testimonial-grid,
          .roadmap-grid {
            grid-template-columns: 1fr;
          }

          .faq-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .sales-shell {
            width: calc(100% - 20px);
            padding-top: 10px;
            padding-bottom: 24px;
          }

          .sales-nav {
            padding: 10px;
            border-radius: 14px;
            margin-bottom: 14px;
          }

          .sales-brand img {
            width: 108px;
          }

          .sales-nav-actions {
            width: 100%;
            justify-content: stretch;
          }

          .sales-nav-actions .sales-btn {
            flex: 1 1 0;
            text-align: center;
          }

          .hero-copy,
          .hero-card,
          .plans-section {
            border-radius: 16px;
          }

          .hero-copy {
            padding: 18px;
          }

          .hero-points,
          .plan-feature-grid {
            grid-template-columns: 1fr;
          }

          .hero-title {
            max-width: none;
          }

          .section-head {
            margin-bottom: 12px;
          }

          .plan-card {
            padding: 14px;
            border-radius: 14px;
          }

          .testimonials-section,
          .comparison-section {
            margin-top: 12px;
            border-radius: 14px;
            padding: 12px;
          }

          .bottom-cta {
            padding: 14px;
            border-radius: 14px;
          }
        }
      `}</style>

      <div className="sales-shell">
        <header className="sales-nav" aria-label="Navegacao da pagina de planos">
          <Link to="/planos" className="sales-brand" aria-label={`${brandName} planos`}>
            <img src={brandFullLogoUrl} alt={brandName} />
          </Link>

          <div className="sales-nav-actions">
            <Link to="/login" className="sales-btn sales-btn-outline">Entrar</Link>
            <Link to="/login" className="sales-btn sales-btn-primary">Assinar agora</Link>
          </div>
        </header>

        <main>
          <section className="sales-hero" aria-labelledby="planos-hero-title">
            <div className="hero-copy">
              <div className="hero-badge">Plano ativo de lançamento</div>
              <h1 className="hero-title" id="planos-hero-title">
                Centralize <strong>vendas e atendimento</strong> no WhatsApp com o ZapVender
              </h1>
              <p className="hero-subtitle">
                Uma página para vender seu serviço com proposta clara: CRM, inbox, automações, campanhas e funil em um único painel.
                Hoje com um plano simples para acelerar implantação e validação.
              </p>

              <ul className="hero-points" aria-label="Pontos principais do plano">
                <li>Implantação em plano único, sem confusão de tiers</li>
                <li>Operação centralizada com WhatsApp + CRM</li>
                <li>Fluxos e automações para ganhar escala</li>
                <li>Painel web para equipe acompanhar leads</li>
              </ul>

              <div className="hero-cta-row">
                <Link to="/login" className="sales-btn sales-btn-primary">Quero começar</Link>
                <a href="#planos-lista" className="sales-btn sales-btn-outline">Ver detalhes do plano</a>
              </div>

              <p className="hero-note">
                Página pronta para publicar agora e evoluir depois com checkout, cupom e planos adicionais.
              </p>
            </div>

            <aside className="hero-card" aria-labelledby="plano-principal">
              <div className="price-kicker">Plano disponível</div>
              <h2 className="price-name" id="plano-principal">ZapVender Pro</h2>

              <div className="price-row" aria-label={`Preco ${monthlyPrice} por mes`}>
                <div className="price-value">{monthlyPrice}</div>
                <div className="price-cycle">/mês</div>
              </div>

              <div className="price-highlight">
                Ideal para iniciar com uma oferta única, validar aquisição e depois expandir a grade de planos.
              </div>

              <ul className="price-list">
                <li>Plano mensal com acesso ao painel completo</li>
                <li>Recursos principais de CRM, automação e campanhas</li>
                <li>Base pronta para evoluir checkout e upsell</li>
              </ul>

              <div className="price-actions">
                <Link to="/login" className="sales-btn sales-btn-primary">Assinar / Solicitar acesso</Link>
                <Link to="/login" className="sales-btn sales-btn-outline">Falar com suporte comercial</Link>
              </div>

              <div className="price-footnote">
                Valor de lançamento exibido em recorrência mensal. Ajuste termos comerciais, meios de pagamento e regras de cancelamento conforme sua operação.
              </div>
            </aside>
          </section>

          <section className="plans-section" id="planos-lista" aria-labelledby="titulo-planos">
            <div className="section-head">
              <div>
                <h2 className="section-title" id="titulo-planos">Planos</h2>
                <p className="section-subtitle">
                  Estrutura inicial com 1 plano público. Você pode adicionar versões Lite/Equipe/Enterprise depois.
                </p>
              </div>
            </div>

            <div className="plans-grid">
              <article className="plan-card" aria-label="Plano ZapVender Pro">
                <div>
                  <div className="plan-labels">
                    <span className="plan-chip is-highlight">Plano atual</span>
                    <span className="plan-chip">R$297/mês</span>
                  </div>

                  <h3 className="plan-title">ZapVender Pro</h3>
                  <p className="plan-description">
                    Plano principal para vender agora, com posicionamento simples e direto. Reúne os módulos centrais para captar, atender e acompanhar clientes pelo WhatsApp.
                  </p>

                  <ul className="plan-feature-grid">
                    {planFeatures.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className="plan-sidebar">
                  <div className="plan-sidebar-price">
                    <strong>{monthlyPrice}</strong>
                    <span>/mês</span>
                  </div>

                  <p className="plan-sidebar-meta">
                    Oferta única para simplificar a decisão de compra no início da operação comercial.
                  </p>

                  <Link to="/login" className="sales-btn sales-btn-primary">Começar com este plano</Link>
                  <Link to="/login" className="sales-btn sales-btn-outline">Entrar no painel</Link>
                </div>
              </article>
            </div>

            <section className="testimonials-section" aria-labelledby="titulo-depoimentos">
              <div className="section-head">
                <div>
                  <h2 className="section-title" id="titulo-depoimentos">Depoimentos (modelo comercial)</h2>
                  <p className="section-subtitle">
                    Bloco pronto para prova social. Substitua pelos relatos reais dos seus clientes quando quiser publicar.
                  </p>
                </div>
              </div>

              <div className="testimonial-grid">
                {testimonials.map((item) => (
                  <article className="testimonial-card" key={`${item.name}-${item.metric}`}>
                    <p className="testimonial-quote">{item.quote}</p>
                    <div className="testimonial-footer">
                      <div className="testimonial-name">{item.name}</div>
                      <div className="testimonial-role">{item.role}</div>
                      <span className="testimonial-metric">{item.metric}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="comparison-section" aria-labelledby="titulo-comparacao">
              <div className="section-head">
                <div>
                  <h2 className="section-title" id="titulo-comparacao">Comparacao de planos (roadmap)</h2>
                  <p className="section-subtitle">
                    Hoje voce vende 1 plano. A comparacao abaixo ja prepara o terreno para tiers futuros.
                  </p>
                </div>
              </div>

              <div className="roadmap-grid" aria-label="Roadmap de planos">
                {planRoadmap.map((plan) => (
                  <article className={`roadmap-card ${plan.badgeClass}`} key={plan.name}>
                    <div className="roadmap-top">
                      <h3 className="roadmap-name">{plan.name}</h3>
                      <span className={`status-badge ${plan.badgeClass}`}>{plan.status}</span>
                    </div>
                    <div className="roadmap-price">{plan.price}</div>
                    <p className="roadmap-desc">{plan.description}</p>
                  </article>
                ))}
              </div>

              <p className="comparison-note">
                Os itens abaixo sao um quadro comercial inicial para comunicacao de posicionamento. Ajuste conforme escopo real, SLA e limites que voce decidir.
              </p>

              <div className="comparison-table-wrap">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Recurso / escopo</th>
                      <th>Pro (atual)</th>
                      <th>Equipe (futuro)</th>
                      <th>Enterprise (futuro)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.feature}>
                        <td>{row.feature}</td>
                        <td>{row.pro}</td>
                        <td>{row.equipe}</td>
                        <td>{row.enterprise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="faq-grid" aria-label="Duvidas frequentes">
              {faqItems.map((item) => (
                <article className="faq-item" key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
            <div className="bottom-cta">
              <div>
                <h3 className="bottom-cta-title">Pronto para publicar e começar a vender</h3>
                <p className="bottom-cta-text">
                  Use esta rota como landing de venda agora e evolua depois com checkout, depoimentos e comparação de planos.
                </p>
              </div>
              <div className="sales-nav-actions">
                <Link to="/login" className="sales-btn sales-btn-outline">Entrar</Link>
                <Link to="/login" className="sales-btn sales-btn-primary">Quero assinar</Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
