# P1 - Performance de Banco (2026-03-17)

## Escopo auditado

- Endpoint inbox: `GET /api/conversations`
- Endpoint mensagens: `GET /api/messages/:leadId`
- Worker de fluxo: leitura de `flow_executions` em estado `running`

Arquivos-base:
- `server/index.js`
- `server/database/models.js`

Relatorios de execucao:
- `docs/performance/2026-03-17T12-38-17-857Z-p1-db-baseline.md`
- `docs/performance/2026-03-17T12-40-11-878Z-p1-db-after.md`
- `docs/performance/2026-03-17T12-50-15-354Z-p1-db-after.md`

## Diagnostico (baseline)

- `messages_list_by_conversation_timeline`: **4.933 ms**
  - Plano fazia `Bitmap Heap Scan` + `Sort` em ~3977 linhas para buscar 100 mensagens.
- `conversations_owner_list`: **10.819 ms**
  - Plano com `Seq Scan` em `conversations` e `leads` + `Hash Join`/`Sort`.
  - Em dataset atual (522 conversas), custo ainda baixo, mas sensivel a crescimento.
- `flow_executions_running_with_conversation`: **0.105 ms**
  - Ainda usava `Seq Scan` em `flow_executions`.

## Otimizacoes aplicadas

### Indices adicionados (codigo)

Atualizados em:
- `server/database/schema.pg.sql`
- `server/database/schema.sql`

Indices:
- `idx_conversations_updated_id_desc` em `(updated_at DESC, id DESC)`
- `idx_conversations_assigned_updated_id_desc` em `(assigned_to, updated_at DESC, id DESC)`
- `idx_messages_conversation_sent_coalesce_desc` em `(conversation_id, COALESCE(sent_at, created_at) DESC, id DESC)`
- `idx_messages_lead_sent_coalesce_desc` em `(lead_id, COALESCE(sent_at, created_at) DESC, id DESC)`
- `idx_flow_executions_status_id_desc` em `(status, id DESC)`
- `idx_flow_executions_flow_status` em `(flow_id, status)`
- `idx_flow_executions_lead` em `(lead_id)`

### Aplicacao imediata em producao

Os mesmos `CREATE INDEX IF NOT EXISTS` foram executados diretamente no Postgres de producao para efeito imediato, sem aguardar deploy.

### Refatoracao da query de inbox por owner (sem alterar regra de acesso)

Arquivo:
- `server/database/models.js` (`Conversation.list`)

Mudancas:
- Removido filtro pesado com `OR + EXISTS` na consulta principal.
- Introduzido conjunto intermediario via CTE:
  - `owner_scope_users`
  - `owner_scope_conversations`
  - `filtered_conversations`
- Aplicado `ORDER BY/LIMIT/OFFSET` antes do join final com `leads/users`.

Validacao de seguranca funcional:
- Comparacao SQL direta (query antiga vs nova) em owners reais de producao.
- Resultado: mesmos IDs retornados (`missing=0`, `extra=0` nos owners testados).

## Resultado (after)

- `messages_list_by_conversation_timeline`: **4.933 ms -> 0.334 ms** (ganho ~93%)
  - Plano passou a usar `Index Scan` em `idx_messages_conversation_sent_coalesce_desc`.
- `flow_executions_running_with_conversation`: **0.105 ms -> 0.062 ms**
  - Plano passou a usar `Index Scan` em `idx_flow_executions_status_id_desc`.
- `conversations_owner_list`: **10.819 ms -> 8.600 ms** (ganho ~20%)
  - Melhora veio da refatoracao da consulta de owner para CTE + pre-filtro antes dos joins finais.

## Revisao N+1

- Fluxo de inbox/mensagens auditado nao mostrou N+1 critico no caminho principal:
  - `GET /api/conversations` usa consulta unica + busca em lote de ultimas mensagens por `conversation_id`.
  - `GET /api/messages/:leadId` executa poucas consultas por request, sem loop por item de lista.
- Pendencia futura: manter revisao recorrente quando novas rotas de inbox/flow forem adicionadas.
