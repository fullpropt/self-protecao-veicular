import {
    ONBOARDING_PRESENTATION_EVENT,
    disableOnboardingPresentationMode,
    enableOnboardingPresentationMode,
    getOnboardingPresentationAccountHealth,
    getOnboardingPresentationCustomEvents,
    getOnboardingPresentationDashboardLeads,
    getOnboardingPresentationDashboardSummary,
    getOnboardingPresentationReusableWhatsappSessionId,
    getOnboardingPresentationStatsSeries,
    isOnboardingPresentationModeEnabled,
    updateOnboardingPresentationStep
} from '../core/onboardingPresentation';

// Dashboard page logic migrated to module

// Dados dos leads
declare const Chart:
    | undefined
    | (new (ctx: HTMLCanvasElement | CanvasRenderingContext2D, config: Record<string, unknown>) => {
          destroy?: () => void;
      });

type LeadStatus = 1 | 2 | 3 | 4;

type Lead = {
    id: number;
    name?: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
    email?: string;
    tags?: unknown;
    last_message_at?: string | null;
    last_interaction_at?: string | null;
    status: LeadStatus;
    created_at: string;
};

type LeadsResponse = { leads?: Lead[]; total?: number };
type LeadSummaryResponse = {
    total?: number;
    by_status?: Record<string, unknown> | null;
    pending?: number;
    completed?: number;
};
type LeadSummary = {
    total: number;
    by_status: Record<LeadStatus, number>;
    pending: number;
    completed: number;
};
type AppError = Error & { code?: string };
type StatsMetric = 'novos_contatos' | 'mensagens' | 'interacoes';
type StatsChartType = 'line' | 'bar';
type StatsPeriodResponse = {
    labels?: string[];
    data?: number[];
};
type CustomEventsPeriod = 'this_month' | 'week' | 'year' | 'last_30_days';
type CustomEventItem = {
    id: number;
    name: string;
    event_key?: string;
    description?: string;
    is_active?: number;
    total_period?: number;
    total_triggers?: number;
    last_triggered_at?: string | null;
};
type CustomEventsStatsResponse = {
    events?: CustomEventItem[];
    totals?: {
        events?: number;
        activeEvents?: number;
        triggers?: number;
    };
    period?: string;
};
type AccountHealthRiskLevel = 'critical' | 'attention' | 'healthy' | 'paused';
type AccountHealthDispatch = {
    campaign_id?: number | null;
    campaign_name?: string | null;
    sent_today?: number;
    unique_leads_today?: number;
    replied_today?: number;
    response_rate?: number;
    first_sent_at?: string | null;
    last_sent_at?: string | null;
};
type AccountHealthAccount = {
    session_id?: string;
    session_name?: string | null;
    phone?: string | null;
    status?: string;
    status_label?: string;
    campaign_enabled?: boolean;
    daily_limit?: number;
    hourly_limit?: number;
    cooldown_until?: string | null;
    cooldown_active?: boolean;
    sent_today?: number;
    unique_leads_today?: number;
    replied_today?: number;
    response_rate?: number;
    sent_last_hour?: number;
    first_sent_at?: string | null;
    last_sent_at?: string | null;
    risk_level?: AccountHealthRiskLevel;
    risk_label?: string;
    risk_reason?: string;
    daily_usage_ratio?: number | null;
    hourly_usage_ratio?: number | null;
    possible_blocked_contacts?: number;
    dispatches?: AccountHealthDispatch[];
};
type AccountHealthSummary = {
    total_accounts?: number;
    critical?: number;
    attention?: number;
    healthy?: number;
    paused?: number;
    cooldown?: number;
};
type AccountHealthResponse = {
    summary?: AccountHealthSummary;
    accounts?: AccountHealthAccount[];
    generatedAt?: string;
    date?: string;
};
type OnboardingStepId =
    | 'connect_whatsapp'
    | 'configure_accounts'
    | 'open_inbox'
    | 'create_first_contact'
    | 'create_tags'
    | 'configure_dynamic_fields'
    | 'create_campaign'
    | 'create_automation';
type OnboardingState = {
    completedSteps: OnboardingStepId[];
    updatedAt: number;
};
type OnboardingVideosMap = Partial<Record<OnboardingStepId, string>>;
type OnboardingVideoProvider = 'file' | 'youtube' | 'vimeo' | 'external' | 'none';
type OnboardingVideoPresentation = {
    provider: OnboardingVideoProvider;
    sourceUrl: string;
    mediaUrl: string;
    embedUrl: string;
    videoId: string;
    posterUrl: string;
    posterFallbackUrl: string;
};
type OnboardingHighlightMarker = {
    at: number;
    selector: string;
    ambientSelector?: string;
    title: string;
    hint: string;
    route?: string;
    action?:
        | 'open_whatsapp_new_account_prompt'
        | 'confirm_whatsapp_new_account_prompt'
        | 'open_inbox_session_filter'
        | 'close_inbox_session_filter'
        | 'open_inbox_contact_info_panel'
        | 'set_dashboard_stats_metric_novos_contatos'
        | 'set_dashboard_stats_metric_mensagens'
        | 'set_dashboard_stats_metric_interacoes';
    clear?: boolean;
    radius?: number;
    scroll?: ScrollLogicalPosition;
};

let allLeads: Lead[] = [];
let selectedLeads: number[] = [];
let customEvents: CustomEventItem[] = [];
let dashboardLeadSummary: LeadSummary = {
    total: 0,
    by_status: { 1: 0, 2: 0, 3: 0, 4: 0 },
    pending: 0,
    completed: 0
};
let onboardingState: OnboardingState = {
    completedSteps: [],
    updatedAt: 0
};
let onboardingVideoUrls: OnboardingVideosMap = {};
let onboardingSelectedStepId: OnboardingStepId | null = null;
let onboardingPlayingStepId: OnboardingStepId | null = null;
let onboardingTourOpen = false;
let onboardingYouTubePlayer: {
    destroy?: () => void;
    playVideo?: () => void;
    pauseVideo?: () => void;
    stopVideo?: () => void;
    mute?: () => void;
    unMute?: () => void;
    isMuted?: () => boolean;
    seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
    getDuration?: () => number;
    getCurrentTime?: () => number;
    getPlayerState?: () => number;
    loadVideoById?: (videoId: string) => void;
} | null = null;
let onboardingYouTubeApiPromise: Promise<void> | null = null;
let onboardingYouTubePlayerReady = false;
let onboardingYouTubePlayerVideoId = '';
let onboardingVideoSyncTimer: number | null = null;
let onboardingVideoDurationSeconds = 0;
let onboardingVideoCurrentSeconds = 0;
let onboardingVideoMuted = false;
let onboardingVideoPlaybackState: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' = 'idle';
let onboardingPreparedSurfaceStepId: OnboardingStepId | null = null;
let onboardingPreparedMarkerActionKey = '';
let onboardingActiveSpotlightElement: HTMLElement | null = null;
let onboardingAmbientSpotlightElements: HTMLElement[] = [];
let onboardingActiveSpotlightSelector = '';
let onboardingActiveSpotlightMarkerKey = '';
let onboardingSpotlightRefreshTimer: number | null = null;
let onboardingSpotlightOverflowPatches: Array<{
    element: HTMLElement;
    overflow: string;
    overflowX: string;
    overflowY: string;
}> = [];
let onboardingPresentationDashboardBridgeBound = false;

let statsChartInstance: { destroy?: () => void } | null = null;
let statsChartType: StatsChartType = 'line';
let statsChartRequestSeq = 0;

function getErrorCode(error: unknown) {
    return String((error as AppError | null | undefined)?.code || '').trim().toUpperCase();
}

function showOnboardingPresentationReadOnlyToast(message = 'No tour, esta acao e apenas demonstrativa e nao altera seus dados reais.') {
    showToast('info', 'Tour guiado', message);
}

const STATS_METRIC_LABELS: Record<StatsMetric, string> = {
    novos_contatos: 'Novos Contatos',
    mensagens: 'Mensagens',
    interacoes: 'Interações'
};
const CUSTOM_EVENT_PERIODS: Record<string, CustomEventsPeriod> = {
    this_month: 'this_month',
    week: 'week',
    year: 'year',
    last_30_days: 'last_30_days'
};
const ONBOARDING_STEP_IDS: OnboardingStepId[] = [
    'connect_whatsapp',
    'configure_accounts',
    'open_inbox',
    'create_first_contact',
    'create_tags',
    'configure_dynamic_fields',
    'create_campaign',
    'create_automation'
];
const ONBOARDING_STEP_ROUTES: Record<OnboardingStepId, string> = {
    connect_whatsapp: '#/dashboard',
    configure_accounts: '#/configuracoes?panel=conexao',
    open_inbox: '#/configuracoes?panel=conexao',
    create_first_contact: '#/contatos',
    create_tags: '#/configuracoes?panel=labels',
    configure_dynamic_fields: '#/configuracoes?panel=contact-fields',
    create_campaign: '#/campanhas',
    create_automation: '#/automacao'
};
const ONBOARDING_STEP_HIGHLIGHTS: Record<OnboardingStepId, OnboardingHighlightMarker[]> = {
    connect_whatsapp: [
        { at: 11.0, selector: '[data-tour-target="dashboard-stats-metric-select"]', route: '#/dashboard', title: 'Veja o gráfico principal', hint: 'Aqui você acompanha o gráfico do período e o seletor de métricas como mensagens.', radius: 16 },
        { at: 16.0, selector: '[data-tour-target="dashboard-chart-bar-toggle"]', route: '#/dashboard', title: 'Alterne o tipo do gráfico', hint: 'Use este toggle para trocar a visualização entre linha e barra.', radius: 18, scroll: 'nearest' },
        { at: 20.0, selector: '[data-tour-target="dashboard-nav-whatsapp"]', route: '#/dashboard', title: 'Abra o WhatsApp', hint: 'Este atalho leva você para a área de conexão das contas.', radius: 18, scroll: 'nearest' },
        { at: 22.0, selector: '[data-tour-target="whatsapp-new-account-button"]', route: '#/whatsapp', title: 'Crie uma nova conta', hint: 'Este botão prepara uma nova sessão para conexão no sistema.', radius: 18 },
        { at: 24.0, selector: '[data-tour-target="app-prompt-modal"]', route: '#/whatsapp', action: 'open_whatsapp_new_account_prompt', title: 'Defina a nova conta', hint: 'O modal abre para escolher o identificador da nova conta WhatsApp.', radius: 22, scroll: 'center' },
        { at: 25.0, selector: '[data-tour-target="whatsapp-expanded-session"]', route: '#/whatsapp', action: 'confirm_whatsapp_new_account_prompt', title: 'A nova conta fica expandida', hint: 'Depois de criar a conta, ela já fica aberta para indicar a sessão que vai gerar o QR Code.', radius: 18, scroll: 'center' },
        { at: 26.2, selector: '[data-tour-target="whatsapp-connect-button"]', route: '#/whatsapp', title: 'Gere o QR Code', hint: 'Agora use este botão para iniciar a conexão e gerar o QR Code da conta criada.', radius: 18, scroll: 'center' },
        { at: 29.0, selector: '', route: '#/whatsapp', title: '', hint: '', clear: true },
        { at: 37.0, selector: '[data-tour-target="whatsapp-new-account-button"]', route: '#/whatsapp', title: 'Você pode repetir o processo', hint: 'Sempre que precisar adicionar outra conta, volte neste mesmo botão.', radius: 18 }
    ],
    configure_accounts: [
        { at: 1.0, selector: '[data-tour-target="settings-nav-conexao"]', title: 'Painel de contas', hint: 'Esta aba concentra as contas conectadas e o status de cada uma.', radius: 14 },
        { at: 5.0, selector: '[data-tour-target="settings-accounts-list"]', title: 'Contas disponíveis', hint: 'Revise aqui o nome, o estado e a disponibilidade das contas de envio.', radius: 22 },
        { at: 7.0, selector: '[data-tour-target="settings-account-1-name-field"]', title: 'Ajuste o nome da conta', hint: 'Aqui você define como a Conta 1 aparece no sistema.', radius: 12, scroll: 'center' },
        { at: 8.0, selector: '[data-tour-target="settings-account-1-weight-field"]', title: 'Controle o peso da Conta 1', hint: 'O peso influencia a distribuição de envios quando há mais de uma conta ativa.', radius: 12, scroll: 'center' },
        { at: 11.0, selector: '[data-tour-target="settings-account-1-daily-limit-field"]', title: 'Defina o limite diário', hint: 'Esse campo controla quantos envios a Conta 1 pode fazer por dia.', radius: 12, scroll: 'center' },
        { at: 14.0, selector: '[data-tour-target="settings-account-1-campaign-toggle"]', title: 'Ative o uso em campanhas', hint: 'Essa opção controla se a Conta 1 participa das campanhas e transmissões.', radius: 12, scroll: 'center' },
        { at: 18.0, selector: '[data-tour-target="settings-account-1-save-button"]', title: 'Salve a configuração', hint: 'Depois de revisar os campos, use este botão para salvar as mudanças da Conta 1.', radius: 12, scroll: 'center' }
    ],
    open_inbox: [
        { at: 3.0, selector: '[data-tour-target="settings-nav-inbox"]', route: '#/configuracoes?panel=conexao', title: 'Abra o Inbox', hint: 'Use o menu lateral para sair das contas e entrar na central de atendimento.', radius: 16, scroll: 'nearest' },
        { at: 5.0, selector: '', route: '#/inbox', title: '', hint: '', clear: true },
        { at: 6.0, selector: '[data-tour-target="inbox-conversations-column"]', route: '#/inbox', title: 'Veja a coluna de conversas', hint: 'Aqui ficam as conversas em andamento e os leads aguardando atendimento.', radius: 20, scroll: 'center' },
        { at: 8.0, selector: '[data-tour-target="inbox-session-indicator"]', route: '#/inbox', action: 'open_inbox_session_filter', title: 'Filtre por conta', hint: 'Abra esta lista para escolher qual conta o Inbox deve exibir.', radius: 18, scroll: 'nearest' },
        { at: 10.0, selector: '[data-tour-target="inbox-conversation-account-tag"]', route: '#/inbox', action: 'close_inbox_session_filter', title: 'Veja as tags das contas', hint: 'Essas etiquetas mostram rapidamente de qual conta cada conversa veio.', radius: 14, scroll: 'center' },
        { at: 16.0, selector: '[data-tour-target="inbox-contact-info-button"]', route: '#/inbox', title: 'Abra as informações do contato', hint: 'Esse botão revela o painel lateral com os dados do lead em atendimento.', radius: 16, scroll: 'nearest' },
        { at: 17.0, selector: '[data-tour-target="inbox-contact-info-panel"]', route: '#/inbox', action: 'open_inbox_contact_info_panel', title: 'Consulte os dados do contato', hint: 'Com o painel aberto, você visualiza os dados do lead sem sair da conversa.', radius: 18, scroll: 'nearest' }
    ],
    create_first_contact: [
        { at: 1.2, selector: '[data-tour-target="contacts-new-button"]', title: 'Crie um novo contato', hint: 'O cadastro começa por este botão na tela de contatos.', radius: 18 },
        { at: 5.0, selector: '[data-tour-target="contacts-name-field"]', title: 'Preencha o nome', hint: 'O nome do contato é o primeiro campo do cadastro.', radius: 14 },
        { at: 8.4, selector: '[data-tour-target="contacts-phone-field"]', title: 'Informe o WhatsApp', hint: 'Digite o número com DDD para o contato já nascer pronto para atendimento.', radius: 14 }
    ],
    create_tags: [
        { at: 1.0, selector: '[data-tour-target="settings-nav-labels"]', title: 'Abra Tags', hint: 'Esta aba reúne todas as etiquetas usadas em contatos e campanhas.', radius: 14 },
        { at: 4.5, selector: '[data-tour-target="settings-tag-name-field"]', title: 'Cadastre uma nova tag', hint: 'Preencha o nome da etiqueta por aqui.', radius: 14 },
        { at: 8.2, selector: '[data-tour-target="settings-tags-table"]', title: 'Gerencie as etiquetas', hint: 'As tags criadas aparecem nesta lista para edição e organização.', radius: 20 }
    ],
    configure_dynamic_fields: [
        { at: 1.0, selector: '[data-tour-target="settings-nav-contact-fields"]', title: 'Abra Campos Dinâmicos', hint: 'Esta área guarda os campos personalizados usados em contatos, mensagens e fluxos.', radius: 14 },
        { at: 4.5, selector: '[data-tour-target="settings-contact-field-name"]', title: 'Crie um campo personalizado', hint: 'Defina aqui o nome do novo campo dinâmico.', radius: 14 },
        { at: 8.4, selector: '[data-tour-target="settings-contact-fields-table"]', title: 'Revise os campos criados', hint: 'A lista abaixo mostra todas as variáveis disponíveis no sistema.', radius: 20 }
    ],
    create_campaign: [
        { at: 1.2, selector: '[data-tour-target="campaign-new-button"]', title: 'Abra a criação de campanha', hint: 'Este botão inicia uma nova campanha no sistema.', radius: 18 },
        { at: 5.0, selector: '[data-tour-target="campaign-name-field"]', title: 'Nome da campanha', hint: 'Dê um nome claro para identificar a campanha depois.', radius: 14 },
        { at: 9.6, selector: '[data-tour-target="campaign-message-tags-button"]', title: 'Insira tags dinâmicas', hint: 'Use este botão para personalizar a mensagem com variáveis do contato.', radius: 16 },
        { at: 14.2, selector: '[data-tour-target="campaign-variation-button"]', title: 'Crie variações', hint: 'As variações ajudam a distribuir textos diferentes dentro da mesma campanha.', radius: 18 }
    ],
    create_automation: [
        { at: 1.2, selector: '[data-tour-target="automation-new-button"]', title: 'Nova automação', hint: 'É por aqui que você cria uma regra automatizada nova.', radius: 18 },
        { at: 5.0, selector: '[data-tour-target="automation-name-field"]', title: 'Nome da automação', hint: 'Dê um nome fácil de reconhecer para a regra.', radius: 14 },
        { at: 9.0, selector: '[data-tour-target="automation-trigger-select"]', title: 'Escolha o gatilho', hint: 'Selecione quando a automação deve ser executada.', radius: 14 },
        { at: 13.2, selector: '[data-tour-target="automation-action-select"]', title: 'Defina a ação', hint: 'Aqui você escolhe o que a automação vai fazer.', radius: 14 }
    ]
};
const ONBOARDING_STEP_LABELS: Record<OnboardingStepId, string> = {
    connect_whatsapp: 'Conecte seu WhatsApp',
    configure_accounts: 'Revise suas contas',
    open_inbox: 'Abra o Inbox',
    create_first_contact: 'Cadastre um contato',
    create_tags: 'Crie tags',
    configure_dynamic_fields: 'Configure campos dinâmicos',
    create_campaign: 'Monte uma campanha',
    create_automation: 'Publique uma automação'
};
const ONBOARDING_STEP_ACTION_LABELS: Record<OnboardingStepId, string> = {
    connect_whatsapp: 'Conectar agora',
    configure_accounts: 'Abrir contas',
    open_inbox: 'Abrir inbox',
    create_first_contact: 'Abrir contatos',
    create_tags: 'Abrir tags',
    configure_dynamic_fields: 'Abrir campos',
    create_campaign: 'Abrir campanhas',
    create_automation: 'Abrir automaÃ§Ãµes'
};
const ONBOARDING_STEP_VIDEO_DESCRIPTIONS: Record<OnboardingStepId, string> = {
    connect_whatsapp: 'Passo a passo para conectar a primeira sessão do WhatsApp no ZapVender.',
    configure_accounts: 'Veja como revisar as contas em Configurações e deixar o ambiente pronto para operar.',
    open_inbox: 'Aprenda a abrir o Inbox e validar o atendimento com uma conversa de teste.',
    create_first_contact: 'Cadastre um contato de exemplo para testar o fluxo completo da operação.',
    create_tags: 'Crie etiquetas para organizar contatos, campanhas e automações.',
    configure_dynamic_fields: 'Configure campos personalizados que viram variáveis em mensagens, campanhas e fluxos.',
    create_campaign: 'Monte sua primeira campanha e entenda onde revisar métricas e resultados.',
    create_automation: 'Publique sua primeira automação e valide o disparo com segurança.'
};
const ONBOARDING_STEP_VIDEO_URLS: Record<OnboardingStepId, string> = {
    connect_whatsapp: 'https://cdn.zapvender.com/ZV%20-%2001%20Conectar%20Whatsapp%20(Primeiros%20Passos).mp4',
    configure_accounts: 'https://cdn.zapvender.com/ZV%20-%2002%20Contas%20(Primeiros%20Passos).mp4',
    open_inbox: 'https://cdn.zapvender.com/ZV%20-%2003%20Inbox%20(Primeiros%20Passos).mp4',
    create_first_contact: 'https://cdn.zapvender.com/ZV%20-%2004%20Contatos%20(Primeiros%20Passos).mp4',
    create_tags: 'https://cdn.zapvender.com/ZV%20-%2005%20Tags%20(Primeiros%20Passos).mp4',
    configure_dynamic_fields: 'https://cdn.zapvender.com/ZV%20-%2006%20Campos%20Din%C3%A2micos%20(Primeiros%20Passos).mp4',
    create_campaign: 'https://cdn.zapvender.com/ZV%20-%2007%20Campanhas%20(Primeiros%20Passos).mp4',
    create_automation: 'https://cdn.zapvender.com/ZV%20-%2008%20Automa%C3%A7%C3%B5es%20(Primeiros%20Passos).mp4'
};
const ONBOARDING_STEP_LABELS_UI: Record<OnboardingStepId, string> = {
    connect_whatsapp: 'Conecte seu WhatsApp',
    configure_accounts: 'Revise suas contas',
    open_inbox: 'Abra o Inbox',
    create_first_contact: 'Cadastre um contato',
    create_tags: 'Crie tags',
    configure_dynamic_fields: 'Configure campos din\u00E2micos',
    create_campaign: 'Monte uma campanha',
    create_automation: 'Publique uma automa\u00E7\u00E3o'
};
const ONBOARDING_STEP_ACTION_LABELS_UI: Record<OnboardingStepId, string> = {
    connect_whatsapp: 'Conectar agora',
    configure_accounts: 'Abrir contas',
    open_inbox: 'Abrir inbox',
    create_first_contact: 'Abrir contatos',
    create_tags: 'Abrir tags',
    configure_dynamic_fields: 'Abrir campos',
    create_campaign: 'Abrir campanhas',
    create_automation: 'Abrir automa\u00E7\u00F5es'
};
const ONBOARDING_STEP_VIDEO_DESCRIPTIONS_UI: Record<OnboardingStepId, string> = {
    connect_whatsapp: 'Passo a passo para conectar a primeira sess\u00E3o do WhatsApp no ZapVender.',
    configure_accounts: 'Veja como revisar as contas em Configura\u00E7\u00F5es e deixar o ambiente pronto para operar.',
    open_inbox: 'Aprenda a abrir o Inbox e validar o atendimento com uma conversa de teste.',
    create_first_contact: 'Cadastre um contato de exemplo para testar o fluxo completo da opera\u00E7\u00E3o.',
    create_tags: 'Crie etiquetas para organizar contatos, campanhas e automa\u00E7\u00F5es.',
    configure_dynamic_fields: 'Configure campos personalizados que viram vari\u00E1veis em mensagens, campanhas e fluxos.',
    create_campaign: 'Monte sua primeira campanha e entenda onde revisar m\u00E9tricas e resultados.',
    create_automation: 'Publique sua primeira automa\u00E7\u00E3o e valide o disparo com seguran\u00E7a.'
};
const DASHBOARD_ONBOARDING_STORAGE_KEY_PREFIX = 'zapvender_dashboard_onboarding_v1:';
const ONBOARDING_YOUTUBE_PLAYER_STATE = {
    ended: 0,
    playing: 1,
    paused: 2,
    buffering: 3
} as const;

function appConfirm(message: string, title = 'Confirmacao') {
    const win = window as Window & { showAppConfirm?: (message: string, title?: string) => Promise<boolean> };
    if (typeof win.showAppConfirm === 'function') {
        return win.showAppConfirm(message, title);
    }
    return Promise.resolve(window.confirm(message));
}
const DASHBOARD_TABLE_FETCH_LIMIT = 100;
const DASHBOARD_SUMMARY_CACHE_TTL_MS = 60 * 1000;

function escapeHtml(value: string) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toNonNegativeInt(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
}

function buildDefaultLeadSummary(): LeadSummary {
    return {
        total: 0,
        by_status: { 1: 0, 2: 0, 3: 0, 4: 0 },
        pending: 0,
        completed: 0
    };
}

function normalizeLeadSummaryResponse(response: LeadSummaryResponse | null | undefined): LeadSummary {
    const fallback = buildDefaultLeadSummary();
    const sourceByStatus = response?.by_status && typeof response.by_status === 'object'
        ? response.by_status
        : {};
    const stage1 = toNonNegativeInt((sourceByStatus as Record<string, unknown>)['1']);
    const stage2 = toNonNegativeInt((sourceByStatus as Record<string, unknown>)['2']);
    const stage3 = toNonNegativeInt((sourceByStatus as Record<string, unknown>)['3']);
    const stage4 = toNonNegativeInt((sourceByStatus as Record<string, unknown>)['4']);
    const derivedTotal = stage1 + stage2 + stage3 + stage4;
    const total = toNonNegativeInt(response?.total);
    const pending = toNonNegativeInt(response?.pending);
    const completed = toNonNegativeInt(response?.completed);

    return {
        ...fallback,
        total: total || derivedTotal,
        by_status: { 1: stage1, 2: stage2, 3: stage3, 4: stage4 },
        pending: pending || (stage1 + stage2),
        completed: completed || stage3
    };
}

function getDashboardSummaryCacheKey() {
    const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
    const tokenSuffix = token ? token.slice(-12) : 'anon';
    return `zapvender_dashboard_summary_v1:${tokenSuffix}`;
}

function readDashboardSummaryCache() {
    try {
        const raw = sessionStorage.getItem(getDashboardSummaryCacheKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; summary?: LeadSummaryResponse };
        const savedAt = Number(parsed?.savedAt || 0);
        if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
        if (Date.now() - savedAt > DASHBOARD_SUMMARY_CACHE_TTL_MS) return null;
        return normalizeLeadSummaryResponse(parsed.summary);
    } catch (_) {
        return null;
    }
}

function writeDashboardSummaryCache(summary: LeadSummary) {
    try {
        sessionStorage.setItem(
            getDashboardSummaryCacheKey(),
            JSON.stringify({
                savedAt: Date.now(),
                summary
            })
        );
    } catch (_) {
        // ignore storage failure
    }
}

function getDashboardOnboardingStorageKey() {
    const userId = String(sessionStorage.getItem('selfDashboardUserId') || '').trim();
    if (userId) return `${DASHBOARD_ONBOARDING_STORAGE_KEY_PREFIX}user:${userId}`;

    const email = String(sessionStorage.getItem('selfDashboardUserEmail') || '').trim().toLowerCase();
    if (email) return `${DASHBOARD_ONBOARDING_STORAGE_KEY_PREFIX}email:${email}`;

    const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
    const suffix = token ? token.slice(-14) : 'anon';
    return `${DASHBOARD_ONBOARDING_STORAGE_KEY_PREFIX}token:${suffix}`;
}

function normalizeOnboardingStepId(value: unknown): OnboardingStepId | null {
    const normalized = String(value || '').trim() as OnboardingStepId;
    return ONBOARDING_STEP_IDS.includes(normalized) ? normalized : null;
}

function normalizeOnboardingState(value: unknown): OnboardingState {
    const source = value && typeof value === 'object' ? (value as { completedSteps?: unknown; updatedAt?: unknown }) : {};
    const completedRaw = Array.isArray(source.completedSteps) ? source.completedSteps : [];
    const completedSteps = completedRaw
        .map((item) => normalizeOnboardingStepId(item))
        .filter((stepId): stepId is OnboardingStepId => Boolean(stepId));
    const uniqueSteps = ONBOARDING_STEP_IDS.filter((stepId) => completedSteps.includes(stepId));
    const updatedAt = Number(source.updatedAt || 0);
    return {
        completedSteps: uniqueSteps,
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.floor(updatedAt) : 0
    };
}

function readOnboardingState(): OnboardingState {
    try {
        const raw = localStorage.getItem(getDashboardOnboardingStorageKey());
        if (!raw) return { completedSteps: [], updatedAt: 0 };
        return normalizeOnboardingState(JSON.parse(raw));
    } catch (_) {
        return { completedSteps: [], updatedAt: 0 };
    }
}

function writeOnboardingState(state: OnboardingState) {
    try {
        localStorage.setItem(getDashboardOnboardingStorageKey(), JSON.stringify(state));
    } catch (_) {
        // ignore storage failure
    }
}

function isOnboardingStepCompleted(stepId: OnboardingStepId) {
    return onboardingState.completedSteps.includes(stepId);
}

function getPreferredOnboardingSelectedStepId() {
    return ONBOARDING_STEP_IDS.find((stepId) => !isOnboardingStepCompleted(stepId))
        || ONBOARDING_STEP_IDS[0]
        || null;
}

function getSelectedOnboardingStepId() {
    const selectedStepId = onboardingSelectedStepId && ONBOARDING_STEP_IDS.includes(onboardingSelectedStepId)
        ? onboardingSelectedStepId
        : getPreferredOnboardingSelectedStepId();
    onboardingSelectedStepId = selectedStepId;
    return selectedStepId;
}

function getOnboardingStepIndex(stepIdInput: string | OnboardingStepId | null | undefined) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    return stepId ? ONBOARDING_STEP_IDS.indexOf(stepId) : -1;
}

function getAdjacentOnboardingStepId(stepIdInput: string | OnboardingStepId | null | undefined, direction: -1 | 1) {
    const currentIndex = getOnboardingStepIndex(stepIdInput);
    if (currentIndex < 0) return null;
    return ONBOARDING_STEP_IDS[currentIndex + direction] || null;
}

function markOnboardingStepCompleted(stepIdInput: string | OnboardingStepId | null | undefined) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (!stepId || isOnboardingStepCompleted(stepId)) return;

    const nextCompleted = new Set(onboardingState.completedSteps);
    nextCompleted.add(stepId);
    onboardingState = {
        completedSteps: ONBOARDING_STEP_IDS.filter((id) => nextCompleted.has(id)),
        updatedAt: Date.now()
    };
    writeOnboardingState(onboardingState);
    renderOnboardingChecklist();
}

function renderOnboardingTourLauncher() {
    const totalSteps = ONBOARDING_STEP_IDS.length;
    const completedCount = onboardingState.completedSteps.length;
    const completedBadge = document.getElementById('onboardingCompletedBadge') as HTMLElement | null;
    const currentStep = document.getElementById('onboardingTourCurrentStep') as HTMLElement | null;
    const startButtonLabel = document.getElementById('onboardingTourStartButtonLabel') as HTMLElement | null;

    if (completedBadge) {
        completedBadge.style.display = completedCount === totalSteps && totalSteps > 0 ? 'inline-flex' : 'none';
    }
    if (currentStep) {
        currentStep.textContent = 'Inicie o tour e acompanhe cada etapa sem sair da tela.';
    }
    if (startButtonLabel) {
        startButtonLabel.textContent = onboardingTourOpen
            ? 'Continuar tour'
            : (completedCount === 0
                ? 'Iniciar tour'
                : (completedCount === totalSteps ? 'Rever tour' : 'Continuar tour'));
    }
}

function bindOnboardingTourControls() {
    const bindClick = (id: string, handler: () => void) => {
        const button = document.getElementById(id) as HTMLButtonElement | null;
        if (!button || button.dataset.bound === '1') return;

        button.addEventListener('click', (event) => {
            event.preventDefault();
            handler();
        });
        button.dataset.bound = '1';
    };

    bindClick('onboardingTourCloseButton', closeOnboardingTour);
    bindClick('onboardingTourPrevButton', goToPreviousOnboardingTourStep);
    bindClick('onboardingTourNextButton', goToNextOnboardingTourStep);
    bindClick('onboardingVideoToggleButton', toggleOnboardingVideoPlayback);
    bindClick('onboardingVideoMuteButton', toggleOnboardingVideoMute);
    bindClick('onboardingVideoReplayButton', restartOnboardingVideo);
    bindClick('onboardingVideoPrevButton', goToPreviousOnboardingTourStep);
    bindClick('onboardingVideoNextButton', goToNextOnboardingTourStep);

    const progress = document.getElementById('onboardingVideoProgress') as HTMLInputElement | null;
    if (progress && progress.dataset.bound !== '1') {
        progress.addEventListener('input', () => {
            seekOnboardingVideo(Number(progress.value));
        });
        progress.dataset.bound = '1';
    }

    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (video && video.dataset.bound !== '1') {
        const syncFromVideo = () => {
            onboardingVideoDurationSeconds = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
            onboardingVideoCurrentSeconds = Number.isFinite(video.currentTime) ? Math.max(0, video.currentTime) : 0;
            onboardingVideoMuted = video.muted || video.volume === 0;
        };

        video.addEventListener('loadedmetadata', () => {
            syncFromVideo();
            renderOnboardingVideoControls();
            scheduleOnboardingSpotlightRefresh(90);
        });

        video.addEventListener('canplay', () => {
            syncFromVideo();
            if (onboardingVideoPlaybackState === 'loading') {
                onboardingVideoPlaybackState = video.paused ? 'paused' : 'playing';
            }
            renderOnboardingVideoControls();
            scheduleOnboardingSpotlightRefresh(90);
        });

        video.addEventListener('play', () => {
            syncFromVideo();
            onboardingVideoPlaybackState = 'playing';
            renderOnboardingVideo();
            renderOnboardingVideoControls();
            scheduleOnboardingSpotlightRefresh(90);
        });

        video.addEventListener('playing', () => {
            syncFromVideo();
            onboardingVideoPlaybackState = 'playing';
            renderOnboardingVideo();
            renderOnboardingVideoControls();
            scheduleOnboardingSpotlightRefresh(90);
        });

        video.addEventListener('pause', () => {
            syncFromVideo();
            if (video.ended || (video.duration > 0 && video.currentTime >= video.duration)) {
                onboardingVideoPlaybackState = 'ended';
            } else if (onboardingVideoPlaybackState !== 'loading') {
                onboardingVideoPlaybackState = 'paused';
            }
            renderOnboardingVideoControls();
            scheduleOnboardingSpotlightRefresh(90);
        });

        video.addEventListener('waiting', () => {
            syncFromVideo();
            onboardingVideoPlaybackState = 'loading';
            renderOnboardingVideoControls();
            scheduleOnboardingSpotlightRefresh(90);
        });

        video.addEventListener('timeupdate', () => {
            syncFromVideo();
            renderOnboardingVideoControls();
            refreshOnboardingTourSurface();
        });

        video.addEventListener('volumechange', () => {
            syncFromVideo();
            renderOnboardingVideoControls();
        });

        video.addEventListener('ended', () => {
            syncFromVideo();
            onboardingVideoPlaybackState = 'ended';
            markOnboardingStepCompleted(onboardingPlayingStepId || onboardingSelectedStepId);
            renderOnboardingVideo();
            renderOnboardingVideoControls();
            scheduleOnboardingSpotlightRefresh(90);
        });

        video.dataset.bound = '1';
    }

    const body = document.body as HTMLBodyElement | null;
    if (body && body.dataset.onboardingSpotlightBound !== '1') {
        const refresh = () => {
            if (!onboardingTourOpen) return;
            refreshOnboardingTourSurface();
        };
        window.addEventListener('resize', refresh);
        window.addEventListener('scroll', refresh, { passive: true });
        window.addEventListener('hashchange', () => {
            onboardingPreparedSurfaceStepId = null;
            scheduleOnboardingSpotlightRefresh(260);
        });
        body.dataset.onboardingSpotlightBound = '1';
    }
}

function renderOnboardingChecklist() {
    getSelectedOnboardingStepId();
    renderOnboardingTourLauncher();
}

function renderOnboardingChecklistLegacy() {
    const selectedStepId = getSelectedOnboardingStepId();
    const totalSteps = ONBOARDING_STEP_IDS.length;
    const completedCount = onboardingState.completedSteps.length;
    const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
    const progressText = null as HTMLElement | null;
    const progressFill = null as HTMLElement | null;
    const completedBadge = null as HTMLElement | null;

    ONBOARDING_STEP_IDS.forEach((stepId) => {
        const checked = isOnboardingStepCompleted(stepId);

        const input = document.getElementById(`onboarding-step-${stepId}`) as HTMLInputElement | null;
        if (input) input.checked = checked;

        const row = document.getElementById(`onboarding-row-${stepId}`) as HTMLElement | null;
        row?.classList.toggle('is-complete', checked);
        row?.classList.toggle('is-active', selectedStepId === stepId);
    });


    if (progressText) {
        progressText.textContent = `${completedCount}/${totalSteps} etapas concluídas`;
    }
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    if (completedBadge) {
        completedBadge.style.display = completedCount === totalSteps && totalSteps > 0 ? 'inline-flex' : 'none';
    }

    renderOnboardingTourLauncher();
}

function selectOnboardingVideoStep(stepIdInput: string) {
    const stepId = normalizeOnboardingStepId(stepIdInput) || getPreferredOnboardingSelectedStepId();
    if (!stepId) return;

    onboardingSelectedStepId = stepId;
    if (!onboardingTourOpen) {
        onboardingPlayingStepId = null;
    }
    renderOnboardingChecklist();
    renderOnboardingVideo();

    if (onboardingTourOpen) {
        startOnboardingTour(stepId);
    }
}

function toggleOnboardingStep(stepIdInput: string, checked?: boolean) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (!stepId) return;

    const shouldCheck = typeof checked === 'boolean' ? checked : !isOnboardingStepCompleted(stepId);
    const nextCompleted = new Set(onboardingState.completedSteps);
    if (shouldCheck) {
        nextCompleted.add(stepId);
    } else {
        nextCompleted.delete(stepId);
    }

    onboardingState = {
        completedSteps: ONBOARDING_STEP_IDS.filter((id) => nextCompleted.has(id)),
        updatedAt: Date.now()
    };
    writeOnboardingState(onboardingState);
    renderOnboardingChecklist();
    renderOnboardingVideo();
}

function resetOnboardingChecklist() {
    disableOnboardingPresentationMode();
    onboardingState = {
        completedSteps: [],
        updatedAt: Date.now()
    };
    destroyOnboardingYouTubePlayer();
    onboardingTourOpen = false;
    onboardingPlayingStepId = null;
    onboardingSelectedStepId = getPreferredOnboardingSelectedStepId();
    onboardingPreparedSurfaceStepId = null;
    onboardingPreparedMarkerActionKey = '';
    writeOnboardingState(onboardingState);
    renderOnboardingChecklist();
    renderOnboardingVideo();
    clearOnboardingSpotlight();
}

function resetOnboardingTourState() {
    disableOnboardingPresentationMode();
    destroyOnboardingYouTubePlayer();
    onboardingTourOpen = false;
    onboardingPlayingStepId = null;
    onboardingSelectedStepId = ONBOARDING_STEP_IDS[0] || null;
    onboardingPreparedSurfaceStepId = null;
    onboardingPreparedMarkerActionKey = '';
    renderOnboardingChecklist();
    renderOnboardingVideo();
    clearOnboardingSpotlight();
}

function startOnboardingTour(stepIdInput?: string) {
    const stepId = normalizeOnboardingStepId(stepIdInput)
        || normalizeOnboardingStepId(onboardingSelectedStepId)
        || getPreferredOnboardingSelectedStepId();
    if (!stepId) return;

    if (!onboardingTourOpen) {
        enableOnboardingPresentationMode(stepId);
    } else {
        updateOnboardingPresentationStep(stepId);
    }

    const hasRouteChanged = ensureOnboardingStepRoute(stepId);
    onboardingSelectedStepId = stepId;
    onboardingPlayingStepId = stepId;
    onboardingTourOpen = true;
    onboardingPreparedSurfaceStepId = null;
    onboardingPreparedMarkerActionKey = '';

    const presentation = buildOnboardingVideoPresentation(onboardingVideoUrls[stepId] || '');

    renderOnboardingChecklist();
    renderOnboardingVideo();
    scheduleOnboardingSpotlightRefresh(hasRouteChanged ? 380 : 180);

    if (!presentation.mediaUrl) {
        renderOnboardingVideoControls(presentation);
        return;
    }

    void ensureOnboardingYouTubePlayback(presentation.mediaUrl);
    renderOnboardingVideoControls(presentation);
}

function closeOnboardingTour() {
    disableOnboardingPresentationMode();
    onboardingTourOpen = false;
    onboardingPreparedSurfaceStepId = null;
    onboardingPreparedMarkerActionKey = '';
    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (video) {
        try {
            video.pause();
        } catch (_) {
            // no-op
        }
    }

    stopOnboardingVideoSyncTimer();
    if (onboardingVideoPlaybackState === 'playing' || onboardingVideoPlaybackState === 'loading') {
        onboardingVideoPlaybackState = 'paused';
    }

    renderOnboardingChecklist();
    renderOnboardingVideo();
    stopOnboardingSpotlightRefreshTimer();
    clearOnboardingSpotlight();
}

function goToPreviousOnboardingTourStep() {
    const previousStepId = getAdjacentOnboardingStepId(getSelectedOnboardingStepId(), -1);
    if (!previousStepId) return;
    startOnboardingTour(previousStepId);
}

function goToNextOnboardingTourStep() {
    const nextStepId = getAdjacentOnboardingStepId(getSelectedOnboardingStepId(), 1);
    if (!nextStepId) {
        closeOnboardingTour();
        return;
    }
    startOnboardingTour(nextStepId);
}

function goToOnboardingStep(stepIdInput: string) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (!stepId) return;
    const route = ONBOARDING_STEP_ROUTES[stepId];
    if (!route) return;
    window.location.hash = route;
}

function normalizeAbsoluteHttpUrl(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location.origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
        return parsed.toString();
    } catch (_) {
        return '';
    }
}

function formatOnboardingVideoTime(totalSeconds: number) {
    const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getCurrentHashRoute() {
    const rawHash = String(window.location.hash || '#/dashboard').trim();
    if (!rawHash) return '/dashboard';
    return rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
}

function getCurrentHashPath() {
    return String(getCurrentHashRoute().split('?')[0] || '/dashboard').trim() || '/dashboard';
}

function normalizeOnboardingRoute(routeInput: unknown) {
    const route = String(routeInput || '').trim();
    if (!route) return '';
    return route.startsWith('#') ? route : `#${route}`;
}

function isOnboardingRouteActive(routeInput: unknown) {
    const route = normalizeOnboardingRoute(routeInput);
    if (!route) return false;
    const routePath = route.slice(1).split('?')[0];
    return getCurrentHashPath() === routePath;
}

function ensureOnboardingRoute(routeInput: unknown) {
    const route = normalizeOnboardingRoute(routeInput);
    if (!route) return false;
    if (String(window.location.hash || '').trim() === route) return false;
    window.location.hash = route;
    return true;
}

function isOnboardingStepRouteActive(stepIdInput: string | OnboardingStepId | null | undefined) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (!stepId) return false;
    return isOnboardingRouteActive(ONBOARDING_STEP_ROUTES[stepId]);
}

function ensureOnboardingStepRoute(stepIdInput: string | OnboardingStepId | null | undefined) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (!stepId) return false;
    return ensureOnboardingRoute(ONBOARDING_STEP_ROUTES[stepId]);
}

function resolveOnboardingHighlightRoute(
    stepIdInput: string | OnboardingStepId | null | undefined,
    marker: OnboardingHighlightMarker | null
) {
    const markerRoute = normalizeOnboardingRoute(marker?.route);
    if (markerRoute) return markerRoute;
    const stepId = normalizeOnboardingStepId(stepIdInput);
    return stepId ? normalizeOnboardingRoute(ONBOARDING_STEP_ROUTES[stepId]) : '';
}

function stopOnboardingSpotlightRefreshTimer() {
    if (onboardingSpotlightRefreshTimer !== null) {
        window.clearTimeout(onboardingSpotlightRefreshTimer);
        onboardingSpotlightRefreshTimer = null;
    }
}

function scheduleOnboardingSpotlightRefresh(delayMs = 120) {
    stopOnboardingSpotlightRefreshTimer();
    onboardingSpotlightRefreshTimer = window.setTimeout(() => {
        onboardingSpotlightRefreshTimer = null;
        refreshOnboardingTourSurface();
    }, Math.max(0, delayMs));
}

function clearOnboardingSpotlight() {
    if (onboardingActiveSpotlightElement) {
        onboardingActiveSpotlightElement.classList.remove('onboarding-tour-target-active');
        onboardingActiveSpotlightElement.classList.remove('onboarding-tour-target-active-soft');
        onboardingActiveSpotlightElement.style.removeProperty('--onboarding-tour-radius');
    }

    if (onboardingAmbientSpotlightElements.length > 0) {
        onboardingAmbientSpotlightElements.forEach((element) => {
            element.classList.remove('onboarding-tour-target-ambient');
            element.style.removeProperty('--onboarding-tour-radius');
        });
    }

    if (onboardingSpotlightOverflowPatches.length > 0) {
        onboardingSpotlightOverflowPatches.forEach((patch) => {
            patch.element.style.overflow = patch.overflow;
            patch.element.style.overflowX = patch.overflowX;
            patch.element.style.overflowY = patch.overflowY;
        });
        onboardingSpotlightOverflowPatches = [];
    }

    onboardingActiveSpotlightElement = null;
    onboardingAmbientSpotlightElements = [];
    onboardingActiveSpotlightSelector = '';
    onboardingActiveSpotlightMarkerKey = '';

    const card = document.getElementById('onboardingSpotlightCard') as HTMLElement | null;
    if (card) {
        card.classList.remove('is-visible');
        card.style.removeProperty('top');
        card.style.removeProperty('left');
    }
}

function ensureOnboardingSpotlightOverflowVisible(targets: HTMLElement[]) {
    if (onboardingSpotlightOverflowPatches.length > 0) {
        onboardingSpotlightOverflowPatches.forEach((patch) => {
            patch.element.style.overflow = patch.overflow;
            patch.element.style.overflowX = patch.overflowX;
            patch.element.style.overflowY = patch.overflowY;
        });
        onboardingSpotlightOverflowPatches = [];
    }

    const seen = new Set<HTMLElement>();
    for (const target of targets) {
        let current = target.parentElement as HTMLElement | null;
        while (current && current !== document.body && current !== document.documentElement) {
            if (seen.has(current)) {
                current = current.parentElement as HTMLElement | null;
                continue;
            }

            seen.add(current);
            const computed = window.getComputedStyle(current);
            const overflowValues = [computed.overflow, computed.overflowX, computed.overflowY];
            const shouldPatch = overflowValues.some((value) => ['hidden', 'clip', 'auto', 'scroll'].includes(String(value || '').trim().toLowerCase()));

            if (shouldPatch) {
                onboardingSpotlightOverflowPatches.push({
                    element: current,
                    overflow: current.style.overflow,
                    overflowX: current.style.overflowX,
                    overflowY: current.style.overflowY
                });
                current.style.overflow = 'visible';
                current.style.overflowX = 'visible';
                current.style.overflowY = 'visible';
            }

            current = current.parentElement as HTMLElement | null;
        }
    }
}

function resolveOnboardingSpotlightTarget(
    stepIdInput: string | OnboardingStepId | null | undefined,
    marker: OnboardingHighlightMarker
) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    const directTarget = document.querySelector(marker.selector) as HTMLElement | null;
    if (!directTarget) return null;

    if (stepId === 'connect_whatsapp' && marker.selector === '[data-tour-target="dashboard-chart-bar-toggle"]') {
        return (directTarget.closest('[data-tour-target="dashboard-chart-type-toggle"]') as HTMLElement | null) || directTarget;
    }

    if (stepId === 'connect_whatsapp' && marker.selector === '[data-tour-target="dashboard-nav-whatsapp"]') {
        return (directTarget.closest('.nav-item') as HTMLElement | null) || directTarget;
    }

    if (stepId === 'open_inbox' && marker.selector === '[data-tour-target="settings-nav-inbox"]') {
        return (directTarget.closest('.nav-item') as HTMLElement | null) || directTarget;
    }

    return directTarget;
}

function resolveOnboardingAmbientSpotlightTargets(
    stepIdInput: string | OnboardingStepId | null | undefined,
    marker: OnboardingHighlightMarker,
    primaryTarget: HTMLElement
) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    const targets: HTMLElement[] = [];

    if (stepId === 'connect_whatsapp') {
        if (marker.selector === '[data-tour-target="dashboard-chart-bar-toggle"]') {
            const chartArea = document.querySelector('[data-tour-target="dashboard-stats-chart-area"]') as HTMLElement | null;
            if (chartArea && chartArea !== primaryTarget) {
                targets.push(chartArea);
            }
        }

        if (marker.selector === '[data-tour-target="dashboard-stats-metric-select"]') {
            const statsCard = document.querySelector('[data-tour-target="dashboard-stats-period-card"]') as HTMLElement | null;
            if (statsCard && statsCard !== primaryTarget) {
                targets.push(statsCard);
            }
        }

        if (marker.selector === '[data-tour-target="dashboard-nav-whatsapp"]') {
            const navSection = primaryTarget.closest('.nav-section') as HTMLElement | null;
            if (navSection && navSection !== primaryTarget) {
                targets.push(navSection);
            }
        }
    }

    if (stepId === 'open_inbox') {
        if (marker.selector === '[data-tour-target="settings-nav-inbox"]') {
            const navSection = primaryTarget.closest('.nav-section') as HTMLElement | null;
            if (navSection && navSection !== primaryTarget) {
                targets.push(navSection);
            }
        }

        if (marker.selector === '[data-tour-target="inbox-conversation-account-tag"]') {
            const conversationsColumn = document.querySelector('[data-tour-target="inbox-conversations-column"]') as HTMLElement | null;
            if (conversationsColumn && conversationsColumn !== primaryTarget) {
                targets.push(conversationsColumn);
            }
        }
    }

    return targets;
}

function resolveActiveOnboardingHighlight(stepIdInput: string | OnboardingStepId | null | undefined) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (!stepId) return null;

    const markers = ONBOARDING_STEP_HIGHLIGHTS[stepId] || [];
    let activeMarker: OnboardingHighlightMarker | null = null;
    for (const marker of markers) {
        if (onboardingVideoCurrentSeconds >= marker.at) {
            activeMarker = marker;
        } else {
            break;
        }
    }
    return activeMarker;
}

function positionOnboardingSpotlightCard(target: HTMLElement, marker: OnboardingHighlightMarker) {
    const card = document.getElementById('onboardingSpotlightCard') as HTMLElement | null;
    const kicker = document.getElementById('onboardingSpotlightKicker') as HTMLElement | null;
    const title = document.getElementById('onboardingSpotlightTitle') as HTMLElement | null;
    const hint = document.getElementById('onboardingSpotlightHint') as HTMLElement | null;
    if (!card || !kicker || !title || !hint) return;

    kicker.textContent = 'Na tela agora';
    title.textContent = marker.title;
    hint.textContent = marker.hint;
    card.classList.add('is-visible');

    const rect = target.getBoundingClientRect();
    const cardWidth = Math.min(280, window.innerWidth - 32);
    const gap = 12;
    const cardHeight = card.offsetHeight || 96;
    const preferredTop = rect.bottom + gap;
    const fallbackTop = rect.top - cardHeight - gap;
    const top = preferredTop + cardHeight <= window.innerHeight - 12
        ? preferredTop
        : Math.max(12, fallbackTop);
    const centeredLeft = rect.left + (rect.width / 2) - (cardWidth / 2);
    const left = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, centeredLeft));

    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(left)}px`;
}

function performOnboardingHighlightAction(
    stepIdInput: string | OnboardingStepId | null | undefined,
    marker: OnboardingHighlightMarker | null
) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    const action = String(marker?.action || '').trim();
    if (!stepId || !marker || !action) return true;

    const actionKey = `${stepId}:${marker.at}:${action}`;
    if (onboardingPreparedMarkerActionKey === actionKey) {
        return true;
    }

    const win = window as Window & {
        createSessionPrompt?: () => Promise<void> | void;
        setInboxTourSessionFilterExpanded?: (forceOpen?: boolean) => void;
        toggleContactInfo?: (forceOpen?: boolean) => void;
    };

    if (action === 'open_whatsapp_new_account_prompt') {
        if (typeof win.createSessionPrompt !== 'function') {
            scheduleOnboardingSpotlightRefresh(260);
            return false;
        }

        void win.createSessionPrompt();
        onboardingPreparedMarkerActionKey = actionKey;
        scheduleOnboardingSpotlightRefresh(120);
        return true;
    }

    if (action === 'confirm_whatsapp_new_account_prompt') {
        const overlay = document.getElementById('appGlobalDialogModal') as HTMLElement | null;
        const input = document.getElementById('appGlobalDialogInput') as HTMLInputElement | null;
        const confirmButton = document.getElementById('appGlobalDialogConfirmBtn') as HTMLButtonElement | null;
        if (!overlay?.classList.contains('active') || !confirmButton) {
            scheduleOnboardingSpotlightRefresh(140);
            return false;
        }

        if (input) {
            input.value = getOnboardingPresentationReusableWhatsappSessionId('default_whatsapp_session');
        }

        confirmButton.click();
        window.requestAnimationFrame(() => {
            overlay.classList.remove('active');
            if (!document.querySelector('.modal-overlay.active')) {
                document.body.style.overflow = '';
            }
        });
        onboardingPreparedMarkerActionKey = actionKey;
        scheduleOnboardingSpotlightRefresh(280);
        return false;
    }

    if (action === 'open_inbox_session_filter') {
        if (typeof win.setInboxTourSessionFilterExpanded !== 'function') {
            scheduleOnboardingSpotlightRefresh(180);
            return false;
        }

        win.setInboxTourSessionFilterExpanded(true);
        onboardingPreparedMarkerActionKey = actionKey;
        scheduleOnboardingSpotlightRefresh(120);
        return false;
    }

    if (action === 'close_inbox_session_filter') {
        if (typeof win.setInboxTourSessionFilterExpanded !== 'function') {
            scheduleOnboardingSpotlightRefresh(160);
            return false;
        }

        win.setInboxTourSessionFilterExpanded(false);
        onboardingPreparedMarkerActionKey = actionKey;
        scheduleOnboardingSpotlightRefresh(120);
        return false;
    }

    if (action === 'open_inbox_contact_info_panel') {
        if (typeof win.toggleContactInfo !== 'function') {
            scheduleOnboardingSpotlightRefresh(180);
            return false;
        }

        win.toggleContactInfo(true);
        onboardingPreparedMarkerActionKey = actionKey;
        scheduleOnboardingSpotlightRefresh(180);
        return false;
    }

    return true;
}

function syncOnboardingDashboardMetricForCurrentTime(stepIdInput: string | OnboardingStepId | null | undefined) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (stepId !== 'connect_whatsapp') return true;
    if (!isOnboardingRouteActive('#/dashboard')) return true;

    let targetMetric: StatsMetric | null = null;
    if (onboardingVideoCurrentSeconds >= 14 && onboardingVideoCurrentSeconds < 16) {
        targetMetric = 'interacoes';
    } else if (onboardingVideoCurrentSeconds >= 13 && onboardingVideoCurrentSeconds < 14) {
        targetMetric = 'mensagens';
    } else if (onboardingVideoCurrentSeconds >= 11 && onboardingVideoCurrentSeconds < 13) {
        targetMetric = 'novos_contatos';
    }

    if (!targetMetric) return true;
    return setSelectedStatsMetric(targetMetric);
}

function syncOnboardingDashboardChartTypeForCurrentTime(stepIdInput: string | OnboardingStepId | null | undefined) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    if (stepId !== 'connect_whatsapp') return true;
    if (!isOnboardingRouteActive('#/dashboard')) return true;

    if (onboardingVideoCurrentSeconds >= 16 && onboardingVideoCurrentSeconds < 20) {
        return setSelectedStatsChartType('bar');
    }

    return setSelectedStatsChartType('line');
}

function applyOnboardingSpotlight(
    stepIdInput: string | OnboardingStepId | null | undefined,
    marker: OnboardingHighlightMarker | null
) {
    if (!marker || !onboardingTourOpen) {
        clearOnboardingSpotlight();
        return;
    }

    if (marker.clear === true) {
        clearOnboardingSpotlight();
        return;
    }

    const target = resolveOnboardingSpotlightTarget(stepIdInput, marker);
    if (!target) {
        clearOnboardingSpotlight();
        return;
    }

    const ambientTargets = resolveOnboardingAmbientSpotlightTargets(stepIdInput, marker, target);
    ensureOnboardingSpotlightOverflowVisible([target, ...ambientTargets]);
    const useSoftActiveTarget = ambientTargets.length > 0;

    const markerKey = `${marker.selector}:${marker.at}`;
    if (onboardingActiveSpotlightElement !== target) {
        if (onboardingActiveSpotlightElement) {
            onboardingActiveSpotlightElement.classList.remove('onboarding-tour-target-active');
            onboardingActiveSpotlightElement.classList.remove('onboarding-tour-target-active-soft');
            onboardingActiveSpotlightElement.style.removeProperty('--onboarding-tour-radius');
        }

        onboardingActiveSpotlightElement = target;
        onboardingActiveSpotlightSelector = marker.selector;
        onboardingActiveSpotlightMarkerKey = markerKey;
        target.classList.add('onboarding-tour-target-active');
    }
    target.classList.toggle('onboarding-tour-target-active-soft', useSoftActiveTarget);
    target.style.setProperty('--onboarding-tour-radius', `${Math.max(8, Math.floor(marker.radius || 16))}px`);

    const currentAmbientSet = new Set(ambientTargets);
    onboardingAmbientSpotlightElements.forEach((element) => {
        if (!currentAmbientSet.has(element)) {
            element.classList.remove('onboarding-tour-target-ambient');
            element.style.removeProperty('--onboarding-tour-radius');
        }
    });
    ambientTargets.forEach((element) => {
        element.classList.add('onboarding-tour-target-ambient');
        element.style.setProperty('--onboarding-tour-radius', '18px');
    });
    onboardingAmbientSpotlightElements = ambientTargets;

    const rect = target.getBoundingClientRect();
    const isOffscreen = rect.top < 72 || rect.bottom > window.innerHeight - 120;
    if (isOffscreen || onboardingActiveSpotlightMarkerKey !== markerKey) {
        target.scrollIntoView({
            behavior: 'smooth',
            block: marker.scroll || 'center',
            inline: 'nearest'
        });
        onboardingActiveSpotlightMarkerKey = markerKey;
    }

    positionOnboardingSpotlightCard(target, marker);
}

function prepareOnboardingSurfaceForStep(
    stepIdInput: string | OnboardingStepId | null | undefined,
    marker: OnboardingHighlightMarker | null = null
) {
    const stepId = normalizeOnboardingStepId(stepIdInput);
    const targetRoute = resolveOnboardingHighlightRoute(stepId, marker);
    if (!stepId || !isOnboardingRouteActive(targetRoute)) return false;

    const win = window as Window & {
        showPanel?: (panelId: string) => void;
        openAddContactModal?: () => void;
        openCampaignModal?: () => void;
        openAutomationModal?: () => void;
    };
    if (onboardingPreparedSurfaceStepId !== stepId) {
        let didPrepare = true;

        if (stepId === 'configure_accounts') {
            if (typeof win.showPanel === 'function') {
                win.showPanel('conexao');
            } else {
                didPrepare = false;
            }
        } else if (stepId === 'open_inbox' && targetRoute.startsWith('#/configuracoes')) {
            if (typeof win.showPanel === 'function') {
                win.showPanel('conexao');
            } else {
                didPrepare = false;
            }
        } else if (stepId === 'create_tags') {
            if (typeof win.showPanel === 'function') {
                win.showPanel('labels');
            } else {
                didPrepare = false;
            }
        } else if (stepId === 'configure_dynamic_fields') {
            if (typeof win.showPanel === 'function') {
                win.showPanel('contact-fields');
            } else {
                didPrepare = false;
            }
        } else if (stepId === 'create_first_contact') {
            if (typeof win.openAddContactModal === 'function') {
                win.openAddContactModal();
            } else {
                didPrepare = false;
            }
        } else if (stepId === 'create_campaign') {
            if (typeof win.openCampaignModal === 'function') {
                win.openCampaignModal();
            } else {
                didPrepare = false;
            }
        } else if (stepId === 'create_automation') {
            if (typeof win.openAutomationModal === 'function') {
                win.openAutomationModal();
            } else {
                didPrepare = false;
            }
        }

        if (!didPrepare) {
            scheduleOnboardingSpotlightRefresh(260);
            return false;
        }

        onboardingPreparedSurfaceStepId = stepId;
        scheduleOnboardingSpotlightRefresh(180);
    }

    return performOnboardingHighlightAction(stepId, marker);
}

function refreshOnboardingTourSurface() {
    const stepId = normalizeOnboardingStepId(onboardingPlayingStepId || onboardingSelectedStepId);
    if (!stepId || !onboardingTourOpen) {
        clearOnboardingSpotlight();
        return;
    }

    const activeMarker = resolveActiveOnboardingHighlight(stepId);
    const targetRoute = resolveOnboardingHighlightRoute(stepId, activeMarker);
    if (targetRoute && !isOnboardingRouteActive(targetRoute)) {
        clearOnboardingSpotlight();
        onboardingPreparedSurfaceStepId = null;
        const hasRouteChanged = ensureOnboardingRoute(targetRoute);
        if (hasRouteChanged) {
            scheduleOnboardingSpotlightRefresh(360);
            return;
        }
    }

    const surfaceReady = prepareOnboardingSurfaceForStep(stepId, activeMarker);
    if (!surfaceReady) return;
    syncOnboardingDashboardMetricForCurrentTime(stepId);
    syncOnboardingDashboardChartTypeForCurrentTime(stepId);
    applyOnboardingSpotlight(stepId, activeMarker);
}

function stopOnboardingVideoSyncTimer() {
    if (onboardingVideoSyncTimer !== null) {
        window.clearInterval(onboardingVideoSyncTimer);
        onboardingVideoSyncTimer = null;
    }
}

function syncOnboardingYouTubeMetrics() {
    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (!video) return;

    onboardingVideoDurationSeconds = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
    onboardingVideoCurrentSeconds = Number.isFinite(video.currentTime) ? Math.max(0, video.currentTime) : 0;
    onboardingVideoMuted = video.muted || video.volume === 0;
    renderOnboardingVideoControls();
}

function startOnboardingVideoSyncTimer() {
    stopOnboardingVideoSyncTimer();
    syncOnboardingYouTubeMetrics();
    onboardingVideoSyncTimer = window.setInterval(syncOnboardingYouTubeMetrics, 250);
}

function resetOnboardingVideoRuntime() {
    stopOnboardingVideoSyncTimer();
    onboardingVideoDurationSeconds = 0;
    onboardingVideoCurrentSeconds = 0;
    onboardingVideoMuted = false;
    onboardingVideoPlaybackState = 'idle';
    onboardingYouTubePlayerVideoId = '';
}

function destroyOnboardingYouTubePlayer() {
    stopOnboardingVideoSyncTimer();
    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (video) {
        try {
            video.pause();
        } catch (_) {
            // no-op
        }
        video.removeAttribute('src');
        try {
            video.load();
        } catch (_) {
            // no-op
        }
        video.style.display = 'none';
    }

    onboardingYouTubePlayer = null;
    onboardingYouTubePlayerReady = false;
    resetOnboardingVideoRuntime();
}

function getOnboardingYouTubeIframe() {
    const host = document.getElementById('onboardingVideoPlayerHost') as HTMLElement | null;
    if (!host) return null;
    if (host instanceof HTMLIFrameElement) {
        return host;
    }
    return host.querySelector('iframe') as HTMLIFrameElement | null;
}

function sendOnboardingYouTubeCommand(func: string, args: unknown[] = []) {
    const frame = getOnboardingYouTubeIframe();
    const targetWindow = frame?.contentWindow;
    if (!frame || !targetWindow) return false;

    const payload = JSON.stringify({
        event: 'command',
        func,
        args
    });

    try {
        const targetOrigin = new URL(frame.src).origin;
        targetWindow.postMessage(payload, targetOrigin || '*');
        return true;
    } catch (_) {
        try {
            targetWindow.postMessage(payload, '*');
            return true;
        } catch (_) {
            return false;
        }
    }
}

function ensureOnboardingYouTubeApi() {
    const windowWithYoutube = window as Window & {
        YT?: { Player?: new (elementId: string, options: Record<string, unknown>) => typeof onboardingYouTubePlayer };
        onYouTubeIframeAPIReady?: () => void;
    };

    if (windowWithYoutube.YT?.Player) {
        return Promise.resolve();
    }
    if (onboardingYouTubeApiPromise) {
        return onboardingYouTubeApiPromise;
    }

    onboardingYouTubeApiPromise = new Promise<void>((resolve, reject) => {
        const previousReady = windowWithYoutube.onYouTubeIframeAPIReady;
        windowWithYoutube.onYouTubeIframeAPIReady = () => {
            if (typeof previousReady === 'function') {
                previousReady();
            }
            resolve();
        };

        const existingScript = document.getElementById('youtube-iframe-api');
        if (existingScript) {
            return;
        }

        const script = document.createElement('script');
        script.id = 'youtube-iframe-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => {
            onboardingYouTubeApiPromise = null;
            reject(new Error('Nao foi possivel carregar a API do YouTube.'));
        };
        document.head.appendChild(script);
    });

    return onboardingYouTubeApiPromise;
}

function renderOnboardingVideoControls(presentationInput?: OnboardingVideoPresentation | null) {
    const toggleButton = document.getElementById('onboardingVideoToggleButton') as HTMLButtonElement | null;
    const toggleIcon = document.getElementById('onboardingVideoToggleIcon') as HTMLElement | null;
    const muteButton = document.getElementById('onboardingVideoMuteButton') as HTMLButtonElement | null;
    const progress = document.getElementById('onboardingVideoProgress') as HTMLInputElement | null;
    const currentTime = document.getElementById('onboardingVideoCurrentTime') as HTMLElement | null;
    const duration = document.getElementById('onboardingVideoDuration') as HTMLElement | null;
    const endedOverlay = document.getElementById('onboardingVideoEndedOverlay') as HTMLElement | null;
    const endedTitle = document.getElementById('onboardingVideoEndedTitle') as HTMLElement | null;
    const endedHint = document.getElementById('onboardingVideoEndedHint') as HTMLElement | null;
    const headerPreviousButton = document.getElementById('onboardingTourPrevButton') as HTMLButtonElement | null;
    const headerNextButton = document.getElementById('onboardingTourNextButton') as HTMLButtonElement | null;
    const replayButton = document.getElementById('onboardingVideoReplayButton') as HTMLButtonElement | null;
    const previousButton = document.getElementById('onboardingVideoPrevButton') as HTMLButtonElement | null;
    const nextButton = document.getElementById('onboardingVideoNextButton') as HTMLButtonElement | null;

    const selectedStepId = getSelectedOnboardingStepId();
    const presentation = presentationInput ?? (selectedStepId
        ? buildOnboardingVideoPresentation(onboardingVideoUrls[selectedStepId] || '')
        : null);
    const hasPlayableVideo = Boolean(presentation?.mediaUrl || presentation?.embedUrl);
    const isActivePlayer = Boolean(onboardingTourOpen && selectedStepId && onboardingPlayingStepId === selectedStepId && hasPlayableVideo);
    const isLoading = isActivePlayer && onboardingVideoPlaybackState === 'loading';
    const isPlaying = isActivePlayer && onboardingVideoPlaybackState === 'playing';
    const isEnded = isActivePlayer && onboardingVideoPlaybackState === 'ended';
    const canControlTimeline = isActivePlayer && onboardingVideoDurationSeconds > 0;
    const progressValue = canControlTimeline
        ? Math.max(0, Math.min(1000, Math.round((onboardingVideoCurrentSeconds / onboardingVideoDurationSeconds) * 1000)))
        : 0;
    const firstStepId = ONBOARDING_STEP_IDS[0] || null;
    const isFirstStep = selectedStepId === firstStepId;
    const previousStepId = selectedStepId ? getAdjacentOnboardingStepId(selectedStepId, -1) : null;
    const nextStepId = selectedStepId ? getAdjacentOnboardingStepId(selectedStepId, 1) : null;

    if (toggleButton) {
        toggleButton.disabled = !hasPlayableVideo || isLoading;
        toggleButton.title = !hasPlayableVideo
            ? 'V\u00eddeo indispon\u00edvel'
            : (isPlaying ? 'Pausar v\u00eddeo' : (isEnded ? 'Reiniciar v\u00eddeo' : 'Reproduzir v\u00eddeo'));
        toggleButton.setAttribute('aria-label', toggleButton.title);
    }
    if (toggleIcon) {
        toggleIcon.className = `icon ${isPlaying ? 'icon-pause' : 'icon-play'} icon-sm`;
    }
    if (muteButton) {
        muteButton.disabled = !isActivePlayer;
        muteButton.title = onboardingVideoMuted ? 'Ativar som' : 'Silenciar v\u00eddeo';
        muteButton.setAttribute('aria-label', muteButton.title);
        muteButton.classList.toggle('is-muted', onboardingVideoMuted);
    }
    if (progress) {
        progress.disabled = !canControlTimeline;
        progress.value = String(progressValue);
    }
    if (currentTime) {
        currentTime.textContent = formatOnboardingVideoTime(onboardingVideoCurrentSeconds);
    }
    if (duration) {
        duration.textContent = formatOnboardingVideoTime(onboardingVideoDurationSeconds);
    }
    if (endedOverlay) {
        endedOverlay.classList.toggle('is-visible', isEnded);
    }
    if (endedTitle) {
        endedTitle.textContent = nextStepId
            ? `Pr\u00f3ximo: ${ONBOARDING_STEP_LABELS_UI[nextStepId]}`
            : 'Tour conclu\u00eddo';
    }
    if (endedHint) {
        endedHint.textContent = nextStepId
            ? 'Siga para o pr\u00f3ximo v\u00eddeo quando quiser.'
            : 'Voc\u00ea chegou ao fim do tour e pode rever qualquer etapa.';
    }
    if (headerPreviousButton) {
        headerPreviousButton.disabled = !previousStepId;
        headerPreviousButton.title = previousStepId ? 'Etapa anterior' : 'Primeira etapa';
        headerPreviousButton.setAttribute('aria-label', headerPreviousButton.title);
    }
    if (headerNextButton) {
        headerNextButton.disabled = !nextStepId;
        headerNextButton.title = nextStepId ? 'Pr\u00f3xima etapa' : 'Fim do tour';
        headerNextButton.setAttribute('aria-label', headerNextButton.title);
    }
    if (replayButton) {
        replayButton.hidden = !isFirstStep;
        replayButton.style.display = isFirstStep ? 'inline-flex' : 'none';
        replayButton.disabled = !hasPlayableVideo || isLoading;
        replayButton.title = 'Ver novamente';
        replayButton.setAttribute('aria-label', replayButton.title);
    }
    if (previousButton) {
        previousButton.hidden = isFirstStep;
        previousButton.style.display = isFirstStep ? 'none' : 'inline-flex';
        previousButton.disabled = !previousStepId;
    }
    if (nextButton) {
        nextButton.textContent = nextStepId ? 'Pr\u00f3ximo' : 'Concluir';
    }
}

async function ensureOnboardingYouTubePlayback(videoUrl: string) {
    if (!videoUrl) return;

    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (!video) return;

    onboardingYouTubePlayerReady = true;
    onboardingYouTubePlayerVideoId = videoUrl;
    onboardingVideoPlaybackState = 'loading';
    renderOnboardingVideo();
    renderOnboardingVideoControls();

    if (video.src !== videoUrl) {
        video.src = videoUrl;
        video.load();
        onboardingVideoCurrentSeconds = 0;
    } else if (video.ended) {
        video.currentTime = 0;
    }

    try {
        await video.play();
        onboardingVideoPlaybackState = 'playing';
        startOnboardingVideoSyncTimer();
    } catch (_) {
        onboardingVideoPlaybackState = 'paused';
    }

    syncOnboardingYouTubeMetrics();
    renderOnboardingVideo();
    renderOnboardingVideoControls();
}

function buildOnboardingVideoPresentation(videoUrl: string): OnboardingVideoPresentation {
    const sourceUrl = normalizeAbsoluteHttpUrl(videoUrl);
    if (!sourceUrl) {
        return {
            provider: 'none',
            sourceUrl: '',
            mediaUrl: '',
            embedUrl: '',
            videoId: '',
            posterUrl: '',
            posterFallbackUrl: ''
        };
    }

    try {
        const parsed = new URL(sourceUrl);
        const pathname = parsed.pathname.toLowerCase();
        const isDirectVideo = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].some((extension) => pathname.endsWith(extension));

        return {
            provider: isDirectVideo ? 'file' : 'external',
            sourceUrl,
            mediaUrl: sourceUrl,
            embedUrl: sourceUrl,
            videoId: '',
            posterUrl: '',
            posterFallbackUrl: ''
        };
    } catch (_) {
        return {
            provider: 'none',
            sourceUrl: '',
            mediaUrl: '',
            embedUrl: '',
            videoId: '',
            posterUrl: '',
            posterFallbackUrl: ''
        };
    }

    return {
        provider: 'external',
        sourceUrl,
        mediaUrl: sourceUrl,
        embedUrl: sourceUrl,
        videoId: '',
        posterUrl: '',
        posterFallbackUrl: ''
    };
}

function renderOnboardingVideo() {
    const selectedStepId = getSelectedOnboardingStepId();
    if (!selectedStepId) return;

    const tour = document.getElementById('onboardingFloatingTour') as HTMLElement | null;
    const shell = document.getElementById('onboardingVideoShell') as HTMLElement | null;
    const placeholder = document.getElementById('onboardingVideoPlaceholder') as HTMLElement | null;
    const placeholderTitle = document.getElementById('onboardingVideoPlaceholderTitle') as HTMLElement | null;
    const hint = document.getElementById('onboardingVideoHint') as HTMLElement | null;
    const posterBackdrop = document.getElementById('onboardingVideoPosterBackdrop') as HTMLElement | null;
    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    const kicker = document.getElementById('onboardingVideoKicker') as HTMLElement | null;
    const title = document.getElementById('onboardingVideoTitle') as HTMLElement | null;
    const description = document.getElementById('onboardingVideoDescription') as HTMLElement | null;

    const stepPosition = Math.max(0, ONBOARDING_STEP_IDS.indexOf(selectedStepId)) + 1;
    const presentation = buildOnboardingVideoPresentation(onboardingVideoUrls[selectedStepId] || '');
    const isCurrentStepOpen = onboardingTourOpen && onboardingPlayingStepId === selectedStepId;
    const shouldRenderVideo = isCurrentStepOpen && Boolean(presentation.mediaUrl);
    const isVideoReady = shouldRenderVideo && onboardingVideoPlaybackState !== 'loading';

    if (tour) {
        tour.classList.toggle('is-open', onboardingTourOpen);
    }
    if (shell) {
        shell.classList.toggle('is-ready', isVideoReady);
    }
    if (kicker) {
        kicker.textContent = `Etapa ${stepPosition} de ${ONBOARDING_STEP_IDS.length}`;
    }
    if (title) {
        title.textContent = ONBOARDING_STEP_LABELS_UI[selectedStepId];
    }
    if (description) {
        description.textContent = ONBOARDING_STEP_VIDEO_DESCRIPTIONS_UI[selectedStepId];
    }
    if (posterBackdrop) {
        const backdropUrl = presentation.posterUrl || presentation.posterFallbackUrl;
        posterBackdrop.style.backgroundImage = backdropUrl ? `url("${backdropUrl}")` : '';
    }

    if (!presentation.mediaUrl) {
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        if (placeholderTitle) {
            placeholderTitle.textContent = 'Guia indispon\u00edvel';
        }
        if (hint) {
            hint.textContent = 'Este passo a passo ainda n\u00e3o est\u00e1 dispon\u00edvel para exibi\u00e7\u00e3o.';
        }
        if (video) {
            video.style.display = 'none';
        }
        renderOnboardingVideoControls(presentation);
        return;
    }

    if (!onboardingTourOpen) {
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        if (placeholderTitle) {
            placeholderTitle.textContent = 'Tour pronto';
        }
        if (hint) {
            hint.textContent = 'Clique em Iniciar tour para abrir o v\u00eddeo flutuante.';
        }
    } else if (!isVideoReady) {
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        if (placeholderTitle) {
            placeholderTitle.textContent = 'Abrindo v\u00eddeo';
        }
        if (hint) {
            hint.textContent = 'O tour est\u00e1 sendo carregado. Isso leva s\u00f3 alguns instantes.';
        }
    } else if (placeholder) {
        placeholder.style.display = 'none';
    }

    if (video) {
        if (shouldRenderVideo) {
            if (video.src !== presentation.mediaUrl) {
                video.src = presentation.mediaUrl;
                onboardingVideoPlaybackState = 'loading';
            }
            video.style.display = 'block';
        } else {
            video.pause();
            video.style.display = 'none';
        }
    }

    renderOnboardingVideoControls(presentation);
    if (onboardingTourOpen) {
        scheduleOnboardingSpotlightRefresh(120);
    }
}

function renderOnboardingVideoLegacy() {
    const selectedStepId = onboardingSelectedStepId && ONBOARDING_STEP_IDS.includes(onboardingSelectedStepId)
        ? onboardingSelectedStepId
        : getPreferredOnboardingSelectedStepId();
    if (!selectedStepId) return;

    onboardingSelectedStepId = selectedStepId;

    const shell = document.getElementById('onboardingVideoShell') as HTMLElement | null;
    const placeholder = document.getElementById('onboardingVideoPlaceholder') as HTMLElement | null;
    const placeholderTitle = document.getElementById('onboardingVideoPlaceholderTitle') as HTMLElement | null;
    const hint = document.getElementById('onboardingVideoHint') as HTMLElement | null;
    const posterBackdrop = document.getElementById('onboardingVideoPosterBackdrop') as HTMLElement | null;
    const cover = document.getElementById('onboardingVideoCover') as HTMLElement | null;
    const playerHost = document.getElementById('onboardingVideoPlayerHost') as HTMLElement | null;
    const previewButton = document.getElementById('onboardingVideoPreviewButton') as HTMLButtonElement | null;
    const playButton = document.getElementById('onboardingVideoPlayButton') as HTMLButtonElement | null;
    const previewHint = document.getElementById('onboardingVideoPreviewHint') as HTMLElement | null;
    const ctaLabel = document.getElementById('onboardingVideoCtaLabel') as HTMLElement | null;
    const status = document.getElementById('onboardingVideoStatus') as HTMLElement | null;
    const note = document.getElementById('onboardingSpotlightNote') as HTMLElement | null;
    const actionButton = document.getElementById('onboardingStepActionButton') as HTMLButtonElement | null;
    const frame = document.getElementById('onboardingVideoFrame') as HTMLIFrameElement | null;
    const kicker = document.getElementById('onboardingVideoKicker') as HTMLElement | null;
    const title = document.getElementById('onboardingVideoTitle') as HTMLElement | null;
    const description = document.getElementById('onboardingVideoDescription') as HTMLElement | null;
    const stepPosition = Math.max(0, ONBOARDING_STEP_IDS.indexOf(selectedStepId)) + 1;
    const presentation = buildOnboardingVideoPresentation(onboardingVideoUrls[selectedStepId] || '');
    const isCompleted = isOnboardingStepCompleted(selectedStepId);
    const isRecommendedStep = selectedStepId === getPreferredOnboardingSelectedStepId();
    const isPlayingCurrentStep = onboardingPlayingStepId === selectedStepId && Boolean(presentation.embedUrl);

    if (kicker) {
        kicker.textContent = `Etapa ${stepPosition} de ${ONBOARDING_STEP_IDS.length}`;
    }
    if (status) {
        status.textContent = isCompleted
            ? 'Concluída'
            : (isPlayingCurrentStep ? 'Guia aberto' : (isRecommendedStep ? 'Próxima recomendada' : 'Guia disponível'));
    }
    if (title) {
        title.textContent = ONBOARDING_STEP_LABELS_UI[selectedStepId];
    }
    if (description) {
        description.textContent = ONBOARDING_STEP_VIDEO_DESCRIPTIONS_UI[selectedStepId];
    }
    if (note) {
        note.textContent = isCompleted
            ? 'Esta etapa já foi concluída. Você pode rever o guia aqui sempre que precisar.'
            : (isPlayingCurrentStep
                ? 'O guia está aberto dentro do card. Você pode acompanhar sem sair do painel.'
                : 'Assista ao guia da etapa selecionada e depois marque a checklist quando concluir.');
    }
    if (actionButton) {
        actionButton.textContent = ONBOARDING_STEP_ACTION_LABELS_UI[selectedStepId] || 'Abrir etapa';
        actionButton.onclick = () => goToOnboardingStep(selectedStepId);
    }
    if (ctaLabel) {
        ctaLabel.textContent = presentation.embedUrl
            ? (isPlayingCurrentStep ? 'Guia em reprodução' : 'Assistir guia aqui')
            : 'Guia indisponível';
    }
    if (previewHint) {
        previewHint.textContent = presentation.embedUrl
            ? (isPlayingCurrentStep
                ? 'O passo a passo está aberto logo aqui no painel.'
                : 'Abra o passo a passo sem sair do dashboard.')
            : 'Este passo a passo ainda não está disponível.';
    }

    if (!presentation.embedUrl) {
        if (shell) {
            shell.classList.remove('is-playing', 'is-youtube');
        }
        if (playerHost) {
            playerHost.style.display = 'none';
        }
        if (previewButton) {
            previewButton.disabled = true;
            previewButton.style.pointerEvents = 'none';
            previewButton.style.opacity = '0.76';
        }
        if (playButton) {
            playButton.disabled = true;
            playButton.textContent = 'Guia indisponível';
        }
        if (posterBackdrop) {
            posterBackdrop.style.backgroundImage = '';
        }
        if (cover) {
            cover.style.display = 'none';
        }
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        if (placeholderTitle) {
            placeholderTitle.textContent = 'Guia indisponível';
        }
        if (hint) {
            hint.textContent = 'Este passo a passo ainda não está disponível para exibição.';
        }
        if (frame) {
            frame.style.display = 'none';
            frame.removeAttribute('src');
        }
        renderOnboardingVideoControls(presentation);
        return;
    }

    if (shell) {
        shell.classList.toggle('is-playing', isPlayingCurrentStep);
        shell.classList.toggle('is-youtube', presentation.provider === 'youtube');
    }
    if (previewButton) {
        previewButton.disabled = false;
        previewButton.style.pointerEvents = '';
        previewButton.style.opacity = '';
    }
    if (playButton) {
        playButton.disabled = isPlayingCurrentStep;
        playButton.textContent = isPlayingCurrentStep ? 'Guia em reprodução' : 'Assistir guia aqui';
    }
    if (posterBackdrop) {
        const backdropUrl = presentation.posterUrl || presentation.posterFallbackUrl;
        posterBackdrop.style.backgroundImage = backdropUrl ? `url("${backdropUrl}")` : '';
    }
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    if (placeholderTitle) {
        placeholderTitle.textContent = 'Assistir guia';
    }
    if (hint) {
        hint.textContent = 'Abra o passo a passo dentro do próprio painel.';
    }
    if (cover) {
        cover.style.display = isPlayingCurrentStep ? 'none' : 'flex';
    }
    if (playerHost) {
        playerHost.style.display = isPlayingCurrentStep && presentation.provider === 'youtube' ? 'block' : 'none';
    }
    if (frame) {
        if (isPlayingCurrentStep && presentation.provider !== 'youtube') {
            if (frame.src !== presentation.embedUrl) {
                frame.src = presentation.embedUrl;
            }
            frame.style.display = 'block';
        } else {
            frame.style.display = 'none';
            frame.removeAttribute('src');
        }
    }
    renderOnboardingVideoControls(presentation);
}

function playOnboardingVideo() {
    startOnboardingTour();
}

function playOnboardingVideoLegacy() {
    const selectedStepId = onboardingSelectedStepId && ONBOARDING_STEP_IDS.includes(onboardingSelectedStepId)
        ? onboardingSelectedStepId
        : getPreferredOnboardingSelectedStepId();
    if (!selectedStepId) return;

    const presentation = buildOnboardingVideoPresentation(onboardingVideoUrls[selectedStepId] || '');
    if (!presentation.mediaUrl) return;

    onboardingSelectedStepId = selectedStepId;
    onboardingPlayingStepId = selectedStepId;
    renderOnboardingChecklist();
    renderOnboardingVideo();

    void ensureOnboardingYouTubePlayback(presentation.mediaUrl);
}

function toggleOnboardingVideoPlayback() {
    const selectedStepId = getSelectedOnboardingStepId();
    if (!selectedStepId) return;

    const presentation = buildOnboardingVideoPresentation(onboardingVideoUrls[selectedStepId] || '');
    if (!presentation.mediaUrl) return;

    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (!onboardingTourOpen || onboardingPlayingStepId !== selectedStepId || !video) {
        startOnboardingTour(selectedStepId);
        return;
    }

    syncOnboardingYouTubeMetrics();

    try {
        const isCurrentlyPlaying = onboardingVideoPlaybackState === 'playing' || onboardingVideoPlaybackState === 'loading';
        if (isCurrentlyPlaying) {
            video.pause();
            onboardingVideoPlaybackState = 'paused';
            stopOnboardingVideoSyncTimer();
        } else {
            if (onboardingVideoPlaybackState === 'ended') {
                video.currentTime = 0;
                onboardingVideoCurrentSeconds = 0;
            }
            void video.play().then(() => {
                onboardingVideoPlaybackState = 'playing';
                startOnboardingVideoSyncTimer();
                syncOnboardingYouTubeMetrics();
                renderOnboardingVideoControls(presentation);
            }).catch(() => {
                onboardingVideoPlaybackState = 'paused';
                renderOnboardingVideoControls(presentation);
            });
        }
    } catch (_) {
        startOnboardingTour(selectedStepId);
        return;
    }

    syncOnboardingYouTubeMetrics();
    renderOnboardingVideoControls(presentation);
}

function toggleOnboardingVideoPlaybackLegacy() {
    const selectedStepId = onboardingSelectedStepId && ONBOARDING_STEP_IDS.includes(onboardingSelectedStepId)
        ? onboardingSelectedStepId
        : getPreferredOnboardingSelectedStepId();
    if (!selectedStepId) return;

    const presentation = buildOnboardingVideoPresentation(onboardingVideoUrls[selectedStepId] || '');
    if (!presentation.mediaUrl) return;

    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (onboardingPlayingStepId !== selectedStepId || !video) {
        playOnboardingVideo();
        return;
    }

    if (!video.paused && !video.ended) {
        video.pause();
        onboardingVideoPlaybackState = 'paused';
    } else {
        void video.play();
    }

    syncOnboardingYouTubeMetrics();
    renderOnboardingVideoControls(presentation);
}

function toggleOnboardingVideoMute() {
    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (!video) return;

    syncOnboardingYouTubeMetrics();

    try {
        video.muted = !video.muted;
        onboardingVideoMuted = video.muted;
    } catch (_) {
        return;
    }

    window.setTimeout(syncOnboardingYouTubeMetrics, 60);
    renderOnboardingVideoControls();
}

function restartOnboardingVideo() {
    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (!video) {
        playOnboardingVideo();
        return;
    }

    video.currentTime = 0;
    void video.play();
    onboardingVideoCurrentSeconds = 0;
    onboardingVideoPlaybackState = 'playing';
    startOnboardingVideoSyncTimer();
    renderOnboardingVideoControls();
}

function seekOnboardingVideo(progressInput: number) {
    const video = document.getElementById('onboardingVideoElement') as HTMLVideoElement | null;
    if (!video || onboardingVideoDurationSeconds <= 0) return;

    const normalizedProgress = Math.max(0, Math.min(1000, Number(progressInput) || 0));
    const nextSeconds = (normalizedProgress / 1000) * onboardingVideoDurationSeconds;
    video.currentTime = nextSeconds;
    onboardingVideoCurrentSeconds = nextSeconds;

    if (onboardingVideoPlaybackState === 'ended') {
        onboardingVideoPlaybackState = 'paused';
    }

    renderOnboardingVideoControls();
}

async function loadOnboardingVideo(_options: { silent?: boolean } = {}) {
    const hasVideoCard = Boolean(document.getElementById('dashboardOnboardingCard'));
    if (!hasVideoCard) return;

    onboardingVideoUrls = { ...ONBOARDING_STEP_VIDEO_URLS };
    renderOnboardingVideo();
}

function bindOnboardingPresentationDashboardBridge() {
    if (onboardingPresentationDashboardBridgeBound) return;
    onboardingPresentationDashboardBridgeBound = true;

    window.addEventListener(ONBOARDING_PRESENTATION_EVENT, () => {
        const hasDashboardSurface = Boolean(document.getElementById('statsChart') || document.getElementById('dashboardOnboardingCard'));
        if (!hasDashboardSurface) return;
        void loadDashboardData();
    });
}

function initOnboardingCard() {
    const hasOnboarding = Boolean(document.getElementById('dashboardOnboardingCard'));
    if (!hasOnboarding) return;
    bindOnboardingTourControls();
    onboardingState = readOnboardingState();
    const preservedStepId = onboardingTourOpen
        ? normalizeOnboardingStepId(onboardingPlayingStepId || onboardingSelectedStepId)
        : null;

    if (!preservedStepId) {
        destroyOnboardingYouTubePlayer();
        onboardingTourOpen = false;
        onboardingSelectedStepId = normalizeOnboardingStepId(onboardingSelectedStepId) || getPreferredOnboardingSelectedStepId();
        onboardingPlayingStepId = null;
    } else {
        onboardingSelectedStepId = preservedStepId;
        onboardingPlayingStepId = preservedStepId;
    }

    renderOnboardingChecklist();
    void loadOnboardingVideo({ silent: true });
}

function normalizeAccountHealthResponse(response: AccountHealthResponse | null | undefined) {
    return {
        summary: response?.summary || {},
        accounts: Array.isArray(response?.accounts) ? response.accounts : [],
        generatedAt: String(response?.generatedAt || '').trim(),
        date: String(response?.date || '').trim()
    };
}

function renderAccountHealthPlaceholder(message: string) {
    const list = document.getElementById('accountHealthList') as HTMLElement | null;
    const summary = document.getElementById('accountHealthSummary') as HTMLElement | null;
    if (summary) {
        summary.innerHTML = `<span class="account-health-summary-item">${escapeHtml(message)}</span>`;
    }
    if (list) {
        list.innerHTML = `<div class="account-health-empty">${escapeHtml(message)}</div>`;
    }
}

function getAccountHealthStatusClass(account: AccountHealthAccount) {
    const status = String(account.status || '').trim().toLowerCase();
    if (status === 'connected') return 'is-connected';
    if (status === 'warming_up') return 'is-warming';
    return 'is-offline';
}

function getAccountHealthRiskClass(level: unknown) {
    const normalized = String(level || '').trim().toLowerCase();
    if (normalized === 'critical') return 'is-critical';
    if (normalized === 'attention') return 'is-attention';
    if (normalized === 'paused') return 'is-paused';
    return 'is-healthy';
}

function formatAccountHealthLimit(currentValue: unknown, limitValue: unknown) {
    const current = toNonNegativeInt(currentValue);
    const limit = toNonNegativeInt(limitValue);
    if (limit > 0) {
        return `${formatNumber(current)} / ${formatNumber(limit)}`;
    }
    return formatNumber(current);
}

function formatAccountHealthLimitHint(limitValue: unknown, ratioValue: unknown, unlimitedText: string) {
    const limit = toNonNegativeInt(limitValue);
    const ratio = Number(ratioValue);
    if (limit > 0 && Number.isFinite(ratio)) {
        return `${formatPercent(ratio * 100)} do limite configurado`;
    }
    return unlimitedText;
}

function formatAccountHealthTime(value: unknown, format: 'time' | 'datetime' = 'time') {
    const normalized = String(value || '').trim();
    return normalized ? formatDate(normalized, format) : '-';
}

function renderAccountHealthSummary(summaryInput: AccountHealthSummary | null | undefined, generatedAt: string) {
    const summary = document.getElementById('accountHealthSummary') as HTMLElement | null;
    if (!summary) return;

    const totalAccounts = toNonNegativeInt(summaryInput?.total_accounts);
    const critical = toNonNegativeInt(summaryInput?.critical);
    const attention = toNonNegativeInt(summaryInput?.attention);
    const cooldown = toNonNegativeInt(summaryInput?.cooldown);
    const updatedAtLabel = generatedAt ? formatDate(generatedAt, 'time') : '-';

    summary.innerHTML = [
        `<span class="account-health-summary-item is-total"><strong>${formatNumber(totalAccounts)}</strong> conta(s)</span>`,
        `<span class="account-health-summary-item is-critical"><strong>${formatNumber(critical)}</strong> em risco alto</span>`,
        `<span class="account-health-summary-item is-attention"><strong>${formatNumber(attention)}</strong> pedem atenção</span>`,
        `<span class="account-health-summary-item is-cooldown"><strong>${formatNumber(cooldown)}</strong> em cooldown</span>`,
        `<span class="account-health-summary-item is-updated">Atualizado <strong>${escapeHtml(updatedAtLabel)}</strong></span>`
    ].join('');
}

function renderAccountHealthAccounts(accountsInput: AccountHealthAccount[] | null | undefined) {
    const list = document.getElementById('accountHealthList') as HTMLElement | null;
    if (!list) return;

    const accounts = Array.isArray(accountsInput) ? accountsInput : [];
    if (!accounts.length) {
        list.innerHTML = '<div class="account-health-empty">Nenhuma conta de disparo encontrada para monitoramento.</div>';
        return;
    }

    list.innerHTML = accounts.map((account) => {
        const sessionName = escapeHtml(String(account.session_name || account.session_id || 'Conta sem nome'));
        const sessionId = escapeHtml(String(account.session_id || '-'));
        const statusLabel = escapeHtml(String(account.status_label || 'Indisponível'));
        const statusClass = getAccountHealthStatusClass(account);
        const riskClass = getAccountHealthRiskClass(account.risk_level);
        const riskLabel = escapeHtml(String(account.risk_label || 'Monitorando'));
        const riskReason = escapeHtml(String(account.risk_reason || 'Sem observações para esta conta.'));
        const sentToday = toNonNegativeInt(account.sent_today);
        const repliedToday = toNonNegativeInt(account.replied_today);
        const uniqueLeadsToday = toNonNegativeInt(account.unique_leads_today);
        const sentLastHour = toNonNegativeInt(account.sent_last_hour);
        const responseRate = Number(account.response_rate || 0);
        const dispatches = Array.isArray(account.dispatches) ? account.dispatches : [];
        const cooldownActive = account.cooldown_active === true;
        const possibleBlockedContacts = toNonNegativeInt(account.possible_blocked_contacts);
        const dailyUsage = formatAccountHealthLimit(account.sent_today, account.daily_limit);
        const hourlyUsage = formatAccountHealthLimit(account.sent_last_hour, account.hourly_limit);
        const cooldownValue = cooldownActive ? formatAccountHealthTime(account.cooldown_until, 'time') : 'Livre';
        const possibleBlockedText = possibleBlockedContacts > 0
            ? `${formatNumber(possibleBlockedContacts)} contato(s)`
            : 'Nenhum sinal forte';
        const accountRiskClass = getAccountHealthRiskClass(account.risk_level).replace('is-', '');
        const accountClasses = [
            'account-health-account',
            `is-${accountRiskClass}`,
            possibleBlockedContacts > 0 ? 'has-block-signal' : ''
        ].filter(Boolean).join(' ');

        return `
            <details class="${accountClasses}">
                <summary class="account-health-summary-row">
                    <div class="account-health-summary-main">
                        <div class="account-health-summary-title-row">
                            <span class="account-health-account-name">${sessionName}</span>
                            <span class="account-health-pill ${statusClass}">${statusLabel}</span>
                            ${account.campaign_enabled === false ? '<span class="account-health-pill is-paused">Disparo pausado</span>' : ''}
                        </div>
                    </div>

                    <div class="account-health-summary-metrics">
                        <span class="account-health-metric-chip is-sent">
                            <span class="account-health-metric-chip-label">Enviadas</span>
                            <strong class="account-health-metric-chip-value">${formatNumber(sentToday)}</strong>
                        </span>
                        <span class="account-health-metric-chip is-replied">
                            <span class="account-health-metric-chip-label">Responderam</span>
                            <strong class="account-health-metric-chip-value">${formatNumber(repliedToday)}</strong>
                        </span>
                        <span class="account-health-metric-chip is-rate">
                            <span class="account-health-metric-chip-label">Taxa</span>
                            <strong class="account-health-metric-chip-value">${formatPercent(responseRate)}</strong>
                        </span>
                        <span class="account-health-metric-chip is-usage">
                            <span class="account-health-metric-chip-label">Uso dia</span>
                            <strong class="account-health-metric-chip-value">${escapeHtml(dailyUsage)}</strong>
                        </span>
                        ${possibleBlockedContacts > 0 ? `
                            <span class="account-health-metric-chip is-blocked">
                                <span class="account-health-metric-chip-label">Sem entrega</span>
                                <strong class="account-health-metric-chip-value">${formatNumber(possibleBlockedContacts)}</strong>
                            </span>
                        ` : ''}
                    </div>

                    <div class="account-health-summary-side">
                        <span class="account-health-risk-badge ${riskClass}">${riskLabel}</span>
                        <span class="account-health-summary-caret" aria-hidden="true"></span>
                    </div>
                </summary>

                <div class="account-health-details">
                    <div class="account-health-detail-grid">
                        <section class="account-health-detail-card is-response">
                            <span class="account-health-detail-card-title">Resposta do dia</span>
                            <div class="account-health-detail-list">
                                <div class="account-health-detail-item">
                                    <span>Contatos impactados</span>
                                    <strong>${formatNumber(uniqueLeadsToday)}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Responderam</span>
                                    <strong>${formatNumber(repliedToday)}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Taxa de resposta</span>
                                    <strong>${formatPercent(responseRate)}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Último disparo</span>
                                    <strong>${account.last_sent_at ? escapeHtml(formatDate(account.last_sent_at, 'time')) : '-'}</strong>
                                </div>
                            </div>
                        </section>

                        <section class="account-health-detail-card is-rhythm">
                            <span class="account-health-detail-card-title">Ritmo da conta</span>
                            <div class="account-health-detail-list">
                                <div class="account-health-detail-item">
                                    <span>Uso diario</span>
                                    <strong>${escapeHtml(dailyUsage)}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Uso por hora</span>
                                    <strong>${escapeHtml(hourlyUsage)}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Cooldown</span>
                                    <strong>${escapeHtml(cooldownValue)}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Ultima hora</span>
                                    <strong>${formatNumber(sentLastHour)}</strong>
                                </div>
                            </div>
                        </section>

                        <section class="account-health-detail-card is-insight">
                            <span class="account-health-detail-card-title">Leitura e alertas</span>
                            <p class="account-health-detail-text">${riskReason}</p>
                            <div class="account-health-detail-list" style="margin-top: 12px;">
                                <div class="account-health-detail-item">
                                    <span>Status da sessao</span>
                                    <strong>${statusLabel}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Sessão</span>
                                    <strong>${sessionId}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Limite diario</span>
                                    <strong>${escapeHtml(formatAccountHealthLimitHint(account.daily_limit, account.daily_usage_ratio, 'Nao configurado'))}</strong>
                                </div>
                                <div class="account-health-detail-item">
                                    <span>Possivel bloqueio</span>
                                    <strong>${escapeHtml(possibleBlockedText)}</strong>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div class="account-health-dispatches">
                        <div class="account-health-dispatches-head">
                            <strong>Disparos do dia</strong>
                        </div>
                        <div class="account-health-dispatch-list">
                            ${dispatches.length
                                ? dispatches.map((dispatch) => `
                                    <article class="account-health-dispatch-row">
                                        <div class="account-health-dispatch-main">
                                            <span class="account-health-dispatch-name">${escapeHtml(String(dispatch.campaign_name || 'Envios avulsos'))}</span>
                                            <span class="account-health-dispatch-meta">${dispatch.last_sent_at ? `Último envio ${escapeHtml(formatDate(dispatch.last_sent_at, 'time'))}` : 'Sem horário registrado'}</span>
                                        </div>
                                        <div class="account-health-dispatch-stat">
                                            <strong>${formatNumber(toNonNegativeInt(dispatch.sent_today))}</strong>
                                            <span>enviadas</span>
                                        </div>
                                        <div class="account-health-dispatch-stat">
                                            <strong>${formatNumber(toNonNegativeInt(dispatch.replied_today))}</strong>
                                            <span>responderam</span>
                                        </div>
                                        <div class="account-health-dispatch-stat">
                                            <strong>${formatPercent(Number(dispatch.response_rate || 0))}</strong>
                                            <span>taxa</span>
                                        </div>
                                    </article>
                                `).join('')
                                : '<div class="account-health-empty">Nenhum disparo enviado hoje nesta conta.</div>'
                            }
                        </div>
                    </div>
                </div>
            </details>
        `;
    }).join('');
}

async function loadAccountHealth(options: { silent?: boolean } = {}) {
    const hasCard = Boolean(document.getElementById('accountHealthList'));
    if (!hasCard) return;

    if (isOnboardingPresentationModeEnabled()) {
        const response = getOnboardingPresentationAccountHealth();
        renderAccountHealthSummary(response.summary, response.generatedAt);
        renderAccountHealthAccounts(response.accounts);
        return;
    }

    const hasRenderedContent = Boolean(document.querySelector('#accountHealthList .account-health-account'));
    if (!hasRenderedContent) {
        renderAccountHealthPlaceholder('Carregando saúde das contas...');
    }

    try {
        const response: AccountHealthResponse = await api.get('/api/dashboard/account-health');
        const normalized = normalizeAccountHealthResponse(response);
        renderAccountHealthSummary(normalized.summary, normalized.generatedAt);
        renderAccountHealthAccounts(normalized.accounts);
    } catch (error) {
        if (!hasRenderedContent) {
            renderAccountHealthPlaceholder('Não foi possível carregar a saúde das contas.');
        }
        if (!options.silent) {
            showToast('warning', 'Aviso', 'Não foi possível carregar saúde das contas');
        }
        console.error(error);
    }
}

function normalizeDateInputValue(value: string | null | undefined) {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function getDefaultStatsRange() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10)
    };
}

function normalizeRangeDates(startValue: string, endValue: string) {
    if (!startValue || !endValue) return { startDate: startValue, endDate: endValue };
    if (startValue <= endValue) {
        return { startDate: startValue, endDate: endValue };
    }
    return { startDate: endValue, endDate: startValue };
}

function buildStatsChartFallback(startDate: string, endDate: string) {
    const normalized = normalizeRangeDates(startDate, endDate);
    const start = new Date(`${normalized.startDate}T00:00:00.000Z`);
    const end = new Date(`${normalized.endDate}T00:00:00.000Z`);
    const labels: string[] = [];
    const data: number[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
        labels.push(cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }));
        data.push(0);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { labels, data };
}

function getSelectedStatsMetric(): StatsMetric {
    const metricRaw = (document.getElementById('statsMetric') as HTMLSelectElement | null)?.value || 'mensagens';
    if (metricRaw === 'mensagens' || metricRaw === 'interacoes' || metricRaw === 'novos_contatos') {
        return metricRaw;
    }
    return 'mensagens';
}

function setSelectedStatsMetric(metric: StatsMetric) {
    const statsMetric = document.getElementById('statsMetric') as HTMLSelectElement | null;
    if (!statsMetric) return false;

    if (statsMetric.value !== metric) {
        statsMetric.value = metric;
        void updateStatsPeriodChart();
    }

    return true;
}

function setSelectedStatsChartType(type: StatsChartType) {
    if (statsChartType === type) return true;
    statsChartType = type;
    updateChartTypeButtonsState();
    void updateStatsPeriodChart();
    return true;
}

function getStatsRangeFromControls() {
    const defaults = getDefaultStatsRange();
    const statsStart = document.getElementById('statsStartDate') as HTMLInputElement | null;
    const statsEnd = document.getElementById('statsEndDate') as HTMLInputElement | null;
    const startDate = normalizeDateInputValue(statsStart?.value) || defaults.startDate;
    const endDate = normalizeDateInputValue(statsEnd?.value) || defaults.endDate;
    return normalizeRangeDates(startDate, endDate);
}

function getStatsMetricColors(metric: StatsMetric) {
    if (metric === 'mensagens') {
        return {
            borderColor: '#2ef2b6',
            backgroundColor: 'rgba(46, 242, 182, 0.18)',
            glowColor: 'rgba(46, 242, 182, 0.36)',
            pointColor: '#c7fff0',
            gridColor: 'rgba(46, 242, 182, 0.1)'
        };
    }
    if (metric === 'interacoes') {
        return {
            borderColor: '#38d8ff',
            backgroundColor: 'rgba(56, 216, 255, 0.18)',
            glowColor: 'rgba(56, 216, 255, 0.34)',
            pointColor: '#d5f8ff',
            gridColor: 'rgba(56, 216, 255, 0.1)'
        };
    }
    return {
        borderColor: '#7c9cff',
        backgroundColor: 'rgba(124, 156, 255, 0.18)',
        glowColor: 'rgba(124, 156, 255, 0.34)',
        pointColor: '#ecf2ff',
        gridColor: 'rgba(124, 156, 255, 0.1)'
    };
}

function updateChartTypeButtonsState() {
    const chartButtons = document.querySelectorAll('.chart-type-toggle .chart-btn');
    chartButtons.forEach((button) => {
        const type = (button as HTMLButtonElement).dataset.chartType === 'bar' ? 'bar' : 'line';
        button.classList.toggle('active', type === statsChartType);
    });
}

function renderStatsChart(labels: string[], values: number[], metric: StatsMetric) {
    const ctx = document.getElementById('statsChart') as HTMLCanvasElement | null;
    if (!ctx || typeof Chart === 'undefined') return;
    const canvasCtx = ctx.getContext('2d');
    if (!canvasCtx) return;

    const chartLib = Chart as unknown as {
        getChart?: (canvas: HTMLCanvasElement) => { destroy: () => void } | undefined;
    };
    const existing = chartLib.getChart?.(ctx);
    if (existing) {
        existing.destroy();
    } else if (statsChartInstance?.destroy) {
        statsChartInstance.destroy();
    }

    const palette = getStatsMetricColors(metric);
    const areaGradient = canvasCtx.createLinearGradient(0, 0, 0, Math.max(ctx.height || 220, 220));
    areaGradient.addColorStop(0, palette.backgroundColor);
    areaGradient.addColorStop(0.48, palette.glowColor);
    areaGradient.addColorStop(1, 'rgba(7, 16, 30, 0.02)');

    const neonGlowPlugin = {
        id: 'dashboardNeonGlow',
        beforeDatasetsDraw(chart: { ctx: CanvasRenderingContext2D }) {
            chart.ctx.save();
            chart.ctx.shadowColor = palette.glowColor;
            chart.ctx.shadowBlur = statsChartType === 'line' ? 18 : 10;
            chart.ctx.shadowOffsetX = 0;
            chart.ctx.shadowOffsetY = 0;
        },
        afterDatasetsDraw(chart: { ctx: CanvasRenderingContext2D }) {
            chart.ctx.restore();
        }
    };

    const dataset = {
        label: STATS_METRIC_LABELS[metric],
        data: values,
        borderColor: palette.borderColor,
        backgroundColor: areaGradient,
        borderWidth: statsChartType === 'line' ? 2.4 : 0,
        fill: statsChartType === 'line',
        tension: statsChartType === 'line' ? 0.36 : 0,
        pointRadius: statsChartType === 'line' ? 3.2 : 0,
        pointHoverRadius: statsChartType === 'line' ? 5.5 : 0,
        pointBackgroundColor: palette.pointColor,
        pointBorderColor: palette.borderColor,
        pointBorderWidth: statsChartType === 'line' ? 1.4 : 0,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: palette.borderColor,
        pointHoverBorderWidth: 2,
        barThickness: statsChartType === 'bar' ? 18 : undefined,
        maxBarThickness: statsChartType === 'bar' ? 22 : undefined,
        borderRadius: statsChartType === 'bar' ? 14 : 0
    };

    statsChartInstance = new Chart(ctx, {
        type: statsChartType,
        data: { labels, datasets: [dataset] },
        plugins: [neonGlowPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: { top: 8, left: 2, right: 6, bottom: 0 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(6, 14, 28, 0.92)',
                    borderColor: palette.glowColor,
                    borderWidth: 1,
                    padding: 10,
                    titleColor: '#e8f7ff',
                    bodyColor: '#d6ecff',
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(125, 211, 252, 0.045)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(214, 228, 239, 0.52)'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: palette.gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        precision: 0,
                        color: 'rgba(214, 228, 239, 0.58)'
                    }
                }
            }
        }
    });
}

async function updateStatsPeriodChart(options: { silent?: boolean } = {}) {
    const metric = getSelectedStatsMetric();
    if (isOnboardingPresentationModeEnabled()) {
        const presentationSeries = getOnboardingPresentationStatsSeries(metric);
        renderStatsChart(presentationSeries.labels, presentationSeries.data, metric);
        return;
    }

    const range = getStatsRangeFromControls();
    const fallback = buildStatsChartFallback(range.startDate, range.endDate);
    const requestId = ++statsChartRequestSeq;

    try {
        const params = new URLSearchParams({
            startDate: range.startDate,
            endDate: range.endDate,
            metric
        });
        const response: StatsPeriodResponse = await api.get(`/api/dashboard/stats-period?${params.toString()}`);
        if (requestId !== statsChartRequestSeq) return;

        const labels = Array.isArray(response.labels) && response.labels.length > 0
            ? response.labels
            : fallback.labels;
        const values = labels.map((_, index) => {
            const source = Array.isArray(response.data) ? response.data[index] : 0;
            const parsed = Number(source);
            return Number.isFinite(parsed) ? parsed : 0;
        });

        renderStatsChart(labels, values, metric);
    } catch (error) {
        if (requestId !== statsChartRequestSeq) return;
        renderStatsChart(fallback.labels, fallback.data, metric);
        if (!options.silent) {
            showToast('warning', 'Aviso', 'Não foi possível atualizar o gráfico por período');
        }
        console.error(error);
    }
}

function bindStatsPeriodControls() {
    const statsStart = document.getElementById('statsStartDate') as HTMLInputElement | null;
    const statsEnd = document.getElementById('statsEndDate') as HTMLInputElement | null;
    const statsMetric = document.getElementById('statsMetric') as HTMLSelectElement | null;

    if (statsStart) {
        statsStart.onchange = () => {
            updateStatsPeriodChart();
        };
    }

    if (statsEnd) {
        statsEnd.onchange = () => {
            updateStatsPeriodChart();
        };
    }

    if (statsMetric) {
        statsMetric.onchange = () => {
            updateStatsPeriodChart();
        };
    }

    const chartButtons = document.querySelectorAll('.chart-type-toggle .chart-btn');
    chartButtons.forEach((button) => {
        (button as HTMLButtonElement).onclick = () => {
            const nextType = (button as HTMLButtonElement).dataset.chartType === 'bar' ? 'bar' : 'line';
            if (nextType === statsChartType) return;
            statsChartType = nextType;
            updateChartTypeButtonsState();
            updateStatsPeriodChart();
        };
    });

    updateChartTypeButtonsState();
}

function normalizeCustomEventsPeriod(value: string | null | undefined): CustomEventsPeriod {
    const normalized = String(value || '').trim().toLowerCase();
    return CUSTOM_EVENT_PERIODS[normalized] || 'this_month';
}

function getSelectedCustomEventsPeriod() {
    const select = document.getElementById('customEventsPeriod') as HTMLSelectElement | null;
    return normalizeCustomEventsPeriod(select?.value);
}

function formatCustomEventLastTriggered(value: string | null | undefined) {
    if (!value) return 'Nunca';
    return timeAgo(value);
}

function renderCustomEventsEmptyState() {
    const container = document.getElementById('customEventsList') as HTMLElement | null;
    if (!container) return;

    container.innerHTML = `
        <div class="events-empty">
            <span class="events-empty-emoji icon icon-target"></span>
            <p><strong>Nenhum evento personalizado ainda</strong></p>
            <p class="text-muted">Crie eventos e use o bloco "Registrar Evento" nos seus fluxos para medir resultados.</p>
            <button class="btn btn-primary btn-sm mt-3 events-empty-create-btn" onclick="openCustomEventModal()">Criar primeiro evento</button>
        </div>
    `;
}

function renderCustomEventsList(response: CustomEventsStatsResponse) {
    const container = document.getElementById('customEventsList') as HTMLElement | null;
    if (!container) return;

    const events = Array.isArray(response?.events) ? response.events : [];
    customEvents = events;

    if (events.length === 0) {
        renderCustomEventsEmptyState();
        return;
    }

    const totalEvents = Number(response?.totals?.events) || events.length;
    const totalTriggers = Number(response?.totals?.triggers) || events.reduce((sum, item) => sum + (Number(item.total_period) || 0), 0);

    container.innerHTML = `
        <div class="events-summary">
            <span><strong>${formatNumber(totalEvents)}</strong> evento(s)</span>
            <span>•</span>
            <span><strong>${formatNumber(totalTriggers)}</strong> disparo(s) no período</span>
        </div>
        <div class="events-list">
            ${events.map((eventItem) => {
                const eventId = Number(eventItem.id) || 0;
                const eventName = escapeHtml(eventItem.name || 'Evento sem nome');
                const eventKey = escapeHtml(eventItem.event_key || '');
                const eventTotal = Number(eventItem.total_period ?? eventItem.total_triggers) || 0;
                const isActive = Number(eventItem.is_active) > 0;
                const statusClass = isActive ? 'active' : 'inactive';
                const statusLabel = isActive ? 'Ativo' : 'Inativo';
                const lastTriggered = escapeHtml(formatCustomEventLastTriggered(eventItem.last_triggered_at));

                return `
                    <div class="events-row">
                        <div class="events-row-head">
                            <div class="events-row-main">
                                <div class="events-row-name">${eventName}</div>
                                <span class="custom-event-status ${statusClass}">${statusLabel}</span>
                                ${eventKey ? `<div class="events-row-key">${eventKey}</div>` : ''}
                            </div>
                            <div class="events-row-side">
                                <div class="events-row-count">
                                    <strong>${formatNumber(eventTotal)}</strong>
                                    <span>no período</span>
                                </div>
                                <div class="events-row-actions">
                                    <button class="btn btn-sm btn-outline btn-icon" title="Editar evento" onclick="openCustomEventModal(${eventId})">
                                        <span class="icon icon-edit icon-sm"></span>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger btn-icon" title="Excluir evento" onclick="deleteCustomEvent(${eventId})">
                                        <span class="icon icon-delete icon-sm"></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="events-row-meta">
                            <div class="events-row-last">${lastTriggered}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderCustomEventsError() {
    const container = document.getElementById('customEventsList') as HTMLElement | null;
    if (!container) return;
    container.innerHTML = '<div class="events-error">Não foi possível carregar eventos personalizados.</div>';
}

function setCustomEventsLoading() {
    const container = document.getElementById('customEventsList') as HTMLElement | null;
    if (!container) return;
    container.innerHTML = '<div class="events-loading">Carregando eventos personalizados...</div>';
}

async function loadCustomEvents(options: { silent?: boolean } = {}) {
    if (isOnboardingPresentationModeEnabled()) {
        renderCustomEventsList(getOnboardingPresentationCustomEvents(getSelectedCustomEventsPeriod()));
        return;
    }

    setCustomEventsLoading();
    const period = getSelectedCustomEventsPeriod();

    try {
        const params = new URLSearchParams({ period });
        const response: CustomEventsStatsResponse = await api.get(`/api/custom-events/stats?${params.toString()}`);
        renderCustomEventsList(response);
    } catch (error) {
        customEvents = [];
        renderCustomEventsError();
        if (!options.silent) {
            showToast('warning', 'Aviso', 'Não foi possível atualizar eventos personalizados');
        }
        console.error(error);
    }
}

function bindCustomEventsControls() {
    const periodSelect = document.getElementById('customEventsPeriod') as HTMLSelectElement | null;
    if (periodSelect) {
        periodSelect.onchange = () => {
            loadCustomEvents();
        };
    }
}

function openCustomEventModal(id?: number) {
    const modalTitle = document.getElementById('customEventModalTitle') as HTMLElement | null;
    const eventIdInput = document.getElementById('customEventId') as HTMLInputElement | null;
    const nameInput = document.getElementById('customEventName') as HTMLInputElement | null;
    const descriptionInput = document.getElementById('customEventDescription') as HTMLTextAreaElement | null;
    const activeInput = document.getElementById('customEventActive') as HTMLInputElement | null;

    const eventId = Number(id);
    const eventItem = Number.isFinite(eventId) && eventId > 0
        ? customEvents.find((item) => Number(item.id) === Math.trunc(eventId)) || null
        : null;

    if (eventIdInput) eventIdInput.value = eventItem ? String(eventItem.id) : '';
    if (nameInput) nameInput.value = eventItem?.name || '';
    if (descriptionInput) descriptionInput.value = eventItem?.description || '';
    if (activeInput) activeInput.checked = eventItem ? Number(eventItem.is_active) > 0 : true;

    if (modalTitle) {
        modalTitle.innerHTML = eventItem
            ? '<span class="icon icon-edit icon-sm"></span> Editar Evento'
            : '<span class="icon icon-add icon-sm"></span> Novo Evento';
    }

    openModal('customEventModal');
}

async function saveCustomEvent() {
    if (isOnboardingPresentationModeEnabled()) {
        showOnboardingPresentationReadOnlyToast();
        closeModal('customEventModal');
        return;
    }

    const eventIdInput = document.getElementById('customEventId') as HTMLInputElement | null;
    const nameInput = document.getElementById('customEventName') as HTMLInputElement | null;
    const descriptionInput = document.getElementById('customEventDescription') as HTMLTextAreaElement | null;
    const activeInput = document.getElementById('customEventActive') as HTMLInputElement | null;

    const eventId = Number.parseInt(eventIdInput?.value || '', 10);
    const name = String(nameInput?.value || '').trim();
    const description = String(descriptionInput?.value || '').trim();
    const isActive = activeInput?.checked !== false;

    if (!name) {
        showToast('warning', 'Aviso', 'Informe o nome do evento');
        nameInput?.focus();
        return;
    }

    const payload = {
        name,
        description,
        is_active: isActive ? 1 : 0
    };

    try {
        if (Number.isFinite(eventId) && eventId > 0) {
            await api.put(`/api/custom-events/${eventId}`, payload);
        } else {
            await api.post('/api/custom-events', payload);
        }

        closeModal('customEventModal');
        await loadCustomEvents({ silent: true });
        showToast('success', 'Sucesso', `Evento ${Number.isFinite(eventId) && eventId > 0 ? 'atualizado' : 'criado'} com sucesso`);
    } catch (error) {
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível salvar o evento');
    }
}

async function deleteCustomEvent(id: number) {
    if (isOnboardingPresentationModeEnabled()) {
        showOnboardingPresentationReadOnlyToast();
        return;
    }

    const eventId = Number(id);
    if (!Number.isFinite(eventId) || eventId <= 0) return;

    const eventItem = customEvents.find((item) => Number(item.id) === Math.trunc(eventId));
    const name = eventItem?.name || 'este evento';
    if (!await appConfirm(`Deseja excluir ${name}?`, 'Excluir evento')) return;

    try {
        await api.delete(`/api/custom-events/${eventId}`);
        await loadCustomEvents({ silent: true });
        showToast('success', 'Sucesso', 'Evento removido com sucesso');
    } catch (error) {
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível remover o evento');
    }
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// Carregar dados ao iniciar
function initDashboard() {
    const defaults = getDefaultStatsRange();
    const statsStart = document.getElementById('statsStartDate') as HTMLInputElement | null;
    const statsEnd = document.getElementById('statsEndDate') as HTMLInputElement | null;
    const statsMetric = document.getElementById('statsMetric') as HTMLSelectElement | null;
    const customEventsPeriod = document.getElementById('customEventsPeriod') as HTMLSelectElement | null;
    if (statsStart && !normalizeDateInputValue(statsStart.value)) statsStart.value = defaults.startDate;
    if (statsEnd && !normalizeDateInputValue(statsEnd.value)) statsEnd.value = defaults.endDate;
    if (statsMetric && !['mensagens', 'interacoes', 'novos_contatos'].includes(String(statsMetric.value || '').trim().toLowerCase())) {
        statsMetric.value = 'mensagens';
    }
    if (customEventsPeriod && !CUSTOM_EVENT_PERIODS[String(customEventsPeriod.value || '').trim().toLowerCase()]) {
        customEventsPeriod.value = 'this_month';
    }
    bindStatsPeriodControls();
    bindCustomEventsControls();
    bindOnboardingPresentationDashboardBridge();
    initStatsChart();
    initOnboardingCard();
    loadDashboardData();
}

onReady(initDashboard);

// Carregar dados do dashboard
async function loadDashboardData() {
    try {
        showLoading('Carregando dados...');

        if (isOnboardingPresentationModeEnabled()) {
            dashboardLeadSummary = getOnboardingPresentationDashboardSummary();
            allLeads = getOnboardingPresentationDashboardLeads();
            updateStats();
            updateFunnel();
            renderLeadsTable();

            await Promise.all([
                updateStatsPeriodChart({ silent: true }),
                loadAccountHealth({ silent: true }),
                loadCustomEvents({ silent: true }),
                loadOnboardingVideo({ silent: true })
            ]);

            hideLoading();
            return;
        }

        const cachedSummary = readDashboardSummaryCache();
        if (cachedSummary) {
            dashboardLeadSummary = cachedSummary;
            updateStats();
            updateFunnel();
        } else {
            dashboardLeadSummary = buildDefaultLeadSummary();
            updateStats();
            updateFunnel();
        }

        const hasLeadsTable = Boolean(document.getElementById('leadsTableBody'));
        const leadsTablePromise = hasLeadsTable
            ? fetchDashboardTableLeads().then((leads) => {
                allLeads = leads;
                renderLeadsTable();
            }).catch(() => {
                allLeads = [];
                renderLeadsTable();
            })
            : Promise.resolve();

        await Promise.all([
            loadDashboardLeadSummary({ silent: true }),
            leadsTablePromise,
            updateStatsPeriodChart({ silent: true }),
            loadAccountHealth({ silent: true }),
            loadCustomEvents({ silent: true }),
            loadOnboardingVideo({ silent: true })
        ]);
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível carregar os dados');
        console.error(error);
    }
}

async function loadDashboardLeadSummary(options: { silent?: boolean } = {}) {
    if (isOnboardingPresentationModeEnabled()) {
        dashboardLeadSummary = getOnboardingPresentationDashboardSummary();
        updateStats();
        updateFunnel();
        return;
    }

    try {
        const response: LeadSummaryResponse = await api.get('/api/leads/summary');
        dashboardLeadSummary = normalizeLeadSummaryResponse(response);
        writeDashboardSummaryCache(dashboardLeadSummary);
        updateStats();
        updateFunnel();
    } catch (error) {
        if (!options.silent) {
            showToast('warning', 'Aviso', 'Não foi possível carregar resumo de leads');
        }
        console.error(error);
    }
}

async function fetchDashboardTableLeads() {
    if (isOnboardingPresentationModeEnabled()) {
        return getOnboardingPresentationDashboardLeads();
    }

    const params = new URLSearchParams();
    params.set('limit', String(DASHBOARD_TABLE_FETCH_LIMIT));
    params.set('offset', '0');
    const response: LeadsResponse = await api.get(`/api/leads?${params.toString()}`);
    return Array.isArray(response?.leads) ? response.leads : [];
}

function initStatsChart() {
    const range = getStatsRangeFromControls();
    const fallback = buildStatsChartFallback(range.startDate, range.endDate);
    renderStatsChart(fallback.labels, fallback.data, getSelectedStatsMetric());
}

// Atualizar estatísticas
function updateStats() {
    const total = toNonNegativeInt(dashboardLeadSummary.total) || allLeads.length;
    const stage1 = toNonNegativeInt(dashboardLeadSummary.by_status[1]);
    const stage2 = toNonNegativeInt(dashboardLeadSummary.by_status[2]);
    const stage3 = toNonNegativeInt(dashboardLeadSummary.by_status[3]);
    const completed = toNonNegativeInt(dashboardLeadSummary.completed) || stage3;
    const pending = toNonNegativeInt(dashboardLeadSummary.pending) || (stage1 + stage2);
    const conversion = total > 0 ? (completed / total * 100) : 0;

    const totalLeads = document.getElementById('totalLeads') as HTMLElement | null;
    const completedLeads = document.getElementById('completedLeads') as HTMLElement | null;
    const pendingLeads = document.getElementById('pendingLeads') as HTMLElement | null;
    const conversionRate = document.getElementById('conversionRate') as HTMLElement | null;

    if (totalLeads) totalLeads.textContent = formatNumber(total);
    if (completedLeads) completedLeads.textContent = formatNumber(completed);
    if (pendingLeads) pendingLeads.textContent = formatNumber(pending);
    if (conversionRate) conversionRate.textContent = formatPercent(conversion);

    const statsContacts = document.getElementById('statsContacts') as HTMLElement | null;
    const statsMessages = document.getElementById('statsMessages') as HTMLElement | null;
    const statsInteractions = document.getElementById('statsInteractionsPer') as HTMLElement | null;
    if (statsContacts) statsContacts.textContent = formatNumber(total);
    if (statsMessages) statsMessages.textContent = formatNumber(total * 2);
    if (statsInteractions) statsInteractions.textContent = total > 0 ? (total * 2 / total).toFixed(1) : '0';
}

// Atualizar funil
function updateFunnel() {
    const total = toNonNegativeInt(dashboardLeadSummary.total) || allLeads.length;
    const stage1 = toNonNegativeInt(dashboardLeadSummary.by_status[1]);
    const stage2 = toNonNegativeInt(dashboardLeadSummary.by_status[2]);
    const stage3 = toNonNegativeInt(dashboardLeadSummary.by_status[3]);
    const stage4 = toNonNegativeInt(dashboardLeadSummary.by_status[4]);

    const funnel1 = document.getElementById('funnel1') as HTMLElement | null;
    const funnel2 = document.getElementById('funnel2') as HTMLElement | null;
    const funnel3 = document.getElementById('funnel3') as HTMLElement | null;
    const funnel4 = document.getElementById('funnel4') as HTMLElement | null;
    const funnel2Percent = document.getElementById('funnel2Percent') as HTMLElement | null;
    const funnel3Percent = document.getElementById('funnel3Percent') as HTMLElement | null;
    const funnel4Percent = document.getElementById('funnel4Percent') as HTMLElement | null;

    if (funnel1) funnel1.textContent = formatNumber(stage1 + stage2 + stage3);
    if (funnel2) funnel2.textContent = formatNumber(stage2 + stage3);
    if (funnel3) funnel3.textContent = formatNumber(stage3);
    if (funnel4) funnel4.textContent = formatNumber(stage3);

    if (total > 0) {
        if (funnel2Percent) funnel2Percent.textContent = formatPercent((stage2 + stage3) / total * 100);
        if (funnel3Percent) funnel3Percent.textContent = formatPercent(stage3 / total * 100);
        if (funnel4Percent) funnel4Percent.textContent = formatPercent(stage3 / total * 100);
    }
}

function parseLeadTags(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw
            .map((item) => {
                if (typeof item === 'string') return item.trim();
                if (item && typeof item === 'object' && 'name' in item) {
                    return String((item as { name?: unknown }).name || '').trim();
                }
                return '';
            })
            .filter(Boolean);
    }

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => String(item || '').trim())
                    .filter(Boolean);
            }
        } catch {
            // Valor simples separado por vírgula ou ponto e vírgula.
        }
        return trimmed
            .split(/[,;|]/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
}

function renderLeadTagChips(lead: Lead): string {
    const tags = parseLeadTags(lead.tags);
    if (!tags.length) return '-';
    return `<div class="contacts-tags-cell">${tags
        .map((tag) => `<span class="badge badge-gray contacts-tag-chip">${escapeHtml(tag)}</span>`)
        .join('')}</div>`;
}

function getLeadLastInteraction(lead: Lead): string {
    const lastInteraction = lead.last_message_at || lead.last_interaction_at || lead.created_at;
    return lastInteraction ? timeAgo(lastInteraction) : '-';
}

// Renderizar tabela de leads
function renderLeadsTable(leads: Lead[] | null = null) {
    const tbody = document.getElementById('leadsTableBody') as HTMLElement | null;
    if (!tbody) return;
    const data = leads || allLeads;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    <div class="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Nenhum lead encontrado</p>
                    <button class="btn btn-primary mt-3" onclick="openModal('addLeadModal')">Adicionar Lead</button>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((lead) => {
        const contactMeta = [lead.vehicle, lead.plate].map((value) => String(value || '').trim()).filter(Boolean).join(' • ');
        const phone = String(lead.phone || '').replace(/\D/g, '');
        const phoneDisplay = phone ? formatPhone(phone) : '-';
        const phoneCell = phone
            ? `<a href="https://wa.me/55${phone}" target="_blank" style="color: var(--whatsapp); text-decoration: none;">${phoneDisplay}</a>`
            : phoneDisplay;
        const whatsappAction = phone
            ? `onclick="sendWhatsApp(${Number(lead.id) || 0}, '${phone}')" title="Mensagem"`
            : 'disabled title="WhatsApp indisponível"';

        return `
            <tr data-id="${lead.id}">
                <td>
                    <label class="checkbox-wrapper">
                        <input type="checkbox" class="lead-checkbox" value="${lead.id}" onchange="updateSelection()">
                        <span class="checkbox-custom"></span>
                    </label>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar" style="background: ${getAvatarColor(lead.name)}">${getInitials(lead.name)}</div>
                        <div>
                            <div style="font-weight: 600;">${escapeHtml(lead.name || 'Sem nome')}</div>
                            <div style="font-size: 12px; color: var(--gray-500);">${escapeHtml(contactMeta || lead.email || '')}</div>
                        </div>
                    </div>
                </td>
                <td>${phoneCell}</td>
                <td>${getStatusBadge(lead.status)}</td>
                <td>${renderLeadTagChips(lead)}</td>
                <td>${getLeadLastInteraction(lead)}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-sm btn-whatsapp btn-icon" ${whatsappAction}>
                            <span class="icon icon-message icon-sm"></span>
                        </button>
                        <button class="btn btn-sm btn-outline btn-icon" onclick="editLead(${lead.id})" title="Editar">
                            <span class="icon icon-edit icon-sm"></span>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteLead(${lead.id})" title="Excluir">
                            <span class="icon icon-delete icon-sm"></span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filtrar leads
function filterLeads() {
    const search = (document.getElementById('searchLeads') as HTMLInputElement | null)?.value.toLowerCase() || '';
    const status = (document.getElementById('filterStatus') as HTMLSelectElement | null)?.value || '';

    let filtered = allLeads;

    if (search) {
        filtered = filtered.filter(l => 
            (l.name && l.name.toLowerCase().includes(search)) ||
            (l.phone && l.phone.includes(search)) ||
            (l.vehicle && l.vehicle.toLowerCase().includes(search)) ||
            (l.plate && l.plate.toLowerCase().includes(search))
        );
    }

    if (status) {
        filtered = filtered.filter(l => l.status == (parseInt(status, 10) as LeadStatus));
    }

    renderLeadsTable(filtered);
}

// Selecionar todos
function toggleSelectAll() {
    const selectAll = (document.getElementById('selectAll') as HTMLInputElement | null)?.checked || false;
    const checkboxes = document.querySelectorAll('.lead-checkbox');
    checkboxes.forEach(cb => {
        (cb as HTMLInputElement).checked = selectAll;
    });
    updateSelection();
}

// Atualizar seleção
function updateSelection() {
    const checkboxes = document.querySelectorAll('.lead-checkbox:checked');
    selectedLeads = Array.from(checkboxes).map(cb => parseInt((cb as HTMLInputElement).value, 10));
}

// Salvar novo lead
async function saveLead() {
    if (isOnboardingPresentationModeEnabled()) {
        showOnboardingPresentationReadOnlyToast();
        closeModal('addLeadModal');
        return;
    }

    const name = (document.getElementById('leadName') as HTMLInputElement | null)?.value.trim() || '';
    const phone = (document.getElementById('leadPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '';
    const vehicle = (document.getElementById('leadVehicle') as HTMLInputElement | null)?.value.trim() || '';
    const plate = (document.getElementById('leadPlate') as HTMLInputElement | null)?.value.trim().toUpperCase() || '';
    const email = (document.getElementById('leadEmail') as HTMLInputElement | null)?.value.trim() || '';
    const status = parseInt((document.getElementById('leadStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus;

    if (!name || !phone) {
        showToast('error', 'Erro', 'Nome e telefone são obrigatórios');
        return;
    }

    if (!validatePhone(phone)) {
        showToast('error', 'Erro', 'Telefone inválido');
        return;
    }

    try {
        showLoading('Salvando...');
        
        await api.post('/api/leads', {
            name, phone, vehicle, plate, email, status
        });

        closeModal('addLeadModal');
        (document.getElementById('addLeadForm') as HTMLFormElement | null)?.reset();
        
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead adicionado com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível salvar o lead');
    }
}

// Editar lead
function editLead(id: number) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;

    const editLeadId = document.getElementById('editLeadId') as HTMLInputElement | null;
    const editLeadName = document.getElementById('editLeadName') as HTMLInputElement | null;
    const editLeadPhone = document.getElementById('editLeadPhone') as HTMLInputElement | null;
    const editLeadVehicle = document.getElementById('editLeadVehicle') as HTMLInputElement | null;
    const editLeadPlate = document.getElementById('editLeadPlate') as HTMLInputElement | null;
    const editLeadEmail = document.getElementById('editLeadEmail') as HTMLInputElement | null;
    const editLeadStatus = document.getElementById('editLeadStatus') as HTMLSelectElement | null;

    if (editLeadId) editLeadId.value = String(lead.id);
    if (editLeadName) editLeadName.value = lead.name || '';
    if (editLeadPhone) editLeadPhone.value = lead.phone || '';
    if (editLeadVehicle) editLeadVehicle.value = lead.vehicle || '';
    if (editLeadPlate) editLeadPlate.value = lead.plate || '';
    if (editLeadEmail) editLeadEmail.value = lead.email || '';
    if (editLeadStatus) editLeadStatus.value = String(lead.status || 1);

    openModal('editLeadModal');
}

// Atualizar lead
async function updateLead() {
    if (isOnboardingPresentationModeEnabled()) {
        showOnboardingPresentationReadOnlyToast();
        closeModal('editLeadModal');
        return;
    }

    const id = (document.getElementById('editLeadId') as HTMLInputElement | null)?.value || '';
    const name = (document.getElementById('editLeadName') as HTMLInputElement | null)?.value.trim() || '';
    const phone = (document.getElementById('editLeadPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '';
    const vehicle = (document.getElementById('editLeadVehicle') as HTMLInputElement | null)?.value.trim() || '';
    const plate = (document.getElementById('editLeadPlate') as HTMLInputElement | null)?.value.trim().toUpperCase() || '';
    const email = (document.getElementById('editLeadEmail') as HTMLInputElement | null)?.value.trim() || '';
    const status = parseInt((document.getElementById('editLeadStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus;

    if (!name || !phone) {
        showToast('error', 'Erro', 'Nome e telefone são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando...');
        
        await api.put(`/api/leads/${id}`, {
            name, phone, vehicle, plate, email, status
        });

        closeModal('editLeadModal');
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead atualizado com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível atualizar o lead');
    }
}

// Excluir lead
async function deleteLead(id: number) {
    if (isOnboardingPresentationModeEnabled()) {
        showOnboardingPresentationReadOnlyToast();
        return;
    }

    if (!await appConfirm('Tem certeza que deseja excluir este lead?', 'Excluir lead')) return;

    try {
        showLoading('Excluindo...');
        await api.delete(`/api/leads/${id}`);
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead excluído com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível excluir o lead');
    }
}

// Enviar WhatsApp
function sendWhatsApp(leadId: number, phone: string) {
    const normalizedLeadId = Number(leadId || 0);
    if (Number.isFinite(normalizedLeadId) && normalizedLeadId > 0) {
        window.location.href = `#/inbox?leadId=${Math.floor(normalizedLeadId)}`;
        return;
    }

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) return;
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
}

// Importar leads
async function importLeads() {
    if (isOnboardingPresentationModeEnabled()) {
        showOnboardingPresentationReadOnlyToast();
        closeModal('importModal');
        return;
    }

    const fileInput = document.getElementById('importFile') as HTMLInputElement | null;
    const textInput = (document.getElementById('importText') as HTMLTextAreaElement | null)?.value.trim() || '';
    const importTagRaw = (document.getElementById('importTag') as HTMLInputElement | null)?.value.trim() || '';
    const importTags = importTagRaw
        .split(/[,;|]/)
        .map(t => t.trim())
        .filter(Boolean);

    let data: Array<Record<string, string>> = [];

    if (fileInput?.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const text = await file.text();
        data = parseCSV(text);
    } else if (textInput) {
        data = parseCSV(textInput);
    } else {
        showToast('error', 'Erro', 'Selecione um arquivo ou cole os dados');
        return;
    }

    if (data.length === 0) {
        showToast('error', 'Erro', 'Nenhum dado válido encontrado');
        return;
    }

    try {
        showLoading(`Importando ${data.length} leads...`);
        
        let imported = 0;
        let limitErrorMessage = '';
        for (const row of data) {
            const phone = (row.telefone || row.phone || row.whatsapp || '').replace(/\D/g, '');
            if (!phone) continue;

            try {
                await api.post('/api/leads', {
                    name: row.nome || row.name || 'Sem nome',
                    phone: phone,
                    vehicle: row.veiculo || row.vehicle || '',
                    plate: row.placa || row.plate || '',
                    status: 1,
                    tags: importTags,
                    source: 'import'
                });
                imported++;
            } catch (e) {
                if (getErrorCode(e).startsWith('PLAN_')) {
                    limitErrorMessage = e instanceof Error ? e.message : 'Limite do plano atingido';
                    break;
                }
                console.error('Erro ao importar:', e);
            }
        }

        closeModal('importModal');
        if (fileInput) fileInput.value = '';
        const importText = document.getElementById('importText') as HTMLTextAreaElement | null;
        if (importText) importText.value = '';
        const importTag = document.getElementById('importTag') as HTMLInputElement | null;
        if (importTag) importTag.value = '';
        
        await loadDashboardData();
        if (limitErrorMessage) {
            const partialImportMessage = imported > 0 ? `${imported} leads importados. ` : '';
            showToast('warning', 'Aviso', `${partialImportMessage}${limitErrorMessage}`);
            return;
        }
        showToast('success', 'Sucesso', `${imported} leads importados com sucesso!`);
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Falha na importação');
    }
}

// Exportar leads
function exportLeads() {
    if (allLeads.length === 0) {
        showToast('warning', 'Aviso', 'Nenhum lead para exportar');
        return;
    }

    const data = allLeads.map(l => ({
        nome: l.name,
        telefone: l.phone,
        veiculo: l.vehicle,
        placa: l.plate,
        email: l.email,
        status: getStatusLabel(l.status),
        data: formatDate(l.created_at, 'datetime')
    }));

    exportToCSV(data, `leads_self_${formatDate(new Date(), 'short').replace(/\//g, '-')}.csv`);
    showToast('success', 'Sucesso', 'Leads exportados com sucesso!');
}

// Confirmar reset
async function confirmReset() {
    if (!await appConfirm('ATENCAO: Esta acao ira excluir TODOS os leads. Deseja continuar?', 'Reset de leads')) return;
    if (!await appConfirm('Tem certeza absoluta? Esta acao nao pode ser desfeita!', 'Reset de leads')) return;
    
    showToast('info', 'Info', 'Função de reset desabilitada por segurança');
}

const windowAny = window as Window & {
    initDashboard?: () => void;
    initOnboardingCard?: () => void;
    resetOnboardingTourState?: () => void;
    loadDashboardData?: () => Promise<void>;
    loadCustomEvents?: (options?: { silent?: boolean }) => Promise<void>;
    startOnboardingTour?: (stepId?: string) => void;
    closeOnboardingTour?: () => void;
    goToPreviousOnboardingTourStep?: () => void;
    goToNextOnboardingTourStep?: () => void;
    toggleOnboardingStep?: (stepId: string, checked?: boolean) => void;
    selectOnboardingVideoStep?: (stepId: string) => void;
    goToOnboardingStep?: (stepId: string) => void;
    resetOnboardingChecklist?: () => void;
    playOnboardingVideo?: () => void;
    toggleOnboardingVideoPlayback?: () => void;
    toggleOnboardingVideoMute?: () => void;
    restartOnboardingVideo?: () => void;
    seekOnboardingVideo?: (progress: number) => void;
    openCustomEventModal?: (id?: number) => void;
    saveCustomEvent?: () => Promise<void>;
    deleteCustomEvent?: (id: number) => Promise<void>;
    refreshOnboardingTourSurface?: () => void;
    updateStats?: () => void;
    updateFunnel?: () => void;
    renderLeadsTable?: (leads?: Lead[] | null) => void;
    filterLeads?: () => void;
    toggleSelectAll?: () => void;
    updateSelection?: () => void;
    saveLead?: () => Promise<void>;
    editLead?: (id: number) => void;
    updateLead?: () => Promise<void>;
    deleteLead?: (id: number) => Promise<void>;
    sendWhatsApp?: (phone: string) => void;
    importLeads?: () => Promise<void>;
    exportLeads?: () => void;
    confirmReset?: () => Promise<void>;
};
windowAny.initDashboard = initDashboard;
windowAny.initOnboardingCard = initOnboardingCard;
windowAny.resetOnboardingTourState = resetOnboardingTourState;
windowAny.loadDashboardData = loadDashboardData;
windowAny.loadCustomEvents = loadCustomEvents;
windowAny.startOnboardingTour = startOnboardingTour;
windowAny.closeOnboardingTour = closeOnboardingTour;
windowAny.refreshOnboardingTourSurface = refreshOnboardingTourSurface;
windowAny.goToPreviousOnboardingTourStep = goToPreviousOnboardingTourStep;
windowAny.goToNextOnboardingTourStep = goToNextOnboardingTourStep;
windowAny.toggleOnboardingStep = toggleOnboardingStep;
windowAny.selectOnboardingVideoStep = selectOnboardingVideoStep;
windowAny.goToOnboardingStep = goToOnboardingStep;
windowAny.resetOnboardingChecklist = resetOnboardingChecklist;
windowAny.playOnboardingVideo = playOnboardingVideo;
windowAny.toggleOnboardingVideoPlayback = toggleOnboardingVideoPlayback;
windowAny.toggleOnboardingVideoMute = toggleOnboardingVideoMute;
windowAny.restartOnboardingVideo = restartOnboardingVideo;
windowAny.seekOnboardingVideo = seekOnboardingVideo;
windowAny.openCustomEventModal = openCustomEventModal;
windowAny.saveCustomEvent = saveCustomEvent;
windowAny.deleteCustomEvent = deleteCustomEvent;
windowAny.updateStats = updateStats;
windowAny.updateFunnel = updateFunnel;
windowAny.renderLeadsTable = renderLeadsTable;
windowAny.filterLeads = filterLeads;
windowAny.toggleSelectAll = toggleSelectAll;
windowAny.updateSelection = updateSelection;
windowAny.saveLead = saveLead;
windowAny.editLead = editLead;
windowAny.updateLead = updateLead;
windowAny.deleteLead = deleteLead;
windowAny.sendWhatsApp = sendWhatsApp;
windowAny.importLeads = importLeads;
windowAny.exportLeads = exportLeads;
windowAny.confirmReset = confirmReset;

export { initDashboard };
