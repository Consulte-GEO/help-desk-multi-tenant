# Implementation Report · Implantação Consulte GEO v5.22

## Resumo executivo

Reversal parcial da decisão D1 da v5.20: o cliente agora **tem** uma
página de status read-only acessada via email do responsável. A
mudança é cirúrgica:

- Novo token separado `client_access_token` (diferente do
  `access_token` da equipe — reencaminhar o email do cliente NÃO
  concede acesso de equipe).
- Nova rota `/s/:token` (`ClientStatusView.vue`) — read-only +
  troca de mensagens com a equipe.
- Cliente pode **comentar** (always `author_role='cliente'` no server,
  fora do controle do frontend).
- Equipe pode marcar comentários como `internal_only=true` — não
  aparecem para o cliente.
- Email do responsável agora inclui botão "Acompanhar status".

Backend .NET skeleton intacto. Stack fechada. Smokes 45 (lógica)
+ 42 (contraste) verdes.

## Decisões do produto fechadas neste ciclo

| # | Decisão | Resultado |
|---|---|---|
| S1 | Cliente vê apenas status ou também resumo da obra? | **Status + comentários + resumo (sem JSON técnico bruto)** |
| S2 | Cliente pode comentar? | **Sim, com `author_role='cliente'` forçado server-side** |
| S3 | Como equipe esconde notas internas? | **Coluna `internal_only` em `setup_review_comments` + checkbox na ReviewView** |
| S4 | Token: mesmo da equipe ou separado? | **Separado — `client_access_token` UUID próprio** |

## Ambiente usado

- Node 22.22.2 / Vue 3.4.38 / Vite 5.4.6 / TS 5.4.5 / Vuex 4.1 /
  Bootstrap 5.3.3
- Supabase project_id `yglcnirbnbwjqpvalqif`
- Sandbox sem `supabase` CLI / Deno (igual v5.20/v5.21)

## Arquivos criados

- `supabase/migrations/20260518_008_setup_client_status.sql`
- `frontend/src/views/ClientStatusView.vue`
- `IMPLEMENTATION-REPORT-V522.md` (este arquivo)

## Arquivos alterados

### Backend
- `supabase/functions/submit-for-validation/index.ts`
  - Nova env `CLIENT_STATUS_URL_BASE` (opcional, inferido do
    `REVIEW_URL_BASE`)
  - Captura `client_access_token` no insert do ticket
  - Email do responsável agora inclui botão "Acompanhar status"
    com link `/s/<client_access_token>`

### Frontend
- `frontend/package.json` — 5.0.21 → 5.0.22
- `frontend/scripts/cleanup-legacy.cjs`
  - Allowlist `src/views/` ganha `ClientStatusView.vue`
- `frontend/src/models/setup.models.ts`
  - `ReviewComment` ganhou `author_role` e `internal_only` opcionais
  - Novo tipo `ClientStatusPayload` (payload da rota pública)
- `frontend/src/services/ticketService.ts`
  - `AddReviewCommentInput` ganhou `internalOnly?: boolean`
  - 3 funções novas: `loadClientStatus`, `addClientComment`
- `frontend/src/router/index.ts` — rota `/s/:token` adicionada
- `frontend/src/views/ReviewView.vue`
  - Checkbox "Comentário interno (não aparece pro cliente)"
  - Badges visuais na lista: "Cliente" e "Interno"
  - Feedback adaptado quando salva comentário interno
- `frontend/src/styles/design-system.css`
  - Header v5.22
  - `.comment--internal` com fundo amarelado + border-left warning

### Smokes
- `frontend/smoke-pipeline.ts`
  - +4 cases: validações de `addClientComment`, tipo
    `ClientStatusPayload`, `ReviewComment` com author_role/internal_only

### Docs
- `docs/EDGE_FUNCTIONS.md` — documenta env `CLIENT_STATUS_URL_BASE`

## Arquivos removidos

- Nenhum.

## Comandos executados

| Comando | Resultado |
|---|---|
| Cópia v5.21 → v5.22 working | OK |
| sqlparse migration 008 | 20 statements top-level |
| `npm install` | OK |
| `npm run typecheck` | 0 erros TS |
| `npm run build` | OK em 7,91s |
| `npm run smoke` (lógica) | **45 OK / 0 FAIL** |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** |
| `npm run smoke:all` encadeado | OK |

## Resultado dos comandos

### Smokes

- **45 OK** lógica (era 41 na v5.21 — +4 cases v5.22)
- **42 OK** contraste (preservado)

### Crescimento do bundle

| Chunk | v5.21 | v5.22 | Delta |
|---|---|---|---|
| `index-*.js` gzip | ~31,9 KB | ~33,3 KB | +1,4 KB (ClientStatusView completa) |
| `index-*.css` gzip | ~5,3 KB | ~5,4 KB | +0,1 KB |

## Implementado com sucesso

### Backend
- ✓ Migration 008: coluna `client_access_token` UUID UNIQUE em
  `setup_tickets` com backfill seguro de tickets existentes
- ✓ Colunas `internal_only` (bool, default false) e `author_role`
  (text, check 'equipe'|'cliente') em `setup_review_comments`
- ✓ 3 RPCs novas para o cliente:
  - `get_status_by_client_token(token)` — payload filtrado, sem
    technical_json bruto, sem reviewer/review_note
  - `list_review_comments_by_client_token(token)` — filtra `internal_only=true`
  - `add_review_comment_by_client_token(token, author, body)` —
    sempre `author_role='cliente'` server-side
- ✓ `add_review_comment_by_token` (equipe) agora aceita
  `p_internal_only` opcional (default false — backward-compatible)
- ✓ `get_submission_by_token` re-criada incluindo `author_role` e
  `internal_only` nos comments (equipe vê tudo)

### Edge Function
- ✓ Captura `client_access_token` no insert
- ✓ Email do responsável agora tem botão CTA navy "Acompanhar status"
  apontando para `${CLIENT_STATUS_URL_BASE}${client_access_token}`
- ✓ `CLIENT_STATUS_URL_BASE` opcional — fallback inferindo de
  `REVIEW_URL_BASE` (`/r/` → `/s/`). Deploys existentes não quebram.

### Frontend
- ✓ Rota `/s/:token` registrada com `props: true`
- ✓ `ClientStatusView.vue` standalone (sem AppShell/SidebarNav):
  cabeçalho + card de resumo + card de mensagens com form de envio +
  rodapé informativo
- ✓ Sugestão automática do nome do responsável como autor padrão
- ✓ Toggle tema light/dark com persistência separada
  (`client-status-theme` localStorage)
- ✓ Distinção visual: comentários do cliente recebem `border-left`
  magenta; badge "Você" (info) ou "Consulte GEO" (success)
- ✓ Tratamento de erros humanizado (invalid_token, token_expired,
  empty_body, body_too_long)

### ReviewView
- ✓ Checkbox "Comentário interno" no form de novo comentário
- ✓ Badges "Cliente" e "Interno" nos comentários listados
- ✓ `.comment--internal` com fundo amarelado discreto + border-left
  warning (alerta visual à equipe)
- ✓ Feedback adaptado: "Comentário interno adicionado (não visível
  ao cliente)"

### Smokes
- ✓ +4 cases v5.22: validações `addClientComment` (empty_body,
  body_too_long), tipo `ClientStatusPayload`, `ReviewComment` com
  `author_role`/`internal_only`

## Parcialmente implementado

- Nenhum item parcial.

## Não implementado

- **Notificação por email quando cliente comenta**: a equipe vê o
  comentário só ao abrir a ReviewView. Implementar webhook/email
  exigiria nova Edge Function ou trigger Postgres. Fora do escopo.
- **Notificação por email quando equipe comenta (não interno)**:
  cliente precisa abrir o link periodicamente. Mesma justificativa.
- **WebSocket / refresh automático**: a página não recarrega
  comentários ao vivo. Cliente refaz F5 para ver novidades.
- **Anexos em comentários** (foto da obra, PDF): só texto. Anexos
  exigiriam Storage e UI mais complexa.
- **Cliente edita/exclui o próprio comentário**: append-only,
  igual à equipe.

## Correções importantes aplicadas

- Backfill seguro do `client_access_token` em tickets existentes
  (`UPDATE ... WHERE client_access_token IS NULL`) antes de tornar
  NOT NULL. Permite aplicar a migration em ambiente já populado sem
  perder dados.
- `CLIENT_STATUS_URL_BASE` com fallback inteligente — deploy não
  quebra mesmo se Thiago esquecer de adicionar a secret nova.

## Regressões evitadas

- `get_submission_by_token` é replaceada com a MESMA assinatura
  (`(uuid) returns jsonb`). Clients que não conhecem `author_role`/
  `internal_only` simplesmente ignoram.
- `add_review_comment_by_token` ganhou parâmetro opcional —
  signature antiga foi DROPed, mas a nova é (uuid, text, text,
  boolean default false). Chamadas sem o 4º parâmetro continuam OK.
- Email da equipe (com link `/r/`) **intacto**. Só o email do
  responsável ganhou o botão `/s/`.
- Modal de submit do cliente intacto.
- Smokes cumulativos: 32 → 37 → 41 → 45.

## Validações realizadas

- `vue-tsc --noEmit`: 0 erros
- `vite build`: OK 7,91s
- `npm run smoke`: 45/45 OK
- `npm run smoke:contrast`: 42/42 OK
- sqlparse da migration 008: 20 statements
- Inspeção das 5 RPCs (3 novas + 2 replaceadas) consistente com TS

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- Mesmo set das v5.20/v5.21 (sandbox sem `supabase` CLI / Deno).
- Migration 008 não executada em Postgres real, só parseada.

### Bloqueios por dependência externa
- Mesmo set v5.20 (Resend / domínio).

### Bloqueios por credenciais
- Não testei end-to-end o fluxo:
  1. Submit normal pelo cliente
  2. Email do responsável chega com botão "Acompanhar status"
  3. Abrir o link → ClientStatusView carrega
  4. Cliente comenta → aparece na ReviewView com badge "Cliente"
  5. Equipe comenta como `internal_only` → cliente não vê

## Pendências que exigem ação manual

1. **Aplicar migration 008**:
   ```bash
   supabase db push --project-ref yglcnirbnbwjqpvalqif
   ```
   A migration faz backfill seguro de tickets existentes.
2. **Configurar `CLIENT_STATUS_URL_BASE` (opcional)**:
   ```bash
   supabase secrets set CLIENT_STATUS_URL_BASE="https://setup.consultegeo.org/s/"
   ```
   Sem isso, a Edge Function infere de `REVIEW_URL_BASE` (`/r/` → `/s/`).
3. **Re-deploy da Edge Function** (porque o template do email mudou
   + nova env):
   ```bash
   supabase functions deploy submit-for-validation
   ```
4. **Test end-to-end**:
   - Submit pelo cliente
   - Confirmar email do responsável chega com botão "Acompanhar status"
   - Abrir o link `/s/<token>` em uma aba e `/r/<token>` em outra
   - Equipe digita comentário normal → aparece em ambas
   - Equipe digita comentário com checkbox "interno" marcado → some na do cliente
   - Cliente digita mensagem → aparece em ambas, com badge "Cliente"

## Como validar localmente

```bash
cd frontend
npm install
npm run build          # 0 erros TS
npm run smoke:all      # 45 + 42 OK
npm run dev            # http://localhost:5173
```

Em modo local-only, tentar `/s/qualquer-uuid` mostra tela de erro
"Link inválido" (RPC não existe / Supabase não configurado).

## Como publicar no Netlify

SPA redirect existente (`/* /index.html 200`) cobre `/r/` e `/s/`.
Sem mudança no `netlify.toml`. Push em `main`.

## Como migrar futuramente para .NET 8 + SQL Server

| Hoje (Supabase) | Amanhã (.NET 8) |
|---|---|
| RPC `get_status_by_client_token` | `GET /api/implantacao-estrutura/status/{client_token}` |
| RPC `list_review_comments_by_client_token` | `GET /api/implantacao-estrutura/status/{client_token}/messages` |
| RPC `add_review_comment_by_client_token` | `POST /api/implantacao-estrutura/status/{client_token}/messages` |
| Colunas `internal_only`, `author_role` | Idem no SQL Server |

Frontend muda só `ticketService.ts`.

## Próximo ciclo recomendado

1. **Test end-to-end no Supabase real (você)** — descobrir bugs
   reais antes de empilhar mais features.
2. **Notificação por email quando há novo comentário** — segunda
   Edge Function `notify-new-comment` disparada por trigger ou pela
   própria RPC. Útil para fechar o loop sem F5 manual.
3. **Anexos em comentários** — exige Supabase Storage + UI.
4. **Refresh automático** (polling 30s ou supabase realtime) —
   ClientStatusView e ReviewView ganham updates ao vivo.
