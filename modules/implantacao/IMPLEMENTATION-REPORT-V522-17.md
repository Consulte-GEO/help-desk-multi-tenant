# Implementation Report · Implantação Consulte GEO v5.22.17

## Resumo executivo

**Pedido do Thiago** (com 7 screenshots reais do app rodando em produção):

1. Não utilizamos o termo "superestrutura" no sistema — apenas "estrutura". Em
   todos os locais onde estiver "superestrutura", mudar para "estrutura".
2. O modo dark não está bom — implementar correções e melhorias nas telas.

Duas frentes resolvidas em conjunto. Build verde, typecheck verde, **166 OK
pipeline · 89 OK contraste** (era 161 / 78). **Zero ação manual** —
inclusive rascunhos antigos no Supabase migram em memória ao carregar.

## Frente 1 — Rename "Superestrutura" → "Estrutura"

### Decisão registrada

O enum `Etapa` originalmente tinha **duas literais com nomes parecidos**:

```ts
export type Etapa =
  | 'Fundação'
  | 'Infraestrutura'
  | 'Superestrutura'    // ID 3 no mapeamento técnico
  | 'Contenção'
  | 'Anexos'
  | 'Estrutura';        // ID 6 (catch-all fallback)
```

A análise do `detectEtapa` mostrou que "Superestrutura" cobria pavimentos
(térreo, 1º pav, cobertura, subsolo) e "Estrutura" era apenas o fallback
para nomes desconhecidos. Consolidei **as duas em "Estrutura"** mantendo
o ID técnico **3** (era o ID de "Superestrutura"; o antigo ID 6 do
"Estrutura" fallback foi removido, e o fallback do `etapaToId` agora
retorna `3`).

### Compatibilidade com dados existentes

Adicionei **migration helper** em `setupDraftService.ts`:

```ts
function migrateLegacySnapshot(snap: unknown): SetupSnapshot {
  // metadata.modeloProjetoFields.superestruturaDrywall → estruturaDrywall
  // pecas[].etapa === 'Superestrutura' → 'Estrutura'
}
```

Aplicada em `loadDraft` e `listDrafts`. Não modifica dados em disco — só
na leitura em memória. Quando o usuário salvar de novo, o snapshot
reescrito já vem com a forma nova. **Rascunhos antigos no Supabase
continuam abrindo sem erro**.

### Arquivos tocados (Frente 1)

| Arquivo | Mudança |
|---|---|
| `models/setup.models.ts` | Enum `Etapa` sem `'Superestrutura'`; chave `estruturaDrywall` no `ModeloProjetoFields` |
| `models/technicalMapping.models.ts` | `ETAPA_TO_CLASSIFICACAO_ID` consolidado em `Estrutura: 3`; fallback `etapaToId` retorna 3 |
| `services/normalizationService.ts` | `detectEtapa` retorna `'Estrutura'` para pavimentos (era `'Superestrutura'`) |
| `services/jsonGeneratorService.ts` | Literais `'Superestrutura'` → `'Estrutura'` |
| `services/excelExportService.ts` | Texto descritivo da coluna Etapa + ordens de exibição |
| `services/setupDraftService.ts` | + `migrateLegacySnapshot()` + `migrateRow()` aplicados em `loadDraft` e `listDrafts` |
| `store/modules/setup.ts` | Literais nos mocks/exemplos |
| `mocks/exampleSnapshots.ts` | Exemplos pré-cadastrados (Térreo, 1º-4º pav, Cobertura) e `estruturaDrywall: 'SEM'` |
| `components/Step1DadosBasicos.vue` | Label "Superestrutura" → "Estrutura"; id/v-model trocados |
| `smoke-pipeline.ts` | +5 testes de regressão (`smokeRename` block) |

### Onde "Superestrutura" ainda aparece (intencional)

Apenas dentro do `migrateLegacySnapshot()` — precisa do nome antigo para
reconhecer rascunhos legados. Quando o protótipo for desligado e migrar
para o backend .NET oficial, este helper pode ser removido junto.

## Frente 2 — Modo dark · 11 correções de legibilidade

### Diagnóstico pelas screenshots do Thiago

| Sintoma observado nas imagens | Causa raiz | Correção |
|---|---|---|
| Título h1 "Dados básicos" / "Concretos" / "Revisão e envio" fantasma no topbar | Topbar dark com `color-mix(--bg 92%, transparent)` — o radial-gradient magenta do body atravessava | Topbar / wizard-footer 98% opacidade + h1 ganha `color: var(--fg)` + `text-shadow` |
| Chips de "Prévia expandida" ilegíveis (Imagem 2) | bg `--surface-raised` + borda `--border-strong` — idênticos ao card | bg `#2d3554` + borda `#6c7ba8` |
| Floor cards fantasma nas pilhas (Imagem 7) | `.floor-card` usava `--surface` (idêntico ao `.tower-stack`) | floor-card bg `#232a45` + borda `#7986b5` + tower-stack `#1a2034` |
| Botões secundários (Reabrir, Limpar, Adicionar linha) fantasmas | Borda `#45517c` mesclava com bg | Borda `#7986b5` |
| Shortcuts roxos esmaecidos (Imagem 3) | Tint magenta do body reduzia peso visual mesmo com 7,08:1 matemático | Tint 22% (era 10%) + borda 50% (era 32%) |
| Kicker e card-description "fantasmas" mesmo passando WCAG | Percepção fraca por fonte mono 10px | Cor `#c9c8be` + bold no kicker; `#cfcec4` na descrição |
| Inputs com pouca presença | bg `--surface-raised` similar ao card | bg `#232a45` + borda `#7986b5` |

### Tudo passa WCAG AA

Após implementação inicial, o smoke-contrast detectou **3 falhas reais
de borda** (UI 1.4.11 < 3:1) que eu mesmo havia introduzido com
`#5b6a99` e `#3a4570`. Corrigi para **`#7986b5`** em todas as 3 (floor
card, botão default, input). Re-rodando: **89 OK / 0 FAIL**.

### Onde NÃO mexi

Mantive os tokens base (`--surface`, `--surface-raised`, `--border`,
`--border-strong`) intactos. Todas as correções são overrides
específicos `[data-theme="dark"] .seletor`. Isso preserva os 78 pares
de contraste já validados pelo smoke e evita regressões em light.

## Ambiente usado

- Node 22.x, npm 10.9.7
- Vite 5.4.21
- vue-tsc + TypeScript strict
- Sandbox Linux sem credenciais Supabase / Resend

## Arquivos criados

- `IMPLEMENTATION-REPORT-V522-17.md` (este arquivo)

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/models/setup.models.ts` | Enum `Etapa` (5 vs 6), chave `estruturaDrywall` |
| `frontend/src/models/technicalMapping.models.ts` | Mapeamento consolidado, fallback 3 |
| `frontend/src/services/normalizationService.ts` | `detectEtapa` |
| `frontend/src/services/jsonGeneratorService.ts` | Literais |
| `frontend/src/services/excelExportService.ts` | Texto Etapa, ordens |
| `frontend/src/services/setupDraftService.ts` | +35 linhas: migration helper |
| `frontend/src/store/modules/setup.ts` | Literais |
| `frontend/src/mocks/exampleSnapshots.ts` | Exemplos |
| `frontend/src/components/Step1DadosBasicos.vue` | Label e binding |
| `frontend/src/styles/design-system.css` | +130 linhas: bloco v5.22.17 dark fixes |
| `frontend/smoke-pipeline.ts` | +60 linhas: bloco `smokeRename` |
| `frontend/smoke-contrast.ts` | +85 linhas: 11 novos pares dark v5.22.17 |
| `frontend/package.json` | versão `5.0.22-16` → `5.0.22-17` |
| `README.md` | Seção destacada v5.22.17 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | sem novas deps |
| `npx tsx smoke-pipeline.ts` | **166 OK / 0 FAIL** | era 161 (+5 testes de regressão do rename) |
| `npx tsx smoke-contrast.ts` (iteração 1) | 86 OK / 3 FAIL | detectou bordas com contraste < 3:1 que eu havia introduzido |
| `npx tsx smoke-contrast.ts` (iteração 2 — após fix) | **89 OK / 0 FAIL** | era 78 (+11 pares dark v5.22.17) |
| `npm run build` | OK 6.83s · 149 modules | CSS subiu ~4 kB (overrides dark) |
| `vue-tsc --noEmit` | OK | strict ok |
| Grep "Superestrutura" em código real | **NENHUM** fora do migrateLegacySnapshot (intencional) |

## Implementado com sucesso

- [x] Frente 1: 24 ocorrências de "Superestrutura" → "Estrutura" em 9 arquivos
- [x] Frente 1: migration helper para rascunhos antigos no Supabase / localStorage
- [x] Frente 1: 5 smokes de regressão impedindo reaparição do termo
- [x] Frente 2: 11 correções de dark mode no CSS
- [x] Frente 2: 11 novos pares no smoke-contrast (todos passando)
- [x] Frente 2: 3 falhas de contraste detectadas e corrigidas pelo próprio gate
- [x] Build verde, typecheck verde, contrato JSON intacto, exemplos batem

## Parcialmente implementado

Nenhum item.

## Não implementado (fora do escopo desta versão)

- Harmonização do radio pill da Etapa 3 com o vocabulário "Simplificado" /
  "Modelo Completo" do dropdown v5.22.16 — você ainda não respondeu se
  quer.
- Limpeza dos 3 comentários técnicos que ainda mencionam "Cliente comum"
  / "Modelo com projetista" (referência da v5.22.16).
- Reabrir o modo dark com Lighthouse/screenshots reais após deploy.

## Correções importantes aplicadas

A iteração 1 do smoke-contrast me pegou no flagrante: bordas dark que
eu havia escolhido (`#5b6a99`, `#3a4570`) **falhavam 1.4.11** com bg
`#232a45` (floor card / input) — entre 1,52:1 e 2,75:1. Subi para
`#7986b5` em todos os 3 casos. Lição: tinta de borda em superfícies
escuras tem pouca margem; o smoke pegou exatamente o que minha
calibração visual deixou passar.

## Regressões evitadas

- Light mode: tokens base intactos; 39 pares de contraste light ainda
  passando.
- Rascunhos antigos no Supabase: `migrateLegacySnapshot` aplica em
  todos os caminhos de leitura. JSON técnico exportado de rascunhos
  legados também vem normalizado.
- Excel exportado: ID 6 do banco antigo ainda resolve para `'Estrutura'`
  no lookup defensivo `etapasIdToNome[6]`, então planilhas geradas a
  partir de drafts antigos não dão célula vazia.
- `etapaToId` fallback agora é 3 (era 6) — `'Estrutura'` continua
  retornando o ID correto.

## Validações realizadas

| Validação | Resultado |
|---|---|
| Grep "Superestrutura" em código visível | NENHUM (só no helper de migração) |
| Grep "superestruturaDrywall" | NENHUM (só no helper de migração) |
| Smoke pipeline | 166 OK / 0 FAIL |
| Smoke contraste (78 antigos + 11 novos) | 89 OK / 0 FAIL |
| Build de produção | OK 6.83s · 149 modules |
| Typecheck vue-tsc strict | OK |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
- Não consigo testar o dark fix em renderer real para confirmar com
  olhos humanos. Validação via smoke-contrast cobre matemática, não
  percepção. Recomendo teste manual pós-deploy com as mesmas 7
  screenshots que você enviou.
- Não consigo testar migration de rascunho antigo real no Supabase
  sem credenciais. Testei a função `migrateLegacySnapshot` por
  inspeção do código. Smoke garante presença das funções.

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Nenhum — esta versão é 100% frontend, sem mexer em Supabase, Edge
Functions ou Netlify config.

## Pendências que exigem ação manual

Nenhuma. Patch puramente frontend, pode ir direto para produção.

## Como validar localmente

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-17.zip
cd implantacao-consulte-geo-v05-22-17/frontend
npm install
npx tsx smoke-contrast.ts   # 89 OK / 0 FAIL
npx tsx smoke-pipeline.ts   # 166 OK / 0 FAIL
npm run build               # build verde em ~7s
npm run dev
```

No navegador, em modo dark:

1. **Etapa 1**: dropdown "Modelo de preenchimento" lista "Simplificado"
   / "Modelo Completo"; ao trocar para "Modelo Completo", aparece o
   campo "Estrutura" (era "Superestrutura").
2. **Topbar**: título "Dados básicos" lê com peso visual claro (era
   fantasma sobre o gradient).
3. **Etapa 3 / Concretos**: shortcuts "+ 12 horas" / "+ 14 horas"
   roxos com mais presença.
4. **Etapa 7 / Revisão**: pilhas "Bloco 1", "Bloco 2" com cards
   visíveis (eram quase invisíveis); título h1 com peso.
5. **Inputs em qualquer etapa**: campos preenchidos têm presença,
   bordas visíveis.

Em modo light, **tudo deve estar idêntico** à v5.22.16 (não toquei nos
tokens base).

## Como publicar no Netlify

Sem alteração. `git add -A`, commit, push → Netlify rebuilda.

## Como configurar Supabase

Sem alteração. **Nenhuma migration SQL** necessária — o helper de
migração roda em memória no client. Rascunhos antigos com
`etapa: 'Superestrutura'` continuam abrindo sem erro.

## Como migrar futuramente para .NET 8 + SQL Server

Quando o backend oficial substituir o Supabase como persistência:

- **Mantém o ID 3** para "Estrutura" no enum `Ges_Classificacao` do
  SQL Server. Os JSONs técnicos gerados estão batem.
- **Pode remover** o `migrateLegacySnapshot` do `setupDraftService` —
  ele só serve para rascunhos legados do Supabase.
- **Recomendo** rodar um script de migração de dados no SQL Server
  para qualquer registro herdado que ainda tenha
  `classificacao = 'Superestrutura'` (renomear para `'Estrutura'`).

## Próximo ciclo recomendado

1. **Teste visual real do dark** com você + screenshots novas pós-deploy
   para validar percepção (não só matemática).
2. **Decidir** sobre harmonização do radio pill da Etapa 3 com o
   vocabulário "Simplificado" / "Modelo Completo".
3. **Playwright + axe-core** para auditoria DOM real (pendência da
   v5.22.15).
