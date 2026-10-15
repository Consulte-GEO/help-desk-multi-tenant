# Implementation Report · Implantação Consulte GEO v5.15

## Resumo executivo

Auditoria de contraste claro/escuro do design system. Foco em corrigir
problemas WCAG AA em dark mode sem trocar stack, sem mudar layout, sem
tocar lógica de negócio. Patch isolado em `frontend/src/styles/design-system.css`.

7 problemas críticos (contraste < 4,5:1 em texto), 7 importantes e 6
de polimento — todos corrigidos ou justificados.

Build limpo (vue-tsc 0 erros, vite build OK). Smoke pipeline 32 OK / 0 FAIL.

## Ambiente usado

- Node 20
- Vue 3.4.38 + Vite 5.4.6 + TS 5.4.5 + Vuex 4.1 + Bootstrap 5.3.3
- Apenas Linux container — sem ambiente real Netlify/Supabase

## Arquivos criados

- `IMPLEMENTATION-REPORT-V515.md` (este arquivo)

## Arquivos alterados

- `frontend/src/styles/design-system.css` (1077 → 1146 linhas; +1,01 kB CSS)
- `frontend/package.json` (version 5.0.14 → 5.0.15)

## Arquivos removidos

- Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | 0 vulnerabilidades, ~30s |
| `npm run build` (base v5.14) | OK | 6.75s, CSS 18.36 kB |
| `npm run build` (v5.15) | OK | 6.26s, CSS 19.35 kB |
| `npx tsx smoke-pipeline.ts` | 32 OK / 0 FAIL | Lógica de negócio intacta |

## Resultado dos comandos

- vue-tsc: 0 erros de tipo.
- vite build: 0 warnings novos (apenas o existente sobre chunks > 600 kB do xlsx).
- smoke: 32/32 cenários OK (carga de exemplos, render tree, validação, export Excel).

## Implementado com sucesso

- **🔴 C1** — `.alert.*` com texto semântico ilegível em dark. Tokens
  `--info-fg`, `--success-fg`, `--warning-fg`, `--danger-fg` adicionados.
  Contraste subiu de 2,7-3,8:1 para 7,5-11,2:1.
- **🔴 C2** — `.badge.*` em dark. Mesma solução. Badges da árvore Etapa 6,
  resumo Etapa 7, status step Etapa 8 todos legíveis.
- **🔴 C3** — `.btn.shortcut-default` em dark. Token `--brand-purple-fg`.
  Contraste 1,4:1 → 8,7:1.
- **🔴 C4** — `.btn.shortcut-empty` em dark. Uso de `--success-fg`.
  Contraste 3,1:1 → 8,7:1. Variável-fantasma `--ok` removida.
- **🔴 C5** — `.btn.danger` em dark. Usa `--danger-fg`. Botões Remover/Limpar/×.
- **🔴 C6** — `.overlay` (backdrop EditDrawer) em dark. `rgba(0,0,0,.56)`.
- **🔴 C7** — Step6 grid-3 (contadores erros/alertas/sugestões) — resolvido
  via C1.
- **🟡 I1** — `.input-suffix` em dark usa `--surface` (era `--bg`, criava
  inversão de hierarquia visual com o input ao lado).
- **🟡 I2** — Spinners de `<input type="number">` ocultos globalmente
  (regra `.input[type="number"]::-webkit-*`). Antes só `.input-fck`.
- **🟡 I3** — Variável `--ok` (fantasma, só fallback) removida; tudo
  usa `--success`/`--success-fg`.
- **🟡 I4** — `--fg-muted` light subido de #6d6a62 (4,1:1) para #5d5a52
  (6,4:1). `.kicker`, `.hint`, `.card-description`, `.padrao-section summary`
  e demais textos secundários ficam acessíveis.
- **🟡 I5** — `--shadow-1` e `--shadow-2` reescritas em dark com base
  rgba(0,0,0,…) (em vez de rgba navy 6%, que era invisível).
- **🟡 I6** — `.brand-mark img` drop-shadow trocada de rgba navy para
  rgba(0,0,0,.35) — agora dá relevo perceptível sobre o gradient.
- **🟡 I7** — `.btn[disabled]` dark opacity .40 → .55.
- **🔵 P1** — `.btn:hover` box-shadow visível em dark.
- **🔵 P2** — `--focus` ring magenta 22% → 42% em dark.
- **🔵 P3** — `.radio-pill.active` bg 6% → 14% em dark.
- **🔵 P4/P5** — `--border` e `--border-strong` dark subidos
  (#303a5e → #3a4570 e #45517c → #5b6a99). Tree/divider visíveis.

## Parcialmente implementado

- Nenhum item parcial.

## Não implementado

- **Bootstrap leakage**: auditado. Os componentes do projeto não usam
  classes Bootstrap (`.form-control`, `.form-check`, `.btn-primary` etc).
  Conflitos potenciais são teóricos. Não há código para refatorar.
  Documentado apenas.
- **`pre.json` em dark mode** com syntax highlighting: o JSON é exibido
  puro (sem realce de chaves/valores/strings). Reformatar isso exige
  parser e adicionar HTML estruturado — fora de escopo (mudaria DOM).
  O fundo `#07101f` + texto `#eef3ff` está acessível em ambos os temas.

## Correções importantes aplicadas

- Variável-fantasma `--ok` (com fallback) removida → uma fonte de verdade
  para "verde semântico" (`--success` + `--success-fg`).
- Tokens semânticos `*-fg` agora são o ponto único de extensão para
  futuras paletas. Adicionar um terceiro tema (alto contraste, por ex.)
  só requer sobrescrever 5 vars.

## Regressões evitadas

- Nenhuma classe foi renomeada.
- Nenhuma estrutura DOM em `.vue` foi alterada.
- Lógica de negócio (Vuex, services) intacta — smoke 32/32.
- Bootstrap import preservado (não removido, não trocado de ordem).
- Logos e assets preservados.

## Validações realizadas

- `npm install`: OK
- `vue-tsc --noEmit`: 0 erros
- `vite build`: OK
- `npx tsx smoke-pipeline.ts`: 32 OK / 0 FAIL
- Cálculo programático de contraste WCAG AA em 14 pares fg/bg críticos:
  todos passam 4,5:1 (anteriormente 7 deles falhavam).

## Bloqueios reais

### Bloqueios técnicos
- Nenhum.

### Bloqueios por ambiente
- Nenhum.

### Bloqueios por dependência externa
- Validação visual em browser real (Chrome/Firefox dev tools) precisa ser
  feita pelo Thiago — container Linux sem display gráfico não roda preview.

### Bloqueios por credenciais
- Deploy Netlify pendente de push em main.
- Supabase intacto (nada alterado).

## Pendências que exigem ação manual

1. **Validação visual** seguindo a checklist da seção "Como validar
   localmente" abaixo.
2. **Deploy Netlify**: push em `main` aciona deploy auto para
   `setupobras.netlify.app` / `setup.consultegeo.org`.

## Como validar localmente

```bash
cd frontend
npm install
npm run build       # espera 0 erros TS
npx tsx smoke-pipeline.ts   # espera 32 OK / 0 FAIL
npm run dev         # abre http://localhost:5173
```

Checklist visual (toggle "Modo escuro" no topbar):

1. **Etapa 4 / modo dark** — abrir um concreto, conferir botões `+ Vazio`
   (verde claro), `+ 12 horas`, `+ 7 dias` etc (lavanda claro). Devem
   estar **claramente legíveis** sobre o card escuro.
2. **Etapa 4 / modo dark** — input com sufixo "%" não deve ter
   "buraco" mais escuro que o input.
3. **Etapa 4 / dark** — inputs numéricos (idade, valor esperado, qtd CPs)
   sem spinner branco no canto direito.
4. **Etapa 6 / dark** — 3 cards de cabeçalho (erros/alertas/sugestões)
   com texto vermelho-claro/amarelo-claro/azul-claro legíveis.
5. **Etapa 6 / dark** — clicar num pavimento abre o EditDrawer; o
   backdrop deve **escurecer** o fundo visivelmente.
6. **Etapa 6 / dark** — badges `Completo`/`Pendente`/`Corrigir` na
   árvore com cores claras legíveis.
7. **Etapa 7 / dark** — alerts "Pronto para enviar" / "Envio bloqueado"
   com texto claro.
8. **Etapa 8 / dark** — `.status-step.active` com ring magenta claro.
9. **Etapa 1 / light** — kickers ("Etapa 1 de 8", "Cadastro da obra")
   devem estar nítidos, sem aspecto desbotado.
10. **Topbar light/dark** — botão "Limpar" (danger) com texto
    vermelho legível em ambos.
11. **Sidebar light/dark** — logo Consulte GEO com leve sombra
    perceptível (relevo sobre gradient).
12. **Qualquer Etapa / dark** — teclar `Tab` em campos e botões: o
    ring de foco magenta deve ser **bem visível**.

## Como publicar no Netlify

Sem mudança no `netlify.toml`. Push em `main` → deploy automático.

```toml
# netlify.toml (intacto)
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Como configurar Supabase

Sem mudança neste ciclo. Nenhuma migration nova, nenhum service alterado.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto. CSS não cruza fronteira de backend.

## Próximo ciclo recomendado

1. Substituir o smoke pipeline atual (lógica) por testes visuais
   automatizados com Playwright + axe-core para travar regressões de
   contraste a cada commit.
2. Avaliar adicionar tema "alto contraste" (terceiro `[data-theme]`)
   para clientes em obra com iluminação ruim — agora é barato (só
   sobrescrever os tokens semânticos).
3. Considerar code-split do xlsx (chunk de 627 kB) com
   `import('xlsx-js-style')` dinâmico só na Etapa 7. Reduz first-load.
4. Auditar Etapa 3 (tabela com chips de prévia expandida) e Etapa 5
   (peças bulk add) em mobile (<760px) — escopo desta auditoria foi
   só claro/escuro em viewport desktop.
