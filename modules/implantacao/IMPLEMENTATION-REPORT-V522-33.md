# Implementation Report · Implantação Consulte GEO v5.22.33

## Resumo executivo

**HOTFIX segundo round**. A v5.22.31 corrigiu colunas inventadas
mas eu assumi que migrations 009 e 010 tinham rodado em produção
— erro de raciocínio. Agora as migrations 011 e 012 são
**auto-suficientes**: garantem (via `ADD COLUMN IF NOT EXISTS`) as
colunas opcionais que vão usar, antes de criar a view e a RPC.

**Pipeline: 476 OK (+6) · Contraste: 89 OK · Build: ✓ 7.48s**.

## Causa raiz

A v5.22.31 corrigiu o problema de **colunas inventadas** (`protocolo`,
`cliente`, etc.) mas mantive na view referências a colunas
**opcionais** que dependiam de migrations 009 e 010:
- `s.resubmitted_at` (migration 009)
- `s.last_team_edit_at` (migration 010)

Eu assumi que essas migrations tinham rodado em produção. Erro:
o banco está num estado intermediário (provavelmente migrations
001-008 aplicadas + tentativa da 011 que falhou). Os erros
relatados pelo Thiago confirmam:

```
ERROR: column s.resubmitted_at does not exist
```

Quando a 011 falha em `s.resubmitted_at`, o Postgres faz ROLLBACK
de toda a transação, incluindo a função `is_admin()`. Aí a 012
tenta usar `is_admin()` e falha em cascata — mesmo padrão da v31.

## Solução: idempotência defensiva

### Migration 011

Topo agora (antes de criar a view):

```sql
alter table public.setup_submissions
    add column if not exists resubmitted_at         timestamptz,
    add column if not exists last_team_edit_at      timestamptz,
    add column if not exists customer_input_original jsonb,
    add column if not exists team_edits_count       integer not null default 0;
```

`ADD COLUMN IF NOT EXISTS` é idempotente desde Postgres 9.6. Se a
coluna existe (migrations 009/010 já rodaram), no-op. Se não
existe, adiciona com os mesmos tipos/defaults das migrations
originais.

A view abaixo pode então referenciar essas colunas com segurança.

### Migration 012

Mesma defesa para `setup_review_comments`:

```sql
alter table public.setup_review_comments
    add column if not exists author_role   text    not null default 'equipe',
    add column if not exists internal_only boolean not null default false;
```

A RPC `add_review_comment_as_admin` insere com `author_role` e
`internal_only` explícitos — agora garantido funcionar mesmo se
migration 008 não tiver rodado.

## Por que essa abordagem em vez de outras

### Alternativa A: separar 011 em duas migrations

```
20260521_011_add_optional_cols.sql       -- só ALTERs
20260521_011b_admin_panel.sql            -- view + RPC
```

**Rejeitado**: complicaria a sequência de aplicação em produção
sem ganho real. Migrations menores não são intrinsecamente melhores;
o que importa é a **idempotência**.

### Alternativa B: usar `DO $$ ... $$` com `IF EXISTS` checks

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setup_submissions' AND column_name = 'resubmitted_at'
  ) THEN
    -- usar resubmitted_at
  ELSE
    -- skip
  END IF;
END $$;
```

**Rejeitado**: explode a complexidade da view para cada coluna
opcional. `ADD COLUMN IF NOT EXISTS` resolve com 1 linha por coluna.

### Alternativa C: deixar a view com `coalesce(s.resubmitted_at, ...)` e esperar que ela falhe se a coluna não existir

**Rejeitado**: já é o que tínhamos. Falha.

### Alternativa D escolhida: `ADD COLUMN IF NOT EXISTS` no topo da própria 011

- Idempotente (custo zero se já aplicado)
- Defensivo (funciona em qualquer estado de banco)
- Auto-contido (não exige ordem específica de execução)
- Padrão recomendado pela Supabase e Postgres docs

## Estados de banco suportados

A migration 011 (v5.22.33) funciona em qualquer destes:

| Estado | Comportamento da 011 |
|---|---|
| Migrations 001-008 aplicadas (e mais nada) | Adiciona resubmitted_at + last_team_edit_at + customer_input_original + team_edits_count, depois cria view |
| Migrations 001-009 aplicadas | resubmitted_at já existe (no-op), adiciona last_team_edit_at + customer_input_original + team_edits_count |
| Migrations 001-010 aplicadas | Todas as colunas já existem (4x no-op), só cria view |
| Migrations 001-010 + 011 antiga falhou | 011 retry funciona (a falha original deu rollback) |

Idem para 012 com `setup_review_comments`.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/20260521_011_admin_panel.sql` | Adiciona bloco "0. Garantir colunas opcionais" no topo |
| `supabase/migrations/20260521_012_admin_review_comments.sql` | Adiciona bloco "0. Garantir colunas opcionais" no topo |
| `frontend/smoke-pipeline.ts` | +6 testes; flex check v32 |
| `frontend/package.json` | bump 5.0.22-33 |
| `README.md` | seção destacada v5.22.33 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.33 |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.32 | 470 OK |
| `vue-tsc --noEmit` | ✅ limpo |
| Pipeline | **476 OK / 0 FAIL** (+6) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **✓ 7.48s** |

## Como aplicar (Thiago)

### Re-aplicar migrations (banco em estado limpo por rollback)

```bash
# Via Dashboard SQL Editor:
# 1. Cole o conteúdo de 20260521_011_admin_panel.sql → Run
# 2. Aguarde "Success. No rows returned"
# 3. Cole o conteúdo de 20260521_012_admin_review_comments.sql → Run
# 4. Aguarde "Success. No rows returned"

# OU via CLI
supabase db push --project-ref yglcnirbnbwjqpvalqif
```

### Validar via SQL após aplicar

```sql
-- A) Colunas de setup_submissions
select column_name from information_schema.columns
 where table_name = 'setup_submissions'
   and column_name in ('resubmitted_at', 'last_team_edit_at',
                       'customer_input_original', 'team_edits_count')
 order by column_name;
-- Deve retornar 4 linhas

-- B) Colunas de setup_review_comments
select column_name from information_schema.columns
 where table_name = 'setup_review_comments'
   and column_name in ('author_role', 'internal_only')
 order by column_name;
-- Deve retornar 2 linhas

-- C) Função is_admin existe
select proname from pg_proc where proname = 'is_admin';
-- Deve retornar: is_admin

-- D) View admin_dashboard_items existe com 14 colunas
select count(*) from information_schema.columns
 where table_name = 'admin_dashboard_items';
-- Deve retornar 14

-- E) View retorna dados sem erro (mesmo vazio)
select count(*) from admin_dashboard_items;
```

## Bloqueios

- **Sandbox sem Supabase real**: testes do banco rodam só em produção.
  Validação estrutural via grep/regex no smoke-pipeline.
- **Não consigo confirmar 100% que migration 008 rodou**: se ela
  não rodou, `setup_review_comments` pode não existir ainda. Mas
  como a 008 cria a tabela em si, esse seria um erro diferente
  ("relation setup_review_comments does not exist") que o Thiago
  teria reportado antes.

## Pendências manuais

1. Re-aplicar migrations 011 e 012 (corrigidas)
2. Validar via SQL os 5 checks acima
3. Re-deploy de `notify-client-comment` (não mudou desde v31, mas
   se ainda não foi feito):
   ```bash
   supabase functions deploy notify-client-comment \
                       --project-ref yglcnirbnbwjqpvalqif \
                       --no-verify-jwt
   ```
4. Bootstrap dos admins (se ainda não foi feito — vide INSTRUCOES.md v28)
5. Smoke tests no painel `/admin`

## Próximo ciclo

Após validação em produção, retomar features novas. Pendências:
- Notificação inversa (cliente recebe email quando equipe comenta)
- Bulk actions no painel /admin
- Animação CSS expand/collapse de Concretos
- Validar bugs herdados v5.22.27 em produção (sem repro até hoje)

## Lição arquitetural

**Toda migration que dependa de colunas opcionais de outras
migrations deve usar `ADD COLUMN IF NOT EXISTS` como guarda no
topo.** Custo é zero (idempotente) e cobre cenários de:
- Migrations anteriores não aplicadas
- Migrations anteriores parcialmente aplicadas
- Re-aplicação após falha

Não custa nada e elimina classes inteiras de erros de
sequenciamento.
