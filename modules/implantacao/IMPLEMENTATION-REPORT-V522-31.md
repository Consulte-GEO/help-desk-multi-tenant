# Implementation Report · Implantação Consulte GEO v5.22.31

## Resumo executivo

**HOTFIX**. Migrations 011 e 012 falhavam ao aplicar em produção
porque eu escrevi as views referenciando colunas que não existem no
schema real de `setup_submissions` e `setup_tickets`. Inventei sem
checar. Erro grave — mas tem solução direta porque o Supabase faz
rollback automático em erro dentro de transação, então o banco está
limpo para reaplicar.

**Pipeline: 447 OK (+12) · Contraste: 89 OK · Build: ✓ 8.15s**.

## Causa raiz (mea culpa)

Na v5.22.28 e v5.22.29 entreguei migrations sem **verificar via grep
nas migrations 001-010** quais colunas realmente existem nas tabelas
que estava JOIN-ando. Imaginei o schema baseado em "como faria sentido
para uma app de chamados". O schema real é diferente.

### Colunas inventadas vs. reais

| Tabela | Inventei | Real |
|---|---|---|
| `setup_submissions` | `protocolo` | em outra tabela (`setup_tickets.ticket_number`) |
| `setup_submissions` | `cliente` | dentro de `technical_json.metadata.cliente` |
| `setup_submissions` | `created_at` | `submitted_at` |
| `setup_submissions` | `updated_at` | computado: greatest(submitted_at, reviewed_at, resubmitted_at, last_team_edit_at) |
| `setup_submissions` | `responsavel_nome` | dentro de `technical_json.metadata.createdBy.nome` |
| `setup_tickets` | `status` | só na submission via JOIN |
| `setup_tickets` | `updated_at` | computado: greatest(created_at, email_sent_at, accessed_at) |
| `setup_tickets` | `payload` | inexistente — dados vivem em submission via JOIN |

## Falha em cascata (por que ambas migrations falharam)

Supabase SQL Editor executa todo o batch SQL em **uma única
transação implícita**. Quando a 011 falhou em `s.protocolo`, o
Postgres fez ROLLBACK de tudo dentro daquela execução — inclusive
a função `is_admin()` que tinha sido criada algumas instruções
antes.

A 012 ao ser executada depois (numa nova transação) tentou usar
`public.is_admin()` mas a função **não existe** porque a 011 nunca
foi commitada.

## Outras falhas latentes corrigidas

Aproveitei o hotfix para corrigir 2 problemas que estavam dormentes:

### 1. Edge Function `notify-client-comment`

Tinha duas queries com colunas inexistentes:

```ts
// ANTES (errado)
.from('setup_tickets')
.select('submission_id, ticket_number, access_token, payload')  // ← payload não existe

.from('setup_submissions')
.select('obra_nome, responsavel_nome')  // ← responsavel_nome não existe
```

```ts
// DEPOIS (correto)
.from('setup_tickets')
.select('submission_id, ticket_number, access_token')

.from('setup_submissions')
.select('obra_nome, technical_json')
// + extração no código:
const responsavelNome = submRow.technical_json?.metadata?.createdBy?.nome || '';
```

Esse bug **só apareceria em runtime** — não tinha como typecheck
pegar porque `.select(...)` aceita string livre. Quando o cliente
comentasse pela primeira vez, a Edge Function travaria.

### 2. RPC `add_review_comment_as_admin` quebraria no INSERT

`setup_review_comments` tem 2 colunas NOT NULL adicionadas pela
migration 008:

- `author_role text NOT NULL DEFAULT 'equipe'`
- `internal_only boolean NOT NULL DEFAULT false`

Os DEFAULTs salvariam o INSERT na maioria dos casos, mas:
- Sem `author_role` explícito, todo comentário do admin seria
  marcado como `'equipe'` (OK por coincidência) e `internal_only=false`
  (também OK)

Mas dependendo do schema final aplicado em produção, isso pode
falhar. Agora a RPC popula explicitamente:
```sql
insert into setup_review_comments(
    submission_id, author, author_role, body, internal_only
) values (
    p_submission_id, v_admin_email, 'equipe', trim(p_body), false
)
```

Robustez: se um futuro migration mudar o DEFAULT, a RPC continua
funcionando.

## View `admin_dashboard_items` corrigida

### Lado SUBMISSIONS

```sql
select
    s.id                              as id,
    'submission'::text                as kind,
    coalesce(                         -- ticket_number via subquery
        (select t2.ticket_number from setup_tickets t2
         where t2.submission_id = s.id limit 1),
        'SUB-' || left(s.id::text, 8) -- fallback para órfãs
    )                                  as identifier,
    s.obra_nome                       as title,
    s.obra_codigo                     as subtitle,
    coalesce(
        s.technical_json -> 'metadata' ->> 'cliente', ''
    )                                  as cliente,
    s.status::text                    as status,
    s.submitted_at                    as created_at,
    greatest(
        s.submitted_at,
        coalesce(s.reviewed_at,       s.submitted_at),
        coalesce(s.resubmitted_at,    s.submitted_at),
        coalesce(s.last_team_edit_at, s.submitted_at)
    )                                  as updated_at,
    p.priority,
    l.locked_by_email,
    l.expires_at,
    (subquery note_count),
    (subquery public_comment_count)   -- internal_only = false
from setup_submissions s
left join setup_admin_priorities p on p.submission_id = s.id
left join setup_admin_locks      l on l.submission_id = s.id
                                  and l.expires_at > now()
```

### Lado TICKETS

```sql
select
    t.id                              as id,
    'ticket'::text                    as kind,
    t.ticket_number                   as identifier,
    coalesce(s.obra_nome, '(sem nome)') as title,
    coalesce(s.obra_codigo, '')       as subtitle,
    coalesce(
        s.technical_json -> 'metadata' ->> 'cliente', ''
    )                                  as cliente,
    coalesce(s.status::text, 'enviado') as status,  -- via JOIN
    t.created_at                      as created_at,
    greatest(
        t.created_at,
        coalesce(t.email_sent_at, t.created_at),
        coalesce(t.accessed_at,   t.created_at)
    )                                  as updated_at,
    p.priority,
    null::text                        as locked_by,
    null::timestamptz                 as lock_expires_at,
    (subquery note_count),
    (subquery public_comment_count)
from setup_tickets t
left join setup_submissions      s on s.id = t.submission_id
left join setup_admin_priorities p on p.ticket_id = t.id
```

## Smoke tests anti-ghost (+12)

Para evitar regressão, adicionei 12 testes que bloqueiam
empacotamento se:

1. Migration 011 referenciar `s.protocolo`, `s.cliente`,
   `s.created_at`, `s.updated_at`, `s.responsavel_nome`
2. Migration 011 referenciar `t.status`, `t.updated_at`, `t.payload`
3. Migration 011 não extrair cliente via `technical_json`
4. Migration 011 não calcular `updated_at` via `greatest()`
5. Migration 011 não ter fallback `'SUB-'` no identifier
6. Migration 012 propagar os mesmos erros
7. Migration 012 não popular `author_role + internal_only` na RPC
8. Migration 012 não filtrar `internal_only = false` no
   `public_comment_count`
9. Edge Function `notify-client-comment` não pode ter `payload`
   ou `responsavel_nome` no `.select(...)`
10. Edge Function precisa extrair `responsavel_nome` via
    `technical_json.metadata.createdBy.nome`

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/20260521_011_admin_panel.sql` | View reescrita com schema real |
| `supabase/migrations/20260521_012_admin_review_comments.sql` | View + RPC corrigidas |
| `supabase/functions/notify-client-comment/index.ts` | Queries com schema real |
| `frontend/smoke-pipeline.ts` | +12 testes anti-ghost; flex check v30 |
| `frontend/package.json` | bump 5.0.22-30 → 5.0.22-31 |
| `README.md` | seção destacada hotfix |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.31 |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.30 | 435 OK |
| `vue-tsc --noEmit` | ✅ limpo |
| Pipeline | **447 OK / 0 FAIL** (+12) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **✓ 8.15s** |

## Pendências manuais

### Re-aplicar migrations (estado limpo no banco — rollback automático)

```bash
# Via Dashboard SQL Editor:
# 1. Cole migration 011 corrigida → Run
# 2. Cole migration 012 corrigida → Run

# OU via CLI:
supabase db push --project-ref yglcnirbnbwjqpvalqif
```

### Validar com SQL

Após aplicar, confirmar:

```sql
-- 1. Função is_admin existe
\df is_admin

-- 2. View admin_dashboard_items existe e tem 14 colunas
\d+ admin_dashboard_items

-- 3. View retorna dados (mesmo que vazio) sem erro
select * from admin_dashboard_items limit 1;

-- 4. RPC add_review_comment_as_admin existe
\df add_review_comment_as_admin
```

### Re-deploy da Edge Function corrigida

```bash
supabase functions deploy notify-client-comment \
                    --project-ref yglcnirbnbwjqpvalqif \
                    --no-verify-jwt
```

Ou push para `main` → GitHub Action faz deploy automático.

### Smoke tests em produção

Os mesmos do `INSTRUCOES.md` da v5.22.28, v5.22.29, v5.22.30 valem.
Em particular:

1. `/admin/login` → entrar com admin
2. `/admin` → listing deve carregar (ANTES estava 500 por causa da view)
3. Drill-down em uma submission → 3 abas (notas, comentários, histórico)
4. Adicionar comentário público → aparece em `/s/:token`
5. Cliente comenta em `/s/:token` → admin recebe email (Edge Function)

## Bloqueios

- **Sandbox sem Supabase real**: testes do banco/migrations precisam
  rodar em produção. Validação estrutural via SQL é só syntax check.
- **Não posso confirmar que mais nenhuma coluna foi inventada** sem
  rodar `EXPLAIN` ou `CREATE OR REPLACE` em produção. Mas o
  `smoke-pipeline.ts` cobre os casos descobertos hoje.

## Próximo ciclo

Após Thiago confirmar que migrations rodaram OK em produção:

1. **Bootstrap admins** (v5.22.28) — se ainda não foi feito
2. **Smoke tests** do painel funcionando (v28-v31)
3. Continuar features novas se tudo OK

Caso outras colunas inexistentes apareçam em runtime
(EDGE Functions ou frontend), aplicar mesma metodologia:
1. Confirmar schema real via `grep "create table\|alter table.*add column"` nas migrations
2. Corrigir no source
3. Empacotar nova versão
4. Adicionar smoke test anti-regressão
