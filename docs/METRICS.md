# Metrics Endpoint

Prometheus-style metrics endpoint:

- `GET /metrics`

Environment:

- `METRICS_ENABLED=false` (default)
- `METRICS_BEARER_TOKEN=` (optional; if set, requires `Authorization: Bearer <token>` or `?token=<token>`)
- `OPS_ALERTS_ENABLED=true` (enables operational alerts worker)
- `OPS_ALERT_NOTIFY_ENABLED=false` (external notifier)
- `OPS_ALERT_NOTIFY_WEBHOOK_URL=` (external alert endpoint)

Current exported metrics:

- `zapvender_process_uptime_seconds`
- `zapvender_whatsapp_sessions_total`
- `zapvender_whatsapp_sessions_connected`
- `zapvender_queue_pending_messages`
- `zapvender_queue_processing_messages`
- `zapvender_queue_sent_messages`
- `zapvender_queue_failed_messages`
- `zapvender_flow_executions_running`
- `zapvender_ops_alerts_enabled`
- `zapvender_ops_alert_notify_enabled`
- `zapvender_ops_alert_queue_pending_warn_threshold`
- `zapvender_ops_alert_queue_failed_warn_threshold`
- `zapvender_ops_alert_flow_running_warn_threshold`
- `zapvender_ops_alert_queue_pending_exceeded`
- `zapvender_ops_alert_queue_failed_exceeded`
- `zapvender_ops_alert_flow_running_exceeded`
- `zapvender_ops_alert_last_cycle_triggered`
- `zapvender_ops_alert_last_cycle_suppressed`
- `zapvender_ops_alert_last_cycle_notify_sent`
- `zapvender_ops_alert_last_cycle_notify_failed`
- `zapvender_ops_alert_last_cycle_notify_skipped`

Suggested alert starters:

- Queue backlog too high (`zapvender_queue_pending_messages`)
- No connected WhatsApp sessions (`zapvender_whatsapp_sessions_connected == 0`)
- Running flows stuck high for long period (`zapvender_flow_executions_running`)
- External notifier failures (`zapvender_ops_alert_last_cycle_notify_failed > 0`)
