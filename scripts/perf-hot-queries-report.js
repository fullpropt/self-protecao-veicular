#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function readEnv(name, fallback = '') {
    return String(process.env[name] || fallback || '').trim();
}

function nowIsoCompact() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseMode() {
    const mode = String(process.argv[2] || 'baseline').trim().toLowerCase();
    if (!['baseline', 'after'].includes(mode)) {
        throw new Error('Modo invalido. Use "baseline" ou "after".');
    }
    return mode;
}

function quoteSqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return `'${String(value).replace(/'/g, "''")}'`;
}

function formatSqlWithParams(sql, params = []) {
    let rendered = String(sql || '');
    for (let idx = params.length; idx >= 1; idx -= 1) {
        const regex = new RegExp(`\\$${idx}(?!\\d)`, 'g');
        rendered = rendered.replace(regex, quoteSqlValue(params[idx - 1]));
    }
    return rendered;
}

function normalizePlanNode(plan = {}) {
    return {
        nodeType: plan['Node Type'] || 'unknown',
        relation: plan['Relation Name'] || '',
        indexName: plan['Index Name'] || '',
        actualRows: Number(plan['Actual Rows'] || 0),
        actualTotalTime: Number(plan['Actual Total Time'] || 0),
        actualLoops: Number(plan['Actual Loops'] || 0)
    };
}

function collectPlanNodes(plan = {}, max = 8, acc = []) {
    if (!plan || typeof plan !== 'object' || acc.length >= max) return acc;
    acc.push(normalizePlanNode(plan));
    const children = Array.isArray(plan.Plans) ? plan.Plans : [];
    for (const child of children) {
        if (acc.length >= max) break;
        collectPlanNodes(child, max, acc);
    }
    return acc;
}

async function explain(client, sql, params = []) {
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
    const result = await client.query(explainSql, params);
    const planJson = result.rows?.[0]?.['QUERY PLAN']?.[0] || {};
    const rootPlan = planJson.Plan || {};
    return {
        planningTimeMs: Number(planJson['Planning Time'] || 0),
        executionTimeMs: Number(planJson['Execution Time'] || 0),
        rootNode: normalizePlanNode(rootPlan),
        nodes: collectPlanNodes(rootPlan, 10)
    };
}

async function findOwnerId(client) {
    const result = await client.query(`
        SELECT owner_user_id, COUNT(*)::int AS total
        FROM leads
        WHERE owner_user_id IS NOT NULL
        GROUP BY owner_user_id
        ORDER BY total DESC
        LIMIT 1
    `);
    return Number(result.rows?.[0]?.owner_user_id || 0) || null;
}

async function findBusyConversationId(client) {
    const result = await client.query(`
        SELECT conversation_id, COUNT(*)::int AS total
        FROM messages
        GROUP BY conversation_id
        ORDER BY total DESC
        LIMIT 1
    `);
    return Number(result.rows?.[0]?.conversation_id || 0) || null;
}

async function findConversationIdsForOwner(client, ownerUserId, limit = 100) {
    if (!ownerUserId) return [];
    const result = await client.query(`
        SELECT c.id
        FROM conversations c
        JOIN leads l ON l.id = c.lead_id
        WHERE l.owner_user_id = $1
        ORDER BY c.updated_at DESC, c.id DESC
        LIMIT $2
    `, [ownerUserId, limit]);
    return (result.rows || [])
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0);
}

async function queryCounts(client) {
    const [conversations, messages, flowExecutions] = await Promise.all([
        client.query('SELECT COUNT(*)::bigint AS total FROM conversations'),
        client.query('SELECT COUNT(*)::bigint AS total FROM messages'),
        client.query('SELECT COUNT(*)::bigint AS total FROM flow_executions')
    ]);

    return {
        conversations: Number(conversations.rows?.[0]?.total || 0),
        messages: Number(messages.rows?.[0]?.total || 0),
        flowExecutions: Number(flowExecutions.rows?.[0]?.total || 0)
    };
}

async function buildReport(mode) {
    const databaseUrl = readEnv('DATABASE_URL');
    if (!databaseUrl) {
        throw new Error('DATABASE_URL nao configurada.');
    }

    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    try {
        const counts = await queryCounts(client);
        const ownerUserId = await findOwnerId(client);
        const busyConversationId = await findBusyConversationId(client);
        const conversationIds = await findConversationIdsForOwner(client, ownerUserId, 100);

        const queries = [];

        if (ownerUserId) {
            const sqlConversations = `
                SELECT c.*, l.name AS lead_name, l.phone, l.vehicle, l.custom_fields AS lead_custom_fields, u.name AS agent_name
                FROM conversations c
                LEFT JOIN leads l ON c.lead_id = l.id
                LEFT JOIN users u ON c.assigned_to = u.id
                WHERE (
                    l.owner_user_id = $1
                    OR EXISTS (
                        SELECT 1
                        FROM users owner_scope
                        WHERE owner_scope.id = COALESCE(c.assigned_to, l.assigned_to)
                          AND (owner_scope.owner_user_id = $2 OR owner_scope.id = $3)
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM whatsapp_sessions ws
                        WHERE ws.session_id = c.session_id
                          AND (
                              ws.created_by = $4
                              OR EXISTS (
                                  SELECT 1
                                  FROM users ws_owner
                                  WHERE ws_owner.id = ws.created_by
                                    AND (ws_owner.owner_user_id = $5 OR ws_owner.id = $6)
                              )
                          )
                    )
                )
                ORDER BY c.updated_at DESC
                LIMIT 100
            `;
            const params = [ownerUserId, ownerUserId, ownerUserId, ownerUserId, ownerUserId, ownerUserId];
            queries.push({
                key: 'conversations_owner_list',
                sql: sqlConversations,
                params
            });
        }

        if (conversationIds.length > 0) {
            const sqlLastMessages = `
                SELECT DISTINCT ON (conversation_id) *
                FROM messages
                WHERE conversation_id = ANY($1::int[])
                ORDER BY conversation_id, COALESCE(sent_at, created_at) DESC, id DESC
            `;
            queries.push({
                key: 'messages_last_by_conversation_ids',
                sql: sqlLastMessages,
                params: [conversationIds]
            });
        }

        if (busyConversationId) {
            const sqlConversationTimeline = `
                SELECT *
                FROM (
                    SELECT *
                    FROM messages
                    WHERE conversation_id = $1
                    ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
                    LIMIT 100
                ) recent_messages
                ORDER BY COALESCE(sent_at, created_at) ASC, id ASC
            `;
            queries.push({
                key: 'messages_list_by_conversation_timeline',
                sql: sqlConversationTimeline,
                params: [busyConversationId]
            });
        }

        const sqlRunningFlowExecutions = `
            SELECT
                fe.id AS execution_id,
                fe.flow_id,
                fe.current_node,
                fe.conversation_id,
                fe.lead_id,
                c.session_id,
                c.last_message_id
            FROM flow_executions fe
            JOIN conversations c ON c.id = fe.conversation_id
            WHERE fe.status = 'running'
            ORDER BY fe.id DESC
            LIMIT 200
        `;
        queries.push({
            key: 'flow_executions_running_with_conversation',
            sql: sqlRunningFlowExecutions,
            params: []
        });

        const results = [];
        for (const item of queries) {
            const timing = await explain(client, item.sql, item.params);
            results.push({
                key: item.key,
                paramsPreview: item.params,
                planningTimeMs: timing.planningTimeMs,
                executionTimeMs: timing.executionTimeMs,
                rootNode: timing.rootNode,
                nodes: timing.nodes,
                sqlRendered: formatSqlWithParams(item.sql, item.params)
            });
        }

        return {
            generatedAt: new Date().toISOString(),
            mode,
            counts,
            sampled: {
                ownerUserId,
                busyConversationId,
                conversationIdsCount: conversationIds.length
            },
            results
        };
    } finally {
        await client.end();
    }
}

function renderMarkdown(report = {}) {
    const lines = [];
    lines.push('# Relatorio de Performance DB (P1)');
    lines.push('');
    lines.push(`- Gerado em: ${report.generatedAt}`);
    lines.push(`- Modo: ${report.mode}`);
    lines.push(`- Tabelas: conversations=${report.counts?.conversations || 0}, messages=${report.counts?.messages || 0}, flow_executions=${report.counts?.flowExecutions || 0}`);
    lines.push(`- Amostras: owner_user_id=${report.sampled?.ownerUserId || 'n/a'}, conversation_id_hot=${report.sampled?.busyConversationId || 'n/a'}, conv_ids_sample=${report.sampled?.conversationIdsCount || 0}`);
    lines.push('');

    for (const item of report.results || []) {
        lines.push(`## ${item.key}`);
        lines.push(`- planning_ms: ${item.planningTimeMs.toFixed(3)}`);
        lines.push(`- execution_ms: ${item.executionTimeMs.toFixed(3)}`);
        lines.push(`- root_node: ${item.rootNode?.nodeType || 'n/a'} (${item.rootNode?.indexName || item.rootNode?.relation || 'n/a'})`);
        lines.push('- plan_nodes:');
        for (const node of item.nodes || []) {
            lines.push(`  - ${node.nodeType} rel=${node.relation || '-'} idx=${node.indexName || '-'} rows=${node.actualRows} loops=${node.actualLoops} total_ms=${node.actualTotalTime.toFixed(3)}`);
        }
        lines.push('');
        lines.push('```sql');
        lines.push(item.sqlRendered || '');
        lines.push('```');
        lines.push('');
    }

    return lines.join('\n');
}

async function main() {
    const mode = parseMode();
    const report = await buildReport(mode);
    const markdown = renderMarkdown(report);

    const reportDir = path.join(process.cwd(), 'docs', 'performance');
    fs.mkdirSync(reportDir, { recursive: true });
    const fileName = `${nowIsoCompact()}-p1-db-${mode}.md`;
    const filePath = path.join(reportDir, fileName);
    fs.writeFileSync(filePath, markdown, 'utf8');

    console.log(`REPORT_FILE=${filePath}`);
    for (const item of report.results || []) {
        console.log(`QUERY ${item.key} execution_ms=${item.executionTimeMs.toFixed(3)} root=${item.rootNode?.nodeType || 'n/a'} idx=${item.rootNode?.indexName || '-'}`);
    }
}

main().catch((error) => {
    console.error(`perf-report-error: ${error.message}`);
    process.exit(1);
});
