function createAdminAuditController(options = {}) {
    const getRequesterRole = options.getRequesterRole;
    const isUserAdminRole = options.isUserAdminRole;
    const buildTenantIntegrityAuditWorkerState = options.buildTenantIntegrityAuditWorkerState;
    const tenantIntegrityAuditService = options.tenantIntegrityAuditService;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const tenantIntegrityAuditAllowGlobalManual = options.tenantIntegrityAuditAllowGlobalManual;
    const tenantIntegrityAuditSampleLimit = options.tenantIntegrityAuditSampleLimit;
    const runTenantIntegrityAudit = options.runTenantIntegrityAudit;

    function ensureAdminPermission(req, res, message) {
        const requesterRole = getRequesterRole(req);
        if (!isUserAdminRole(requesterRole)) {
            res.status(403).json({ error: message });
            return false;
        }
        return true;
    }

    return {
        async getTenantIntegrityAuditStatus(req, res) {
            if (!ensureAdminPermission(req, res, 'Sem permissao para acessar auditoria de integridade')) {
                return;
            }

            const workerState = buildTenantIntegrityAuditWorkerState();
            const response = {
                success: true,
                worker: {
                    enabled: workerState.enabled,
                    intervalMs: workerState.intervalMs,
                    sampleLimit: workerState.sampleLimit,
                    leaderLockEnabled: workerState.leaderLockEnabled,
                    leaderLockHeld: workerState.leaderLockHeld,
                    running: workerState.running,
                    lastRunAt: workerState.lastRunAt,
                    lastError: workerState.lastError,
                    lastRunRecordId: workerState.lastRunRecordId,
                    lastPersistError: workerState.lastPersistError,
                    hasLastResult: !!workerState.lastResult
                },
                manualRun: {
                    defaultScope: 'owner',
                    allowGlobal: tenantIntegrityAuditAllowGlobalManual
                }
            };

            if (tenantIntegrityAuditAllowGlobalManual && workerState.lastResult) {
                response.worker.lastResult = workerState.lastResult;
            }

            return res.json(response);
        },

        async listTenantIntegrityAuditHistory(req, res) {
            if (!ensureAdminPermission(req, res, 'Sem permissao para acessar historico da auditoria')) {
                return;
            }

            try {
                const requestedScope = String(req.query?.scope || 'owner').trim().toLowerCase();
                const requestedLimit = req.query?.limit || 20;
                const includeResult = ['1', 'true', 'sim', 'yes', 'on'].includes(String(req.query?.includeResult || '').trim().toLowerCase());
                const onlyIssues = ['1', 'true', 'sim', 'yes', 'on'].includes(String(req.query?.onlyIssues || '').trim().toLowerCase());

                let ownerScopeUserId = null;
                if (requestedScope !== 'global') {
                    ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                    if (!ownerScopeUserId) {
                        return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
                    }
                } else if (!tenantIntegrityAuditAllowGlobalManual) {
                    return res.status(403).json({ error: 'Consulta global do historico desabilitada' });
                }

                const runs = await tenantIntegrityAuditService.listAuditRuns({
                    scope: requestedScope === 'global' ? 'global' : 'owner',
                    ownerUserId: requestedScope === 'global' ? null : ownerScopeUserId,
                    limit: requestedLimit,
                    includeResult,
                    onlyIssues
                });

                return res.json({
                    success: true,
                    scope: requestedScope === 'global' ? 'global' : 'owner',
                    ownerUserId: requestedScope === 'global' ? null : ownerScopeUserId,
                    count: Array.isArray(runs) ? runs.length : 0,
                    runs
                });
            } catch (error) {
                console.error('[TenantIntegrityAudit][history-endpoint] falha:', error);
                return res.status(500).json({ error: 'Falha ao consultar historico da auditoria', details: error.message });
            }
        },

        async runTenantIntegrityAuditManual(req, res) {
            if (!ensureAdminPermission(req, res, 'Sem permissao para executar auditoria de integridade')) {
                return;
            }

            try {
                const body = req.body && typeof req.body === 'object' ? req.body : {};
                const requestedScope = String(body.scope || req.query?.scope || 'owner').trim().toLowerCase();
                const requestedSampleLimit = body.sampleLimit || req.query?.sampleLimit || tenantIntegrityAuditSampleLimit;

                let ownerScopeUserId = null;
                if (requestedScope !== 'global') {
                    ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                    if (!ownerScopeUserId) {
                        return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
                    }
                } else if (!tenantIntegrityAuditAllowGlobalManual) {
                    return res.status(403).json({ error: 'Execucao manual global de auditoria desabilitada' });
                }

                const audit = await runTenantIntegrityAudit({
                    trigger: 'manual-endpoint',
                    ownerUserId: requestedScope === 'global' ? null : ownerScopeUserId,
                    sampleLimit: requestedSampleLimit,
                    cacheAsWorker: false
                });

                return res.json({
                    success: true,
                    audit,
                    worker: buildTenantIntegrityAuditWorkerState()
                });
            } catch (error) {
                console.error('[TenantIntegrityAudit][manual-endpoint] falha:', error);
                return res.status(500).json({ error: 'Falha ao executar auditoria de integridade', details: error.message });
            }
        }
    };
}

module.exports = {
    createAdminAuditController
};
