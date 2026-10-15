# Implementation Report · Implantação Consulte GEO v5.22.43

## Resumo executivo

Duas entregas neste ciclo:

1. **Correção do deploy no Netlify** (deploy `6a75e5be` falhou com `ENOENT
   package.json`). O repositório é um monorepo — o app Vue vive em `frontend/` —
   mas o `netlify.toml` mandava publicar a raiz e o comando `npm run build` vinha
   da UI do Netlify, que procurava `package.json` na raiz. Corrigido com
   `base = "frontend"` + `command` declarado no próprio `netlify.toml`.

2. **Integração da PRÉ-ANÁLISE (Triagem da Planilha)** no `frontend/public/importa.html`
   real (Copilot v3.1 → v3.2), agora que o source completo está disponível. O
   terceiro card foi adicionado à tela de modos e a página da triagem passou a ser
   publicada junto com o app.

## Ambiente usado

Node 20 (Netlify) / Node 22 (validação local), npm ci, Vite 5, vue-tsc 2, Chromium
(Playwright) servindo `frontend/dist` para os testes de não-regressão.

## Arquivos criados

```
.gitignore                                  (novo — repo não tinha; evitava
                                             commit acidental de 132MB de node_modules)
frontend/public/pre-analise.html            página da Pré-análise (2 passos)
frontend/public/assets/intake-auditor.js    motor determinístico (UMD)
frontend/public/assets/intake-selftest.js   suíte C1–C20 + 7 extras
frontend/public/assets/pre-analise.js       camada de página
frontend/public/assets/design-system.css    Design System (tokens/componentes)
frontend/public/assets/geo-symbol.png       símbolo da marca
IMPLEMENTATION-REPORT-V522-43.md            este relatório
```

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `netlify.toml` | `base = "frontend"`, `command = "npm run build"`, `publish = "dist"` |
| `frontend/public/importa.html` | `.mode-grid` 2→3 colunas; card **PRÉ-ANÁLISE**; handler `data-action="mode-intake"`; `APP_VERSION` 3.1.0 → 3.2.0 |
| `frontend/package.json` | `version` 5.0.22-42 → 5.0.22-43 |

## Arquivos removidos

Nenhum. Backend .NET, schemas, supabase, docs e relatórios anteriores preservados.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm ci` | OK | 81 pacotes |
| `node --check` (JS inline do importa.html) | OK | 133.486 chars |
| `node --check` intake-auditor/selftest/pre-analise | OK | 3 arquivos |
| `npm run typecheck` (vue-tsc) | OK | sem erros |
| `npm run build` | OK | build em ~8s |
| `npm run smoke:contrast` | **89 OK, 0 FAIL** | WCAG AA nos dois temas |
| `npm run smoke` (pipeline) | **578 OK, 1 FAIL** | FAIL **pré-existente** (ver abaixo) |
| Self-test da Pré-análise (browser) | **27/27 verdes** | C1–C20 + T21–T27 |
| Navegação/não-regressão (Playwright sobre `dist`) | OK | ver validações |

## Resultado dos comandos

Publicação verificada em `frontend/dist/`: `index.html` (app Vue), `importa.html`
(147.886 bytes), `pre-analise.html`, `laudos.html`, `vendor/xlsx.full.min.js`,
`assets/intake-auditor.js`, `assets/design-system.css`, `assets/geo-symbol.png`.

## Implementado com sucesso

- Deploy corrigido: build roda em `frontend/`, publica `frontend/dist`.
- Terceiro card **PRÉ-ANÁLISE** na tela de modos (3 colunas no desktop; a media
  query de 980px já reduzia para 1 coluna no mobile — mantida).
- Card abre `./pre-analise.html`; o botão “Continuar para Pré-importação” volta
  para `./importa.html`.
- `pre-analise.html` reaproveita `./vendor/xlsx.full.min.js` já existente
  (evita duplicar 881 KB no bundle).
- Versionamento no padrão do projeto (`5.0.22-43` ≙ v5.22.43) e Copilot 3.2.0.
- `.gitignore` criado (node_modules, dist, .env, logs, caches).

## Correções importantes aplicadas

- **Causa raiz do deploy**: `commandOrigin: ui` — o comando da UI vencia porque o
  `netlify.toml` não declarava `command`. Agora o comando está versionado, então o
  build é reprodutível pelo repositório e não depende da UI.
- Ausência de `.gitignore`: `git status` listava `node_modules/` (132 MB) e
  `dist/` (5,8 MB) como não rastreados — um `git add -A` os enviaria ao repo.

## Regressões evitadas

Pré-importação e Pós-importação foram exercitadas no `dist` após a alteração:
ambas abrem e renderizam normalmente. O motor do Copilot (SheetReader,
HeaderEngine, WorkbookProfiler, appState, exportação XLSX) **não foi tocado** — a
integração se limitou a CSS de grid, um card e um `else if` no event delegation.

## Validações realizadas

| Validação | Resultado |
|---|---|
| 3 cards na tela de modos, ordem Pré-análise → Pré → Pós | OK |
| `.mode-grid` com 3 colunas no desktop | OK |
| Card → `/pre-analise.html` | OK |
| Upload real de planilha “suja” (mescladas, TOTAL, FCK conflitante) | 10 registros, 6 bloqueadores, 0 erros de página |
| Self-test embutido | 27/27 |
| Pré-importação após a mudança | OK |
| Pós-importação após a mudança | OK |
| App Vue em `/` | OK |

## Bloqueios reais

### Pendência pré-existente (não introduzida por esta entrega)
`npm run smoke` acusa **1 FAIL**: *“GitHub Action deploy-edge-functions.yml
ausente — deploy Edge Functions continuará sendo manual”*. Confirmado que o repo
nunca versionou `.github/workflows/` (`git ls-tree -r HEAD`). Não foi criado um
workflow apenas para silenciar o teste: publicar Edge Functions exige
`SUPABASE_ACCESS_TOKEN`/project ref em secrets, e um workflow incompleto quebraria
o CI. Fica como próximo passo, com decisão do responsável.

### Ambiente
Sem credenciais do Supabase/Netlify nesta sessão para validar runtime autenticado —
apenas build e navegação estática foram exercitados.

## Pendências que exigem ação manual

1. Conferir na UI do Netlify se o *Base directory* está vazio (o `netlify.toml`
   já define `base`; um valor divergente na UI pode conflitar).
2. Decidir sobre `.github/workflows/deploy-edge-functions.yml` (item acima).
3. Opcional: os artefatos da v06 na raiz do repo (`index.html`, `importa.html`,
   `assets/`, `emails/`, `prototype/`) **não são publicados** — o site serve
   `frontend/dist`. Ficam como referência; podem ser movidos para `docs/` ou
   `prototype/` num ciclo de limpeza.

## Como validar localmente

```bash
cd frontend
npm ci
npm run build
npx serve dist          # ou: python3 -m http.server -d dist 8080
# abrir /importa.html → card PRÉ-ANÁLISE → upload de uma planilha de cliente
```

## Como publicar no Netlify

Push na `main`. O Netlify lê o `netlify.toml`: `base=frontend`,
`command=npm run build`, `publish=dist`, Node 20. Sem passos manuais.

## Próximo ciclo recomendado

1. Migrar a Pré-análise para dentro do `UI.render()` do Copilot (hoje é página
   dedicada) **se** houver ganho de UX — a página separada tem risco zero de
   regressão e já entrega o fluxo em 2 passos.
2. Popular `appState.intake` no `importa.html` e ativar o handoff nativo para a
   Pré-importação sem novo upload (contrato já descrito em `docs/INTEGRACAO-IMPORTA.md`).
3. Resolver a pendência do workflow de Edge Functions.
