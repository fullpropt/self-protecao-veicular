export type OnboardingPresentationStepId =
  | 'connect_whatsapp'
  | 'configure_accounts'
  | 'open_inbox'
  | 'create_first_contact'
  | 'create_tags'
  | 'configure_dynamic_fields'
  | 'create_campaign'
  | 'create_automation';

export type OnboardingPresentationSnapshot = {
  enabled: boolean;
  stepId: OnboardingPresentationStepId | null;
  startedAt: number;
};

type DashboardMetricKey = 'novos_contatos' | 'mensagens' | 'interacoes';
type PresentationLeadStatus = 1 | 2 | 3 | 4;

type PresentationLead = {
  id: number;
  name: string;
  phone: string;
  vehicle?: string;
  plate?: string;
  email?: string;
  tags?: string[];
  status: PresentationLeadStatus;
  created_at: string;
  last_message_at?: string | null;
  last_interaction_at?: string | null;
  session_id?: string;
  session_label?: string;
  notes?: string;
  custom_fields?: Record<string, unknown> | null;
};

type PresentationLeadSummary = {
  total: number;
  by_status: Record<PresentationLeadStatus, number>;
  pending: number;
  completed: number;
};

type PresentationStatsSeries = {
  labels: string[];
  data: number[];
};

type PresentationAccountDispatch = {
  campaign_id?: number | null;
  campaign_name?: string | null;
  sent_today?: number;
  unique_leads_today?: number;
  replied_today?: number;
  response_rate?: number;
  first_sent_at?: string | null;
  last_sent_at?: string | null;
};

type PresentationAccountHealthAccount = {
  session_id: string;
  session_name: string;
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
  risk_level?: 'critical' | 'attention' | 'healthy' | 'paused';
  risk_label?: string;
  risk_reason?: string;
  daily_usage_ratio?: number | null;
  hourly_usage_ratio?: number | null;
  possible_blocked_contacts?: number;
  dispatches?: PresentationAccountDispatch[];
};

type PresentationAccountHealthResponse = {
  summary: {
    total_accounts: number;
    critical: number;
    attention: number;
    healthy: number;
    paused: number;
    cooldown: number;
  };
  accounts: PresentationAccountHealthAccount[];
  generatedAt: string;
  date: string;
};

type PresentationCustomEvent = {
  id: number;
  name: string;
  event_key?: string;
  description?: string;
  is_active?: number;
  total_period?: number;
  total_triggers?: number;
  last_triggered_at?: string | null;
};

type PresentationCustomEventsResponse = {
  events: PresentationCustomEvent[];
  totals: {
    events: number;
    activeEvents: number;
    triggers: number;
  };
  period: string;
};

type PresentationSessionRecord = {
  session_id: string;
  name?: string;
  phone?: string;
  status?: string;
  connected?: boolean;
  campaign_enabled?: boolean | number;
  daily_limit?: number;
  dispatch_weight?: number;
};

type PresentationPlanUsage = {
  planName: string;
  current: number;
  max: number | null;
  unlimited: boolean;
};

type PresentationTag = {
  id: number;
  name: string;
  color?: string;
  description?: string;
};

type PresentationTemplate = {
  id: number;
  name: string;
  content: string;
  category?: string;
  media_type?: string;
  media_url?: string;
};

type PresentationContactField = {
  key: string;
  label: string;
  placeholder?: string;
  is_default?: boolean;
  source?: string;
};

type PresentationConversation = {
  id: number;
  lead_id: number;
  session_id: string;
  name: string;
  phone: string;
  avatar_url?: string;
  last_message?: string;
  last_message_at?: string;
  unread?: number;
  status?: PresentationLeadStatus;
  is_bot_active?: number;
  flow_is_running?: number;
  flow_running_id?: number | null;
};

type PresentationMessage = {
  id: number | string;
  content: string;
  direction: 'outgoing' | 'incoming';
  status?: string;
  created_at: string;
  media_type?: string;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_filename?: string | null;
};

type PresentationCampaignStatus = 'active' | 'paused' | 'completed' | 'draft';
type PresentationCampaignType = 'broadcast' | 'drip';

type PresentationCampaignSenderAccount = {
  session_id: string;
  weight?: number;
  daily_limit?: number;
  is_active?: number | boolean;
};

type PresentationCampaign = {
  id: number;
  name: string;
  description?: string;
  type: PresentationCampaignType;
  distribution_strategy?: 'single' | 'round_robin' | 'weighted_round_robin' | 'random';
  distribution_config?: Record<string, unknown> | null;
  message_variations?: string[];
  sender_accounts?: PresentationCampaignSenderAccount[];
  status: PresentationCampaignStatus;
  sent?: number;
  delivered?: number;
  read?: number;
  replied?: number;
  created_at: string;
  segment?: string;
  tag_filter?: string;
  tag_filters?: string[];
  message?: string;
  delay?: number;
  delay_min?: number;
  delay_max?: number;
  start_at?: string;
  send_window_enabled?: number | boolean;
  send_window_start?: string;
  send_window_end?: string;
  queue_total?: number;
  queue_pending?: number;
  queue_processing?: number;
  queue_finalized?: number | boolean;
};

type PresentationCampaignRecipient = {
  id: number;
  name?: string;
  phone?: string;
  status?: number;
  tags?: string;
  vehicle?: string;
  plate?: string;
  campaign_sent?: boolean;
  campaign_delivered?: boolean;
  campaign_read?: boolean;
  campaign_sent_at?: string | null;
  campaign_queue_status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | null;
  campaign_queue_error?: string | null;
};

type PresentationAutomation = {
  id: number;
  name: string;
  description?: string;
  trigger_type: 'status_change' | 'message_received' | 'keyword' | 'inactivity' | 'new_lead' | 'schedule';
  trigger_value?: string;
  action_type: 'send_message' | 'change_status' | 'add_tag' | 'start_flow' | 'notify';
  action_value?: string;
  delay?: number;
  session_scope?: string | null;
  session_ids?: string[];
  tag_filter?: string | null;
  tag_filters?: string[];
  is_active: boolean;
  executions?: number;
  last_execution?: string | null;
};

type PresentationRuntime = {
  sessions: PresentationSessionRecord[];
  conversations: PresentationConversation[];
  messagesByConversation: Record<string, PresentationMessage[]>;
};

export const ONBOARDING_PRESENTATION_EVENT = 'zapvender:onboarding-presentation-change';

const STEP_IDS: OnboardingPresentationStepId[] = [
  'connect_whatsapp',
  'configure_accounts',
  'open_inbox',
  'create_first_contact',
  'create_tags',
  'configure_dynamic_fields',
  'create_campaign',
  'create_automation'
];

const DASHBOARD_PRESENTATION_SUMMARY: PresentationLeadSummary = {
  total: 148,
  by_status: { 1: 64, 2: 39, 3: 31, 4: 14 },
  pending: 103,
  completed: 45
};

const DASHBOARD_PRESENTATION_LEADS: PresentationLead[] = [
  {
    id: 9101,
    name: 'Fernanda Alves',
    phone: '27981431090',
    vehicle: 'Corolla 2023',
    plate: 'RTA2J91',
    email: 'fernanda.alves@exemplo.com',
    tags: ['Lead quente', 'Indicacao'],
    status: 3,
    created_at: '2026-03-18T14:00:00.000Z',
    last_interaction_at: '2026-03-20T13:42:00.000Z',
    session_id: 'zv_demo_principal',
    session_label: 'ZapVender Comercial',
    notes: 'Prefere atendimento no periodo da tarde.',
    custom_fields: { cidade: 'Vitoria', curso: 'Inscricao 2026', origem: 'Indicacao' }
  },
  {
    id: 9102,
    name: 'Carlos Menezes',
    phone: '27998155001',
    vehicle: 'HB20 2022',
    plate: 'QWE8D19',
    email: 'carlos.menezes@exemplo.com',
    tags: ['Novo contato'],
    status: 2,
    created_at: '2026-03-19T11:10:00.000Z',
    last_message_at: '2026-03-20T12:15:00.000Z',
    session_id: 'zv_demo_principal',
    session_label: 'ZapVender Comercial',
    notes: 'Solicitou comparativo entre planos.',
    custom_fields: { cidade: 'Serra', curso: 'Renovacao', origem: 'Instagram' }
  },
  {
    id: 9103,
    name: 'Juliana Rocha',
    phone: '27998244077',
    vehicle: 'Onix Plus 2024',
    plate: 'LPA4R52',
    email: 'juliana.rocha@exemplo.com',
    tags: ['Campanha marco', 'VIP'],
    status: 1,
    created_at: '2026-03-20T09:10:00.000Z',
    last_interaction_at: '2026-03-20T09:18:00.000Z',
    session_id: 'zv_demo_suporte',
    session_label: 'ZapVender Suporte',
    notes: 'Vai enviar documentos ate sexta.',
    custom_fields: { cidade: 'Vila Velha', curso: 'Matricula', origem: 'Landing page' }
  },
  {
    id: 9104,
    name: 'Ricardo Tavares',
    phone: '27999220118',
    vehicle: 'Compass 2021',
    plate: 'MZX6C11',
    email: 'ricardo.tavares@exemplo.com',
    tags: ['Negociacao'],
    status: 3,
    created_at: '2026-03-17T16:40:00.000Z',
    last_message_at: '2026-03-20T10:55:00.000Z',
    session_id: 'zv_demo_principal',
    session_label: 'ZapVender Comercial',
    notes: 'Cliente em fase final de aprovacao.',
    custom_fields: { cidade: 'Cariacica', curso: 'Transferencia', origem: 'Google' }
  },
  {
    id: 9105,
    name: 'Bianca Costa',
    phone: '27999777112',
    vehicle: 'Nivus 2024',
    plate: 'JKL3H29',
    email: 'bianca.costa@exemplo.com',
    tags: ['Documento recebido'],
    status: 2,
    created_at: '2026-03-18T09:32:00.000Z',
    last_message_at: '2026-03-20T11:40:00.000Z',
    session_id: 'zv_demo_suporte',
    session_label: 'ZapVender Suporte',
    notes: 'Aguardando confirmar titularidade.',
    custom_fields: { cidade: 'Guarapari', curso: 'Inscricao 2026', origem: 'Anuncio' }
  }
];

const DASHBOARD_PRESENTATION_STATS: Record<DashboardMetricKey, PresentationStatsSeries> = {
  mensagens: {
    labels: ['14/03', '15/03', '16/03', '17/03', '18/03', '19/03', '20/03'],
    data: [26, 32, 35, 41, 39, 47, 54]
  },
  interacoes: {
    labels: ['14/03', '15/03', '16/03', '17/03', '18/03', '19/03', '20/03'],
    data: [14, 17, 19, 23, 22, 24, 29]
  },
  novos_contatos: {
    labels: ['14/03', '15/03', '16/03', '17/03', '18/03', '19/03', '20/03'],
    data: [3, 5, 4, 7, 6, 8, 9]
  }
};

const DASHBOARD_PRESENTATION_ACCOUNT_HEALTH: PresentationAccountHealthResponse = {
  summary: { total_accounts: 3, critical: 0, attention: 1, healthy: 2, paused: 0, cooldown: 1 },
  generatedAt: '2026-03-20T13:58:00.000Z',
  date: '2026-03-20',
  accounts: [
    {
      session_id: 'zv_demo_principal',
      session_name: 'ZapVender Comercial',
      phone: '+55 27 99876-1000',
      status: 'connected',
      status_label: 'Conectada',
      campaign_enabled: true,
      daily_limit: 120,
      hourly_limit: 18,
      cooldown_until: null,
      cooldown_active: false,
      sent_today: 42,
      unique_leads_today: 31,
      replied_today: 12,
      response_rate: 38.7,
      sent_last_hour: 8,
      first_sent_at: '2026-03-20T11:05:00.000Z',
      last_sent_at: '2026-03-20T13:52:00.000Z',
      risk_level: 'healthy',
      risk_label: 'Saudavel',
      risk_reason: 'Conta principal com ritmo estavel e boa taxa de resposta.',
      daily_usage_ratio: 0.35,
      hourly_usage_ratio: 0.44,
      possible_blocked_contacts: 0,
      dispatches: [
        {
          campaign_id: 301,
          campaign_name: 'Reativacao marco',
          sent_today: 28,
          unique_leads_today: 22,
          replied_today: 10,
          response_rate: 45.5,
          last_sent_at: '2026-03-20T13:52:00.000Z'
        }
      ]
    },
    {
      session_id: 'zv_demo_suporte',
      session_name: 'ZapVender Suporte',
      phone: '+55 27 99876-2000',
      status: 'connected',
      status_label: 'Conectada',
      campaign_enabled: true,
      daily_limit: 90,
      hourly_limit: 12,
      cooldown_until: '2026-03-20T14:15:00.000Z',
      cooldown_active: true,
      sent_today: 18,
      unique_leads_today: 15,
      replied_today: 4,
      response_rate: 26.7,
      sent_last_hour: 10,
      first_sent_at: '2026-03-20T10:45:00.000Z',
      last_sent_at: '2026-03-20T13:48:00.000Z',
      risk_level: 'attention',
      risk_label: 'Atencao',
      risk_reason: 'Entrou em cooldown automatico apos alta cadencia na ultima hora.',
      daily_usage_ratio: 0.2,
      hourly_usage_ratio: 0.83,
      possible_blocked_contacts: 1,
      dispatches: [
        {
          campaign_id: 318,
          campaign_name: 'Boas-vindas premium',
          sent_today: 18,
          unique_leads_today: 15,
          replied_today: 4,
          response_rate: 26.7,
          last_sent_at: '2026-03-20T13:48:00.000Z'
        }
      ]
    },
    {
      session_id: 'zv_demo_operacao',
      session_name: 'ZapVender Operacao',
      phone: '+55 27 99876-3000',
      status: 'disconnected',
      status_label: 'Desconectada',
      campaign_enabled: false,
      daily_limit: 60,
      hourly_limit: 10,
      cooldown_until: null,
      cooldown_active: false,
      sent_today: 0,
      unique_leads_today: 0,
      replied_today: 0,
      response_rate: 0,
      sent_last_hour: 0,
      first_sent_at: null,
      last_sent_at: null,
      risk_level: 'paused',
      risk_label: 'Pausada',
      risk_reason: 'Conta reservada para treinamento da equipe.',
      daily_usage_ratio: 0,
      hourly_usage_ratio: 0,
      possible_blocked_contacts: 0,
      dispatches: []
    }
  ]
};

const DASHBOARD_PRESENTATION_CUSTOM_EVENTS: PresentationCustomEventsResponse = {
  period: 'this_month',
  totals: { events: 3, activeEvents: 3, triggers: 28 },
  events: [
    {
      id: 401,
      name: 'Interessados',
      event_key: 'interessados',
      description: 'Leads que pediram cotacao detalhada.',
      is_active: 1,
      total_period: 13,
      total_triggers: 13,
      last_triggered_at: '2026-03-20T12:30:00.000Z'
    },
    {
      id: 402,
      name: 'Venda',
      event_key: 'venda',
      description: 'Conversoes confirmadas pela operacao.',
      is_active: 1,
      total_period: 3,
      total_triggers: 3,
      last_triggered_at: '2026-03-19T16:12:00.000Z'
    },
    {
      id: 403,
      name: 'Documento recebido',
      event_key: 'documento_recebido',
      description: 'Quando o lead envia a documentacao inicial.',
      is_active: 1,
      total_period: 12,
      total_triggers: 12,
      last_triggered_at: '2026-03-20T11:45:00.000Z'
    }
  ]
};

const WHATSAPP_PRESENTATION_BASE_SESSIONS: PresentationSessionRecord[] = [
  {
    session_id: 'zv_demo_principal',
    name: 'ZapVender Comercial',
    phone: '5527998761000',
    status: 'connected',
    connected: true,
    campaign_enabled: true,
    daily_limit: 120,
    dispatch_weight: 2
  },
  {
    session_id: 'zv_demo_suporte',
    name: 'ZapVender Suporte',
    phone: '5527998762000',
    status: 'connected',
    connected: true,
    campaign_enabled: true,
    daily_limit: 90,
    dispatch_weight: 1
  }
];

const WHATSAPP_PRESENTATION_PLAN_USAGE: PresentationPlanUsage = {
  planName: 'Premium',
  current: WHATSAPP_PRESENTATION_BASE_SESSIONS.length,
  max: 5,
  unlimited: false
};

const PRESENTATION_TAGS: PresentationTag[] = [
  { id: 701, name: 'Lead quente', color: '#ef4444', description: 'Leads com alta chance de conversao.' },
  { id: 702, name: 'VIP', color: '#0ea5e9', description: 'Clientes com atendimento prioritario.' },
  { id: 703, name: 'Novo contato', color: '#22c55e', description: 'Contatos recem cadastrados.' },
  { id: 704, name: 'Documento recebido', color: '#f59e0b', description: 'Ja enviou documentacao inicial.' },
  { id: 705, name: 'Campanha marco', color: '#14b8a6', description: 'Entrou por campanha do mes.' },
  { id: 706, name: 'Indicacao', color: '#8b5cf6', description: 'Lead vindo de indicacao.' }
];

const PRESENTATION_CONTACT_FIELDS: PresentationContactField[] = [
  { key: 'nome', label: 'Nome', is_default: true, source: 'name' },
  { key: 'telefone', label: 'Telefone', is_default: true, source: 'phone' },
  { key: 'email', label: 'Email', is_default: true, source: 'email' },
  { key: 'cidade', label: 'Cidade', placeholder: 'Ex.: Vitoria', is_default: false, source: 'custom' },
  { key: 'curso', label: 'Curso', placeholder: 'Ex.: Inscricao 2026', is_default: false, source: 'custom' },
  { key: 'origem', label: 'Origem', placeholder: 'Ex.: Instagram', is_default: false, source: 'custom' },
  { key: 'observacoes', label: 'Observacoes', placeholder: 'Anotacoes do contato', is_default: false, source: 'custom' }
];

const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: 801,
    name: 'Boas-vindas',
    content: 'Ola {{nome}}! Seja bem-vindo(a) a ZapVender. Posso te mostrar os proximos passos?',
    category: 'quick_reply'
  },
  {
    id: 802,
    name: 'Enviar proposta',
    content: 'Perfeito! Vou te encaminhar a proposta e os detalhes do atendimento.',
    category: 'quick_reply'
  },
  {
    id: 803,
    name: 'Follow-up',
    content: 'Oi {{nome}}, passando para saber se posso te ajudar com mais alguma informacao.',
    category: 'quick_reply'
  }
];

const PRESENTATION_CONTACTS: PresentationLead[] = DASHBOARD_PRESENTATION_LEADS.map((lead) => ({
  ...lead
}));

const CONTACTS_PRESENTATION_PLAN_USAGE: PresentationPlanUsage = {
  planName: 'Premium',
  current: PRESENTATION_CONTACTS.length,
  max: 500,
  unlimited: false
};

const PRESENTATION_CONVERSATIONS: PresentationConversation[] = [
  {
    id: 5101,
    lead_id: 9101,
    session_id: 'zv_demo_principal',
    name: 'Fernanda Alves',
    phone: '27981431090',
    avatar_url: '',
    last_message: 'Gostaria de trocar o nome da inscricao para o nome da minha amiga.',
    last_message_at: '2026-03-20T14:55:00.000Z',
    unread: 0,
    status: 3,
    is_bot_active: 1,
    flow_is_running: 1,
    flow_running_id: 1201
  },
  {
    id: 5102,
    lead_id: 9102,
    session_id: 'zv_demo_principal',
    name: 'Carlos Menezes',
    phone: '27998155001',
    avatar_url: '',
    last_message: 'Quero entender os valores.',
    last_message_at: '2026-03-20T14:22:00.000Z',
    unread: 2,
    status: 2,
    is_bot_active: 1,
    flow_is_running: 0,
    flow_running_id: null
  },
  {
    id: 5103,
    lead_id: 9103,
    session_id: 'zv_demo_suporte',
    name: 'Juliana Rocha',
    phone: '27998244077',
    avatar_url: '',
    last_message: '[imagem]',
    last_message_at: '2026-03-20T13:48:00.000Z',
    unread: 1,
    status: 1,
    is_bot_active: 1,
    flow_is_running: 0,
    flow_running_id: null
  }
];

const PRESENTATION_MESSAGES_BY_CONVERSATION: Record<string, PresentationMessage[]> = {
  '5101': [
    {
      id: 9101001,
      content: 'Boa tarde pessoal.',
      direction: 'outgoing',
      status: 'read',
      created_at: '2026-03-20T17:40:00.000Z',
      media_type: 'text'
    },
    {
      id: 9101002,
      content: 'Gostaria de saber se teria a possibilidade de trocar o nome da inscricao para o nome da minha amiga?',
      direction: 'incoming',
      status: 'read',
      created_at: '2026-03-20T17:45:00.000Z',
      media_type: 'text'
    }
  ],
  '5102': [
    {
      id: 9102001,
      content: 'Ola, Carlos! Posso te explicar os planos.',
      direction: 'outgoing',
      status: 'delivered',
      created_at: '2026-03-20T14:18:00.000Z',
      media_type: 'text'
    },
    {
      id: 9102002,
      content: 'Quero entender os valores.',
      direction: 'incoming',
      status: 'read',
      created_at: '2026-03-20T14:22:00.000Z',
      media_type: 'text'
    }
  ],
  '5103': [
    {
      id: 9103001,
      content: 'Recebi sua imagem, obrigada!',
      direction: 'outgoing',
      status: 'sent',
      created_at: '2026-03-20T13:40:00.000Z',
      media_type: 'text'
    },
    {
      id: 9103002,
      content: '[imagem]',
      direction: 'incoming',
      status: 'read',
      created_at: '2026-03-20T13:48:00.000Z',
      media_type: 'image',
      media_url: 'https://cdn.zapvender.com/demo-onboarding-contact-card.png',
      media_mime_type: 'image/png',
      media_filename: 'documento.png'
    }
  ]
};

const PRESENTATION_CAMPAIGNS: PresentationCampaign[] = [
  {
    id: 301,
    name: 'Reativacao marco',
    description: 'Campanha para leads que esfriaram na ultima semana.',
    type: 'broadcast',
    distribution_strategy: 'round_robin',
    sender_accounts: [
      { session_id: 'zv_demo_principal', weight: 2, daily_limit: 120, is_active: true },
      { session_id: 'zv_demo_suporte', weight: 1, daily_limit: 90, is_active: true }
    ],
    status: 'active',
    sent: 128,
    delivered: 117,
    read: 86,
    replied: 24,
    created_at: '2026-03-18T09:15:00.000Z',
    segment: 'all',
    tag_filters: ['Lead quente', 'Indicacao'],
    message: 'Ola {{nome}}, tudo bem? Separei uma condicao especial para voce hoje.',
    message_variations: [
      'Ola {{nome}}, tudo bem? Separei uma condicao especial para voce hoje.',
      '{{nome}}, vi que voce demonstrou interesse. Posso te mostrar a oferta atualizada?'
    ],
    delay: 5000,
    delay_min: 5000,
    delay_max: 15000,
    start_at: '2026-03-20T12:30:00.000Z',
    send_window_enabled: true,
    send_window_start: '08:00',
    send_window_end: '18:00',
    queue_total: 180,
    queue_pending: 42,
    queue_processing: 10,
    queue_finalized: false
  },
  {
    id: 302,
    name: 'Documentos pendentes',
    description: 'Sequencia de lembretes para quem ainda nao enviou documentos.',
    type: 'drip',
    distribution_strategy: 'single',
    sender_accounts: [
      { session_id: 'zv_demo_suporte', weight: 1, daily_limit: 90, is_active: true }
    ],
    status: 'paused',
    sent: 52,
    delivered: 49,
    read: 37,
    replied: 11,
    created_at: '2026-03-17T15:00:00.000Z',
    segment: 'all',
    tag_filters: ['Documento recebido'],
    message: 'Oi {{nome}}, passando para lembrar do envio dos documentos.\n---\nSe preferir, eu posso te orientar passo a passo.',
    delay: 10000,
    delay_min: 10000,
    delay_max: 20000,
    start_at: '2026-03-20T10:00:00.000Z',
    send_window_enabled: true,
    send_window_start: '09:00',
    send_window_end: '19:00',
    queue_total: 52,
    queue_pending: 0,
    queue_processing: 0,
    queue_finalized: true
  },
  {
    id: 303,
    name: 'Boas-vindas premium',
    description: 'Rascunho de campanha para contatos VIP.',
    type: 'broadcast',
    distribution_strategy: 'single',
    sender_accounts: [
      { session_id: 'zv_demo_principal', weight: 1, daily_limit: 120, is_active: true }
    ],
    status: 'draft',
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    created_at: '2026-03-20T08:50:00.000Z',
    segment: 'all',
    tag_filters: ['VIP'],
    message: 'Seja bem-vindo ao atendimento premium, {{nome}}.',
    message_variations: [],
    delay: 5000,
    delay_min: 5000,
    delay_max: 10000,
    start_at: '',
    send_window_enabled: false,
    send_window_start: '08:00',
    send_window_end: '18:00',
    queue_total: 0,
    queue_pending: 0,
    queue_processing: 0,
    queue_finalized: false
  }
];

const PRESENTATION_CAMPAIGN_RECIPIENTS: Record<string, PresentationCampaignRecipient[]> = {
  '301': [
    {
      id: 9101,
      name: 'Fernanda Alves',
      phone: '27981431090',
      status: 3,
      tags: 'Lead quente, Indicacao',
      vehicle: 'Corolla 2023',
      plate: 'RTA2J91',
      campaign_sent: true,
      campaign_delivered: true,
      campaign_read: true,
      campaign_sent_at: '2026-03-20T13:15:00.000Z',
      campaign_queue_status: 'sent'
    },
    {
      id: 9104,
      name: 'Ricardo Tavares',
      phone: '27999220118',
      status: 3,
      tags: 'Negociacao',
      vehicle: 'Compass 2021',
      plate: 'MZX6C11',
      campaign_sent: true,
      campaign_delivered: true,
      campaign_read: false,
      campaign_sent_at: '2026-03-20T13:22:00.000Z',
      campaign_queue_status: 'processing'
    },
    {
      id: 9105,
      name: 'Bianca Costa',
      phone: '27999777112',
      status: 2,
      tags: 'Documento recebido',
      vehicle: 'Nivus 2024',
      plate: 'JKL3H29',
      campaign_sent: false,
      campaign_delivered: false,
      campaign_read: false,
      campaign_sent_at: null,
      campaign_queue_status: 'pending'
    }
  ],
  '302': [
    {
      id: 9103,
      name: 'Juliana Rocha',
      phone: '27998244077',
      status: 1,
      tags: 'VIP, Campanha marco',
      campaign_sent: true,
      campaign_delivered: true,
      campaign_read: true,
      campaign_sent_at: '2026-03-20T11:10:00.000Z',
      campaign_queue_status: 'sent'
    }
  ],
  '303': []
};

const PRESENTATION_AUTOMATIONS: PresentationAutomation[] = [
  {
    id: 601,
    name: 'Boas-vindas automatica',
    description: 'Envia mensagem inicial quando um novo lead fala no WhatsApp.',
    trigger_type: 'message_received',
    trigger_value: '',
    action_type: 'send_message',
    action_value: 'Ola {{nome}}! Seja bem-vindo(a) ao atendimento da ZapVender.',
    delay: 0,
    session_ids: ['zv_demo_principal'],
    tag_filters: ['Novo contato'],
    is_active: true,
    executions: 156,
    last_execution: '2026-03-20T13:10:00.000Z'
  },
  {
    id: 602,
    name: 'Interesse detectado',
    description: 'Marca contatos que mencionam interesse, inscricao ou vaga.',
    trigger_type: 'keyword',
    trigger_value: 'interesse, inscricao, vaga, titularidade',
    action_type: 'add_tag',
    action_value: 'Lead quente',
    delay: 0,
    session_ids: ['zv_demo_principal', 'zv_demo_suporte'],
    tag_filters: [],
    is_active: true,
    executions: 47,
    last_execution: '2026-03-20T12:22:00.000Z'
  },
  {
    id: 603,
    name: 'Mover para andamento',
    description: 'Atualiza o status quando o lead responde apos o primeiro contato.',
    trigger_type: 'status_change',
    trigger_value: '{"fromStatus":"1","toStatus":"2"}',
    action_type: 'change_status',
    action_value: '2',
    delay: 5,
    session_ids: ['zv_demo_suporte'],
    tag_filters: ['Documento recebido'],
    is_active: false,
    executions: 23,
    last_execution: '2026-03-19T15:30:00.000Z'
  }
];

let snapshot: OnboardingPresentationSnapshot = {
  enabled: false,
  stepId: null,
  startedAt: 0
};

let runtime: PresentationRuntime = createPresentationRuntime();

function cloneSessions(input: PresentationSessionRecord[]) {
  return input.map((session) => ({ ...session }));
}

function cloneLead(input: PresentationLead): PresentationLead {
  return {
    ...input,
    tags: Array.isArray(input.tags) ? [...input.tags] : [],
    custom_fields: input.custom_fields ? { ...input.custom_fields } : input.custom_fields ?? null
  };
}

function cloneLeads(input: PresentationLead[]) {
  return input.map((lead) => cloneLead(lead));
}

function cloneConversation(input: PresentationConversation): PresentationConversation {
  return { ...input };
}

function cloneConversations(input: PresentationConversation[]) {
  return input.map((conversation) => cloneConversation(conversation));
}

function cloneMessage(input: PresentationMessage): PresentationMessage {
  return { ...input };
}

function cloneMessages(input: PresentationMessage[]) {
  return input.map((message) => cloneMessage(message));
}

function cloneTags(input: PresentationTag[]) {
  return input.map((tag) => ({ ...tag }));
}

function cloneTemplates(input: PresentationTemplate[]) {
  return input.map((template) => ({ ...template }));
}

function cloneContactFields(input: PresentationContactField[]) {
  return input.map((field) => ({ ...field }));
}

function cloneCampaign(input: PresentationCampaign): PresentationCampaign {
  return {
    ...input,
    message_variations: Array.isArray(input.message_variations) ? [...input.message_variations] : [],
    tag_filters: Array.isArray(input.tag_filters) ? [...input.tag_filters] : [],
    sender_accounts: Array.isArray(input.sender_accounts)
      ? input.sender_accounts.map((account) => ({ ...account }))
      : []
  };
}

function cloneCampaigns(input: PresentationCampaign[]) {
  return input.map((campaign) => cloneCampaign(campaign));
}

function cloneCampaignRecipients(input: PresentationCampaignRecipient[]) {
  return input.map((recipient) => ({ ...recipient }));
}

function cloneAutomations(input: PresentationAutomation[]) {
  return input.map((automation) => ({
    ...automation,
    session_ids: Array.isArray(automation.session_ids) ? [...automation.session_ids] : [],
    tag_filters: Array.isArray(automation.tag_filters) ? [...automation.tag_filters] : []
  }));
}

function createPresentationRuntime(): PresentationRuntime {
  return {
    sessions: cloneSessions(WHATSAPP_PRESENTATION_BASE_SESSIONS),
    conversations: cloneConversations(PRESENTATION_CONVERSATIONS),
    messagesByConversation: Object.fromEntries(
      Object.entries(PRESENTATION_MESSAGES_BY_CONVERSATION).map(([conversationId, messages]) => [
        conversationId,
        cloneMessages(messages)
      ])
    )
  };
}

function normalizeStepId(stepId: unknown): OnboardingPresentationStepId | null {
  const normalized = String(stepId || '').trim() as OnboardingPresentationStepId;
  return STEP_IDS.includes(normalized) ? normalized : null;
}

function syncPresentationDocumentState() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('onboarding-presentation-mode', snapshot.enabled);
  document.body.dataset.onboardingPresentation = snapshot.enabled ? '1' : '0';
  if (snapshot.stepId) {
    document.body.dataset.onboardingPresentationStep = snapshot.stepId;
  } else {
    delete document.body.dataset.onboardingPresentationStep;
  }
}

function emitPresentationChange() {
  syncPresentationDocumentState();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ONBOARDING_PRESENTATION_EVENT, { detail: getOnboardingPresentationSnapshot() }));
}

function getPresentationContactById(leadId: number) {
  return PRESENTATION_CONTACTS.find((lead) => Number(lead.id) === Number(leadId)) || null;
}

export function getOnboardingPresentationSnapshot(): OnboardingPresentationSnapshot {
  return { ...snapshot };
}

export function isOnboardingPresentationModeEnabled() {
  return snapshot.enabled;
}

export function enableOnboardingPresentationMode(stepId?: unknown) {
  const normalizedStepId = normalizeStepId(stepId);
  const shouldResetRuntime = !snapshot.enabled;
  snapshot = {
    enabled: true,
    stepId: normalizedStepId,
    startedAt: snapshot.startedAt || Date.now()
  };
  if (shouldResetRuntime) {
    runtime = createPresentationRuntime();
  }
  emitPresentationChange();
}

export function updateOnboardingPresentationStep(stepId?: unknown) {
  if (!snapshot.enabled) return;
  snapshot = {
    ...snapshot,
    stepId: normalizeStepId(stepId)
  };
  emitPresentationChange();
}

export function disableOnboardingPresentationMode() {
  const wasEnabled = snapshot.enabled;
  snapshot = {
    enabled: false,
    stepId: null,
    startedAt: 0
  };
  runtime = createPresentationRuntime();
  if (wasEnabled) {
    emitPresentationChange();
    return;
  }
  syncPresentationDocumentState();
}

export function getOnboardingPresentationDashboardSummary(): PresentationLeadSummary {
  return {
    total: DASHBOARD_PRESENTATION_SUMMARY.total,
    by_status: { ...DASHBOARD_PRESENTATION_SUMMARY.by_status },
    pending: DASHBOARD_PRESENTATION_SUMMARY.pending,
    completed: DASHBOARD_PRESENTATION_SUMMARY.completed
  };
}

export function getOnboardingPresentationDashboardLeads(): PresentationLead[] {
  return cloneLeads(DASHBOARD_PRESENTATION_LEADS);
}

export function getOnboardingPresentationStatsSeries(metric: DashboardMetricKey): PresentationStatsSeries {
  const fallback = DASHBOARD_PRESENTATION_STATS.mensagens;
  const source = DASHBOARD_PRESENTATION_STATS[metric] || fallback;
  return { labels: [...source.labels], data: [...source.data] };
}

export function getOnboardingPresentationAccountHealth(): PresentationAccountHealthResponse {
  return {
    summary: { ...DASHBOARD_PRESENTATION_ACCOUNT_HEALTH.summary },
    accounts: DASHBOARD_PRESENTATION_ACCOUNT_HEALTH.accounts.map((account) => ({
      ...account,
      dispatches: Array.isArray(account.dispatches)
        ? account.dispatches.map((dispatch) => ({ ...dispatch }))
        : []
    })),
    generatedAt: DASHBOARD_PRESENTATION_ACCOUNT_HEALTH.generatedAt,
    date: DASHBOARD_PRESENTATION_ACCOUNT_HEALTH.date
  };
}

export function getOnboardingPresentationCustomEvents(period = 'this_month'): PresentationCustomEventsResponse {
  return {
    period,
    totals: { ...DASHBOARD_PRESENTATION_CUSTOM_EVENTS.totals },
    events: DASHBOARD_PRESENTATION_CUSTOM_EVENTS.events.map((eventItem) => ({ ...eventItem }))
  };
}

export function getOnboardingPresentationWhatsappSessions(): PresentationSessionRecord[] {
  return cloneSessions(runtime.sessions);
}

export function getOnboardingPresentationWhatsappPlanUsage(): PresentationPlanUsage {
  return {
    planName: WHATSAPP_PRESENTATION_PLAN_USAGE.planName,
    current: runtime.sessions.length,
    max: WHATSAPP_PRESENTATION_PLAN_USAGE.max,
    unlimited: WHATSAPP_PRESENTATION_PLAN_USAGE.unlimited
  };
}

export function upsertOnboardingPresentationWhatsappSession(
  sessionInput: PresentationSessionRecord
): PresentationSessionRecord {
  const normalizedSessionId = String(sessionInput?.session_id || '').trim();
  if (!normalizedSessionId) return { session_id: '' };

  const nextSession: PresentationSessionRecord = {
    session_id: normalizedSessionId,
    name: String(sessionInput.name || '').trim(),
    phone: String(sessionInput.phone || '').trim(),
    status: String(sessionInput.status || '').trim() || (sessionInput.connected ? 'connected' : 'disconnected'),
    connected: sessionInput.connected === true,
    campaign_enabled: sessionInput.campaign_enabled !== false,
    daily_limit: Number.isFinite(Number(sessionInput.daily_limit)) ? Math.max(0, Math.floor(Number(sessionInput.daily_limit))) : 0,
    dispatch_weight: Number.isFinite(Number(sessionInput.dispatch_weight)) ? Math.max(1, Math.floor(Number(sessionInput.dispatch_weight))) : 1
  };

  const existingIndex = runtime.sessions.findIndex((session) => session.session_id === normalizedSessionId);
  if (existingIndex >= 0) {
    runtime.sessions[existingIndex] = { ...runtime.sessions[existingIndex], ...nextSession };
  } else {
    runtime.sessions.push(nextSession);
  }

  emitPresentationChange();
  return { ...nextSession };
}

export function patchOnboardingPresentationWhatsappSession(
  sessionId: string,
  patch: Partial<PresentationSessionRecord>
) {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) return null;

  const existingIndex = runtime.sessions.findIndex((session) => session.session_id === normalizedSessionId);
  if (existingIndex < 0) return null;

  runtime.sessions[existingIndex] = {
    ...runtime.sessions[existingIndex],
    ...patch,
    session_id: normalizedSessionId
  };
  emitPresentationChange();
  return { ...runtime.sessions[existingIndex] };
}

export function removeOnboardingPresentationWhatsappSession(sessionId: string) {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) return false;
  const initialLength = runtime.sessions.length;
  runtime.sessions = runtime.sessions.filter((session) => session.session_id !== normalizedSessionId);
  const didRemove = runtime.sessions.length !== initialLength;
  if (didRemove) emitPresentationChange();
  return didRemove;
}

export function getOnboardingPresentationWhatsappSessionById(sessionId: string) {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) return null;
  const session = runtime.sessions.find((item) => item.session_id === normalizedSessionId);
  return session ? { ...session } : null;
}

export function getOnboardingPresentationTags(): PresentationTag[] {
  return cloneTags(PRESENTATION_TAGS);
}

export function getOnboardingPresentationTemplates(): PresentationTemplate[] {
  return cloneTemplates(PRESENTATION_TEMPLATES);
}

export function getOnboardingPresentationContactFields(): PresentationContactField[] {
  return cloneContactFields(PRESENTATION_CONTACT_FIELDS);
}

export function getOnboardingPresentationContacts(): PresentationLead[] {
  return cloneLeads(PRESENTATION_CONTACTS);
}

export function getOnboardingPresentationContactsPlanUsage(): PresentationPlanUsage {
  return {
    planName: CONTACTS_PRESENTATION_PLAN_USAGE.planName,
    current: PRESENTATION_CONTACTS.length,
    max: CONTACTS_PRESENTATION_PLAN_USAGE.max,
    unlimited: CONTACTS_PRESENTATION_PLAN_USAGE.unlimited
  };
}

export function getOnboardingPresentationInboxLeads(sessionId = '') {
  const normalizedSessionId = String(sessionId || '').trim();
  const leads = getOnboardingPresentationContacts();
  if (!normalizedSessionId) return leads;
  return leads.filter((lead) => String(lead.session_id || '').trim() === normalizedSessionId);
}

export function getOnboardingPresentationInboxConversations(sessionId = '') {
  const normalizedSessionId = String(sessionId || '').trim();
  const source = normalizedSessionId
    ? runtime.conversations.filter((conversation) => String(conversation.session_id || '').trim() === normalizedSessionId)
    : runtime.conversations;
  return cloneConversations(source);
}

export function getOnboardingPresentationInboxMessages(conversationId: number) {
  const key = String(Number(conversationId) || 0);
  return cloneMessages(runtime.messagesByConversation[key] || []);
}

export function getOnboardingPresentationInboxQuickReplies() {
  return cloneTemplates(PRESENTATION_TEMPLATES.filter((template) => {
    const category = String(template.category || '').trim().toLowerCase();
    return category === 'quick_reply' || category === 'custom' || category === '';
  }));
}

export function getOnboardingPresentationInboxLeadById(leadId: number) {
  const lead = getPresentationContactById(leadId);
  return lead ? cloneLead(lead) : null;
}

export function markOnboardingPresentationConversationRead(conversationId: number) {
  const normalizedConversationId = Number(conversationId || 0);
  if (!Number.isFinite(normalizedConversationId) || normalizedConversationId <= 0) return null;
  const index = runtime.conversations.findIndex((conversation) => Number(conversation.id) === normalizedConversationId);
  if (index < 0) return null;
  runtime.conversations[index] = { ...runtime.conversations[index], unread: 0 };
  emitPresentationChange();
  return { ...runtime.conversations[index] };
}

export function appendOnboardingPresentationInboxMessage(
  conversationId: number,
  messageInput: Partial<PresentationMessage> & { content: string; direction?: 'incoming' | 'outgoing' }
) {
  const normalizedConversationId = Number(conversationId || 0);
  if (!Number.isFinite(normalizedConversationId) || normalizedConversationId <= 0) return null;
  const key = String(normalizedConversationId);
  const createdAt = String(messageInput.created_at || new Date().toISOString());
  const nextMessage: PresentationMessage = {
    id: messageInput.id || Date.now(),
    content: String(messageInput.content || '').trim(),
    direction: messageInput.direction === 'incoming' ? 'incoming' : 'outgoing',
    status: String(messageInput.status || 'sent').trim() || 'sent',
    created_at: createdAt,
    media_type: String(messageInput.media_type || 'text').trim() || 'text',
    media_url: messageInput.media_url || null,
    media_mime_type: messageInput.media_mime_type || null,
    media_filename: messageInput.media_filename || null
  };

  runtime.messagesByConversation[key] = [...(runtime.messagesByConversation[key] || []), nextMessage];
  const conversationIndex = runtime.conversations.findIndex((conversation) => Number(conversation.id) === normalizedConversationId);
  if (conversationIndex >= 0) {
    runtime.conversations[conversationIndex] = {
      ...runtime.conversations[conversationIndex],
      last_message: nextMessage.content || '[mensagem]',
      last_message_at: createdAt,
      unread: nextMessage.direction === 'incoming'
        ? Number(runtime.conversations[conversationIndex].unread || 0) + 1
        : 0
    };
  }
  emitPresentationChange();
  return { ...nextMessage };
}

export function getOnboardingPresentationCampaigns(): PresentationCampaign[] {
  return cloneCampaigns(PRESENTATION_CAMPAIGNS);
}

export function getOnboardingPresentationCampaignRecipients(campaignId: number) {
  return cloneCampaignRecipients(PRESENTATION_CAMPAIGN_RECIPIENTS[String(Number(campaignId) || 0)] || []);
}

export function getOnboardingPresentationAutomations(): PresentationAutomation[] {
  return cloneAutomations(PRESENTATION_AUTOMATIONS);
}
