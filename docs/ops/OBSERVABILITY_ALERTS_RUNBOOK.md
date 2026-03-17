# Runbook - Observability Alerts (P0)

## Objetivo
Padronizar monitoramento do fluxo/menu com logs estruturados e alertas de backlog/erro.

## Variaveis de ambiente
- `METRICS_ENABLED=true`
- `METRICS_BEARER_TOKEN=<token-forte>`
- `LOG_LEVEL=info`
- `WHATSAPP_LOG_LEVEL=warn`
- `FLOW_INBOUND_TELEMETRY_ENABLED=true`
- `FLOW_INBOUND_TELEMETRY_SLOW_MS=1500`
- `OPS_ALERTS_ENABLED=true`
- `OPS_ALERTS_POLL_MS=60000`
- `OPS_ALERTS_COOLDOWN_MS=300000`
- `OPS_ALERT_QUEUE_PENDING_WARN=3000`
- `OPS_ALERT_QUEUE_FAILED_WARN=200`
- `OPS_ALERT_FLOW_RUNNING_WARN=300`

## Como validar
1. `GET /metrics` sem token deve retornar `401` (ou `503` se token nao configurado em producao).
2. `GET /metrics` com token deve retornar `200` com linhas:
   - `zapvender_queue_pending_messages`
   - `zapvender_queue_failed_messages`
   - `zapvender_flow_executions_running`
   - `zapvender_ops_alert_queue_pending_exceeded`
   - `zapvender_ops_alert_queue_failed_exceeded`
   - `zapvender_ops_alert_flow_running_exceeded`
3. Logs devem conter eventos estruturados quando limiares forem ultrapassados:
   - `ops.alert.threshold_exceeded`
   - `flow.inbound.telemetry_slow`
   - `flow.inbound.automation_slow`
   - `flow.idempotency.receipt_claim_failed`

## Acao recomendada por alerta
- `queue_pending_high`: verificar workers, throughput de envio e gargalo de banco.
- `queue_failed_high`: inspecionar erros de envio (WA/API), credenciais e retries.
- `flow_running_high`: revisar fluxos presos, estados `running` antigos e timeout recovery.

## Observacoes
- Alertas usam cooldown (`OPS_ALERTS_COOLDOWN_MS`) para evitar spam.
- Worker de alerta e iniciado no boot e encerrado em `SIGTERM`/`SIGINT`.
- Ajuste limiares por carga real do tenant.
