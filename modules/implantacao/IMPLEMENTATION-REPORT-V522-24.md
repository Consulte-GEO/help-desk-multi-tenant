# Implementation Report · Implantação Consulte GEO v5.22.24

## Resumo executivo

**Pedido**: avançar com o backlog após v5.22.23 (sem bloqueio em testes
manuais pendentes). Escolhi a **v5.22.25 originalmente sugerida** (link
compartilhável + `/meus-rascunhos`) e renumerei para v5.22.24 — fecha
cenários de borda da estratégia "voltar depois sem fricção" iniciada
na v5.22.19.

**Status**: implementado, validado por smoke pipeline.
**Build verde · 285 OK pipeline (+17) · 89 OK contraste · zero CSS novo ·
zero migração SQL · zero impacto em schema**.

## Diagnóstico

### O que existia (antes desta versão)

- `setupDraftService.ts` já tinha `listDrafts()`, `loadDraft(id)`,
  `deleteDraft(id)` desde sempre — só não tinha UI consumindo
- `getLastDraftPointer/setLastDraftPointer/clearLastDraftPointer`
  desde v5.22.19
- Vue Router com 4 rotas configuradas (setup, review, client-status,
  health)
- SPA fallback no `netlify.toml` (`/* → /index.html status 200`)
- `mounted` do SetupPage era síncrono

### Quais lacunas a v5.22.24 fecha

1. **Troca de máquina**: usuário começa cadastro no notebook,
   precisa terminar no celular ou em outra estação. Antes: impossível
   (pointer é local). Agora: copia link, abre na outra máquina.
2. **Passar tarefa para colega**: estagiário começa, engenheiro
   completa. Cola o link no Slack/WhatsApp.
3. **Múltiplas obras em paralelo**: empresa cadastrando várias
   obras ao mesmo tempo. Antes: pointer aponta só pra última editada;
   as outras "somem". Agora: lista vê todas, escolhe qual continuar.

### O que foi alterado

| Arquivo | Tipo | Mudança |
|---|---|---|
| `frontend/src/views/MyDraftsView.vue` | NOVO | tabela de rascunhos + ações |
| `frontend/src/router/index.ts` | MOD | rota `/meus-rascunhos` |
| `frontend/src/views/SetupPage.vue` | MOD | mounted async, `?draft=`, botão + handler |
| `frontend/scripts/cleanup-legacy.cjs` | MOD | allowlist da view nova |
| `frontend/smoke-pipeline.ts` | MOD | +130 linhas (bloco v5.22.24) |
| `frontend/package.json` | MOD | version bump |
| `README.md` | MOD | header + nova seção |
| `docs/CHANGELOG_SOLICITACOES.md` | MOD | entrada v5.22.24 |

### O que foi validado

- **Pipeline**: 285 OK / 0 FAIL (eram 268; +17 testes novos)
- **Contraste**: 89 OK / 0 FAIL (zero CSS novo — `MyDraftsView`
  reusa `.app-shell`, `.card`, `.table`, `.btn`, todos validados)
- **Build**: verde em 9.63s
- **Typecheck strict**: limpo (`npx vue-tsc --noEmit`)
- Smoke testa que o link `Continuar` da MyDraftsView usa exatamente
  o formato `/?draft=:id` que o mounted do SetupPage espera —
  consistência verificada.

### O que NÃO pôde ser validado

- **Comportamento real em browser**: sandbox sem headless. Smoke
  garante que código existe e build empacota tudo; comportamento
  visual (clique no botão "Copiar link" → feedback de 2s → "Link
  copiado!" volta a "Copiar link") precisa ser testado em produção.
- **Compatibilidade do `navigator.clipboard.writeText`**: API
  moderna, requer contexto seguro. Em ambientes corporativos com
  http://intranet/, o fallback `execCommand('copy')` ativa. Não
  testado em ambos.
- **`/meus-rascunhos` com 50+ rascunhos**: `listDrafts` limita a 50.
  Sem paginação. UI usa tabela simples; pode ficar longa. Por ora
  basta para os números esperados (1-10 obras paralelas).

## Decisões registradas

### Por que `?draft=` na query e não `/d/:id` como rota

Considerei `/d/:id` (rota com param). Razões para preferir query:

1. **Volta para `/` automaticamente após `replaceState`**: a URL fica
   limpa para o usuário, sem precisar adicionar mais uma rota
   "default" pós-carga.
2. **Não polui router**: `/meus-rascunhos`, `/r/`, `/s/` já fazem o
   sistema parecer "cheio de rotas". `?draft=` é parâmetro opcional
   da home — semanticamente mais correto ("vou abrir a home, mas
   pré-carregada com X").
3. **Backward-compatible**: links da v5.22.19 (que não tinha esse
   recurso) continuam funcionando — a query é ignorada se não houver
   handler.

### Por que limpar a URL com `replaceState` em vez de manter

Manter o `?draft=` na URL teria 2 problemas:

1. **Vazamento por recopia**: se o usuário copiar a URL de novo
   (ex.: para mandar pra outra pessoa), estaria mandando um link
   que recarrega o mesmo rascunho de novo — comportamento confuso e
   acidentalmente compartilhador.
2. **Histórico**: F5 ou back/forward com `?draft=` recarrega o
   loadDraft toda vez, gerando audit poluído e potencialmente
   sobrescrevendo edições não-salvas.

`replaceState` mantém o usuário na mesma "página" do histórico, só
muda a URL visível. Não dispara nova navegação no Vue Router.

### Por que 3 fallbacks de copy

`navigator.clipboard.writeText` só funciona em contextos seguros
(HTTPS ou localhost). Para um ERP rodando em `http://192.168.x.x`
da intranet de uma construtora, falharia silenciosa. O
`execCommand('copy')` está deprecated mas funciona em todos os
browsers ainda — é o backup canônico. O `prompt()` é o último
recurso (usuário copia manualmente do diálogo) — feio mas
inquebrável.

Garante que o botão "Copiar link" **sempre** consegue entregar o
link de algum modo. Trade-off de complexidade aceitável (15 linhas
de fallback) para zero "por que não funciona?" do usuário.

### Por que botão "Copiar link" só com `draftId`

Se o rascunho ainda não foi persistido (autosave nunca rodou, ex.:
usuário acabou de abrir e está tocando no Step1), não há ID
estável para compartilhar. Mostrar o botão deixaria o usuário
clicar e copiar `/?draft=` vazio — frustrante.

O autosave dispara a cada 3s de inatividade, então o `draftId`
aparece logo após a primeira edição "completada". Para o usuário
prático, parece quase imediato.

### Por que `MyDraftsView` não usa Vuex

Razões:

1. **View isolada**: só faz `listDrafts` + `deleteDraft`. Não muda
   estado do setup wizard.
2. **Evita poluir state**: meter `myDrafts: SetupDraftRow[]` no Vuex
   só pra esta tela seria over-engineering.
3. **Reload trivial**: `this.drafts = await listDrafts()` 1 vez no
   `mounted`. Sem necessidade de cache reativo.

Tema é sincronizado lendo `document.documentElement.dataset.theme`
direto, evitando dependência do store. Imperfeito (não reage a
mudança de tema no mesmo carregamento), mas vista é leve e o usuário
quase nunca abre/fecha tema na lista.

### Por que filtra `status === 'rascunho'`

`listDrafts()` devolve todos os rascunhos, incluindo `enviado`,
`devolvido`, `aprovado`, `implantado`, `cancelado`. A lista
"Meus rascunhos" só faz sentido para os ATIVOS — os outros já
estão em outro fluxo (`/s/:token` para o usuário, `/r/:token` para
a equipe).

Filtro feito client-side em vez de mudar `listDrafts` para evitar
quebrar consumers existentes do service.

### Por que apagar é soft delete

`deleteDraft` já fazia soft delete (`status='cancelado'` + `updated_at`).
Mantém audit trail no Supabase e não destrói LS imediatamente
(usuário pode recuperar via support se errar).

`window.confirm` antes do clique — barreira sufuciente para evitar
delete acidental, sem complexidade extra.

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / browser

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `frontend/src/views/MyDraftsView.vue` | 200 |
| `IMPLEMENTATION-REPORT-V522-24.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/router/index.ts` | +1 import, +7 linhas (rota nova) |
| `frontend/src/views/SetupPage.vue` | mounted async + ~110 linhas (botão, handlers, query handling, cleanup) |
| `frontend/scripts/cleanup-legacy.cjs` | +2 linhas (allowlist) |
| `frontend/smoke-pipeline.ts` | +130 linhas (bloco v5.22.24) + 1 ajuste de flexibilidade |
| `frontend/package.json` | version bump |
| `README.md` | header + nova seção |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.24 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Saída |
|---|---|
| Sandbox preservado da v5.22.23 | versão 5.0.22-23 → bump 5.0.22-24 |
| `npx vue-tsc --noEmit` (após cada bloco) | limpo |
| `npx tsx smoke-pipeline.ts` | **285 OK / 0 FAIL** |
| `npx tsx smoke-contrast.ts` | **89 OK / 0 FAIL** |
| `npm run build` | **✓ built in 9.63s** |

## Implementado com sucesso

- [x] Rota `/meus-rascunhos` no router
- [x] `MyDraftsView.vue` renderiza com tabela de rascunhos
- [x] Filtra `status === 'rascunho'`
- [x] Ordena por `updated_at DESC` (vem do listDrafts)
- [x] Formato de data pt-BR ("20/05/2026 14:32")
- [x] Botão "Continuar" → `/?draft=:id`
- [x] Botão "Apagar" → `deleteDraft` com `window.confirm`
- [x] Limpa pointer local quando apaga o draft "current"
- [x] Empty state quando 0 rascunhos
- [x] Error state quando `listDrafts` falha
- [x] Loading state durante fetch
- [x] Botão "Voltar ao cadastro" + toggle de tema
- [x] `SetupPage.mounted()` async
- [x] Detecta `?draft=` query e chama `loadDraft`
- [x] `replaceState` limpa a URL sem disparar navegação
- [x] Audit `rascunho_carregado_via_link`
- [x] Botão "Copiar link" na topbar, visível só se há `draftId`
- [x] `navigator.clipboard.writeText` (caminho principal)
- [x] Fallback `execCommand('copy')` (http internal)
- [x] Fallback final `window.prompt()`
- [x] Feedback visual "✓ Link copiado!" por 2s
- [x] Audit `link_copiado`
- [x] `beforeUnmount` limpa o `linkCopiedTimer`
- [x] `cleanup-legacy` allowlist atualizado
- [x] Smoke pipeline +17 testes
- [x] README + CHANGELOG atualizados
- [x] Backend .NET: **intocado**
- [x] Schema Supabase: **intocado**
- [x] CSS: zero linhas alteradas

## Parcialmente implementado

Nada.

## Não implementado (escopo deferido)

- **Envio do link por email** (Resend) — secundária do plano
  original. Pode entrar como v5.22.27 quando houver demanda.
- **Paginação na lista** — limite hard de 50 do `listDrafts`.
  Sem demanda real ainda.
- **Filtros/busca na lista** — não vai escalar pra 50+ obras antes
  de haver demanda explícita.
- **Endurecer RLS no `setup_drafts`** — dívida técnica documentada
  na seção do README. Vale quando o backend .NET for a fonte da
  verdade.

## Correções de smoke aplicadas

### Check de versão da v5.22.23 estava estrito

Igual aos checks anteriores. Flexibilizado para `!== '5.0.22-22|21|20|19|18'`.
Padrão consistente — toda versão futura é aceita.

## Regressões evitadas

- **`loadDraft` retorna null se ID não existe** — o catch interno do
  mounted lida com isso (segue fluxo normal, banner aparece se houver
  pointer local).
- **Pointer local NÃO é apagado quando link compartilhável é usado** —
  o `setup/loadDraft` no store já atualiza o pointer para o ID
  carregado. Resultado: se o usuário fechar a aba e voltar, o banner
  oferece esse mesmo rascunho.
- **`?draft=` inválido não quebra**: catch silencioso + fluxo normal
  segue. Banner aparece se houver pointer local.
- **F5 na URL com `?draft=`**: como o `replaceState` apaga a query
  após o load, F5 recarrega `/` puro — não tem efeito colateral.
- **Multiple tabs**: cada uma processa `?draft=` independentemente.
  Sem conflito de estado entre abas (cada uma tem sua própria
  instância do store).
- **Apagar o draft "current"**: `MyDraftsView` limpa o pointer local
  se for o caso. Banner não vai tentar reabrir um draft que sumiu.

## Validações realizadas

| Critério §16 | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 285 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 9.63s |
| `.env.example` existe, sem secrets reais | ✅ (não tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke garante |
| Projetista é texto livre | ✅ smoke garante |
| Rascunho salva e recarrega | ✅ smoke v5.22.19 |
| JSON técnico gera e valida contra schema | ✅ smoke v5.22.18 |
| Excel técnico exporta | ✅ smoke v5.22.18 |
| Validações aparecem | ✅ smoke v5.22.18+ |
| Auditoria registra eventos | ✅ smoke v5.22.18 + 2 ações novas |
| Documentação atualizada | ✅ |
| Backend .NET skeleton intacto | ✅ |

## Bloqueios reais

- **Browser real**: sandbox sem chromium-headless. Não testei:
  - Botão "Copiar link" aparecendo na topbar
  - Clipboard real funcionando
  - Feedback "Link copiado!" alternando
  - `/meus-rascunhos` carregando + Continuar funcionando
  - `?draft=` no query string carregando o rascunho
  - `replaceState` limpando a URL

## Pendências que exigem ação manual

1. **Teste do botão "Copiar link"**: abrir cadastro, digitar algo
   (espera 3s para autosave gerar o `draftId`), botão "Copiar link"
   aparece na topbar. Clicar → label muda para "✓ Link copiado!"
   por 2s. Cola o link em outra aba → carrega o mesmo rascunho.

2. **Teste de `/meus-rascunhos`**: acessar `setup.consultegeo.org/meus-rascunhos`.
   Deve listar todos os rascunhos com status `rascunho`. "Continuar"
   abre o cadastro com aquele rascunho. "Apagar" pede confirmação e
   remove da lista.

3. **Teste de retomada via link em outro browser**: copiar link na
   máquina A, abrir no browser B (limpo, sem cookies/LS). Carrega o
   rascunho do Supabase.

4. **Validar bugs herdados** (v5.22.23):
   - "Ir para Etapa N" não deixa branca
   - "Devolver para responsável" funciona (com logs do DevTools)

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 285 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado: 89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 10s)
npm run dev                  # abre http://localhost:5173
```

Visite `http://localhost:5173/meus-rascunhos` para testar a lista.
Crie um rascunho na home, espere 3s (autosave), clique "Copiar link"
no topo, abra em aba anônima.

## Como publicar no Netlify

Sem mudanças no `netlify.toml`. Push para `main`. O SPA fallback
existente cobre a rota `/meus-rascunhos`.

## Como configurar Supabase

Sem mudanças no schema. Sem migration. A tabela `setup_drafts` já
suporta tudo que é necessário.

## Como migrar para .NET 8 + SQL Server

Sem impacto direto. Quando o backend .NET entrar:

- `GET /api/implantacao-estrutura/drafts/{id}` é o que o `?draft=`
  consumirá (já é o que `loadDraft` faz).
- `GET /api/implantacao-estrutura/drafts` (lista) alimenta o
  `/meus-rascunhos`. Filtros por `owner_id` quando houver auth.
- Considerar autenticação por token de acesso por link em vez de
  expor o ID UUID diretamente.

## Próximo ciclo recomendado

**v5.22.25** — Validar bugs herdados (v5.22.23 itens 2 e 5). Com os
logs do DevTools que o usuário vai trazer, fix exato em vez de
defesa em profundidade.

**v5.22.26** — Limpeza das labels "Etapa N" obsoletas no
`validationService.ts` (dívida técnica documentada desde v5.22.20).

**v5.22.27** — Envio do link por email (Resend) como complemento da
v5.22.24. Útil para passar tarefa pra colega de forma formal.
