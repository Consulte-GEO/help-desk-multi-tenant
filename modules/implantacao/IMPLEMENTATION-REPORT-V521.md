# Implementation Report · Implantação Consulte GEO v5.21

## Resumo executivo

Completa o ciclo de validação iniciado na v5.20:

1. **Histórico de comentários** na ReviewView — a equipe agora adiciona
   N notas com autor + timestamp em vez da "uma nota só" da v5.20.
   Nova tabela `setup_review_comments` + 2 RPCs gated por mesmo token.
   `get_submission_by_token` ganhou campo `comments` (backward-compatible).

2. **Mobile pass na ReviewView** — toolbar de 4 botões ("Em análise",
   "Devolver", "Aprovar", "Marcar implantado") agora empilha com
   wrap + min-width em viewport <760px. Tabela de auditoria envelopada
   em `.table-wrap` (sombra inset de scroll horizontal).

Backend .NET skeleton intacto. Stack fechada. Smokes 41 (lógica)
+ 42 (contraste) verdes.

## Ambiente usado

- Node 22.22.2 / Vue 3.4.38 / Vite 5.4.6 / TS 5.4.5 / Vuex 4.1 /
  Bootstrap 5.3.3
- Supabase project_id `yglcnirbnbwjqpvalqif`
- Sandbox sem `supabase` CLI / Deno (igual v5.20)

## Arquivos criados

- `supabase/migrations/20260518_007_setup_review_comments.sql`
- `IMPLEMENTATION-REPORT-V521.md` (este arquivo)

## Arquivos alterados

- `frontend/package.json` — 5.0.20 → 5.0.21
- `frontend/src/models/setup.models.ts`
  - Novo tipo `ReviewComment`
  - Campo `comments: ReviewComment[]` em `TicketReviewPayload`
- `frontend/src/services/ticketService.ts`
  - 2 funções novas: `addReviewComment`, `listReviewComments`
  - Validação client-side (empty body, body > 2000 chars) antes de
    bater no Supabase
- `frontend/src/views/ReviewView.vue`
  - Novo card "Histórico de comentários" entre "Ações" e "JSON técnico"
  - Form de adicionar comentário (textarea max 2000 + botão)
  - State: `newCommentBody`, `commentLoading`, `commentFeedback`
  - Handler `onAddComment` com mensagens humanas para erros conhecidos
  - Tabela de auditoria envelopada em `.table-wrap` (mobile)
- `frontend/src/styles/design-system.css`
  - Header atualizado para v5.21
  - `.comment-body` com white-space + overflow-wrap
  - `.toolbar` mobile com flex-wrap + min-width 140px nos `.btn`
- `frontend/smoke-pipeline.ts`
  - +4 cases: validações client-side de `addReviewComment` e
    sanidade do tipo `ReviewComment`

## Arquivos removidos

- Nenhum.

## Comandos executados

| Comando | Resultado |
|---|---|
| Cópia v5.20 → v5.21 working | OK |
| sqlparse migration 007 | 12 statements parseados |
| `npm install` | OK |
| `npm run typecheck` | 0 erros TS |
| `npm run build` | OK em 7,53s |
| `npm run smoke` (lógica) | **41 OK / 0 FAIL** |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** |
| `npm run smoke:all` encadeado | OK |

## Resultado dos comandos

### Comparativo de chunks (gzip) v5.20 → v5.21

| Chunk | v5.20 | v5.21 | Delta |
|---|---|---|---|
| `index-*.js` (eager) | 31,47 KB | ~31,9 KB | +0,4 KB (ReviewView ganhou UI de comments) |
| `index-*.css` | 5,25 KB | ~5,3 KB | +0,05 KB |

### Smokes

- **41 OK** lógica (era 37 na v5.20 — +4 cases v5.21)
- **42 OK** contraste (preservado)

## Implementado com sucesso

### Backend
- ✓ Migration 007 cria tabela `setup_review_comments` com RLS
  bloqueando anon e índice composto (`submission_id`, `created_at`)
  para listing ordenado.
- ✓ RPC `list_review_comments_by_token` — valida token, expiração,
  retorna array ordenado por `created_at` ASC.
- ✓ RPC `add_review_comment_by_token` — valida token, body (1-2000
  chars), insere comment + audit event best-effort.
- ✓ `get_submission_by_token` re-criada com campo `comments` no
  payload retornado (backward-compatible — clients antigos ignoram).

### Frontend
- ✓ Tipo `ReviewComment` exportado.
- ✓ `addReviewComment` valida client-side ANTES de chamar Supabase
  (3 erros: `empty_body`, `body_too_long`, `supabase_not_configured`).
- ✓ UI da ReviewView com card dedicado: empty state + lista de
  comments (autor em strong + timestamp BR + body com pre-wrap) +
  form de novo comentário.
- ✓ Optimistic update: comment inserido aparece imediatamente na
  lista (sem refetch).
- ✓ Mensagens de erro humanizadas para `empty_body`, `body_too_long`,
  `invalid_token`, `token_expired`.

### Mobile
- ✓ `.toolbar` em mobile com flex-wrap + min-width 140px nos botões
  — resolve os 4 botões de Ações em 360px.
- ✓ Tabela de auditoria da ReviewView envolvida em `.table-wrap`
  (sombra inset de scroll horizontal, padrão da v5.19).

### Smokes
- ✓ +4 cases v5.21 — todas as 3 validações client-side de
  `addReviewComment` + sanidade do tipo `ReviewComment`.

## Parcialmente implementado

- Nenhum item parcial.

## Não implementado

- **Editar/excluir comentários**: append-only por design. Se
  alguém errar, adiciona outro corrigindo. Auditoria simples.
- **Notificar cliente por email a cada novo comentário**: fora do
  escopo deste ciclo. Adicionaria carga de email não solicitada.
  Cliente vê pelo contato direto da equipe.
- **Threading / replies**: lista plana. Suficiente para fluxo de
  análise simples.
- **Filtro/busca em comments**: a lista é pequena (≤ 20 esperados).
  Não vale o esforço.

## Correções importantes aplicadas

- O `.table-wrap` da ReviewView foi adicionado depois (tabela de
  auditoria não tinha wrap em v5.20). Sem isso, em viewport estreito
  a coluna "Quando" (timestamps longos pt-BR) empurrava o layout.

## Regressões evitadas

- `get_submission_by_token` é replaceada com a mesma assinatura;
  campo novo `comments` é additive (clients que esperam só `ticket`
  + `submission` continuam funcionando).
- `update_submission_status_by_token` intacta.
- `setup_review_comments` é tabela nova — não há dado existente a
  migrar.
- API externa dos services preservada (`loadByToken`,
  `updateStatusByToken` inalterados).
- Smokes 32 originais → 37 v5.20 → 41 v5.21 (cumulativo).
- Backend .NET skeleton intacto.

## Validações realizadas

- `vue-tsc --noEmit`: 0 erros
- `vite build`: OK 7,53s
- `npm run smoke`: 41/41 OK
- `npm run smoke:contrast`: 42/42 OK
- sqlparse da migration 007: 12 statements
- Inspeção das 3 RPCs novas: assinaturas e returns alinhados com
  o ticketService TS

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- Sandbox sem `supabase` CLI / Deno (igual v5.20).
- Migration 007 não foi executada num Postgres real, só parseada
  com sqlparse.

### Bloqueios por dependência externa
- Nenhum novo (Resend continua dependendo de domínio verificado +
  RESEND_API_KEY — herdado da v5.20).

### Bloqueios por credenciais
- Não testei `addReviewComment` end-to-end com Supabase ao vivo.

## Pendências que exigem ação manual

1. **Aplicar a migration 007**:
   ```bash
   supabase db push --project-ref yglcnirbnbwjqpvalqif
   ```
   Ela é additive — não muda tabelas existentes, só cria
   `setup_review_comments` + replace de `get_submission_by_token`
   (com mesma assinatura).
2. **Test end-to-end**:
   - Abrir um chamado existente via `/r/<token>`
   - Adicionar 2-3 comentários com autores diferentes
   - Recarregar a página, conferir que aparecem ordenados
   - Test em viewport mobile (DevTools) confirmando que os 4 botões
     de Ações empilham legível

## Como validar localmente

```bash
cd frontend
npm install
npm run build          # 0 erros TS
npm run smoke:all      # 41 + 42 OK
npm run dev
```

Para test no ReviewView real, precisa ter:
1. Migrations 005, 006, 007 aplicadas no Supabase
2. Edge Function `submit-for-validation` deployada
3. Acesso via `/r/<token>` (token vem do email enviado pela Edge)

Em modo local-only (sem Supabase), o card de comentários aparece
mas qualquer ação dispara `supabase_not_configured`.

## Como publicar no Netlify

Sem mudança no `netlify.toml`. `git push` em `main`.

## Como configurar Supabase

Sem mudança no que já estava em `docs/EDGE_FUNCTIONS.md`. Apenas
aplicar migration 007 junto das 005/006:

```bash
supabase db push --project-ref yglcnirbnbwjqpvalqif
```

ou SQL manual em ordem (005 → 006 → 007).

## Como migrar futuramente para .NET 8 + SQL Server

| Hoje (Supabase) | Amanhã (.NET 8) |
|---|---|
| RPC `list_review_comments_by_token` | `GET /api/implantacao-estrutura/review/{token}/comments` |
| RPC `add_review_comment_by_token` | `POST /api/implantacao-estrutura/review/{token}/comments` |
| `setup_review_comments` | Tabela idêntica em SQL Server |

`ticketService.ts` muda 2 funções para chamar `/api/*`. Frontend resto
intacto.

## Próximo ciclo recomendado

1. **Test end-to-end no Supabase real** (você) — descobre bugs reais
   de borda. Volta com lista cirúrgica para v5.22.
2. **Status público para o cliente** (D1 reversal opcional) — segundo
   token read-only no email do responsável + rota `/s/:token`.
   Implementável aqui em ~25 min se decidir.
3. **Lighthouse mobile baseline** — medir Performance/A11y em 360x640
   como referência para regressões.
