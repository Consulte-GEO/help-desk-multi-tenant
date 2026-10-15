# Implementation Report · Implantação Consulte GEO v5.22.20

## Resumo executivo

**Pedido do Thiago** (continuação da v5.22.19, Camada 4 da proposta original):

> *"... v5.22.20 — Camada 4 da proposta original: painel de pendências
> persistente. Lista campos faltantes (warnings ainda não resolvidos)
> no rodapé do wizard com link direto para a etapa+linha. Resolve o
> problema na raiz: 'esqueci de coletar agora'."*

**Resposta entregue**: novo componente `PendenciasPanel.vue`
renderizado no topo das Etapas 1–6 do wizard. Lista bloqueantes
(errors) + alertas (warnings) com botão "Ir para Etapa N" que
dispara navegação direta. Some na Etapa 7 (`Step8Preview` já tem
resumo completo). Reusa pares de cor já validados pelo smoke-contrast.

**Status**: implementado, validado.
**Build verde · 220 OK pipeline (+17) · 89 OK contraste · zero cor nova ·
zero ação manual no Supabase**.

## Diagnóstico

### O que existia (antes desta versão)

1. **`validationService.ts`**: gera `ValidationBuckets` com 4 buckets
   (`bloqueantes`, `alertas`, `sugestoes`, `pendenciasInternas`). Cada
   `ValidationIssue` carrega `path`, `localizacao`, `severity`,
   `message`, `entityTemporaryId`.
2. **`SetupPage.vue`**: já calculava `validation: ValidationBuckets`
   em um computed. Tinha `bloqueantesCount` exposto para o botão
   "Enviar para validação" (Etapa 7) e tooltip explicando o disable.
3. **`Step8Preview.vue`** (Etapa 7): tinha visualização completa com
   summary buttons (Bloqueantes / Alertas / Sugestões), ancoragem,
   integração com EditDrawer.
4. **`goTo(stepId)`** method já existia em `SetupPage` — usado pelo
   `@navigate` da sidebar.

### O que estava faltando

- **Visibilidade das pendências durante o preenchimento** (Etapas 1–6).
  O usuário só via o resumo na Etapa 7. Para resolver pendências
  espalhadas, precisava navegar etapa por etapa procurando o que
  faltava — exatamente o problema raiz descrito pelo Thiago.

### Bug latente identificado (não corrigido — fora de escopo)

As strings `localizacao` armazenadas em alguns issues estão **obsoletas**
após a renumeração v5.22.11. Exemplo: validation atribui `localizacao:
'Etapa 3'` para grupos, mas grupos hoje são Etapa 2. Os
`Step8Preview` provavelmente exibe as labels obsoletas — sem testes
para confirmar o quão visível é o impacto.

**Decisão**: não corrigir nesta versão. O `PendenciasPanel` usa `path`
como fonte de verdade (estável, semântico) e **reescreve a label**
quando vier no formato "Etapa N" obsoleto. Corrigir o validationService
em si é trabalho à parte. Documentado aqui como dívida técnica.

### O que foi alterado

1. `frontend/src/components/PendenciasPanel.vue` — **novo**.
2. `frontend/src/views/SetupPage.vue` — import + registro + render no
   template (`v-if="step < 7"`) + listener `@go-to="goTo"`.
3. `frontend/src/styles/design-system.css` — bloco `.pendencias-panel*`
   (só layout; cores via `.alert.danger`/`.alert.warning`).
4. `frontend/scripts/cleanup-legacy.cjs` — `PendenciasPanel.vue` na
   allowlist.
5. `frontend/smoke-pipeline.ts` — bloco v5.22.20 (17 testes novos).
   Também tornei o check de versão do bloco v5.22.19 mais flexível
   (era estrito em `5.0.22-19`, agora só confirma "saiu da -18").
6. `frontend/package.json` — bump 5.0.22-19 → 5.0.22-20.
7. `README.md` — header e nova seção de mudanças.
8. `docs/CHANGELOG_SOLICITACOES.md` — entrada v5.22.20.

### O que foi validado

- **Pipeline**: 220 OK / 0 FAIL (eram 203; +17 testes novos)
- **Contraste**: 89 OK / 0 FAIL (zero cor nova)
- **Build**: verde em 8.96s
- **Typecheck strict**: limpo (`npx vue-tsc --noEmit`)
- **Smoke ad-hoc funcional** (script criado pra checar, depois removido):
  snapshot vazio gera 5 issues; `pathToStep` mapeou os 5 corretamente
  para etapas válidas (1, 2, 4, 5, 6). Cobertura confirmada.
- **Diff contra v5.22.19**: 8 arquivos alterados/criados, conforme
  esperado.

### O que NÃO pôde ser validado

- **Comportamento em browser real**: clicar em "Ir para Etapa N",
  navegação acontecendo, painel aparecendo/sumindo conforme se navega.
  Sandbox sem headless browser. Smoke garante que o código está lá.
- **Acessibilidade real do `aria-expanded`**: estrutura está correta,
  mas não foi testada com leitor de tela.
- **Layout em viewports muito pequenos** (<320px). Há media query
  `@media (max-width: 600px)` mas sem teste visual.

## Decisões registradas

### Por que `path` em vez de `localizacao` como fonte de mapeamento

`localizacao` é uma string legível ("Etapa 3", "Bloco 1", "Sapata SP-01")
populada de formas heterogêneas pelo `validationService`. Em alguns
casos é "Etapa N" — e essa N está obsoleta após v5.22.11 (validation diz
"Etapa 3" para grupos, mas hoje grupos são Etapa 2). Em outros casos é
o nome dinâmico da entidade.

`path` é estrutural (`grupos[0].pecas[1].fck`), gerado pelo código do
próprio validation, e nunca foi tocado pela renumeração. Mais seguro.

O `localizacao` continua sendo usado para **display**, mas com fallback
para o título da etapa quando vem no formato obsoleto.

### Por que mostrar errors + warnings no mesmo painel

Pensei em separar (dois painéis: bloqueantes vermelho, alertas amarelo)
mas decidi por um único painel com badge inline por tipo. Razões:

1. **Foco do usuário**: ele quer ver tudo que falta, não ter que
   processar duas listas paralelas.
2. **Hierarquia visual**: `severityClass` muda o painel inteiro entre
   `.alert.danger` (se há bloqueante) e `.alert.warning` (só alertas).
   Sinaliza criticidade sem dividir a lista.
3. **Espaço de tela**: dois painéis ocupariam o dobro do espaço acima
   do conteúdo da etapa. Já estão competindo com o `ResumeDraftBanner`
   no topo.

### Por que NÃO mostrar `info` e `pendenciaInterna`

- `info` (sugestões): são dicas de estilo/qualidade, não "campos que
  faltam". Ex.: "considere adicionar pavimento técnico". Não é
  pendência no sentido do usuário.
- `pendenciaInterna`: revisão da equipe Consulte GEO. Aparece em
  outras telas (`ReviewView`), não no fluxo do cliente.

Filtragem feita no `computed visibleItems` do componente — entrada
recebe `validation.issues` (lista completa) e processa internamente.

### Por que painel some na Etapa 7

`Step8Preview` já tem o resumo completo de validação:
- Summary buttons com counts dos 4 buckets
- Listas detalhadas por bucket
- Botões de ancoragem rolando para cada seção
- Integração com `EditDrawer` para edição inline

Repetir o painel ali seria ruído. Manter painel só nas etapas de
preenchimento (1–6) é onde ele agrega valor.

### Por que padrão expandido (em vez de colapsado)

Premissa: usuário acabou de abrir a página, precisa **ver de cara** o
que falta. Padrão recolhido faria o painel parecer "decoração". Após
ver pela 1ª vez, ele pode recolher se quiser focar no formulário.
Estado per-sessão; não persistido.

### Por que reusar `.badge.danger`/`.badge.warning` para os badges

Esses pares fg/bg já estão validados pelo smoke-contrast em ambos os
temas (claro/escuro). Criar cor nova de badge exigiria entrada nova
no smoke-contrast e revalidação WCAG AA.

Como o badge fica dentro do `.alert` (mesma família de cor), o
destaque vem de uma **borda interna** via `box-shadow: inset 0 0 0
1px var(--*-fg)` — pinta sutil que não introduz novo par de cor.

### Por que `v-if="step < 7"` no SetupPage em vez de internamente no componente

Razão dupla:

1. **Performance**: na Etapa 7, evita avaliar todo o `computed
   visibleItems` (que filtra dezenas de issues) só para o componente
   decidir não renderizar.
2. **Clareza arquitetural**: a decisão "este painel pertence a quais
   etapas" é um detalhe do `SetupPage`, não do componente. O componente
   é genérico: dê `issues + currentStep`, ele renderiza. Quem decide
   quando exibir é o pai.

### Por que tornei flexível o check de versão do bloco v5.22.19 no smoke

O bloco v5.22.19 tinha `if (pkg.version === '5.0.22-19')`. Quando
bumpei para `-20`, esse teste quebraria. Tornei flexível: `pkg.version
!== '5.0.22-18'`. Histórico de validação preservado, sem precisar
atualizar a cada release.

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / Resend
- `npm install` já em cache

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `frontend/src/components/PendenciasPanel.vue` | 153 |
| `IMPLEMENTATION-REPORT-V522-20.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/views/SetupPage.vue` | +1 import, +1 component, +23 linhas no template |
| `frontend/src/styles/design-system.css` | +90 linhas (`.pendencias-panel*`) |
| `frontend/scripts/cleanup-legacy.cjs` | +2 linhas (allowlist) |
| `frontend/smoke-pipeline.ts` | +120 linhas (bloco v5.22.20) +ajuste no v5.22.19 |
| `frontend/package.json` | version bump |
| `README.md` | header + nova seção v5.22.20 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.20 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Saída relevante |
|---|---|
| `unzip -q` (sandbox preservado) | v5.22.19 intacta |
| `npx vue-tsc --noEmit` (após cada bloco) | limpo |
| `npx tsx smoke-pipeline.ts` | **220 OK / 0 FAIL** |
| `npx tsx smoke-contrast.ts` | **89 OK / 0 FAIL** |
| `npx tsx smoke-v5_22_20-ad-hoc.ts` (script temporário) | 5 OK / 0 FAIL — todos os paths mapeados corretamente |
| `npm run build` | **✓ built in 8.96s** |

## Implementado com sucesso

- [x] `PendenciasPanel.vue` com header colapsável, lista, badge por severity, botão "Ir para Etapa N"
- [x] Helper `pathToStep` com 6 prefixos + fallback defensivo
- [x] Filtra só `error` + `warning` (oculta `info` + `pendenciaInterna`)
- [x] `severityClass` alterna entre `.alert.danger` e `.alert.warning`
- [x] Reescreve `localizacao` quando vem em formato obsoleto "Etapa N"
- [x] Estado expanded per-sessão (não persistido)
- [x] Botão "Ir para Etapa N" oculto na etapa atual (mostra "(nesta etapa)")
- [x] Integrado no `SetupPage` com `v-if="step < 7"`
- [x] Reusa `goTo(step)` existente (sem novo código de roteamento)
- [x] CSS: layout responsivo, badge com box-shadow inset (sem cor nova)
- [x] Allowlist em `cleanup-legacy.cjs`
- [x] Smoke pipeline +17 testes
- [x] README + CHANGELOG atualizados
- [x] Package version bump
- [x] Backend .NET skeleton: **intocado**

## Parcialmente implementado

Nada.

## Não implementado

Por design, fica para versões futuras:

- **Link compartilhável `?draft=:id`** — útil para troca de máquina.
- **`/meus-rascunhos`** — lista de rascunhos do dispositivo.
- **Envio por email do link de rascunho** — secundária do link compartilhável.
- **Correção do bug latente no `validationService`** — labels "Etapa N"
  obsoletas. Trabalho separado.
- **Foco direto no campo faltante** ao clicar "Ir para Etapa N": hoje
  leva para a etapa, mas não rola até a célula nem foca o input. Para
  isso seria necessário passar `entityTemporaryId` + scrollIntoView +
  focus. Útil mas não crítico.

## Correções importantes aplicadas

### Bloco smoke v5.22.19 estava estrito demais

Sintoma: depois de bumpar `package.json` para `5.0.22-20`, o smoke do
bloco v5.22.19 quebraria (esperava exatamente `5.0.22-19`).

Correção: troquei `pkg.version === '5.0.22-19'` por `pkg.version !==
'5.0.22-18'`. Mais flexível, preserva histórico de validação sem
precisar atualizar a cada release.

### Badge inicialmente invertia fg/bg (risco de quebrar contraste)

Sintoma: primeiro tentei `background: var(--danger-fg); color:
var(--danger-bg)` para destacar o badge dentro do alert pai. Esse
par invertido NÃO está validado pelo smoke-contrast.

Correção: usei `color: var(--danger-fg); background: var(--danger-bg)`
(par já validado, igual a `.badge.danger`) + `box-shadow: inset 0 0
0 1px var(--danger-fg)` para destacar via borda. Borda não conta
como novo par de cor.

## Regressões evitadas

- **`Step8Preview` (Etapa 7) NÃO foi tocado** — continua mostrando o
  resumo completo de validação que sempre teve. O `PendenciasPanel`
  é estritamente um complemento das Etapas 1–6.
- **`goTo(stepId)` reusado** — método já existia para a sidebar.
  Zero novo código de navegação. Comportamento idêntico ao clique
  na sidebar.
- **`validation.issues` reusado** — já era computado no `SetupPage`.
  Zero novo cálculo no path crítico.
- **Renumeração v5.22.11** considerada explicitamente: `pathToStep`
  retorna `2` para `grupos` (não 3 como diz a `localizacao` obsoleta).
  Testado no smoke por regex específica.
- **Cleanup-legacy allowlist atualizado** — sem isso, o build do
  Netlify apagaria `PendenciasPanel.vue` na fase prebuild e quebraria
  (mesmo problema que pegamos na v5.22.19).

## Validações realizadas

| Critério §16 | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 220 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 8.96s |
| `.env.example` existe, sem secrets reais | ✅ (não foi tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke garante |
| Projetista é texto livre | ✅ smoke garante |
| Rascunho salva e recarrega | ✅ smoke v5.22.19 |
| JSON técnico gera e valida contra schema | ✅ smoke v5.22.18 |
| Excel técnico exporta | ✅ smoke v5.22.18 |
| Validações aparecem | ✅ smoke v5.22.18 + agora persistente |
| Auditoria registra eventos | ✅ smoke v5.22.18 |
| Documentação atualizada | ✅ README + CHANGELOG + este relatório |
| Backend .NET skeleton intacto | ✅ não foi tocado |

## Bloqueios reais

- **Browser real**: sandbox sem chromium-headless. O painel
  visualmente, a transição expand/collapse, a navegação ao clicar
  "Ir para Etapa N" — nada disso foi visto rodando. Smoke garante
  que o código está presente e o build empacota tudo.

## Pendências que exigem ação manual

1. **Teste em browser real após deploy no Netlify**:
   - Abrir `setup.consultegeo.org` num rascunho com pendências
   - Confirmar painel aparece no topo das Etapas 1–6
   - Confirmar painel some na Etapa 7
   - Clicar "Ver detalhes" → lista expande
   - Clicar "Ir para Etapa N" → navega para etapa correta
   - Confirmar badge "Bloqueia envio" (vermelho) quando há erros
   - Confirmar badge "Atenção" (amarelo) quando só warnings
   - Confirmar comportamento em mobile (viewport < 600px)

2. **Validação visual com leitor de tela**: `aria-expanded` no botão
   toggle, `role="region"` no painel. Não foi testado com NVDA/JAWS.

3. **Eventual correção do bug das labels obsoletas no
   `validationService`**: trabalho separado, ver "Bug latente
   identificado" no diagnóstico.

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 220 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado: 89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 9s)
npm run dev                  # abre http://localhost:5173
```

Para testar o painel manualmente:
1. Carregar exemplo "Comum" (gera obra completa sem pendências).
2. Apagar o nome da obra na Etapa 1 → painel aparece com badge "Bloqueia envio".
3. Ir para Etapa 4 (peças) → painel ainda aparece, mostrando pendência da Etapa 1 + botão "Ir para Etapa 1".
4. Clicar no botão → navega de volta.
5. Ir para Etapa 7 → painel some, `Step8Preview` toma o lugar.

## Como publicar no Netlify

Sem mudanças no `netlify.toml`. Push para `main` dispara rebuild.
GitHub Action das Edge Functions não afetada.

## Como configurar Supabase

Sem mudanças no schema. Sem migration. Sem ação em banco.

## Como migrar para .NET 8 + SQL Server

Sem impacto. Mudança puramente de UI no frontend; reusa o que o
`validationService` já calcula. Quando o backend .NET retornar
issues, o painel funcionará igual (mesmo contrato `ValidationIssue`).

## Próximo ciclo recomendado

**v5.22.21** — Foco direto no campo ao clicar "Ir para Etapa N".
Cada `ValidationIssue` tem `entityTemporaryId`; passar isso na
navegação + scrollIntoView + focus no input correspondente. Resolve
"caçar a célula" de uma vez por todas.

**v5.22.22** (sugestão) — Link compartilhável `?draft=:id` + lista
`/meus-rascunhos`. Fecha os cenários de borda (troca de máquina,
múltiplas obras paralelas).

**v5.22.23** (sugestão, dívida técnica) — Corrigir labels obsoletas
`localizacao: 'Etapa N'` no `validationService.ts`. Trabalho simples
de busca-substitui agora que o `pathToStep` da v5.22.20 documenta
o mapeamento correto.
