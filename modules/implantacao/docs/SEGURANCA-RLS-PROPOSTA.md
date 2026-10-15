# Segurança RLS do módulo de implantação · V8 · v5.22.45

## Estado observado

No projeto Supabase `yglcnirbnbwjqpvalqif`, as migrations 016–023 constam no
histórico remoto. Elas removem o acesso tabular irrestrito de `anon` às tabelas
operacionais do setup e introduzem RPCs por token para drafts, exports e
auditoria.

A migration 022 foi registrada antes do último refinamento das RPCs de escrita.
Para não editar migration aplicada, a
`20260807_023_reconcile_draft_write_rpcs.sql` reaplica a definição final e está
**aplicada**.

As Edge Functions V8 também estão ativas: `submit-for-validation` v4 e
`share-draft-link` v1, ambas com `verify_jwt=true`. Os fontes remotos foram
inspecionados e contêm validação explícita de `draftId + draftToken`, lock e
status antes de qualquer operação com `service_role`.

## Migrations V8

| Ordem | Arquivo | Estado remoto em 07/08/2026 | Objetivo |
|---:|---|---|---|
| 016 | `20260807_016_close_setup_submissions_and_admin_view.sql` | aplicada | fecha `setup_submissions`; view admin como `security_invoker` |
| 017 | `20260807_017_make_setup_audit_append_only.sql` | aplicada | transição append-only da auditoria |
| 018 | `20260807_018_draft_token_rpcs_and_close_setup_rls.sql` | aplicada | token por draft, RPCs e fechamento direto de drafts/exports/audit |
| 019 | `20260807_019_harden_setup_admin_and_indexes.sql` | aplicada | fecha tickets/comentários, restringe funções e cria índices |
| 020 | `20260807_020_harden_client_audit_rpc.sql` | aplicada | timestamp/source do banco e allow-list da auditoria pública |
| 021 | `20260807_021_restore_is_admin_for_public_rls.sql` | aplicada | permite policies públicas avaliarem `is_admin()` sem conceder papel admin |
| 022 | `20260807_022_harden_draft_write_rpcs.sql` | aplicada | primeiro endurecimento das RPCs de escrita de draft |
| 023 | `20260807_023_reconcile_draft_write_rpcs.sql` | aplicada | retry, idempotência e bloqueio final por lock/status |

Não altere migrations aplicadas. Correções futuras devem ser incrementais.

## Modelo de posse

O navegador gera `draftId` e `draftToken`, persiste a associação localmente e
usa a dupla nas RPCs. O token:

- nunca é retornado pelas RPCs;
- não autoriza outro draft;
- só aparece em link compartilhável no fragmento
  `#draft=<uuid>&token=<uuid>`;
- é validado pelas Edge Functions antes do uso de `service_role`.

A definição final na 023 permite criação idempotente pelo mesmo UUID/token,
rejeita token divergente e recusa alteração/cancelamento quando `locked_at` está
preenchido ou o status não é editável.

## RPCs V8

| RPC | Controle principal |
|---|---|
| `get_draft_by_token` | token opaco; não devolve `access_token` |
| `list_drafts_by_tokens` | máximo de 100 tokens |
| `upsert_draft_by_token` | id+token, payload limitado, lock/status e retry idempotente |
| `cancel_draft_by_token` | id+token, soft delete e lock/status |
| `record_export_by_token` | draft possuído e submission pertencente ao draft |
| `list_exports_by_token` | draft possuído e limite de linhas |
| `record_audit_by_token` | draft possuído, allow-list, metadata e payload limitados |
| `list_audit_by_token` | draft possuído e limite de linhas |

Todas fixam `search_path = pg_catalog, public`, revogam `EXECUTE` de `PUBLIC` e
concedem somente aos papéis necessários.

## Estado por tabela

| Objeto | `anon` direto | `authenticated` direto | Canal do cliente |
|---|---|---|---|
| `setup_drafts` | bloqueado | `SELECT` com `is_admin()` | RPCs por token |
| `setup_submissions` | bloqueado | `SELECT/UPDATE` com `is_admin()` | Edge por id+token |
| `setup_exports` | bloqueado | `SELECT` com `is_admin()` | RPCs por token |
| `setup_audit_events` | bloqueado | `SELECT/INSERT` com `is_admin()`; sem update/delete | RPCs por token |
| `setup_tickets` | sem grant direto | policies admin | RPCs/Edge por token específico |
| `setup_review_comments` | sem grant direto | policies admin | RPCs por token de review/cliente |
| `admin_dashboard_items` | sem grant | `SELECT`, `security_invoker=true` | não aplicável |

## Validação realizada

Foram executados/confirmados:

- histórico remoto 016–023;
- criação, atualização e retry de draft por UUID/token;
- token incorreto negado;
- cancelamento autorizado e recusa de draft não editável;
- auditoria válida aceita e ação fora da allow-list negada;
- acesso tabular de `anon` negado;
- ajuda pública preservada após o ajuste de `is_admin()`;
- inventário das Edge Functions e leitura dos fontes remotos V8;
- análise do Database Linter;
- checagem estática/transpile dos serviços e Edges locais.

Não foi executado o caminho positivo completo de submissão e e-mail para evitar
criar protocolo/mensagem real. Uma tentativa de testar apenas erros por HTTP no
container foi impedida pela resolução DNS do ambiente. O fluxo positivo deve ser
feito em preview com destinatários controlados.

## Rollback por fase

### Fase 1 — submissions/view admin (016)

Reverter grants/policies de `setup_submissions` e retirar `security_invoker` da
view somente se o frontend anterior também for restaurado. Reabrir `anon_rw`
reintroduz a vulnerabilidade original.

### Fase 2 — auditoria append-only (017)

A 017 possui rollback temporário para o cliente antigo. Após 018/020, prefira
reverter as definições de RPC em migration incremental; não conceda UPDATE ou
DELETE na auditoria.

### Fase 3 — token/RPC/RLS (018–023)

1. reverter frontend e Edge Functions para contrato compatível;
2. reaplicar a definição anterior das RPCs por nova migration;
3. só então ajustar grants/policies;
4. não remover `access_token` em rollback emergencial.

Os blocos SQL de referência estão nos cabeçalhos das migrations. Nunca edite uma
migration que já conste no histórico remoto.

## Achados residuais

O linter ainda aponta problemas fora do módulo de implantação:

- `public.external_cache` sem RLS;
- cinco views legadas security definer;
- funções legadas com `search_path` mutável;
- proteção contra senha vazada desabilitada.

Também há alertas genéricos para RPCs `SECURITY DEFINER` públicas. Nas RPCs por
token isso é intencional: elas são a API de capacidade do cliente e aplicam token
opaco, `search_path` fixo, limites e validação de posse. Cada função deve continuar
sendo revisada individualmente.
