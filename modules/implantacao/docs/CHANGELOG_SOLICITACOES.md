# Changelog das solicitações aplicadas

## v5.22.38 (2026-05-22) — Drag-and-drop para reordenar

Demanda: reordenar registros em Blocos e torres e em Pavimentos e
peças arrastando a linha toda (clica, segura, arrasta para a posição).

### Composable novo

`frontend/src/composables/useDragReorder.ts`:
- `createDragReorder()` — estado reativo de DnD (armed, draggingIndex,
  overIndex) + métodos arm/onDragStart/onDragOver/onDragEnd/resolveDrop
- HTML5 Drag and Drop API nativa (sem lib externa)
- Modelo "armar pelo handle": elemento só fica draggable após
  mousedown no handle ⠿ — evita capturar o mousedown de inputs

### Store (Vuex)

`store/modules/setup.ts`:
- `reorderGrupos({ from, to })` — splice + insert, clamp de índices
- `reorderPecas({ grupoId, from, to })` — reordena dentro do grupo

### Componentes

`Step3GruposEditor.vue` (Blocos e torres):
- Drag nos dois modos (tabela e cards)
- Coluna/handle ⠿ + draggable condicional + classes dnd-row/over/dragging
- Emite `reorder-grupos`

`Step5PecasEditor.vue` (Pavimentos e peças):
- Drag nas peças de cada grupo
- Guard `dragGrupoId`: peça só pode ser solta no MESMO grupo
- Emite `reorder-pecas` com grupoId

`SetupPage.vue`:
- Handlers `onReorderGrupos` / `onReorderPecas` → commit no store
- Auditoria local (`grupo_reordenado` / `peca_reordenada`)

### CSS (design-system.css)

- `.drag-handle` (cursor grab/grabbing), `.col-drag`
- `.dnd-row`, `.dnd-dragging` (opacity), `.dnd-over` (barra brand)
- Respeita `prefers-reduced-motion`

### Decisões registradas

- **HTML5 DnD nativo, não lib**: stack fechada; reordenação de lista
  vertical não justifica dependência externa
- **Armar pelo handle**: sem isso, `draggable=true` no card/linha
  captura o mousedown e impede selecionar texto nos inputs
- **Peças não migram entre grupos**: guard de grupoId no drop;
  reordenação é só intra-grupo (coerente com o modelo de dados)
- **Clamp + splice no store**: defesa contra índices inválidos

### Validações

- Pipeline: **571 OK / 0 FAIL** (+20 testes vs 551 da v5.22.37)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 7.45s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Edge Functions / migrations / Storage
- Modelo de dados (só reordena o array existente)

## v5.22.37 (2026-05-22) — Até 5 imagens por etapa + carrossel

Demanda: permitir anexar até 5 imagens de exemplo por etapa; se houver
mais de uma, o cliente alterna entre elas com setas.

### Backend (migration 015)

`supabase/migrations/20260522_015_step_help_multiple_images.sql`:
- Adiciona `image_paths text[]` (default `{}`)
- Migra `image_path` único existente → `array[image_path]`
  (condicional, idempotente)
- Constraint `setup_step_help_max_5_images`:
  `coalesce(array_length(image_paths,1),0) <= 5`
- `image_path` fica deprecado (mantido para leitura de dados antigos)

### Frontend — service

`stepHelpService.ts`:
- `MAX_IMAGES_PER_STEP = 5`
- `StepHelp.image_paths: string[]` (image_path deprecado)
- `normalizeRow()` — converte dados antigos (image_path) para array
- `resolveImageUrls(paths[])` — resolve URLs públicas em lote
- `saveStepHelp` recebe `image_paths`, trunca em 5, sincroniza
  `image_path` com a 1ª (compat)

### Frontend — admin

`AdminStepHelpView.vue`:
- Input `multiple` + `onPickImages` (upload em lote)
- Calcula `slotsLeft`; ignora excedentes com aviso
- Bloqueia input ao atingir 5
- Grade de thumbnails com botão remover por imagem
- Contador "N/5"

### Frontend — cliente

`StepHelpPanel.vue`:
- Carrossel: 1 imagem por vez
- Setas ‹ › + indicador "N/total" + dots — só quando >1 imagem
- `prevImage`/`nextImage` com wrap-around circular
- 1 imagem: exibe direto, sem controles

### Decisões registradas

- **Array em vez de tabela filha**: até 5 itens, sem ordenação
  complexa nem metadados por imagem → `text[]` é suficiente e
  mais simples de migrar para .NET (coluna ou tabela 1:N depois).
- **image_path mantido**: não removo a coluna para não quebrar
  dados em trânsito; sincronizo com a 1ª imagem.
- **Wrap-around no carrossel**: ‹ na 1ª vai pra última e vice-versa
  (UX comum em galerias).
- **Upload em lote respeitando slots**: se já tem 3 e seleciona 4,
  sobe 2 e avisa que 2 foram ignoradas.

### Validações

- Pipeline: **551 OK / 0 FAIL** (+16 testes vs 535 da v5.22.36)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 7.47s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Edge Functions
- Vuex store
- Bucket Storage (mesmo `step-help-images`)

## v5.22.36 (2026-05-22) — Ajuda contextual configurável por etapa

Demanda: no painel admin, configurar por etapa do wizard um vídeo do
YouTube + uma imagem de exemplo; depois consumir nas telas do cliente.
Decisões do usuário: upload via Storage, todas as etapas, 1 vídeo + 1
imagem (tudo dinâmico), com título+descrição, tudo em sequência.

### Backend (migration 014)

`supabase/migrations/20260522_014_setup_step_help.sql`:
- Tabela `setup_step_help` (step_key unique, youtube_url,
  youtube_video_id, image_path, help_title, help_description,
  enabled, updated_by, updated_at) + constraints de tamanho
- RLS: leitura pública (`enabled=true OR is_admin()`), escrita só admin
- Trigger `updated_at`
- Seed idempotente das 7 etapas (ON CONFLICT DO NOTHING)
- Bucket Storage `step-help-images` (público leitura)
- 4 policies em `storage.objects`: leitura pública, insert/update/
  delete só admin

### Frontend — serviços

`frontend/src/services/youtubeService.ts`:
- `extractYoutubeVideoId` aceita watch?v=, youtu.be/, /embed/,
  /shorts/, ID puro
- Valida `[A-Za-z0-9_-]{11}` (anti-XSS)
- `youtubeEmbedUrl` (nocookie), `youtubeThumbnailUrl`, `youtubeWatchUrl`

`frontend/src/services/stepHelpService.ts`:
- `STEP_KEYS`, `STEP_KEY_BY_ID` (1→dados-basicos … 7→revisao),
  `STEP_LABELS`
- `listAllStepHelp` (admin), `getStepHelp` (wizard, só enabled)
- `saveStepHelp` (upsert, extrai videoId), `uploadStepHelpImage`
  (valida image/* + 5MB), `deleteStepHelpImage`, `resolveImageUrl`

### Frontend — telas

`frontend/src/views/AdminStepHelpView.vue` (rota `/admin/ajuda`):
- Card por etapa: título, descrição, link YouTube (validação @blur),
  upload de imagem, previews ao vivo, toggle enabled, salvar
- Link "Ajuda das etapas" no topbar do `/admin`

`frontend/src/components/StepHelpPanel.vue` (consumo no wizard):
- Prop `stepId`; resolve `step_key`; busca ajuda; colapsável
- Só renderiza se `hasContent` (vídeo OU imagem)
- Guard de race ao trocar de etapa (`loadedKey`)
- Integrado no `SetupPage` após o `PendenciasPanel`

### Decisões registradas

- **step_key texto, não número**: a numeração das etapas já mudou
  (v5.22.11 removeu a Etapa 2). Chave estável desacopla.
- **image_path, não image_url**: URL pública derivada no frontend;
  resiste a mudança de domínio do Storage.
- **Tudo dinâmico**: campos vazios não aparecem; etapa sem config
  não mostra painel.
- **Import estático no router** (não dynamic): consistência com os
  demais views + evita problema de resolve.

### Validações

- Pipeline: **535 OK / 0 FAIL** (+21 testes vs 514 da v5.22.35)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 6.83s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Edge Functions (sem função nova)
- Vuex store
- Schema das outras tabelas

## v5.22.35 (2026-05-21) — Bulk actions + atalhos de teclado

### 1. Ações em lote no painel `/admin`

`AdminDashboardView.vue`:
- Estado `selectedIds: Set<string>` (chave `kind:id`)
- Coluna de checkbox por linha + checkbox "select all" no header
- Computeds `allVisibleSelected` + `someVisibleSelected`
  (este controla o estado `indeterminate` do checkbox header)
- Métodos `onToggleRow`, `onToggleSelectAll`, `clearSelection`,
  `onBulkApplyPriority`
- Barra de ações em lote (`.bulk-bar`) aparece só quando há seleção
- `onBulkApplyPriority` aplica prioridade sequencialmente (não
  Promise.all — respeita rate limit), com atualização otimista local
  e relatório de erros parciais
- `@click.stop` no `<td class="col-check">` impede que selecionar
  abra o drill-down

**Decisões**:
- Set recriado a cada toggle (`new Set(this.selectedIds)`) para
  forçar reatividade dos computeds no Vue 3 Options API
- Desmarcar "todos" só remove os visíveis (preserva seleção de
  itens que saíram por filtro)
- Aplicação sequencial reporta erros acumulados no final, não
  interrompe o lote por falha pontual

### 2. Navegação por teclado nos Concretos

Composable novo `frontend/src/composables/useListKeyboardNav.ts`:
- `handleListKeyNav(e, state)` retorna intenção (`{ handled,
  focusedId?, expandedId?, scrollToId? }`)
- ↑/↓ move foco (sem wrap-around), Enter/Espaço expande/minimiza,
  Esc minimiza
- NÃO intercepta quando foco está em input/textarea/select/
  contenteditable

`Step4Concretos.vue`:
- Grid com `tabindex=0` + `role="list"` + `@keydown="onListKeydown"`
- Estado `focusedId` + classe `is-kbd-focused` (outline brand)
- Dica visual com `<kbd>` quando 2+ concretos
- Reusa `scrollToNewItem` (v5.22.32) para scrollar ao card focado

**Decisões**:
- Composable retorna intenção em vez de mutar — testável isolado,
  não acopla nomes de propriedades do componente
- `tabindex=0` no grid (não em cada card) — uma região focável,
  navegação interna por estado, não por tab nativo
- Sem wrap-around (parar no topo/fundo) — menos confuso

### Validações

- Pipeline: **514 OK / 0 FAIL** (+20 testes vs 494 da v5.22.34)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 8.14s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Schema do banco / migrations
- Edge Functions
- RPCs
- Vuex store
- Variáveis de ambiente

## v5.22.34 (2026-05-21) — Notificação inversa + UX polish

### 1. Notificação inversa: equipe → cliente

**Edge Function nova `notify-team-comment`** (~310 linhas):
- Espelho inverso de `notify-client-comment` (que avisa equipe)
- Acionada por `ticketService.addReviewComment` (/r/:token) e
  `adminQueriesService.addReviewCommentAsAdmin` (painel /admin)
- Resolve contexto via `SUPABASE_SERVICE_ROLE_KEY` (mesma arquitetura
  da notify-client-comment)
- Email vai para `email_recipients + email_cc` do ticket original
- Link aponta para `/s/:client_access_token` (status do cliente)
- Audit: `notify_client_team_comment_sent` / `_failed`
- Fire-and-forget + só para internal_only=false

**Migration 013 nova**: estende RPC `add_review_comment_by_token`
para retornar `submission_id` no payload. Frontend precisa desse
campo para chamar a Edge Function. Idempotente (CREATE OR REPLACE).

**Variáveis novas/opcionais**:
- `CLIENT_STATUS_URL_BASE` (opcional, ex.: `https://setup.consultegeo.org/s`)
  - Se ausente, é inferida de `REVIEW_URL_BASE` substituindo /r → /s

### 2. Badge `✓` verde no card minimizado de Concretos

`Step4Concretos.vue`: quando o concreto está MINIMIZADO E COMPLETO
(todos os campos preenchidos + tem padrão de moldagem), badge
verde-circular `✓` aparece ao lado da descrição. Reforço positivo.

CSS adicionado em `design-system.css`:
- `background: #d1fae5`
- `color: #14532d`
- formato círculo 22x22px

Complementa `⚠ Falta info` (laranja) da v5.22.32 — agora cards
minimizados sempre têm sinal visual: verde (OK) ou laranja (falta).

### 3. Animação CSS expand/collapse em Concretos

Transição suave de altura (250ms ease) ao expandir/minimizar
cards. Implementação via Vue `<transition>` com hooks JS que
medem `scrollHeight` em runtime.

```ts
onEnter(el, done) {
  requestAnimationFrame(() => {
    el.style.height = `${el.scrollHeight}px`;
    el.addEventListener('transitionend', done);
  });
}
```

Por que JS em vez de CSS-only?
- `max-height` exige adivinhar teto absurdo (`max-height: 9999px`),
  e a velocidade da animação varia conforme o conteúdo
- `height: auto` não é animável diretamente
- Hooks JS medem o `scrollHeight` real → animação consistente

**A11y**: respeita `prefers-reduced-motion` via `@media query`.
Usuários sensíveis: transição quase instantânea (só opacity).

### Workflow CI atualizado

`.github/workflows/deploy-edge-functions.yml` ganha step de deploy
para `notify-team-comment`.

### Validações

- Pipeline: **494 OK / 0 FAIL** (+18 testes vs 476 da v5.22.33)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 8.19s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Schema do banco (apenas RPC `add_review_comment_by_token` ganha
  campo no retorno, sem mudar parâmetros nem comportamento)
- RLS policies
- Vuex store

## v5.22.33 (2026-05-21) — HOTFIX (segundo round)

### Bug em produção: migrations 009 e 010 nunca foram aplicadas

**Sintoma reportado**:
```
20260521_011_admin_panel — ERROR: column s.resubmitted_at does not exist
20260521_012_admin_review_comments — ERROR: function public.is_admin() does not exist
```

**Diagnóstico**: a v5.22.31 corrigiu colunas inventadas. Mas eu
**assumi** que migrations 009 (resubmitted_at) e 010
(last_team_edit_at, customer_input_original, team_edits_count)
tinham rodado em produção. Erro: o banco real está num estado
intermediário (provavelmente só com migrations 001-008 aplicadas).

A 012 falhou em cascata novamente — Postgres rollback transacional.

### Solução: migrations auto-suficientes via `ADD IF NOT EXISTS`

Em vez de exigir que migrations 009 e 010 rodem ANTES da 011,
agora a 011 garante (idempotente) as colunas que vai usar:

```sql
-- Topo da migration 011 (ANTES de criar a view)
alter table public.setup_submissions
    add column if not exists resubmitted_at         timestamptz,
    add column if not exists last_team_edit_at      timestamptz,
    add column if not exists customer_input_original jsonb,
    add column if not exists team_edits_count       integer not null default 0;
```

Idempotente: se as migrations 009/010 já rodaram, é no-op. Se não,
adiciona aqui. A view abaixo pode referenciar essas colunas
com segurança.

Mesma defesa na 012 para colunas de `setup_review_comments`
(`author_role`, `internal_only`).

### Estados de banco suportados

A migration 011 agora funciona em qualquer destes:
- Banco com migrations 001-008 aplicadas (e mais nada)
- Banco com 001-009 aplicadas
- Banco com 001-010 aplicadas
- Banco com tudo aplicado

Idem para 012.

### Smoke tests novos (+6)

`smoke-pipeline.ts` ganha checks que falham se:
- Migration 011 não tem guard de `resubmitted_at`/`last_team_edit_at`
- Migration 012 não tem guard de `author_role`/`internal_only`
- ALTER TABLE não vem ANTES de CREATE VIEW

### Como reaplicar

Banco está limpo (rollback automático). Simplesmente reaplique
as duas migrations corrigidas em ordem:

```bash
# Via Dashboard SQL Editor:
# 1. Cole 20260521_011_admin_panel.sql → Run
# 2. Cole 20260521_012_admin_review_comments.sql → Run

# OU via CLI
supabase db push --project-ref yglcnirbnbwjqpvalqif
```

### Validações

- Pipeline: **476 OK / 0 FAIL** (+6 testes vs 470 da v5.22.32)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 7.48s
- `vue-tsc --noEmit` limpo

### Lição aprendida (continuação da v31)

Migrations que dependem de colunas opcionais devem **defensivamente
garantir** essas colunas com `ADD COLUMN IF NOT EXISTS`. Custo é
zero (idempotente) e elimina classes inteiras de erro de
sequenciamento.

## v5.22.32 (2026-05-21) — Melhorias UX

### 3 melhorias pedidas pelo usuário

**Solicitação**: "Na tela de concreto eu gostaria que sempre ficasse
apenas um registro maximizado e os outros minimizados. Se por um acaso
está faltando algum campo ou não tem padrão de moldagem no registro
minimizado deve ter algo do lado do texto da descrição do traço para
que o usuário identifique que falta algo. Em todas as telas ao clicar
em algum botão adicionar caso a quantidade de registros existentes já
ocupe a area da tela, automaticamente a tela deve rolar para o local
do novo registro."

### 1. Concretos: single-maximized

`Step4Concretos.vue` reescrito:
- `collapsed: Record<string, boolean>` → `expandedId: string | null`
- `toggleCollapsed(id)` → `toggleExpanded(id)`: se id atual está
  expandido, fecha (`expandedId = null`); senão set `expandedId = id`
  (automaticamente fecha os outros via `v-show="isExpanded(c.id)"`)
- `mounted()` expande o primeiro concreto se houver lista
- `watch 'concretos.length'`: quando aumenta, set `expandedId = novoId`
  e dispara scroll

### 2. Indicador visual de incompletude

Método `concretoIncompleto(c)` retorna `{ incompleto: bool, motivos: string[] }`.

Critérios mínimos:
- `descricao` não vazia
- `aplicacao` não vazia
- `fck` numérico entre 10 e 100 MPa
- `padroesMoldagem.length > 0`

Template renderiza `<span class="badge-incompleto">⚠ Falta info</span>`
ao lado da descrição do traço **apenas quando card está minimizado
E há motivos**. Tooltip mostra a lista de motivos.

CSS adicionado em `design-system.css`:
- `background: #fef3c7` (laranja-âmbar suave)
- `color: #92400e`
- `border: 1px solid #fbbf24`

Cor warning, não erro — não é bloqueante, é só lembrete.

### 3. Auto-scroll ao adicionar em todas as telas

Composable novo `frontend/src/composables/useScrollIntoNewItem.ts`
com função `scrollToNewItem(selector, opts?)`:

```typescript
export async function scrollToNewItem(
  selector: string,
  opts: ScrollToNewItemOptions = {},
): Promise<void> {
  await nextTick();
  await nextTick();  // 2 ticks cobrem componentes aninhados
  const el = document.querySelector(selector);
  if (!el) return;

  const margin = opts.visibleMargin ?? 80;
  const rect = el.getBoundingClientRect();
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const isVisible = rect.top >= -margin && rect.bottom <= viewportH + margin;

  if (isVisible) return;
  el.scrollIntoView({
    behavior: opts.behavior ?? 'smooth',
    block: opts.block ?? 'center',
  });
}
```

**Por que watch em `array.length`?** O botão emite evento → pai
(SetupPage) muta store → reatividade propaga de volta. O DOM só
existe depois disso. Watch + nextTick respeitam o pipeline.

**Por que detecção de viewport?** Se elemento já está visível,
scrollar deixa o usuário tonto. Margem de 80px aceita "quase
visível" como visível.

**Aplicado em 6 componentes**:

| Componente | watch | id no DOM |
|---|---|---|
| `Step3GruposEditor.vue` | `grupos.length` | `#grupo-XYZ` |
| `Step4Concretos.vue` | `concretos.length` | `#concreto-XYZ` |
| `Step5PecasEditor.vue` | `totalPecasCount` (computed: soma de todos os grupos) | `#peca-XYZ` |
| `Step6UsuariosObra.vue` | `usuarios.length` | `#usuario-XYZ` |
| `Step7Fornecedores.vue` | `fornecedores.length` | `#fornecedor-XYZ` |
| `PadraoMoldagemEditor.vue` | `padroes.length` | `#padrao-XYZ` |

### Smoke tests (+23)

Bloco anti-regressão valida:
- Composable `useScrollIntoNewItem.ts` existe e exporta `scrollToNewItem`
- Composable usa `nextTick()` + `getBoundingClientRect`
- Step4Concretos tem `expandedId`, `toggleExpanded`, `isExpanded`,
  `concretoIncompleto`, badge `class="badge-incompleto"`, watch +
  scrollToNewItem, id no card
- CSS tem `.badge-incompleto`
- Outros 5 componentes: watch correto + scrollToNewItem + id no DOM

### Validações

- Pipeline: **470 OK / 0 FAIL** (+23 testes vs 447 da v5.22.31)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 7.85s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Schema do banco / migrations
- Edge Functions
- RPCs
- Vuex store (lógica de adicionar/remover continua igual)
- Validações de envio

## v5.22.31 (2026-05-21) — HOTFIX

### Bug crítico: migrations 011 e 012 falhavam em produção

**Sintoma reportado pelo Thiago**:
```
20260521_011_admin_panel — ERROR: column s.protocolo does not exist
20260521_012_admin_review_comments — ERROR: function public.is_admin() does not exist
```

**Causa**: ao escrever a view `admin_dashboard_items` nas migrations
011 (v5.22.28) e 012 (v5.22.29), referenciei colunas que **não
existem** em `setup_submissions` e `setup_tickets`. Não chequei
schema real. A migration 012 falhou em cascata: Supabase SQL Editor
executa em transação única → quando 011 falha, tudo é revertido,
inclusive a função `is_admin()` que a 012 precisa.

**Colunas inventadas (todas removidas)**:
- `setup_submissions`: `protocolo`, `cliente`, `created_at`,
  `updated_at`, `responsavel_nome`
- `setup_tickets`: `status`, `updated_at`, `payload`

**Schema real (descoberto via grep nas migrations 001-010)**:
- `setup_submissions`: id, draft_id, status, obra_codigo, obra_nome,
  technical_json, submitted_at, reviewed_at, reviewer, review_note,
  resubmitted_at, customer_input_original, team_edits_count,
  last_team_edit_at
- `setup_tickets`: id, submission_id, ticket_number, access_token,
  client_access_token, expires_at, email_recipients, email_cc,
  email_sent_at, email_error, accessed_at, accessed_count,
  client_message, created_at

### Correções

| Campo da view | Antes (falha) | Agora (correto) |
|---|---|---|
| `identifier` (submission) | `s.protocolo` | `coalesce(subquery setup_tickets.ticket_number, 'SUB-' \|\| substr(id, 1, 8))` |
| `cliente` | `s.cliente` | `technical_json -> 'metadata' ->> 'cliente'` |
| `created_at` | `s.created_at` | `s.submitted_at` |
| `updated_at` | `s.updated_at` | `greatest(submitted_at, reviewed_at, resubmitted_at, last_team_edit_at)` |
| `status` (ticket) | `t.status` | `s.status` via JOIN |
| `updated_at` (ticket) | `t.updated_at` | `greatest(t.created_at, t.email_sent_at, t.accessed_at)` |

### Edge Function `notify-client-comment` também corrigida

Mesma raiz: usava `setup_tickets.payload` e `setup_submissions.responsavel_nome`
no `.select(...)`. Corrigido:
- Remove `payload` da query de tickets
- Extrai `responsavel_nome` de `technical_json.metadata.createdBy.nome`

### RPC `add_review_comment_as_admin` também corrigida

`setup_review_comments` tem colunas obrigatórias `author_role` e
`internal_only` (NOT NULL, criadas na migration 008). A RPC original
não populava → INSERT falharia em runtime mesmo com a função
existente. Agora popula:
- `author_role = 'equipe'`
- `internal_only = false` (comentário visível ao cliente)

### Smoke tests anti-ghost (+12)

`smoke-pipeline` agora bloqueia regressões via 12 testes que
falham se as migrations referenciarem colunas inexistentes ou se
a Edge Function usar `select('payload')` / `select('responsavel_nome')`.

### Como reaplicar

Supabase fez rollback no erro original, então banco está limpo.
Reaplicar:

```bash
# Via Dashboard SQL Editor: copiar conteúdo da migration 011 + Run
# Depois: migration 012 + Run
# OU via CLI:
supabase db push --project-ref yglcnirbnbwjqpvalqif
```

### Validações

- Pipeline: **447 OK / 0 FAIL** (+12 testes vs 435 da v5.22.30)
- Contraste: 89 OK / 0 FAIL
- Build: ✓ 8.15s
- `vue-tsc --noEmit` limpo

### Lição aprendida

A partir desta versão, qualquer migration nova que toque view/RPC
sobre tabelas existentes **deve passar pelo grep anti-ghost** antes
de empacotar. O regex `^\s*[stl]\.<col>\s*as` no SQL pega 99% dos
casos.

## v5.22.30 (2026-05-21)

### Produtividade do painel `/admin`

3 features de fluxo de trabalho.

#### 1. Quick prioridade + highlight visual

Dropdown de prioridade direto na linha do listing (sem abrir
drill-down). Adicionado `onQuickPriorityChange(item, event)` no
`AdminDashboardView` com:
- `event.stopPropagation()` (não abre drill por acidente)
- Atualização otimista local (sem reload completo)
- Rollback no UI se a mutation falhar

Linhas ganham classes condicionais via `rowClasses(it)`:
- `.row-urgent`: borda vermelha + bg suave
- `.row-high`: borda laranja + bg suave
- `.row-done`: texto riscado + cinza

#### 2. Filtros novos no header

- `filterMineOnly` (checkbox): client-side filter por
  `locked_by === currentUserEmail`
- `filterFromDate` / `filterToDate` (input[type=date]):
  hooked no `DashboardFilters.fromDate/toDate` que já existia no
  service. Validação cruzada via `min`/`max` no template.
- `onClearFilters()`: zera todos os filtros + reload
- `hasActiveFilters` computed: controla disabled do botão Limpar

#### 3. Edge Function `notify-client-comment`

Nova Edge Function dispara email para a equipe quando cliente
envia mensagem via `/s/:token`. Antes da v5.22.30, esses
comentários eram silenciosos.

**Arquitetura**:
- Frontend cliente em `ClientStatusView.onAddClientComment` chama
  `ticketService.addClientComment` (RPC) e a Edge Function
- Edge Function recebe apenas `client_access_token` + `body_preview`
- Resolve internamente `submission_id`, `ticket_number`, `obra_nome`,
  `responsavel_nome` via `SUPABASE_SERVICE_ROLE_KEY` (lê
  `setup_tickets` + `setup_submissions`)
- Manda email com link `/r/:token` da equipe (token resolvido via
  service role)
- Audit em `setup_audit_events` com action
  `notify_team_client_comment_sent` (ou `_failed`)

**Padrão de chamada**: `void sb.functions.invoke('notify-client-comment',
{...}).catch(console.warn)` no `ticketService` — fire-and-forget
total. Se Resend cair, o comentário JÁ está persistido pelo RPC
anterior. Cliente vê confirmação imediata.

**Variáveis usadas**:
- `RESEND_API_KEY` (já configurada)
- `EMAIL_FROM` (já configurada)
- `REVIEW_URL_BASE` (já configurada)
- `SUPABASE_URL` (injetada automaticamente)
- `SUPABASE_SERVICE_ROLE_KEY` (injetada automaticamente)
- `NOTIFICATION_RECIPIENTS` (opcional, CSV; default
  `atendimento@consultegeo.com.br`)

### Workflow CI atualizado

`.github/workflows/deploy-edge-functions.yml` ganha step de deploy
para `notify-client-comment`.

### Validações

- Pipeline: **435 OK / 0 FAIL** (+16 testes vs 419 da v5.22.29)
- Contraste: 89 OK / 0 FAIL (zero CSS quebrado por filtros/quick
  priority/highlight de rows)
- Build: ✓ 9.01s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Schema do cliente (fluxo `/`, `/r/:token`, `/s/:token` intactos)
- RPCs existentes (`add_review_comment_by_client_token` continua
  igual — o trigger de notificação é externo via Edge Function)
- `package.json` deps (zero novas dependências)

## v5.22.29 (2026-05-21)

### Refinamentos do painel `/admin`

3 features de alto ROI sobre o MVP da v5.22.28.

#### 1. Export Excel do listing

`adminExportService.ts` com `exportDashboardToExcel(items, stats)`.
Botão "⬇ Excel" no header. Gera arquivo `painel-gestao-{yyyyMMdd-HHmm}.xlsx`
com 4 abas:
- **Resumo**: stats agregadas
- **Itens**: listing completo
- **Notas**: notas internas de todos os itens listados
- **Histórico**: audit events dos últimos 90 dias

Reuso de `xlsx-js-style` (mesma dependência do `excelExportService`).
Lazy load para não pesar bundle inicial.

#### 2. Histórico de mudanças no drill-down

Nova aba "🕓 Histórico" lista `setup_audit_events` da submission/ticket.
Timeline com timestamp, ator, ação, origem (badge colorida).

`adminQueriesService` ganha:
- `listAuditEventsBySubmission(submissionId)`
- `listAuditEventsByTicket(ticketId)` — resolve submission_id antes
- `logAdminAudit(...)` — registra ações do próprio painel com
  `source='admin_panel'`

#### 3. Comentário visível para o cliente

Nova aba "💬 Comentários ao cliente" no drill-down. Reusa
`setup_review_comments` (canal cliente↔equipe que já existia via
tokens). Admin comenta via RPC `add_review_comment_as_admin` (re-valida
`is_admin()` server-side).

UX:
- Visual warning (amarelado) para diferenciar de notas internas
- `confirm()` antes de enviar (irreversível)
- Badge "via painel" identifica autoria do dashboard
- Cliente vê automaticamente em `/s/:token`

### Migration 012 — `20260521_012_admin_review_comments.sql`

- Policy `setup_review_comments_admin_read` (admin lê direto)
- RPC `add_review_comment_as_admin(uuid, text)` SECURITY DEFINER
- View `admin_dashboard_items` recriada com coluna
  `public_comment_count`

### Validações

- Pipeline: **419 OK / 0 FAIL** (+26 testes vs 393 da v5.22.28)
- Contraste: 89 OK / 0 FAIL (zero CSS novo — só estilos de timeline
  e abas com classes do design system)
- Build: ✓ 8.61s
- `vue-tsc --noEmit` limpo

### Sem mudança em

- Backend .NET skeleton
- Schema do cliente (fluxo `/`, `/r/:token`, `/s/:token` intactos)
- Edge Functions existentes (sem deploy adicional além da migration)
- `package.json` deps (zero novas dependências)

## v5.22.28 (2026-05-21)

### Painel de gestão (`/admin`)

Primeiro uso de **Supabase Auth** no projeto. Pedido novo nesta
iteração: tela de login + dashboard de chamados para a equipe
Consulte GEO.

**Stack do painel**:
- Vue 3 + Vue Router (rotas + guard)
- Supabase Auth (email/password, JWT com `app_metadata.is_admin`)
- Tabelas novas: `setup_admin_notes`, `setup_admin_locks`,
  `setup_admin_priorities`
- View consolidada: `admin_dashboard_items` (submissions + tickets)
- Função RLS: `is_admin()` com whitelist hardcoded dos 2 emails

**Usuários criados via Edge Function `admin-bootstrap`** (chamada
manual com shared-secret):
- `thiago@consultegeo.com.br`
- `atendimento@consultegeo.com.br`

Senhas geradas (20 chars, Web Crypto) retornadas uma única vez no
payload. Idempotente: rodar de novo não cria duplicados.

**Features de gestão**:
1. Listing consolidado submissions + tickets
2. 4 stats no topo (total, semana, em análise, urgente+alta)
3. Filtros: tipo, status, prioridade, busca com debounce
4. Drill-down: prioridade + lock "em análise por mim" (TTL 4h) +
   notas internas
5. Logout

**Validações**:
- Pipeline: 393 OK / 0 FAIL (+39 testes vs 354 da v5.22.27)
- Contraste: 89 OK (zero CSS novo no listing — sets de cores via
  variáveis do design system)
- Build: ✓ 7.18s
- `vue-tsc --noEmit` limpo

**Migração futura para .NET 8 + OpenIddict**: trivial. `signIn` vira
`POST /api/auth/login` retornando JWT; `is_admin()` vira role-based
authorization via `[Authorize(Roles="Admin")]`.

## v5.22.27 (2026-05-21)

### Cleanup geral — 4 frentes consolidadas

#### 1. Bugs herdados v5.22.23 (causa raiz identificada)

Auditando o código sem logs do DevTools, identifiquei 3 restos da
renumeração v5.22.11 (wizard 8→7 etapas) que sobreviveram à
correção parcial da v5.22.13:

- `SetupPage.onNext()` ainda usava `s === 8` / `s < 8`. Avançar da
  Etapa 7 fazia `setStep(8)` → nenhum `v-else-if="step === N"` cobre
  → **tela branca**. Causa raiz mais provável do bug reportado.
- `WizardFooter` escondia "Avançar" com `currentStep < 6` (deveria
  ser `< 7`). Usuário ficava preso na Etapa 5/6, precisava usar
  sidebar.
- `Step8Preview` com `:total-steps="8"` enquanto outros usam 7.
- `setStep` Vuex permitia `Math.min(10, step)` — clamp obsoleto
  ainda permitia valores fora dos templates.

Correções aplicadas + warning defensivo no `setStep` para flagar
callers obsoletos sem quebrar a app.

**Nota**: não é possível afirmar com 100% de certeza que isso resolve
o bug reportado sem logs de produção, mas são bugs reais com sintoma
"tela branca" identificados na auditoria.

#### 2. Acessibilidade dos 3 modais

Novo composable `src/composables/useModalA11y.ts` centraliza:
- Focus trap (Tab/Shift+Tab circula dentro do modal)
- Focus inicial no primeiro elemento focável
- ESC fecha
- Restaura foco para o elemento que abriu o modal

Aplicado em `ShareDraftLinkModal`, `SubmitTicketModal`,
`ReturnSubmissionModal`. Usa `querySelector` dentro do container
(não `$refs`) — mais resiliente que o focus manual removido na
v5.22.23. Possível defesa em profundidade para o bug "Devolver".

#### 3. Workflow CI atualizado

`.github/workflows/deploy-edge-functions.yml` ganha step de deploy
para `share-draft-link` (Edge Function da v5.22.26).

#### 4. Blueprint .NET

`docs/BACKEND_DOTNET_BLUEPRINT.md` com snippets prontos para portar
`stepMappingService.ts` (v5.22.25) e a Edge Function
`share-draft-link` (v5.22.26) para C#. Inclui `StepMappingService.cs`,
`ShareDraftService.cs`, endpoint controller, DTOs, configuração,
testes mínimos, riscos conhecidos.

**Validações automatizadas**:
- Pipeline: 354 OK / 0 FAIL (+22 testes vs 332 da v5.22.26)
- Contraste: 89 OK / 0 FAIL (zero CSS novo)
- Build: ✓ 7.27s
- `vue-tsc --noEmit` limpo

**Sem impacto em**: backend .NET skeleton, schema Supabase (sem
migration nova), CSS, JSON técnico do schema, Edge Functions
existentes.

## v5.22.26 (2026-05-21)

### Envio do link compartilhável por email (Resend)

**Pedido**: complementar o "Copiar link" (v5.22.24) com canal formal
de compartilhamento — útil para passar tarefa pra colega via email
em vez de chat informal.

**Solução**:
- Nova Edge Function `supabase/functions/share-draft-link/index.ts`
  (~270 linhas). Espelha o padrão de `notify-return`: valida UUID +
  email no payload, monta HTML/text do email, envia via Resend,
  retorna `{ok, email_id, sent_to}` ou erro estruturado.
- Novo service `src/services/setupShareService.ts` (~125 linhas).
  Validação client-side de email antes da chamada. Modo local-only
  quando `SUPABASE_CONFIGURED===false` devolve `{fake: true}` para
  manter o protótipo clicável em dev sem credenciais.
- Novo modal `src/components/ShareDraftLinkModal.vue` (~245 linhas).
  Teleport to=body, aria-modal acessível, 4 estados (idle/sending/
  success/error). Campos: email obrigatório, nome destinatário,
  nome remetente, mensagem opcional. Pré-preenche o "Seu nome" com
  `metadata.createdBy.nome` quando disponível.
- `SetupPage.vue` ganha botão "Enviar por email" na topbar (ao lado
  de "Copiar link", guard por `draftId`), state `shareModalOpen` e
  3 handlers (`onOpenShareModal`, `onCloseShareModal`,
  `onSendShareEmail`).
- Auditoria local: `share_modal_aberto`, `link_compartilhado_email`,
  `share_email_falhou`.

**Validações automatizadas**:
- Pipeline: 332 OK / 0 FAIL (+27 testes vs 305 da v5.22.25)
- Contraste: 89 OK / 0 FAIL (zero CSS novo — modal reusa
  `.modal-portal`, `.field`, `.btn`, `.alert.info/.danger`)
- Build: ✓ 8.91s
- `vue-tsc --noEmit` limpo (strict)

**Sem impacto em**: backend .NET skeleton, schema Supabase (sem
migration nova), CSS, JSON técnico do schema.

**Secrets adicionais para deploy**: `APP_URL_BASE` (ou
`SETUP_URL_BASE`, ou derivar de `REVIEW_URL_BASE` existente).
`RESEND_API_KEY` e `EMAIL_FROM` já configurados são reusados.

**Bloqueios reais**: validação 100% estrutural — sandbox sem Supabase
CLI/Deno/Resend. Runtime real exige `supabase functions deploy
share-draft-link` + `APP_URL_BASE` configurada.

## v5.22.25 (2026-05-21)

### Quitação de dívida técnica: labels "Etapa N" obsoletas

**Diagnóstico**: o `validationService.ts` produzia `localizacao`
hardcoded como `'Etapa 3'` para grupos (hoje Etapa 2), `'Etapa 6'`
para usuários (hoje Etapa 5) e `'Etapa 7'` para fornecedores (hoje
Etapa 6). A renumeração v5.22.11 nunca atualizou essas strings.

Impacto: `Step8Preview.vue`, `excelExportService.ts` e o painel de
pendências mostravam etapas erradas ao usuário. O `PendenciasPanel`
contornava via regex `/^Etapa \d+$/` lendo `path` como fonte de
verdade, mas Step8Preview e Excel não tinham essa proteção.

**Solução**:
- Novo serviço `src/services/stepMappingService.ts` centraliza
  `pathToStep()`, `stepTitle()`, `localizacaoForPath()`. Lê
  `WIZARD_STEPS` direto do model.
- `validationService.ts` reescrito: zero literais `'Etapa N'`. Todas
  as issues geram `localizacao = "Etapa N · Título"` via helper.
- `PendenciasPanel.vue` importa `pathToStep` do helper em vez de
  duplicar. Regex de workaround mantido como defesa em profundidade
  para rascunhos legados persistidos no Supabase.

**Validações automatizadas**:
- Pipeline: 305 OK / 0 FAIL (+20 testes vs 285 baseline)
- Contraste: 89 OK / 0 FAIL (zero CSS novo)
- Build: ✓ 7.33s
- Runtime smoke verifica: `localizacao` alinhada com `pathToStep`,
  zero issues regressivas, formato `"Etapa N · Título"`.

**Sem impacto em**: backend .NET skeleton, schema Supabase, Edge
Functions, CSS, JSON técnico do schema (`localizacao` é só campo
informativo dentro do bucket `validation`).

## v5.22.24 (2026-05-21)

### Link compartilhável `?draft=:id` + `/meus-rascunhos`

Fecha as últimas duas lacunas da estratégia "voltar depois sem
fricção":
- Botão "Copiar link" na topbar quando há `draftId`. Quem abrir o link
  em qualquer máquina carrega o rascunho do Supabase. URL é limpa via
  `replaceState` após carregar.
- Rota `/meus-rascunhos` com tabela ordenada pela última edição,
  "Continuar" para `/?draft=:id`, "Apagar" com soft delete via
  `window.confirm`.

Pipeline: 285 OK / 0 FAIL (+17). Contraste: 89 OK. Build verde.

## v4 (2026-05-18)

### Frontend Vue 3 endurecido
- Removida dependência de `consulte-framework-vue` (pacote não público que
  inviabilizava `npm install`).
- `package.json` enxuto: Vue 3.4, Vite 5.4, vue-tsc 2.1, Vuex 4, Bootstrap 5.3,
  xlsx 0.18, `@supabase/supabase-js` 2.45.
- Stack confirmada: Vue 3 + Vite + TypeScript + Vuex 4 + Bootstrap 5 +
  Design System Consulte GEO (aplicado via tokens CSS portáveis).
- Models separados: `ObraInput`, `EstruturaInput`, `PecaInput` (antes era
  linha única).
- Componetização: `AppShell`, `Stepper`, `ObraForm`, `EstruturasTable`,
  `PecasTable`, `PreviewTree`, `ValidationPanel`, `TechnicalExportPanel`,
  `JsonViewer`.
- View orquestradora `SetupPage.vue` + `router/index.ts`.
- Vuex modularizado em `setup`, `validation`, `export` com actions, getters
  e auditoria automática em mutações.

### Normalização real
- `normalizeFck` aceita `"30"`, `"FCK 30"`, `"FCK30"`, `"30 MPa"`, `"30mpa"`,
  `"FCK 30mpa"` preservando `raw` original.
- `normalizeVolume` aceita `100`, `100,5`, `100.5`, `100 m³`, `100,50 m3`,
  `-` (not_applicable) e vazio (missing); volume ausente vira warning, não
  bloqueia rascunho.
- `normalizeStructureNumber` retorna `type: 'range' | 'list' | 'text'` com
  `items` expandidos e `display` legível.
- Expansão de pavimentos (`"1º ao 10º pavimento"`).
- 20 smoke tests passando.

### Validações reais
- Sistema `code/severity/message/path/entityTemporaryId/suggestedFix`.
- Severidades `error | warning | info`.
- Validações de Obra, Estrutura e Peça + cruzadas (mesma peça com
  FCK/volume divergente, agrupamentos).
- 23 códigos de validação catalogados em `VALIDATION_CODES`.

### JSON técnico v4
- `metadata` com 10 campos (schemaVersion, generatedAt, generatedBy,
  source, environment, tenantHint, draftId, submissionId, projectName,
  projectVersion).
- `customerInput` preservado exatamente como digitado.
- `normalizedStructure` separa obra, estruturas, peças e agrupamentos.
- `technicalMapping.rows` com mapping concreto para `Ges_Obra`,
  `Pro_Projetista`, `Ges_Classificacao`, `Utl_Produto`, `Con_Concreto`,
  `Ges_UnidadeTipo`, `Ges_UnidadeGrupo`, `Ges_Unidade`, `CTe_PadraoMoldagem`,
  `CTe_TipoEnsaioProduto` com `@ref:` para resolver dependências.
- `renderTree` em árvore (obra → estruturas → peças) com badges/totals/alerts.
- `audit` com timestamp/actor/action/entity/source.
- Schema JSON v4 disponível em `schemas/implantacao-consulte-geo.v4.schema.json`.

### Exportação Excel real
- Geração no browser via `xlsx` 0.18.
- **8 abas obrigatórias**: Resumo, Estruturas, Peças, Tipos Técnicos,
  Unidades Técnicas, Mapeamento Banco, Validações, JSON Técnico.
- Nome do arquivo: `implantacao-consulte-geo-{codigo}-{yyyyMMdd-HHmm}.xlsx`.
- Smoke pipeline confirmou abertura e leitura do .xlsx escrito.

### Persistência Supabase
- 4 services isolados: `setupDraftService`, `setupSubmissionService`,
  `setupAuditService`, `setupExportService`.
- Fallback `localStorage` quando env Supabase ausente — protótipo
  permanece funcional em modo local.
- 4 migrations: `setup_drafts`, `setup_submissions`, `setup_audit_events`,
  `setup_exports` (RLS habilitado, policies `*_anon_rw` para o protótipo).
- Cliente Supabase com headers `x-app-name` / `x-app-env`.
- Soft delete (status `cancelado`) — nunca hard delete.

### Deploy
- `netlify.toml` configurado (base `frontend`, command `npm run build`,
  publish `frontend/dist`, NODE_VERSION 20, SPA redirect, headers).
- `.env.example` com as 4 variáveis VITE_*.
- Docs: `docs/SUPABASE.md`, `docs/NETLIFY.md`, `docs/DESIGN_SYSTEM_USAGE.md`.

### Backend .NET preservado
- Skeleton .NET 8 (Controllers, DTOs, Services, Repository) e DDL SQL
  Server **mantidos intactos** em `backend/`.

## v3 (anterior)
- Removidas referências ao modelo específico citado anteriormente.
- Botão alterado para **Carregar exemplo completo com projetista**.
- Texto **Estruturas** aplicado no lugar de nomenclatura anterior.
- **Tipo de Estrutura**, **Número da Estrutura** e **Nomenclatura no Sistema** aplicados.
- **Projetista** alterado para campo string livre.
- Dropdown Tipo de Estrutura configurado com Bloco, Torre, Contenção, Área Externa, Anexos e Apoio.
- **Regra Aplicada** aplicado.
- Botão **Adicionar linha** aplicado.
- Adicionada exportação de planilha Excel preenchida na área **Exportação técnica**.
- JSON técnico refeito com mapeamento do banco real enviado.

## v5.22.19 (2026-05-20)

### Solicitação do Thiago

> *"Em alguns casos o usuário esqueceu de coletar alguma informação
> antes de começar o preenchimento e terá que voltar depois para
> completar. Avalie a melhor solução."*

### Decisão arquitetural

Defesa em profundidade — três camadas combinadas, em vez de uma
solução única. Diagnóstico identificou que o `setupDraftService` já
salva (Supabase + LS fallback) e `persistDebounced` já tinha 9 call
sites no `SetupPage` — faltava apenas implementação real e UX para
retomada.

### Camada 1 — Autosave debounce-safe (3s)

- `persistDebounced` reescrita: cancela timer pendente, agenda
  `saveDraftSilent` em 3s. Reset a cada nova edição.
- Novo `saveDraftSilent` noexcept no service — não dispara audit log
  (evita poluir `setup_audit_events` com evento a cada 3s).
- Constante `AUTOSAVE_DEBOUNCE_MS = 3000` no store.

### Camada 2 — Banner "Continuar onde parei"

- Novo `ResumeDraftBanner.vue` reusando `.alert.info` (par fg/bg já
  validado — zero cor nova, zero entrada nova no smoke-contrast).
- Cálculo de tempo relativo pt-BR ("há 2 minutos", "ontem", "há 3 dias").
- Ponteiro persistido em chave separada `consulte-geo.setup.last-draft.v1`
  — guarda `{id, obraNome, updatedAt}` apenas, não duplica snapshot.
- Atualizado em `saveDraft` manual, `loadDraft` e cada autosave.
- Limpo em `reset()` (mutation) e no botão "Começar novo" do banner.

### Camada 3 — Aviso `beforeunload` para edições não salvas

- Listener registrado em `mounted()`, removido em `beforeUnmount()`.
- Só dispara se `isDirty=true` — janela curta (≤3s entre edição e
  autosave), mas suficiente para o usuário que apertar Ctrl+W no
  meio de digitar não perder o input.

### Validações

- Pipeline: **203 OK / 0 FAIL** (+23 testes novos)
- Contraste: **89 OK / 0 FAIL**
- Build: verde em 7.70s
- TypeScript strict: limpo

### Alternativas avaliadas e descartadas

| Alternativa | Por que descartada |
|---|---|
| Cookies | Limite de 4KB; snapshot passa disso facilmente |
| Email com link como primária | Atrito alto (escrever email, abrir caixa, clicar) |
| `/meus-rascunhos` lista | Bom mas não resolve o caso comum (mesmo navegador, mesmo usuário) — fica para futuro |
| Link copiável `?draft=:id` | Bom para colega/troca-de-máquina — fica para futuro |

## v5.22.20 (2026-05-20)

### Continuação da v5.22.19

Complemento natural da solicitação anterior do Thiago. A v5.22.19
resolveu "voltar depois" (autosave + retomada + beforeunload); esta
versão resolve o **problema raiz** ("não tenho o dado agora, mas
quero seguir") com a Camada 4 prevista na proposta original.

### Painel de Pendências persistente

- Novo `PendenciasPanel.vue` renderizado no topo das Etapas 1–6.
- Lista bloqueantes (errors) + alertas (warnings) com badge,
  localização legível, mensagem e botão "Ir para Etapa N".
- Botão `goTo(step)` reusa a navegação que já existia para a sidebar
  (mesmo método). Zero novo código de roteamento.
- Painel some na Etapa 7 (`Step8Preview` já tem o resumo completo).
- Reusa `.alert.danger`/`.alert.warning` — zero cor nova.

### Mapeamento path → etapa

`pathToStep()` helper interno ao componente. Usa `path` como fonte
de verdade (estável); `localizacao` ficaria obsoleta após a
renumeração v5.22.11. 6 prefixos cobrem 100% dos paths gerados
pelo `validationService` atual.

### Validações

- Pipeline: **220 OK / 0 FAIL** (+17 testes novos)
- Contraste: **89 OK / 0 FAIL**
- Build: verde em 8.96s
- Smoke ad-hoc de runtime: 5 issues em snapshot vazio, 100% mapeados

## v5.22.21 (2026-05-20)

### Continuação natural da v5.22.20

Refinamento de UX: na v5.22.20, o botão "Ir para Etapa N" do
PendenciasPanel levava o usuário à etapa, mas ele ainda precisava
caçar a célula. Agora o **input específico** é focado e centralizado
na tela automaticamente.

### Convenção `data-field-id` nos Steps

- Peças/grupos: `${entityTemporaryId}-${campo}` (ex.: `peca_abc-fck`)
- Metadata: `meta-${path}` (ex.: `meta-obraNome`)
- Listas sem campo singular: null → fallback gracioso (só navega)

### Steps anotados

| Step | Campos | Ocorrências |
|---|---|---|
| Step1 | `meta-obraNome` | 1 |
| Step3 | `${grupo.id}-numeroEstrutura` | 2 (modo comum + projetista) |
| Step5 | `${peca.id}-{local,fck,volume}` | 3 |

### Novo método `goToWithFocus(payload)` no SetupPage

- Navega para etapa (se diferente da atual)
- `$nextTick` + `requestAnimationFrame` para garantir DOM pintado
- `querySelector('[data-field-id="..."]')` + `scrollIntoView` + `focus`
- Falha silenciosa se não achar

### Novo botão "Focar campo"

Aparece quando pendência está na etapa atual mas tem `fieldId`
mapeado. Útil para tabelas grandes onde o input pode estar fora da
viewport.

### Validações

- Pipeline: **239 OK / 0 FAIL** (+19 testes novos)
- Contraste: **89 OK / 0 FAIL**
- Build: verde em 9.77s
- Smoke ad-hoc funcional: 4/4 codes principais mapeados corretamente

## v5.22.22 (2026-05-20)

### Solicitação do Thiago

> *"Na tela de fornecedores ao invés do botão Adicionar fornecedor eu
> gostaria de dois botões: Adicionar Usina, Adicionar Laboratório."*

### Mudança

Step7Fornecedores agora tem 2 botões tipados no lugar do botão único:

- "Adicionar usina" → `$emit('add-fornecedor', 'usina')`
- "Adicionar laboratório" → `$emit('add-fornecedor', 'laboratorio')`

Mesma alteração no botão do fim da lista (vira "Adicionar outra usina" +
"Adicionar outro laboratório"). Mensagem da empty area atualizada.

Handlers no SetupPage / ClientStatusView / ReviewView atualizados para
receber o tipo e repassar a `novoFornecedor(tipo)`. A função em
`setup.models.ts` já aceitava `tipo` como parâmetro desde v5.22.7 — só
não estava sendo usado. Auditoria local registra
`fornecedor_add_usina` ou `fornecedor_add_laboratorio`.

### Validações

- Pipeline: **254 OK / 0 FAIL** (+15 testes novos)
- Contraste: **89 OK / 0 FAIL**
- Build: verde em 9.63s
- Zero CSS novo · zero migração SQL · zero impacto no schema

## v5.22.23 (2026-05-20)

### Solicitações do Thiago (5 itens via screenshot + texto)

1. Painel de pendências sempre recolhido por default; usuário clica "Ver detalhes" para expandir
2. **Bug**: clicar em "Ir para Etapa N" deixava a tela em branco
3. Ao criar um novo grupo em "Blocos e torres", já vir com "sem numeração" (prévia com 1 elemento)
4. FCK, Volume por unidade e Concreto **não são obrigatórios** em Pavimentos e peças
5. **Bug**: botão "Devolver para o responsável" não funciona

### Mudanças

**Item 1** — `PendenciasPanel.vue`: `data() { expanded: false }`. Botão alterna entre "Ver detalhes" e "Ocultar detalhes".

**Item 2** — `SetupPage.goToWithFocus` refatorado de async/await para fluxo síncrono no setStep + `nextTick(callback)` com try/catch global no foco. Removido o `requestAnimationFrame` extra.

**Item 3** — `novoGrupo()` em `setup.models.ts` defaulta `edificacoesInput: '-'`. `expandRange('-')` retorna `[null]` = 1 item sem numeração.

**Item 4** — `validationService.ts`:
- FCK vazio: deixa de gerar issue (era bloqueante)
- FCK preenchido com valor inválido (fora 10-100): vira warning (era bloqueante)
- Volume vazio: deixa de gerar issue (era warning)
- Volume > 1000 e casas decimais demais: continuam warning (input inválido ≠ ausente)
- Concreto: já era pendência interna, sem mudança

**Item 5** — Defensivo, **sem reprodução em sandbox**:
- `ReturnSubmissionModal`: removido watch que tentava focar textarea via ref no nextTick (potencial fonte de erro silencioso)
- `ReviewView.onOpenReturnModal`: log visível em produção para diagnóstico

### Validações

- Pipeline: **268 OK / 0 FAIL** (+14 testes novos)
- Contraste: **89 OK / 0 FAIL**
- Build: verde em 9.88s
- Smoke funcional ad-hoc: 6/6 testes passaram (FCK vazio OK, FCK inválido warning, Volume vazio OK, Volume > 1000 warning, novoGrupo default "-")

## v5.22.24 (2026-05-21)

### Continuação da estratégia "voltar depois sem fricção"

Fecha os cenários de borda que ficaram em aberto desde a v5.22.19:
troca de máquina e múltiplas obras em paralelo.

### Link compartilhável `?draft=:id`

- Botão "Copiar link" na topbar, visível quando há `draftId` no state
- Feedback visual: muda para "✓ Link copiado!" por 2s
- 3 fallbacks de copy: `navigator.clipboard`, `execCommand`, `prompt`
- `mounted` do SetupPage virou async e detecta `?draft=` no query
- URL é limpa via `replaceState` após carregar (não vaza ID no histórico)

### Lista `/meus-rascunhos`

- Nova rota com tabela ordenada por `updated_at DESC`
- Reusa `listDrafts()` (Supabase + LS fallback)
- Filtra `status === 'rascunho'` (ignora enviados/cancelados)
- "Continuar" → `/?draft=:id` (entra no fluxo do SetupPage)
- "Apagar" → soft delete via `deleteDraft` com `window.confirm`

### Dívida técnica registrada

- RLS aberta no `setup_drafts` — link por ID UUID é seguro contra
  força bruta mas exposto a logs públicos
- `/meus-rascunhos` é por dispositivo (sem auth real). Quando houver
  login, vai filtrar por `owner_id`

### Validações

- Pipeline: **285 OK / 0 FAIL** (+17 testes novos)
- Contraste: **89 OK / 0 FAIL**
- Build: verde em 9.63s
