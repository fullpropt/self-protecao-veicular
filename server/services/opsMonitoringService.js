function createOpsMonitoringService(options = {}) {
    const queryOne = options.queryOne;
    const getSessionsMap = typeof options.getSessionsMap === 'function'
        ? options.getSessionsMap
        : () => new Map();
    const getProcessUptimeSeconds = typeof options.getProcessUptimeSeconds === 'function'
        ? options.getProcessUptimeSeconds
        : () => Math.floor(process.uptime());
    const logStructured = typeof options.logStructured === 'function'
        ? options.logStructured
        : () => {};
    const normalizeErrorForLog = typeof options.normalizeErrorForLog === 'function'
        ? options.normalizeErrorForLog
        : (error, fallback = 'unknown') => {
            const message = String(error?.message || error || '').trim();
            return message ? message.slice(0, 400) : fallback;
        };

    const OPS_ALERTS_ENABLED = options.opsAlertsEnabled === true;
    const OPS_ALERTS_POLL_MS = Math.max(1000, Number(options.opsAlertsPollMs || 60000) || 60000);
    const OPS_ALERTS_COOLDOWN_MS = Math.max(1000, Number(options.opsAlertsCooldownMs || (5 * 60 * 1000)) || (5 * 60 * 1000));
    const OPS_ALERT_QUEUE_PENDING_WARN = Math.max(1, Number(options.queuePendingWarn || 3000) || 3000);
    const OPS_ALERT_QUEUE_FAILED_WARN = Math.max(1, Number(options.queueFailedWarn || 200) || 200);
    const OPS_ALERT_FLOW_RUNNING_WARN = Math.max(1, Number(options.flowRunningWarn || 300) || 300);
    const OPS_ALERT_NOTIFY_ENABLED = options.notifyEnabled === true;
    const OPS_ALERT_NOTIFY_WEBHOOK_URL = String(options.notifyWebhookUrl || '').trim();
    const OPS_ALERT_NOTIFY_BEARER_TOKEN = String(options.notifyBearerToken || '').trim();
    const OPS_ALERT_NOTIFY_TIMEOUT_MS = Math.max(250, Number(options.notifyTimeoutMs || 5000) || 5000);
    const OPS_ALERT_NOTIFY_INCLUDE_SNAPSHOT = options.notifyIncludeSnapshot !== false;
    const APP_BRAND_NAME = String(options.appBrandName || 'ZapVender').trim() || 'ZapVender';
    const NODE_ENV = String(options.nodeEnv || process.env.NODE_ENV || '').trim() || 'development';

    let opsAlertsIntervalId = null;
    let opsAlertsBootstrapTimeoutId = null;
    let opsAlertsIsRunning = false;
    let opsAlertsLastSummary = null;
    const opsAlertsLastTriggerByKey = new Map();

    async function getRuntimeSnapshot() {
        const sessions = getSessionsMap();
        const sessionValues = sessions instanceof Map ? Array.from(sessions.values()) : [];
        const connectedSessions = sessionValues.filter((session) => session?.isConnected === true).length;
        const totalSessions = sessions instanceof Map ? sessions.size : sessionValues.length;

        const queueStatsRow = await queryOne(`
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
            FROM message_queue
        `);
        const runningFlowsRow = await queryOne(`
            SELECT COUNT(*)::int AS total
            FROM flow_executions
            WHERE status = 'running'
        `);

        return {
            totalSessions,
            connectedSessions,
            queuePending: Number(queueStatsRow?.pending || 0) || 0,
            queueProcessing: Number(queueStatsRow?.processing || 0) || 0,
            queueSent: Number(queueStatsRow?.sent || 0) || 0,
            queueFailed: Number(queueStatsRow?.failed || 0) || 0,
            flowRunning: Number(runningFlowsRow?.total || 0) || 0
        };
    }

    function buildThresholdState(snapshot = {}) {
        const queuePending = Number(snapshot.queuePending || 0) || 0;
        const queueFailed = Number(snapshot.queueFailed || 0) || 0;
        const flowRunning = Number(snapshot.flowRunning || 0) || 0;

        return {
            queuePendingExceeded: queuePending >= OPS_ALERT_QUEUE_PENDING_WARN ? 1 : 0,
            queueFailedExceeded: queueFailed >= OPS_ALERT_QUEUE_FAILED_WARN ? 1 : 0,
            flowRunningExceeded: flowRunning >= OPS_ALERT_FLOW_RUNNING_WARN ? 1 : 0
        };
    }

    function buildMetricsLines(snapshot = {}, thresholdState = {}) {
        const totalSessions = Number(snapshot.totalSessions || 0) || 0;
        const connectedSessions = Number(snapshot.connectedSessions || 0) || 0;
        const queuePending = Number(snapshot.queuePending || 0) || 0;
        const queueProcessing = Number(snapshot.queueProcessing || 0) || 0;
        const queueSent = Number(snapshot.queueSent || 0) || 0;
        const queueFailed = Number(snapshot.queueFailed || 0) || 0;
        const flowRunning = Number(snapshot.flowRunning || 0) || 0;
        const lastCycle = (opsAlertsLastSummary && typeof opsAlertsLastSummary === 'object')
            ? opsAlertsLastSummary
            : {};
        const lastCycleTriggered = Number(lastCycle.alertsTriggered || 0) || 0;
        const lastCycleSuppressed = Number(lastCycle.alertsSuppressedByCooldown || 0) || 0;
        const lastCycleNotifySent = Number(lastCycle.notificationsSent || 0) || 0;
        const lastCycleNotifyFailed = Number(lastCycle.notificationsFailed || 0) || 0;
        const lastCycleNotifySkipped = Number(lastCycle.notificationsSkipped || 0) || 0;

        return [
            '# HELP zapvender_process_uptime_seconds Node process uptime in seconds',
            '# TYPE zapvender_process_uptime_seconds gauge',
            `zapvender_process_uptime_seconds ${Math.max(0, Number(getProcessUptimeSeconds() || 0) || 0)}`,
            '# HELP zapvender_whatsapp_sessions_total Total WhatsApp sessions loaded in runtime',
            '# TYPE zapvender_whatsapp_sessions_total gauge',
            `zapvender_whatsapp_sessions_total ${totalSessions}`,
            '# HELP zapvender_whatsapp_sessions_connected Connected WhatsApp sessions in runtime',
            '# TYPE zapvender_whatsapp_sessions_connected gauge',
            `zapvender_whatsapp_sessions_connected ${connectedSessions}`,
            '# HELP zapvender_queue_pending_messages Pending messages in queue',
            '# TYPE zapvender_queue_pending_messages gauge',
            `zapvender_queue_pending_messages ${queuePending}`,
            '# HELP zapvender_queue_processing_messages Processing messages in queue',
            '# TYPE zapvender_queue_processing_messages gauge',
            `zapvender_queue_processing_messages ${queueProcessing}`,
            '# HELP zapvender_queue_sent_messages Sent messages in queue table',
            '# TYPE zapvender_queue_sent_messages gauge',
            `zapvender_queue_sent_messages ${queueSent}`,
            '# HELP zapvender_queue_failed_messages Failed messages in queue table',
            '# TYPE zapvender_queue_failed_messages gauge',
            `zapvender_queue_failed_messages ${queueFailed}`,
            '# HELP zapvender_flow_executions_running Running flow executions',
            '# TYPE zapvender_flow_executions_running gauge',
            `zapvender_flow_executions_running ${flowRunning}`,
            '# HELP zapvender_ops_alerts_enabled Ops alerts worker enabled (1=true)',
            '# TYPE zapvender_ops_alerts_enabled gauge',
            `zapvender_ops_alerts_enabled ${OPS_ALERTS_ENABLED ? 1 : 0}`,
            '# HELP zapvender_ops_alert_notify_enabled Ops alert external notifier enabled (1=true)',
            '# TYPE zapvender_ops_alert_notify_enabled gauge',
            `zapvender_ops_alert_notify_enabled ${OPS_ALERT_NOTIFY_ENABLED ? 1 : 0}`,
            '# HELP zapvender_ops_alert_queue_pending_warn_threshold Alert threshold for pending queue messages',
            '# TYPE zapvender_ops_alert_queue_pending_warn_threshold gauge',
            `zapvender_ops_alert_queue_pending_warn_threshold ${OPS_ALERT_QUEUE_PENDING_WARN}`,
            '# HELP zapvender_ops_alert_queue_failed_warn_threshold Alert threshold for failed queue messages',
            '# TYPE zapvender_ops_alert_queue_failed_warn_threshold gauge',
            `zapvender_ops_alert_queue_failed_warn_threshold ${OPS_ALERT_QUEUE_FAILED_WARN}`,
            '# HELP zapvender_ops_alert_flow_running_warn_threshold Alert threshold for running flows',
            '# TYPE zapvender_ops_alert_flow_running_warn_threshold gauge',
            `zapvender_ops_alert_flow_running_warn_threshold ${OPS_ALERT_FLOW_RUNNING_WARN}`,
            '# HELP zapvender_ops_alert_queue_pending_exceeded Queue pending threshold exceeded (1=true)',
            '# TYPE zapvender_ops_alert_queue_pending_exceeded gauge',
            `zapvender_ops_alert_queue_pending_exceeded ${Number(thresholdState.queuePendingExceeded || 0)}`,
            '# HELP zapvender_ops_alert_queue_failed_exceeded Queue failed threshold exceeded (1=true)',
            '# TYPE zapvender_ops_alert_queue_failed_exceeded gauge',
            `zapvender_ops_alert_queue_failed_exceeded ${Number(thresholdState.queueFailedExceeded || 0)}`,
            '# HELP zapvender_ops_alert_flow_running_exceeded Flow running threshold exceeded (1=true)',
            '# TYPE zapvender_ops_alert_flow_running_exceeded gauge',
            `zapvender_ops_alert_flow_running_exceeded ${Number(thresholdState.flowRunningExceeded || 0)}`,
            '# HELP zapvender_ops_alert_last_cycle_triggered Alerts triggered in last ops cycle',
            '# TYPE zapvender_ops_alert_last_cycle_triggered gauge',
            `zapvender_ops_alert_last_cycle_triggered ${lastCycleTriggered}`,
            '# HELP zapvender_ops_alert_last_cycle_suppressed Alerts suppressed by cooldown in last ops cycle',
            '# TYPE zapvender_ops_alert_last_cycle_suppressed gauge',
            `zapvender_ops_alert_last_cycle_suppressed ${lastCycleSuppressed}`,
            '# HELP zapvender_ops_alert_last_cycle_notify_sent External notifications sent in last ops cycle',
            '# TYPE zapvender_ops_alert_last_cycle_notify_sent gauge',
            `zapvender_ops_alert_last_cycle_notify_sent ${lastCycleNotifySent}`,
            '# HELP zapvender_ops_alert_last_cycle_notify_failed External notifications failed in last ops cycle',
            '# TYPE zapvender_ops_alert_last_cycle_notify_failed gauge',
            `zapvender_ops_alert_last_cycle_notify_failed ${lastCycleNotifyFailed}`,
            '# HELP zapvender_ops_alert_last_cycle_notify_skipped External notifications skipped in last ops cycle',
            '# TYPE zapvender_ops_alert_last_cycle_notify_skipped gauge',
            `zapvender_ops_alert_last_cycle_notify_skipped ${lastCycleNotifySkipped}`
        ];
    }

    function shouldEmitAlert(alertKey, now = Date.now()) {
        const normalizedAlertKey = String(alertKey || '').trim().toLowerCase();
        if (!normalizedAlertKey) return false;

        const lastEmittedAt = Number(opsAlertsLastTriggerByKey.get(normalizedAlertKey) || 0);
        if (lastEmittedAt > 0 && (now - lastEmittedAt) < OPS_ALERTS_COOLDOWN_MS) {
            return false;
        }

        opsAlertsLastTriggerByKey.set(normalizedAlertKey, now);

        if (opsAlertsLastTriggerByKey.size > 200) {
            const oldestKey = opsAlertsLastTriggerByKey.keys().next().value;
            if (oldestKey) {
                opsAlertsLastTriggerByKey.delete(oldestKey);
            }
        }

        return true;
    }

    function buildAlertsFromSnapshot(snapshot = {}, thresholdState = {}) {
        const alerts = [];
        const queuePending = Number(snapshot.queuePending || 0) || 0;
        const queueFailed = Number(snapshot.queueFailed || 0) || 0;
        const flowRunning = Number(snapshot.flowRunning || 0) || 0;

        if (Number(thresholdState.queuePendingExceeded || 0) === 1) {
            alerts.push({
                key: 'queue_pending_high',
                metric: 'zapvender_queue_pending_messages',
                value: queuePending,
                threshold: OPS_ALERT_QUEUE_PENDING_WARN,
                message: 'Fila pendente acima do limite'
            });
        }

        if (Number(thresholdState.queueFailedExceeded || 0) === 1) {
            alerts.push({
                key: 'queue_failed_high',
                metric: 'zapvender_queue_failed_messages',
                value: queueFailed,
                threshold: OPS_ALERT_QUEUE_FAILED_WARN,
                message: 'Fila com mensagens com falha acima do limite'
            });
        }

        if (Number(thresholdState.flowRunningExceeded || 0) === 1) {
            alerts.push({
                key: 'flow_running_high',
                metric: 'zapvender_flow_executions_running',
                value: flowRunning,
                threshold: OPS_ALERT_FLOW_RUNNING_WARN,
                message: 'Fluxos em execucao acima do limite'
            });
        }

        return alerts;
    }

    function resolveNotifyUrl() {
        const rawValue = String(OPS_ALERT_NOTIFY_WEBHOOK_URL || '').trim();
        if (!rawValue) return '';
        try {
            return new URL(rawValue).toString();
        } catch (_) {
            return '';
        }
    }

    function buildNotificationPayload(options = {}) {
        const alert = options.alert || {};
        const summary = options.summary || {};
        const snapshot = options.snapshot || {};
        const trigger = String(options.trigger || '').trim() || 'ops-alert-worker';
        const payload = {
            source: 'zapvender',
            app: APP_BRAND_NAME,
            event: 'ops.alert.threshold_exceeded',
            emittedAt: new Date().toISOString(),
            environment: NODE_ENV,
            trigger,
            alert: {
                key: String(alert.key || '').trim() || 'unknown',
                metric: String(alert.metric || '').trim() || 'unknown',
                value: Number(alert.value || 0) || 0,
                threshold: Number(alert.threshold || 0) || 0,
                message: String(alert.message || '').trim() || 'Ops alert threshold exceeded',
                cooldownMs: OPS_ALERTS_COOLDOWN_MS
            },
            cycle: {
                alertsEvaluated: Number(summary.alertsEvaluated || 0) || 0,
                alertsTriggered: Number(summary.alertsTriggered || 0) || 0,
                alertsSuppressedByCooldown: Number(summary.alertsSuppressedByCooldown || 0) || 0
            }
        };

        if (OPS_ALERT_NOTIFY_INCLUDE_SNAPSHOT) {
            payload.snapshot = {
                queuePending: Number(snapshot.queuePending || 0) || 0,
                queueFailed: Number(snapshot.queueFailed || 0) || 0,
                queueProcessing: Number(snapshot.queueProcessing || 0) || 0,
                flowRunning: Number(snapshot.flowRunning || 0) || 0,
                sessionsConnected: Number(snapshot.connectedSessions || 0) || 0,
                sessionsTotal: Number(snapshot.totalSessions || 0) || 0
            };
        }

        return payload;
    }

    async function dispatchExternalNotification(options = {}) {
        if (!OPS_ALERT_NOTIFY_ENABLED) {
            return { skipped: 'disabled' };
        }

        const webhookUrl = resolveNotifyUrl();
        if (!webhookUrl) {
            return { skipped: 'invalid_webhook_url' };
        }

        const alert = options.alert || {};
        const trigger = String(options.trigger || '').trim() || 'ops-alert-worker';
        const payload = buildNotificationPayload(options);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OPS_ALERT_NOTIFY_TIMEOUT_MS);
        const startedAtMs = Date.now();

        try {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': `${APP_BRAND_NAME}/ops-alert-notifier`
            };
            if (OPS_ALERT_NOTIFY_BEARER_TOKEN) {
                headers.Authorization = `Bearer ${OPS_ALERT_NOTIFY_BEARER_TOKEN}`;
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            const durationMs = Math.max(0, Date.now() - startedAtMs);
            if (!response.ok) {
                const responseBody = String(await response.text().catch(() => '')).trim().slice(0, 240);
                throw new Error(`http_${response.status}${responseBody ? `_${responseBody}` : ''}`);
            }

            logStructured(
                'info',
                'ops.alert.notification_sent',
                {
                    trigger,
                    alertKey: String(alert.key || '').trim() || 'unknown',
                    metric: String(alert.metric || '').trim() || 'unknown',
                    statusCode: Number(response.status || 0) || 0,
                    durationMs
                },
                'Notificacao externa de alerta enviada'
            );
            return { sent: true, statusCode: response.status, durationMs };
        } catch (error) {
            const durationMs = Math.max(0, Date.now() - startedAtMs);
            logStructured(
                'error',
                'ops.alert.notification_failed',
                {
                    trigger,
                    alertKey: String(alert.key || '').trim() || 'unknown',
                    metric: String(alert.metric || '').trim() || 'unknown',
                    durationMs,
                    error: normalizeErrorForLog(error)
                },
                'Falha ao enviar notificacao externa de alerta'
            );
            return { sent: false, error: normalizeErrorForLog(error), durationMs };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function runCycle(options = {}) {
        const trigger = String(options.trigger || 'ops-alert-worker').trim() || 'ops-alert-worker';
        const force = options.force === true;

        if (!OPS_ALERTS_ENABLED && !force) {
            return { skipped: 'disabled', trigger };
        }
        if (opsAlertsIsRunning) {
            return { skipped: 'in_flight', trigger };
        }

        opsAlertsIsRunning = true;
        const startedAtMs = Date.now();
        const summary = {
            trigger,
            alertsEvaluated: 0,
            alertsTriggered: 0,
            alertsSuppressedByCooldown: 0,
            notificationsSent: 0,
            notificationsFailed: 0,
            notificationsSkipped: 0,
            elapsedMs: 0
        };

        try {
            const snapshot = await getRuntimeSnapshot();
            const thresholdState = buildThresholdState(snapshot);
            const alerts = buildAlertsFromSnapshot(snapshot, thresholdState);
            summary.alertsEvaluated = alerts.length;

            const now = Date.now();
            for (const alert of alerts) {
                if (!shouldEmitAlert(alert.key, now)) {
                    summary.alertsSuppressedByCooldown += 1;
                    continue;
                }

                summary.alertsTriggered += 1;
                logStructured(
                    'warn',
                    'ops.alert.threshold_exceeded',
                    {
                        trigger,
                        alertKey: alert.key,
                        metric: alert.metric,
                        value: alert.value,
                        threshold: alert.threshold,
                        cooldownMs: OPS_ALERTS_COOLDOWN_MS
                    },
                    alert.message
                );

                const notifyResult = await dispatchExternalNotification({
                    alert,
                    snapshot,
                    summary,
                    trigger
                });
                if (notifyResult?.sent === true) {
                    summary.notificationsSent += 1;
                } else if (notifyResult?.skipped) {
                    summary.notificationsSkipped += 1;
                    if (notifyResult.skipped === 'invalid_webhook_url') {
                        logStructured(
                            'warn',
                            'ops.alert.notification_skipped',
                            {
                                reason: notifyResult.skipped,
                                trigger
                            },
                            'Notificador externo de alerta com URL invalida'
                        );
                    }
                } else {
                    summary.notificationsFailed += 1;
                }
            }

            return summary;
        } catch (error) {
            summary.error = normalizeErrorForLog(error);
            logStructured(
                'error',
                'ops.alert.cycle_failed',
                {
                    trigger,
                    error: summary.error
                },
                'Falha no ciclo de alertas operacionais'
            );
            return summary;
        } finally {
            summary.elapsedMs = Math.max(0, Date.now() - startedAtMs);
            opsAlertsLastSummary = {
                ...summary,
                completedAt: new Date().toISOString()
            };
            opsAlertsIsRunning = false;
        }
    }

    function startWorker() {
        if (opsAlertsIntervalId) return;

        if (!OPS_ALERTS_ENABLED) {
            logStructured(
                'info',
                'ops.alert.worker_disabled',
                { reason: 'config_disabled' },
                'Worker de alertas operacionais desabilitado por configuracao'
            );
            return;
        }

        const notifyUrlValid = Boolean(resolveNotifyUrl());
        if (OPS_ALERT_NOTIFY_ENABLED && !notifyUrlValid) {
            logStructured(
                'warn',
                'ops.alert.notification_config_invalid',
                { reason: 'invalid_webhook_url' },
                'Notificador externo de alerta habilitado, mas URL do webhook e invalida'
            );
        }

        const runWorkerCycle = () => {
            runCycle({
                trigger: 'ops-alert-worker'
            }).catch((error) => {
                logStructured(
                    'error',
                    'ops.alert.worker_cycle_failed',
                    { error: normalizeErrorForLog(error) },
                    'Falha no ciclo periodico de alertas operacionais'
                );
            });
        };

        opsAlertsIntervalId = setInterval(runWorkerCycle, OPS_ALERTS_POLL_MS);

        const bootstrapDelayMs = Math.max(
            3000,
            Math.min(15000, Math.floor(OPS_ALERTS_POLL_MS / 2))
        );
        opsAlertsBootstrapTimeoutId = setTimeout(() => {
            opsAlertsBootstrapTimeoutId = null;
            runWorkerCycle();
        }, bootstrapDelayMs);

        logStructured(
            'info',
            'ops.alert.worker_started',
            {
                pollMs: OPS_ALERTS_POLL_MS,
                cooldownMs: OPS_ALERTS_COOLDOWN_MS,
                queuePendingWarn: OPS_ALERT_QUEUE_PENDING_WARN,
                queueFailedWarn: OPS_ALERT_QUEUE_FAILED_WARN,
                flowRunningWarn: OPS_ALERT_FLOW_RUNNING_WARN,
                notifyEnabled: OPS_ALERT_NOTIFY_ENABLED,
                notifyWebhookConfigured: notifyUrlValid
            },
            'Worker de alertas operacionais ativo'
        );
    }

    function stopWorker() {
        if (opsAlertsBootstrapTimeoutId) {
            clearTimeout(opsAlertsBootstrapTimeoutId);
            opsAlertsBootstrapTimeoutId = null;
        }
        if (opsAlertsIntervalId) {
            clearInterval(opsAlertsIntervalId);
            opsAlertsIntervalId = null;
        }
        opsAlertsIsRunning = false;
        opsAlertsLastTriggerByKey.clear();
    }

    function getLastSummary() {
        return opsAlertsLastSummary;
    }

    return {
        getRuntimeSnapshot,
        buildThresholdState,
        buildMetricsLines,
        runCycle,
        startWorker,
        stopWorker,
        getLastSummary
    };
}

module.exports = {
    createOpsMonitoringService
};
