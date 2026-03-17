# Checklist de Prioridades (Base do Usuario) - 2026-03-16

Referencia usada:
- P0 Seguranca real em producao
- P0 Estabilidade WhatsApp/menu
- P0 Observabilidade
- P1 Performance de banco
- P1 Refatoracao incremental
- P2 Escala estrutural
- P2 Produto/expansao

Legenda:
- [x] Feito
- [ ] Nao feito
- [~] Parcial

---

## P0 - Seguranca real em producao

- [x] CSP ativada em modo `report-only` no backend.
  Evidencia: `server/index.js` (constantes CSP + helmet + endpoint de report).
- [x] Fail-fast para chaves inseguras/ausentes em producao (`JWT_SECRET` e `ENCRYPTION_KEY`).
  Evidencia: `server/index.js` (erros de startup quando chave e fraca/ausente).
- [x] Rotacao de segredos externos dispensada neste ciclo (decisao operacional).
  Evidencia: mantida rotacao ja aplicada no Railway para segredos internos (`JWT_SECRET`, `WEBHOOK_SECRET`, `SUPPORT_INBOX_WEBHOOK_SECRET`, `ENCRYPTION_KEY`) e item de provedores externos retirado da lista de pendencias.
- [x] Validacao de schema nas rotas criticas (login, send, bulk, webhooks) conectada.
  Evidencia: `server/index.js` com `validateLogin`, `validateApiSendRequest`, `validateQueueBulkRequest`, `validateStripeWebhook`, `validatePagarmeWebhook`.

Status do bloco: [x] Concluido

## P0 - Estabilidade WhatsApp/menu

- [x] Idempotencia de inbound por mensagem implementada.
  Evidencia: `INCOMING_MESSAGE_IDEMPOTENCY_TTL_MS`, receipts e controle de duplicidade em `server/index.js`.
- [x] Lock de processamento por conversa/mensagem implementado (inclui lock distribuido via Postgres).
  Evidencia: `incomingMessageProcessingLocks` + `FLOW_INBOUND_POSTGRES_LOCK_ENABLED` em `server/index.js`.
- [x] Ajustes de warmup/backoff e melhorias de menu textual implementados.
  Evidencia: `WHATSAPP_SESSION_SEND_WARMUP_MS`, `WHATSAPP_SESSION_DISPATCH_BACKOFF_MS` e commits recentes de fluxo/menu.
- [~] Validacao operacional continua (SLO/alertas) para comprovar eliminacao total de engasgos em todos os servicos.
  Evidencia: worker `startOpsAlertsWorker` e limiares operacionais no `/metrics` em `server/index.js`.

Status do bloco: [~] Parcial (tecnicamente avancado)

## P0 - Observabilidade

- [x] Endpoint de metricas implementado (`/metrics`).
  Evidencia: `server/index.js`.
- [x] Telemetria de fluxo inbound por etapas implementada.
  Evidencia: logs `[flow-telemetry]` em `server/index.js`.
- [x] Metricas ativas em producao no servico principal (`METRICS_ENABLED=true` + token).
  Evidencia: variaveis aplicadas no Railway em 2026-03-17 e validacao com `/metrics` retornando `200` com bearer token e `401` sem token.
- [x] Alertas operacionais de fila/fluxo com cooldown implementados.
  Evidencia: `runOpsAlertsCycle`, `buildOpsThresholdState` e metricas `zapvender_ops_alert_*` em `server/index.js`.
- [x] Notificacao externa de alertas operacionais via webhook configuravel.
  Evidencia: `dispatchOpsAlertExternalNotification` + envs `OPS_ALERT_NOTIFY_*` em `server/index.js` e `.env.example`.
- [x] Politicas base de alerta e consultas de dashboard documentadas.
  Evidencia: `docs/ops/PROMETHEUS_ALERT_RULES.yml` e `docs/ops/GRAFANA_DASHBOARD_QUERIES.md`.
- [~] Logging estruturado aplicado nos pontos criticos de inbound/locks/idempotencia.
  Evidencia: `logStructured(...)` com eventos `flow.inbound.*`, `flow.idempotency.*` e `flow.lock.*` em `server/index.js`.

Status do bloco: [~] Parcial

## P1 - Performance de banco

- [x] Indices para tabelas quentes ja existem no schema.
  Evidencia: `server/database/schema.sql` e `server/database/schema.pg.sql`.
- [x] Revisao de N+1 nas rotas quentes (inbox/fluxos/mensagens) com checklist de query por endpoint.
  Evidencia: `docs/performance/P1_DB_PERFORMANCE_2026-03-17.md` (rotas auditadas e conclusoes sobre N+1).
- [x] Plano de execucao (`EXPLAIN ANALYZE`) documentado para queries mais custosas.
  Evidencia: `docs/performance/2026-03-17T12-38-17-857Z-p1-db-baseline.md`, `docs/performance/2026-03-17T12-40-11-878Z-p1-db-after.md` e consolidado em `docs/performance/P1_DB_PERFORMANCE_2026-03-17.md`.

Status do bloco: [x] Concluido

## P1 - Refatoracao incremental

- [~] Quebra de `server/index.js` por dominio iniciada.
  Evidencia: extraidos blocos de observabilidade/alertas para `server/services/opsMonitoringService.js`, de menu textual para `server/services/flowMenuTextService.js` e o pipeline de automacao inbound para `server/services/inboundMessagePipelineService.js`, com `server/index.js` usando wrappers.
- [ ] Quebra de `server/database/models.js` por modulo de dominio.

Evidencia atual:
- `server/index.js` com ~17495 linhas.
- `server/database/models.js` com ~4553 linhas.

Status do bloco: [~] Parcial inicial

## P2 - Escala estrutural

- [x] Controles de worker e lock de lideranca existem (fila/agendados/webhook).
  Evidencia: flags `QUEUE_WORKER_ENABLED`, `SCHEDULED_AUTOMATIONS_WORKER_ENABLED`, `POSTGRES_WORKER_LEADER_LOCK_ENABLED`.
- [ ] Separacao formal de worker dedicado por servico com topologia definitiva.
- [ ] Redis/Bull operacional de ponta a ponta (dependencia existe, uso efetivo nao evidenciado no backend).
- [ ] Trilha de migracao arquitetural (Prisma/Nest/microservicos) formalizada.

Status do bloco: [~] Parcial inicial

## P2 - Produto/expansao

- [x] Base de billing/checkout existe (Stripe/Pagar.me).
- [ ] Onboarding guiado.
- [ ] Billing por uso.
- [ ] Feature flags formalizadas por modulo/tenant.
- [ ] Trilha enterprise para API oficial do WhatsApp.

Status do bloco: [~] Parcial baixo

---

## Resumo executivo

- Blocos concluidos: 2/7
- Blocos parciais: 5/7
- Blocos nao iniciados: 0/7

Proximo foco recomendado:
1. Iniciar P1 Refatoracao incremental (`server/index.js` e `server/database/models.js` por dominio).
2. Avancar P2 Escala estrutural com separacao formal de worker dedicado por servico.
3. Evoluir P2 Produto/expansao com onboarding guiado e feature flags por tenant.
