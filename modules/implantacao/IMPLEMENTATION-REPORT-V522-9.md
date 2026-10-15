# Implementation Report · Implantação Consulte GEO v5.22.9

## Resumo executivo

Versão "equipe edita à vontade + favicon" focada em **5 entregas**:

1. **Equipe Consulte GEO edita as etapas 1-7** do cadastro do cliente diretamente, usando os mesmos componentes que o cliente usa. Não mais cards read-only com pre/JSON; agora é wizard editável real.
2. **Save automático com debounce de 800ms** ao mexer em qualquer campo na rota `/r/<token>`. Preserva o `customerInput` original antes da primeira edição (snapshot no banco).
3. **Botão "Aprovar para implantação" no topo** da página (slot `top-actions-extra` do AppShell) — equipe pode aprovar de qualquer etapa, simétrico ao "Enviar para validação" do cliente.
4. **Cards clicáveis em 2 contextos**:
   - Step8Preview (cliente): os 3 cards "erros que bloqueiam / alertas / sugestões" viram botões que rolam até o card de detalhe + flash de destaque
   - ReviewView Etapa 8 (equipe): os 5 cards de contagem (estruturas, peças, concretos, usuários, fornecedores) viram botões que navegam direto à etapa de edição
5. **Favicon Consulte GEO**: 5 arquivos gerados a partir do `logocolor2x.png` (crop do G magenta-violeta) — `favicon.ico` (multi-size 16+32+48), `favicon-16.png`, `favicon-32.png`, `favicon-512.png`, `apple-touch-icon.png` (180×180 com fundo navy `#0E1B40`).

**Build verde · typecheck verde · 110 smokes lógica (23 novos) · 42 smokes contraste · migration 010 nova.**

## Ambiente usado

- Node 20.x
- npm 10.x
- Python 3 com Pillow para geração de favicons
- Sandbox Linux sem acesso a `supabase` CLI ou Deno — validação por inspeção estática

## Arquivos criados

- `supabase/migrations/20260519_010_team_edit_technical_json.sql` (migration nova — ALTER + 2 RPCs)
- `frontend/public/favicon.ico` (8.7 KB, multi-size 16+32+48)
- `frontend/public/favicon-16.png` (930 B)
- `frontend/public/favicon-32.png` (2.7 KB)
- `frontend/public/favicon-512.png` (109 KB)
- `frontend/public/apple-touch-icon.png` (21 KB, com fundo navy)
- `IMPLEMENTATION-REPORT-V522-9.md` (este arquivo)

## Arquivos reescritos

- `frontend/src/views/ReviewView.vue` — reescrito do zero (618 → ~700 linhas). Estado novo:
  - `editSnap: SetupSnapshot` hidratado a partir do `technical_json` da submission
  - `saveTimer`, `saveStateText`, `saveInFlight` para debounce
  - `teamEditsCount` exibido no banner topo
  - 17 handlers de mutação no editSnap (campos, grupos, concretos, peças, usuários, fornecedores, emails)
  - Cada mutação chama `scheduleSave()` que dispara `flushSave()` após 800ms
  - `buildTechnicalJsonFromEditSnap()` reconstrói o payload preservando campos não tocados (metadata, technicalMapping, validation, audit)
  - Slot `top-actions-extra` do AppShell com "Aprovar para implantação" + "Devolver" + save-state
  - Slot `overlays` para o `ReturnSubmissionModal`
  - Etapa 8: 5 `<button class="nav-card-button">` que navegam via `onNavigate(N)`
- `README.md` — atualizado para v5.22.9 (equipe edita, save automático, cards clicáveis, favicon, migration 010 obrigatória)

## Arquivos alterados

- `frontend/src/services/ticketService.ts`:
  - Nova função `updateTechnicalJsonByReviewToken(token, json, actor?)` retornando `{ submission_id, team_edits_count, first_edit }`
- `frontend/src/components/Step8Preview.vue`:
  - 3 `<div class="alert">` superiores viram `<button class="validation-summary-button">` com `@click="onScrollTo(...)"`
  - 3 cards de detalhe ganham `ref` (cardBloqueantes/cardAlertas/cardSugestoes) e `:class="{ 'card-flash': flashTarget === ... }"`
  - Novo `data()` com `flashTarget` e `flashTimer`
  - `onScrollTo(target)` usa `scrollIntoView({ behavior: 'smooth', block: 'center' })` + flash de 1.8s
  - `beforeUnmount` limpa o timer
  - Novo `<style scoped>` com `.validation-summary-button` (border-left colorida por severidade) + `@keyframes cardFlash`
- `frontend/index.html`:
  - 5 tags `<link rel="icon">` + `<link rel="apple-touch-icon">`
  - `<meta name="description">` adicionada
- `frontend/package.json` — version 5.0.22-9
- `frontend/smoke-pipeline.ts` — 23 testes novos da v5.22.9

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | sem warnings novos |
| `npm run typecheck` | **0 errors** | TS strict; ajustes para `obraId` (não `obraCodigo`), `internalOnly` (não `internal_only`), `body` (não `comment`), `UpdateStatusInput` como objeto |
| `npm run build` | 1.7 MB dist | 7.01s; favicons copiados para `dist/` |
| `npm run smoke` | **110 OK / 0 FAIL** | 23 testes novos da v5.22.9 |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** | WCAG AA preservado |
| Geração de favicons | Pillow OK | crop 660×660 + fundo→transparente + redimensionamento |

## Implementado com sucesso

1. **Equipe edita etapas 1-7** — `ReviewView.vue` agora usa Step1DadosBasicos, Step2TipoEstrutura, Step3GruposEditor, Step4Concretos, Step5PecasEditor, Step6UsuariosObra, Step7Fornecedores. Mesma UX que o cliente. Sem flag `readonly`, sem branching de comportamento. A única diferença é que cliente não tem etapas 9-10 nem o botão "Aprovar".
2. **Save automático** — debounce de 800ms via `setTimeout` cancelado por chamadas subsequentes. Flush forçado antes de aprovar/devolver para garantir consistência. Estado visual no topo: "Editando..." → "Salvando..." → "Salvo · N edição(ões)" ou "Erro: …".
3. **Preservação do customerInput original** — RPC `update_technical_json_by_review_token` salva `customer_input_original` na primeira edição. Audit emite `team_edit_first` vs `team_edit` para distinguir. Frontend hoje exibe o `team_edits_count` no banner; ver o snapshot original ainda não tem UI (próxima versão).
4. **Cards clicáveis ReviewView Etapa 8** — 5 nav-card-buttons com border-left magenta, hover lift + sombra, focus-visible para acessibilidade, navegam via `@click="onNavigate(N)"`.
5. **Cards clicáveis Step8Preview** — 3 validation-summary-buttons, `:disabled` quando categoria está vazia, animação `cardFlash` 1.6s ao chegar. `scrollIntoView` smooth + center.
6. **Botão "Aprovar para implantação" no topo** — via slot `top-actions-extra`, visível em qualquer etapa para a equipe (`v-if="canApprove"`). Aprovação confirma via `confirm()`, faz flush do save pendente, chama `updateStatusByToken({ token, status: 'aprovado', reviewer })` e recarrega o payload.
7. **Favicon** — Python+Pillow gerou os 5 arquivos a partir de `/mnt/project/logocolor2x.png`. Crop (800, 80, 1460, 740) isola o G. Pixels muito escuros (R+G+B < 60) viraram transparentes para o PNG; apple-touch usa fundo navy `#0E1B40`. `index.html` adicionou 5 tags `<link>` + meta description.
8. **Migration 010** — alterações idempotentes (`if not exists` em colunas; `create or replace` nas funções). Permissions: `revoke all from public; grant execute to anon, authenticated`.

## Parcialmente implementado

- **Visualização do `customer_input_original`** pelo frontend: a coluna é populada corretamente pela RPC, mas a UI ainda não tem botão "Ver versão original do cliente" — fica para próxima versão. Se a equipe quiser conferir o original, precisa consultar o banco diretamente.
- **Bulk add / copy peças na ReviewView**: handlers existem (`onBulkAdd`, `onCopyPecas`) mas estão como `noop`. A equipe pode adicionar peça por peça, mas não usar os atalhos que o cliente tem. Se for prioridade, é fácil de ativar — o componente Step5PecasEditor já emite os eventos certos.

## Não implementado

- **Realtime de save** — se 2 pessoas da equipe abrirem o mesmo chamado simultaneamente, last-write-wins. Não há Supabase Realtime nem trava de concorrência. Aceitável para o volume atual (single-team de validação).
- **Diff visual entre customer_input_original e technical_json atual** — fica para quando alguém pedir.
- **Histórico de edições granular** — audit registra um evento por save, mas sem detalhar qual campo foi alterado. Suficiente para auditoria, não para "git blame" por campo.

## Regressões evitadas

- **Cliente em modo `/s/<client_token>`** continua vendo o `technical_json` (que agora pode ter edições da equipe). É a decisão **(l)** que combinamos: cliente vê transparente, com banner "N edições da equipe" se houver. Sem flag de "esconder edições".
- **Snapshots antigos** carregam normal: a RPC só popula `customer_input_original` na primeira edição da equipe; antes disso a coluna é `NULL` e o frontend não exibe banner.
- **`get_review_payload_by_token`** continua retornando os mesmos campos legados + 3 campos novos (`team_edits_count`, `last_team_edit_at`, `customer_input_original`). Frontend antigo simplesmente ignora os novos.
- **Cliente sem fornecedores/usuários** (snapshots pré-v5.22.6/7) ainda hidrata corretamente — `editSnap.usuariosObra` e `editSnap.fornecedores` defaultam para `[]` quando ausentes.
- **Etapa 8 da equipe** não mostra mais ValidationPanel detalhado (era read-only com JSON), mas as 5 nav-card-buttons já dão acesso a tudo. Etapa 9 ainda mostra o JSON técnico para inspeção de baixo nível.

## Validações realizadas

| Validação | Resultado | Observação |
|---|---|---|
| `npm run typecheck` | ✓ | 0 erros TS strict |
| `npm run build` | ✓ | 7.01s, favicons em `dist/` |
| `npm run smoke` | ✓ 110/110 | 23 cases novos |
| `npm run smoke:contrast` | ✓ 42/42 | WCAG AA preservado |
| Migration 010 sintaxe SQL | ✓ inspeção | grep confirma RPC + coluna |
| Favicons gerados | ✓ Pillow | 5 arquivos, tamanhos certos |
| Inspeção visual favicon-32 | ✓ via view tool | G magenta-violeta legível |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
- Sandbox sem `supabase` CLI ou Deno — migration 010 validada apenas por inspeção estática + tests do smoke. Aplicação real precisa do SQL Editor do Supabase.

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Nenhum.

## Pendências que exigem ação manual

**Esta versão exige migration nova, então o deploy não é mais "só push frontend".**

1. **Aplicar migration 010 no Supabase**:
   - Abrir Supabase Dashboard → SQL Editor
   - Colar o conteúdo de `supabase/migrations/20260519_010_team_edit_technical_json.sql`
   - Run
   - Verificar: `select team_edits_count from setup_submissions limit 1;` deve retornar coluna existente (provavelmente NULL).
2. **Push frontend** → Netlify build automático
3. **Teste end-to-end** em aba anônima:
   - Cadastrar como cliente, preencher pelo menos as Etapas 1, 3, 4, 5 e submeter
   - Pegar o `review_token` (vem no email ou no banco) e abrir `/r/<token>`
   - **Navegar pelas etapas 1-7**: deve aparecer tudo editável (campos com input, não cards read-only com `<pre>` JSON)
   - **Editar qualquer campo**: ver no topo "Editando..." → 800ms depois "Salvando..." → "Salvo · 1 edição(ões)"
   - **Verificar banner**: deve aparecer "1 edição(ões) da equipe" no topo
   - **Etapa 8**: clicar nos 5 cards verde — deve navegar pra etapa correspondente
   - **Etapa 9**: clicar "Aprovar para implantação" no botão lá dentro OU no botão no topbar (deve estar nos dois lugares)
   - **Aprovar**: confirma o status muda para 'aprovado' e os botões somem
   - **Cliente reabre `/s/<client_token>`**: deve ver os campos com as edições da equipe + banner "1 edição(ões) da equipe"
4. **Verificar favicon**: abrir o site, conferir que a aba do navegador tem o G magenta-violeta. Em iPhone, salvar como atalho na tela inicial deve mostrar o ícone com fundo navy.

## Como validar localmente

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-9.zip
cd implantacao-consulte-geo-v05-22-9/frontend
npm install
cp .env.example .env   # editar VITE_SUPABASE_*
npm run dev            # localhost:5173
```

Para testar o save automático localmente, precisa do Supabase real + migration 010 aplicada. Sem isso, o save da equipe vai falhar (mas as etapas 1-7 ainda ficam editáveis em memória).

## Como publicar

```bash
# 1. APLICAR MIGRATION 010 PRIMEIRO no Supabase
#    Dashboard → SQL Editor → cole o arquivo 20260519_010_team_edit_technical_json.sql

# 2. Push frontend
git add .
git commit -m "v5.22.9: equipe edita etapas 1-7, save automático, cards clicáveis, favicon, migration 010"
git push origin main
```

Aguarde Netlify build (~2 min). Teste em aba anônima.

## Próximo ciclo recomendado

1. **Testar com cliente piloto** — uma obra real, validar que as edições da equipe não geram confusão pro cliente quando ele volta a `/s/<token>`
2. **UI para "ver versão original do cliente"** — botão na ReviewView que mostra side-by-side `customer_input_original` vs estado atual
3. **Diff por campo** — quais campos a equipe editou; usar para emails de aprovação ("seu cadastro foi aprovado com X correções da equipe técnica")
4. **Backend .NET completo** — sair de stub, persistir em `setup_submissions_v52`, sequence para ticket_number, OIDC
5. **42 `any` no SetupPage** — dívida técnica antiga

---

**Build verde, smokes verdes (110 + 42), migration documentada, código pronto pra push após migration aplicada.**
