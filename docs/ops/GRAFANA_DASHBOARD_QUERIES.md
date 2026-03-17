# Dashboard Basico (Grafana)

Use este arquivo como base de paineis para um dashboard "ZapVender - Ops".

## Painel 1 - Queue Pending
- Tipo: `Time series`
- Query:
```promql
zapvender_queue_pending_messages
```
- Threshold visual: `zapvender_ops_alert_queue_pending_warn_threshold`

## Painel 2 - Queue Failed
- Tipo: `Time series`
- Query:
```promql
zapvender_queue_failed_messages
```
- Threshold visual: `zapvender_ops_alert_queue_failed_warn_threshold`

## Painel 3 - Flow Executions Running
- Tipo: `Time series`
- Query:
```promql
zapvender_flow_executions_running
```
- Threshold visual: `zapvender_ops_alert_flow_running_warn_threshold`

## Painel 4 - WhatsApp Sessions
- Tipo: `Stat` (duplo)
- Queries:
```promql
zapvender_whatsapp_sessions_connected
```
```promql
zapvender_whatsapp_sessions_total
```

## Painel 5 - Ops Alert Status (Flags)
- Tipo: `Stat`
- Queries:
```promql
zapvender_ops_alert_queue_pending_exceeded
```
```promql
zapvender_ops_alert_queue_failed_exceeded
```
```promql
zapvender_ops_alert_flow_running_exceeded
```

## Painel 6 - Notificador Externo
- Tipo: `Time series` + `Stat`
- Queries:
```promql
zapvender_ops_alert_last_cycle_notify_sent
```
```promql
zapvender_ops_alert_last_cycle_notify_failed
```
```promql
zapvender_ops_alert_last_cycle_notify_skipped
```

## Painel 7 - Uptime
- Tipo: `Stat`
- Query:
```promql
zapvender_process_uptime_seconds
```

## Observacoes
- Configure scrape de `/metrics` com token bearer.
- Recomendado: refresh de 15s a 30s.
- Combine com `docs/ops/PROMETHEUS_ALERT_RULES.yml`.
