# Implementation Report · Implantação Consulte GEO v5.20

## Resumo executivo

Restruturação do fluxo de submissão. O wizard do cliente foi reduzido
de 8 para 6 etapas. A Etapa 6 (antes "Revisão visual") virou
"Revisão e envio" e contém o botão **Enviar para validação** que
dispara uma Edge Function Supabase. A função:

1. Insere submission + ticket no Postgres.
2. Reserva número humano-amigável `CG-AAAA-NNNNNN` via sequence.
3. Tranca o draft (read-only).
4. Envia 2 emails distintos via Resend:
   - Equipe (`thiago@consultegeo.com.br`) com link `/r/<token>`
   - Responsável (cadastrado na Etapa 1) com confirmação **sem link**
5. Retorna `ticket_number` para o frontend, **sem expor o token**.

O cliente vê um modal com o número do chamado e fim do fluxo. As
etapas internas (Validação + Acompanhamento) ficaram em uma view
nova `/r/:token` (`ReviewView.vue`) que carrega via RPC SECURITY
DEFINER gated por token.

Stack fechada respeitada. Backend .NET skeleton intacto. Smokes 37
(lógica) + 42 (contraste) verdes.

## Ambiente usado

- Node 22.22.2 (compatível Node 20+)
- Vue 3.4.38 + Vite 5.4.6 + TS 5.4.5 + Vuex 4.1 + Bootstrap 5.3.3
- Supabase project_id `yglcnirbnbwjqpvalqif`
- Resend (domínio `posso.dev` a verificar)
- Sandbox sem `supabase` CLI, sem `deno`, sem rede pra `*.azureedge.net`

## Arquivos criados

### Backend (Supabase)
- `supabase/migrations/20260518_005_setup_tickets.sql`
- `supabase/migrations/20260518_006_setup_drafts_lock.sql`
- `supabase/functions/submit-for-validation/index.ts`

### Frontend
- `frontend/src/services/ticketService.ts`
- `frontend/src/components/SubmitTicketModal.vue`
- `frontend/src/views/ReviewView.vue`

### Docs
- `docs/EDGE_FUNCTIONS.md`
- `IMPLEMENTATION-REPORT-V520.md` (este arquivo)

## Arquivos alterados

### Frontend
- `frontend/package.json` — versão 5.0.19 → 5.0.20
- `frontend/src/models/setup.models.ts`
  - WIZARD_STEPS de 8 para 6 (Etapa 6 vira "Revisão e envio")
  - Adicionados tipos `TicketSubmissionResponse`, `TicketReviewPayload`
- `frontend/src/services/supabaseClient.ts`
  - `readEnv()` cobre Vite + Node (smoke pipeline funciona)
- `frontend/src/store/modules/setup.ts`
  - Action `submit` agora chama `ticketService.submitForValidation()`
  - State: `clientMessage` + `currentTicket` adicionados
  - Mutations: `setClientMessage`, `setCurrentTicket`, `clearTicket`
- `frontend/src/router/index.ts` — rota `/r/:token` adicionada
- `frontend/src/components/Step1DadosBasicos.vue`
  - "Etapa 1 de 8" → "Etapa 1 de 6"
  - Hint no campo de email do responsável
- `frontend/src/components/Step2..6` — "Etapa N de 8" → "Etapa N de 6"
- `frontend/src/components/Step6Preview.vue`
  - Novo bloco de envio: textarea + 3 botões (Excel/JSON/Enviar)
  - Props e emits adicionados
- `frontend/src/components/WizardFooter.vue`
  - Botão "Avançar" desaparece na Etapa 6 (CTA única no card)
- `frontend/src/views/SetupPage.vue`
  - Step7Envio e Step8Acompanhamento removidos do render
  - Modal `SubmitTicketModal` integrado em `overlays`
  - Handlers `onUpdateClientMessage`, `onSubmitForValidation`,
    `onCloseTicketModal`
- `frontend/src/styles/design-system.css`
  - Header atualizado para v5.20
  - Novo bloco `.modal` + `.ticket-number-block` + `.ticket-number`
- `frontend/scripts/cleanup-legacy.cjs`
  - Allowlist atualizada (SubmitTicketModal, ticketService, ReviewView)
  - Novo target para `src/views/`
- `frontend/smoke-pipeline.ts`
  - +5 cases (ticketService fake, WIZARD_STEPS=6, última etapa correta)

## Arquivos removidos

- Nenhum. `Step7Envio.vue` e `Step8Acompanhamento.vue` foram mantidos
  no projeto porque conterão lógica reaproveitável quando a tela de
  review evoluir. Hoje não são renderizados pelo cliente.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| Análise estática de Step1, router, models, migrations | OK | 4 migrations existentes mapeadas |
| `pip install sqlparse --break-system-packages` | OK | Validação sintaxe SQL |
| sqlparse das migrations 005/006 | OK | 16 + 4 statements parseados |
| `npm install` (no working dir) | OK | sem novas deps |
| `npm run typecheck` (vue-tsc) | 0 erros TS | |
| `npm run build` | OK em 8,31s | bundle redistribuído |
| `npm run smoke` | **37 OK / 0 FAIL** | +5 cases v5.20 |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** | preservado |
| `npm run smoke:all` encadeado | OK | |
| Inspeção `dist/index.html` | modulepreload reduzido | |

## Resultado dos comandos

### Comparativo de chunks (gzip) v5.19 → v5.20

| Chunk | v5.19 | v5.20 | Delta |
|---|---|---|---|
| `index-*.js` (eager) | 28,01 KB | **31,47 KB** | +3,46 KB |
| `index-*.css` | 5,00 KB | 5,25 KB | +0,25 KB |
| `vendor-supabase-*.js` (lazy) | 53,50 KB | 53,50 KB | 0 |
| `vendor-xlsx-*.js` (lazy) | 323,14 KB | 323,14 KB | 0 |
| `excelExportService-*.js` (lazy) | 7,75 KB | 7,74 KB | -0,01 |

Crescimento do `index-*.js` (+3,46 KB) corresponde ao ReviewView,
SubmitTicketModal e ticketService. Aceitável: ReviewView só é
carregado pela equipe via link.

## Implementado com sucesso

### Backend (migrações)
- ✓ Migration 005: sequence + 4 funções (`format_ticket_number`,
  `nextval_ticket`, `get_submission_by_token`,
  `update_submission_status_by_token`) + tabela `setup_tickets`
  com RLS bloqueando anon
- ✓ Migration 006: lock columns em `setup_drafts` (`locked_at`,
  `locked_by_submission`)
- ✓ Ambas as migrations parseáveis com sqlparse (validação estática
  apenas — execução real exige Supabase ao vivo)

### Edge Function
- ✓ `submit-for-validation/index.ts`: 12 etapas (validate, env, rate-limit,
  insert submission, nextval, insert ticket, lock draft, send 2 emails,
  update ticket, audit, return without token)
- ✓ 2 templates de email (HTML + texto plano) — equipe COM link,
  responsável SEM link, conforme decisão D11
- ✓ Tratamento de erro: falha de email não bloqueia ticket; grava
  `email_error` para diagnóstico
- ✓ Audit event `ticket.created` com `entity='setup_tickets'`

### Frontend
- ✓ Wizard de 6 etapas (cliente)
- ✓ Etapa 6 com textarea opcional (1000 chars) + 3 botões
- ✓ Modal de confirmação com ticket_number em mono grande +
  botão "Copiar número"
- ✓ ReviewView (`/r/:token`) — header + cards (chamado, ações,
  JSON técnico, auditoria)
- ✓ 4 ações na ReviewView: marcar em análise, devolver, aprovar,
  marcar implantado (todas via RPC `update_submission_status_by_token`)
- ✓ Tema claro/escuro respeitado também na ReviewView (toggle próprio,
  persistência em `localStorage`)
- ✓ `supabaseClient` agora funciona em ambiente Node (`readEnv()`)

### Smokes
- ✓ `smoke-pipeline.ts` +5 cases v5.20
- ✓ Total: 37 OK lógica + 42 OK contraste

## Parcialmente implementado

- **Tema da ReviewView**: feita standalone (não usa AppShell nem
  SidebarNav). Decisão consciente: ReviewView serve usuário interno
  e tem layout próprio focado em ações, sem wizard. O tema light/dark
  funciona, mas a aparência ainda não foi validada visualmente em
  todos os tamanhos de viewport.

## Não implementado

- **Test real da Edge Function**: sandbox não tem `supabase` CLI nem
  `deno` instalado e o tráfego para `deno.land` é bloqueado. Validei
  por inspeção estática + verificações de tipo TypeScript. A execução
  real (com `RESEND_API_KEY` válida) cabe ao Thiago.
- **Verificação do domínio Resend (`posso.dev`)**: pendente no
  console Resend. Sem isso o `EMAIL_FROM` vai falhar com `domain not
  verified`.
- **Login/sessão para a equipe**: link-based é suficiente para MVP.
  Bloqueio futuro via auth + RLS pode ser adicionado.
- **Página de status público para o cliente**: cliente perde acesso
  após enviar (decisão D1). Retorno futuro do status virá por
  contato direto.
- **PDF anexo ao email**: link reduz peso e evita filtros. Cliente
  pode baixar Excel pela própria tela de revisão se necessário.

## Correções importantes aplicadas

- `supabaseClient` lia `import.meta.env` diretamente, o que estourava
  no smoke pipeline (Node puro). Trocado por `readEnv()` que
  inspeciona via globalThis. Build Vite continua funcionando.
- `cleanup-legacy.cjs` apagava arquivos novos da v5.20 por não estarem
  na allowlist. Atualizei a lista + adicionei target para `src/views/`.

## Regressões evitadas

- Backend .NET skeleton intacto.
- Smoke de lógica continua válido (32 cases originais preservados,
  +5 novos = 37).
- Smoke de contraste 42/42 OK.
- Modelos e schemas existentes intactos (apenas tipos adicionados).
- Vuex API externa preservada (assinaturas de actions inalteradas).
- Bundle splitting da v5.18 preservado (vendor-supabase continua lazy).

## Validações realizadas

- `vue-tsc --noEmit`: 0 erros
- `vite build`: OK 8,31s
- `npm run smoke`: 37/37 OK (5 novos cases v5.20)
- `npm run smoke:contrast`: 42/42 OK
- `npm run smoke:all`: encadeado OK
- Inspeção do `dist/index.html`: modulepreload reduzido vs v5.19
- sqlparse: SQL parseável (16+4 statements)
- Análise estática do payload da Edge Function (TS strict-like)

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- Sandbox **sem** `supabase` CLI / Deno / acesso a `deno.land`. Edge
  Function validada apenas por inspeção estática.
- Migration SQL não foi executada num Postgres real — apenas parseada.

### Bloqueios por dependência externa
- **Resend**: domínio `posso.dev` precisa ser verificado no console
  para que `EMAIL_FROM` funcione.
- **Supabase**: `RESEND_API_KEY` e demais secrets devem ser
  configuradas via `supabase secrets set` antes do deploy da Edge
  Function.

### Bloqueios por credenciais
- Não tenho `RESEND_API_KEY` real — Edge Function vai gravar
  `email_error` se a chave estiver inválida; o ticket continua sendo
  criado normalmente.
- Não tenho service-role key do Supabase — não pude testar a Edge
  Function localmente.

## Pendências que exigem ação manual

1. **Aplicar as migrations**:
   ```bash
   supabase db push --project-ref yglcnirbnbwjqpvalqif
   ```
   ou execução SQL manual em ordem (`005`, depois `006`).
2. **Verificar domínio `posso.dev` no console Resend**.
3. **Configurar secrets da Edge Function** (lista em
   `docs/EDGE_FUNCTIONS.md`).
4. **Deploy da Edge Function**:
   ```bash
   supabase functions deploy submit-for-validation \
     --project-ref yglcnirbnbwjqpvalqif
   ```
5. **Test end-to-end**: rodar `npm run dev`, preencher uma obra,
   chegar na Etapa 6, clicar "Enviar para validação", confirmar
   que o modal abre com `CG-2026-NNNNNN` e que o email chega
   em `thiago@consultegeo.com.br` com o link `/r/<token>`.
6. **Test do link**: abrir o link recebido, confirmar carregamento
   do ReviewView, testar as 4 ações.
7. **Deploy Netlify**: `git push` em `main`.

## Como validar localmente

```bash
cd frontend
npm install
npm run build           # ~8s, 0 erros TS
npm run smoke:all       # 37 + 42 OK
npm run dev             # http://localhost:5173
```

Para testar o fluxo completo end-to-end localmente é preciso:
1. Configurar `.env.local` com `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (preview do projeto).
2. Aplicar as migrations 005/006 no projeto Supabase.
3. Subir a Edge Function (`supabase functions serve submit-for-validation
   --no-verify-jwt --env-file ./.env.local`).
4. Preencher uma obra na UI até a Etapa 6 e clicar "Enviar".

Sem essa configuração, o protótipo continua funcional em **modo
local**: o submit retorna um ticket fake (`CG-AAAA-NNNNNN` aleatório),
sem persistência nem email. Útil para demonstrações offline.

## Como publicar no Netlify

Sem mudança no `netlify.toml`. O ponto importante:

- **Variáveis de ambiente**: as 4 `VITE_*` continuam iguais.
- **Rota `/r/:token`**: o SPA redirect (`/* /index.html 200`) já
  estava no `netlify.toml`. Funciona.
- **Cache-busting**: hash no nome dos chunks (automático Vite).

## Como configurar Supabase

Detalhes completos em `docs/EDGE_FUNCTIONS.md`. Resumo:

1. Aplicar migrations 005 e 006.
2. `supabase secrets set RESEND_API_KEY=... NOTIFICATION_RECIPIENTS=thiago@consultegeo.com.br EMAIL_FROM="Implantação Consulte GEO <noreply@posso.dev>" REVIEW_URL_BASE="https://setup.consultegeo.org/r/"`.
3. `supabase functions deploy submit-for-validation`.

## Como migrar futuramente para .NET 8 + SQL Server

O fluxo todo é portável:

| Hoje (protótipo Supabase) | Amanhã (.NET 8 + SQL Server) |
|---|---|
| Edge Function `submit-for-validation` | `POST /api/implantacao-estrutura/submit` |
| RPC `get_submission_by_token` | `GET /api/implantacao-estrutura/review/{token}` |
| RPC `update_submission_status_by_token` | `POST /api/implantacao-estrutura/review/{token}/status` |
| Sequence `ticket_number_seq` | `IDENTITY(1,1)` em SQL Server |
| `setup_tickets` | Tabela idêntica em SQL Server (sem RLS, com auth) |
| Resend | SMTP corporativo / SendGrid / SES |

O frontend não precisa mudar — só trocar o `ticketService.ts` para
chamar `/api/*` em vez de `sb.functions.invoke()` e `sb.rpc()`.

## Próximo ciclo recomendado

1. **Teste end-to-end no Supabase real** (Thiago) — descobrir bugs
   reais de borda (parsing do JSON na Edge Function, formato exato
   dos contadores, etc).
2. **Validação visual da ReviewView em mobile** — analisei estaticamente
   mas não vi em viewport real.
3. **Adicionar comentários na ReviewView** — campo `review_note`
   atual aceita uma nota só; histórico de comentários requer tabela
   nova `setup_review_comments` (ou reuso de `setup_audit_events`).
4. **Status público pro cliente** — se decidir reverter D1, basta
   gerar um segundo token "read-only" na Edge Function e enviar
   junto no email do responsável.
5. **Rate-limit mais robusto** — hoje é via SELECT em
   `setup_submissions` (60s). Para produção pode trocar por Redis ou
   uma tabela `setup_rate_limit` com TTL.
