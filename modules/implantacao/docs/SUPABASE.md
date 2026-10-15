# Supabase — Implantação Consulte GEO (protótipo)

Supabase é **apenas a persistência do protótipo publicado** em
`setup.consultegeo.org`. O contrato técnico do JSON gerado pelo frontend
permanece migrável para o backend oficial **.NET 8 + SQL Server** sem
mudanças de payload.

## Projeto

- **Project name:** Implantação Consulte GEO
- **Project ID:** `yglcnirbnbwjqpvalqif`
- **Região:** definida no painel Supabase pelo Thiago.

## Variáveis usadas pelo frontend

O arquivo `.env.example` lista as 4 variáveis necessárias. Copie para
`frontend/.env.local` e preencha com os valores reais do projeto Supabase.

| Variável | Onde aparece | Obrigatória |
|---|---|---|
| `VITE_SUPABASE_URL`      | `services/supabaseClient.ts`            | sim, em produção |
| `VITE_SUPABASE_ANON_KEY` | `services/supabaseClient.ts`            | sim, em produção |
| `VITE_APP_ENV`           | rodapé `AppShell.vue`, headers Supabase | recomendada |
| `VITE_APP_NAME`          | rodapé `AppShell.vue`, headers Supabase | recomendada |

> **Nunca** coloque a `service_role` no frontend. Apenas a `anon` key vai
> em `VITE_SUPABASE_ANON_KEY`.

## Modo local sem Supabase

Quando `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` estão vazias, todos os
services de persistência (`setupDraftService`, `setupSubmissionService`,
`setupAuditService`, `setupExportService`) operam em fallback
`localStorage`. Isto preserva a usabilidade do protótipo em qualquer
ambiente, inclusive `npm run dev` local sem credenciais.

O rodapé exibe `· modo local (sem Supabase)` para deixar isso visível.

## Migrations

Arquivos em `supabase/migrations/`:

| Arquivo | Tabela | Função |
|---|---|---|
| `20260518_001_setup_drafts.sql`        | `setup_drafts`        | Rascunhos do cadastro |
| `20260518_002_setup_submissions.sql`   | `setup_submissions`   | Submissões enviadas para validação |
| `20260518_003_setup_audit_events.sql`  | `setup_audit_events`  | Audit trail (toda mutação) |
| `20260518_004_setup_exports.sql`       | `setup_exports`       | Log de exports JSON/Excel |

Cada tabela tem **RLS habilitado** com uma policy `*_anon_rw` permissiva
para o protótipo. Antes de produção, restrinja: por exemplo, com chave
de tenant em `obra_codigo` e join com `auth.uid()`.

## Como aplicar

### Via Supabase CLI (recomendado)

```bash
supabase link --project-ref yglcnirbnbwjqpvalqif
supabase db push
```

### Via SQL Editor (manual)

1. Abra o SQL Editor no painel do projeto.
2. Cole o conteúdo de cada arquivo da pasta `supabase/migrations/` em
   ordem ascendente de timestamp.
3. Execute uma migration por vez.

## Migração futura para .NET 8 + SQL Server

Quando o backend oficial estiver pronto:

1. Apontar `implantacaoEstruturaService.ts` (já presente, usa `fetch`) para a
   API real em `/api/implantacao-estrutura`.
2. Substituir as chamadas dos componentes Vue de `setupDraftService` /
   `setupSubmissionService` por `implantacaoEstruturaService`.
3. O **JSON técnico não muda** — o backend recebe o mesmo payload que o
   protótipo gera hoje. As tabelas em SQL Server (`Ges_ImplantacaoEstruturaProposta`,
   `Ges_ImplantacaoEstruturaAuditoria`) já estão modeladas em
   `backend/database/`.
4. A camada Supabase pode ser descontinuada após o cutover.
