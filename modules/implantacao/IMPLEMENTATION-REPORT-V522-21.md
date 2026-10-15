# Implementation Report · Implantação Consulte GEO v5.22.21

## Resumo executivo

**Sugestão minha aceita pelo Thiago** (continuação da v5.22.20):

> *"v5.22.21 — Foco direto no campo ao clicar Ir para Etapa N. Hoje
> leva pra etapa; faltando o scrollIntoView + focus() no input via
> entityTemporaryId. Resolve 'caçar a célula' de vez."*

**Resposta entregue**: convenção `data-field-id` nos inputs dos Steps
+ novo método `goToWithFocus()` no `SetupPage` que navega e foca o
input correspondente. Cobre os 4 codes de validação mais frequentes
(VAL-OBRA-001, VAL-PEC-001/002/003) + um (VAL-GRP-001) com cobertura
em ambos os modos (comum e projetista). Pendências em lista vazia
seguem usando navegação simples (sem foco específico — não há campo).

**Status**: implementado, validado.
**Build verde · 239 OK pipeline (+19) · 89 OK contraste · zero cor nova ·
zero ação manual no Supabase**.

## Diagnóstico

### O que existia (antes desta versão)

1. **`PendenciasPanel` (v5.22.20)** já listava pendências e emitia
   `go-to` com `step: number`. `SetupPage` recebia, navegava via
   `goTo(stepId)`. Funcional mas sem foco fino.
2. **`ValidationIssue`** já carregava `entityTemporaryId` e `campo`
   exatamente onde aplicável (validation service já fazia esse
   trabalho). Não precisei tocar no service.
3. **Steps** usavam `peca.id` / `grupo.id` como `:key` nos `v-for`
   mas não expunham esses ids no DOM via atributos.

### O que faltava

- **Foco direto no input** após navegar. Em tabelas grandes (peças
  é o caso típico — pode ter 30+ linhas por grupo), achar o input
  errado dá trabalho.
- **Botão de localização** quando a pendência está na etapa atual
  mas o input está fora da viewport.

### O que foi alterado

1. `PendenciasPanel.vue` — novo helper `computeFieldId(issue)`,
   `DisplayItem.fieldId`, emit do go-to agora carrega
   `{step, fieldId}`, novo botão "Focar campo" para pendências na
   etapa atual com fieldId.
2. `SetupPage.vue` — novo método `goToWithFocus(payload)`. Recebe
   `{step, fieldId}`, navega (se etapa diferente), aguarda
   `$nextTick` + `requestAnimationFrame`, faz `querySelector` +
   `scrollIntoView` + `focus`. Falha silenciosa.
3. `Step1DadosBasicos.vue` — `data-field-id="meta-obraNome"` no
   input do nome da obra (cobre VAL-OBRA-001).
4. `Step3GruposEditor.vue` — `data-field-id="${grupo.id}-numeroEstrutura"`
   nos dois inputs de `edificacoesInput` (tabela do modo comum +
   form do modo projetista — cobre VAL-GRP-001).
5. `Step5PecasEditor.vue` — `data-field-id` em peca.local, .fck,
   .volume (cobre VAL-PEC-001, VAL-PEC-002, VAL-PEC-003, e os volume
   warnings VAL-PEC-004/PRECISAO).
6. `smoke-pipeline.ts` — 19 testes novos (bloco v5.22.21). Também
   flexibilizei o check antigo de `@go-to="goTo"` para aceitar
   `goTo` ou `goToWithFocus`, e o check de versão da v5.22.20 que
   estava estrito demais.
7. `package.json` — bump 5.0.22-20 → 5.0.22-21.
8. `README.md` — header e nova seção de mudanças.
9. `docs/CHANGELOG_SOLICITACOES.md` — entrada v5.22.21.

### O que foi validado

- **Pipeline**: 239 OK / 0 FAIL (eram 220; +19 testes novos)
- **Contraste**: 89 OK / 0 FAIL (zero cor nova)
- **Build**: verde em 9.77s
- **Typecheck strict**: limpo
- **Smoke ad-hoc funcional**: gerei issues controlados zerando campos
  num snapshot, e `computeFieldId` produziu os 4 fieldIds corretos
  (VAL-OBRA-001 → `meta-obraNome`; VAL-PEC-001/002/003 → `peca_*-{local,fck,volume}`).

### O que NÃO pôde ser validado

- **scrollIntoView visual + focus real em browser**: sandbox sem
  headless browser. Mas o caminho do código é simples
  (`document.querySelector` é uma API estável; `scrollIntoView`/`focus`
  são ubíquos). Smoke garante que o caminho existe.
- **`requestAnimationFrame` em SSR**: o código tem `typeof document
  === 'undefined'` guard antes do `querySelector`, então é seguro.
- **Inputs em componentes filhos não cobertos** (`Step6UsuariosObra`,
  `Step7Fornecedores`): pendências desses Steps são warnings sem
  `entityTemporaryId`, então caem no fallback null = só navega.
  Posso expandir cobertura numa próxima versão se houver demanda.

## Decisões registradas

### Por que `data-field-id` em vez de `id`

`id` HTML precisa ser único no documento. Reutilizar nomes (ex.:
`fck`) em múltiplas linhas de tabela quebra isso. `data-field-id` é
livre — pode aparecer 100 vezes na mesma página (uma por linha).

Os IDs gerados já são únicos porque `peca.id` é gerado via
`cryptoUid()` (sufixo aleatório base32-ish). Mas usar `data-*` é a
prática correta para "selectores de teste/scripting" — não conflita
com nada do navegador.

### Por que a convenção `${entityId}-${campo}` é stringificada

Alternativa considerada: emitir `{step, entityId, campo}` separados
e construir o seletor no `SetupPage`. Decidi consolidar em uma
string única (`fieldId`) por 3 razões:

1. **Encapsulamento**: o componente filho (`PendenciasPanel`) já
   sabe a convenção; expô-la em duas partes seria forçar o pai
   a duplicar lógica.
2. **Extensibilidade**: se amanhã eu quiser focar elementos sem
   `entityId` (ex.: linha inteira), basta o componente retornar
   uma string diferente.
3. **Debugging**: log/auditoria de "focado em peca_abc-fck" é mais
   legível que `{entityId: 'peca_abc', campo: 'fck'}`.

### Por que `$nextTick + requestAnimationFrame` (cinto + suspensório)

`$nextTick` é suficiente em 99% dos casos (Vue terminou o re-render).
Mas alguns Steps fazem cálculos no `mounted()` (ex.: Step5 calcula
`pecasList` para o `<datalist>`, Step4 carrega exemplos sugeridos).
Esses cálculos podem repintar inputs **um frame depois**. `rAF` extra
custa ~16ms imperceptíveis e elimina race conditions.

### Por que `scrollIntoView({block: 'center'})`

Centralizar é mais útil que `start` (que coloca o input colado no
topo da viewport, encostando no header sticky) ou `end`. O `try/catch`
cobre browsers antigos que não aceitam options.

### Por que `focus({preventScroll: true})`

Já fizemos o `scrollIntoView` com `behavior: 'smooth'` (animação).
Se o `focus` rolasse de novo (default), cancelaria a animação suave.
`preventScroll` evita esse conflito.

### Por que fallback gracioso quando não acha o seletor

Defesa em profundidade. Se amanhã alguém renomear `peca.id` ou
adicionar uma nova validation rule que aponta para campo sem
`data-field-id`, o pior cenário é "voltou ao comportamento da v5.22.20"
(navega sem focar). Nunca quebra.

### Por que NÃO cobri Step6/Step7

Pendências desses Steps (USUARIO_NOME_VAZIO, FORNECEDORES_VAZIO etc.)
são warnings sobre listas/itens **sem `entityTemporaryId`**. O
`validation service` os emite com `localizacao: 'Etapa 6'` mas sem
identificação por entidade. Adicionar `data-field-id` neles exigiria
expor índices (`data-field-id="usuario-${i}-nome"`), o que é frágil
(reordenar lista invalida).

Decisão: ficar com o cenário 80/20 desta versão e abrir um item de
backlog para "validation service usa IDs persistentes para usuários
e fornecedores também". Quando isso for feito, basta adicionar
`data-field-id` nos Steps correspondentes — o `computeFieldId` já
suporta a convenção sem mudança.

### Por que novo botão "Focar campo" em vez de manter "(nesta etapa)"

Pergunta válida: se o usuário já está na etapa, ele "deveria saber"
onde está o input. Mas:

1. Em **tabelas grandes** (peças, especialmente após `bulk-add`), o
   input pode estar a 30+ rows da viewport.
2. **Volume ausente** em peça específica é uma pendência tipicamente
   distante do que o usuário está olhando.
3. O botão é discreto (`btn xs nav-back` — cinza) e só aparece
   quando há `fieldId`. Não polui.

Custo é ínfimo, valor é claro.

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / Resend

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `IMPLEMENTATION-REPORT-V522-21.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/PendenciasPanel.vue` | +43 linhas (computeFieldId + DisplayItem.fieldId + emit payload + botão Focar campo) |
| `frontend/src/views/SetupPage.vue` | +45 linhas (goToWithFocus method) + 1 char (listener) |
| `frontend/src/components/Step1DadosBasicos.vue` | +1 linha (data-field-id) |
| `frontend/src/components/Step3GruposEditor.vue` | +2 linhas (data-field-id em ambos os modos) |
| `frontend/src/components/Step5PecasEditor.vue` | +3 linhas (data-field-id em local/fck/volume) |
| `frontend/smoke-pipeline.ts` | +130 linhas (bloco v5.22.21) + 2 ajustes de flexibilidade |
| `frontend/package.json` | version bump |
| `README.md` | header + nova seção v5.22.21 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.21 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Saída relevante |
|---|---|
| Sandbox preservado da v5.22.20 | versão 5.0.22-20 intacta |
| `npx vue-tsc --noEmit` (após cada bloco) | limpo |
| `npx tsx smoke-pipeline.ts` (1ª tentativa) | 238 OK / 1 FAIL (check antigo) |
| `npx tsx smoke-pipeline.ts` (após ajuste) | **239 OK / 0 FAIL** |
| `npx tsx smoke-contrast.ts` | **89 OK / 0 FAIL** |
| `npx tsx smoke-v5_22_21-ad-hoc.ts` (script temporário) | 4 OK / 0 FAIL — fieldIds corretos |
| `npm run build` | **✓ built in 9.77s** |

## Implementado com sucesso

- [x] `computeFieldId(issue)` no PendenciasPanel
- [x] `DisplayItem.fieldId` propagado pelo computed
- [x] Emit `go-to` carrega `{step, fieldId}`
- [x] Novo método `goToWithFocus(payload)` no SetupPage
- [x] `$nextTick + requestAnimationFrame` antes de querySelector
- [x] `scrollIntoView({block: 'center', behavior: 'smooth'})` com fallback
- [x] `focus({preventScroll: true})` com fallback
- [x] Audit local `focar_campo` registrado
- [x] Falha silenciosa se seletor não existir
- [x] `data-field-id` no Step1 (meta-obraNome)
- [x] `data-field-id` no Step3 (ambos modos)
- [x] `data-field-id` no Step5 (local, fck, volume)
- [x] Novo botão "Focar campo" para itens na etapa atual com fieldId
- [x] Smoke pipeline +19 testes
- [x] Ajustes de flexibilidade nos checks antigos
- [x] README + CHANGELOG atualizados
- [x] Package version bump
- [x] Backend .NET skeleton: **intocado**

## Parcialmente implementado

- **Cobertura Step6/Step7**: warnings desses Steps caem em null
  (sem fieldId). Funciona como antes (só navega), mas sem foco.
  Documentado no relatório.

## Não implementado

- **Highlight visual do campo focado** (animação tipo "pulse" no
  border) — seria nice-to-have. O foco nativo do browser já dá
  algum feedback (outline azul), mas em design system custom às vezes
  o outline é estilizado fraco.
- **Validation service expor IDs persistentes** para usuários e
  fornecedores — destravaria cobertura Step6/Step7. Item de backlog.
- **Lista compartilhável `?draft=:id`** (v5.22.22 prevista).
- **Limpeza de labels obsoletas no validationService** (dívida
  técnica v5.22.23).

## Correções importantes aplicadas

### Smoke da v5.22.20 estava estrito demais

Sintoma: depois de mudar `@go-to="goTo"` para `@go-to="goToWithFocus"`,
o teste antigo quebrou.

Correção: regex agora aceita `goTo` OU `goToWithFocus` —
`/<PendenciasPanel[\s\S]{0,400}@go-to="goTo(WithFocus)?"/`.

### Check de versão da v5.22.20 estava estrito (5.0.22-20)

Mesmo padrão que fiz na v5.22.20 com o check da v5.22.19. Agora:
`pkg.version !== '5.0.22-19' && pkg.version !== '5.0.22-18'` —
flexível para crescimento futuro.

## Regressões evitadas

- **`goTo(stepId)` antigo PRESERVADO** — continua sendo usado pelo
  `@navigate` da sidebar. O novo `goToWithFocus` é independente.
- **Comportamento padrão sem fieldId** — `goToWithFocus({step, fieldId:
  null})` faz exatamente o que `goTo(step)` fazia. Compatibilidade
  total.
- **Step8Preview NÃO foi tocado** — segue exatamente igual. O
  PendenciasPanel some na Etapa 7 (mantido da v5.22.20).
- **Inputs sem `data-field-id`** ainda funcionam — atributo opcional,
  não quebra parsing nem layout.
- **`audit.acao` documenta o novo evento** `focar_campo` — facilita
  rastrear adoção.

## Validações realizadas

| Critério §16 | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 239 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 9.77s |
| `.env.example` existe, sem secrets reais | ✅ (não tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke garante |
| Projetista é texto livre | ✅ smoke garante |
| Rascunho salva e recarrega | ✅ smoke v5.22.19 |
| JSON técnico gera e valida contra schema | ✅ smoke v5.22.18 |
| Excel técnico exporta | ✅ smoke v5.22.18 |
| Validações aparecem | ✅ smoke v5.22.18 + persistente v5.22.20 + foco v5.22.21 |
| Auditoria registra eventos | ✅ smoke v5.22.18 + novo evento focar_campo |
| Documentação atualizada | ✅ README + CHANGELOG + este relatório |
| Backend .NET skeleton intacto | ✅ não foi tocado |

## Bloqueios reais

- **Browser real**: sandbox sem chromium-headless. scrollIntoView com
  smooth scrolling e focus visual nativo não foram vistos rodando.
  O smoke garante presença do código; o smoke ad-hoc funcional garantiu
  que os IDs casam com os atributos.

## Pendências que exigem ação manual

1. **Teste em browser real após deploy no Netlify**:
   - Carregar exemplo "Comum" (gera obra com pendências mínimas)
   - Apagar nome da obra na Etapa 1
   - Apagar FCK de uma peça específica na Etapa 4
   - Voltar para Etapa 1 → painel aparece com 2 pendências
   - Clicar "Ir para Etapa 4" da pendência de FCK
   - Confirmar: navegou para Etapa 4, scroll automático até o input,
     foco com outline visível, cursor pronto para digitar
   - Voltar para Etapa 1, ainda com pendência VAL-OBRA-001
   - Clicar "Focar campo" (na etapa atual) → scroll + foco no input
     `obraNome` (que provavelmente está no topo da página, então
     pode não rolar muito, mas o foco deve estar visível)

2. **Teste de animação**: `behavior: 'smooth'` é honrado em browsers
   modernos; em mobile pode ser ignorado. Testar em iOS Safari
   particularmente.

3. **Teste com tabelas longas**: rascunho com 30+ peças por grupo,
   pendência na peça 25 → rolagem suave até centralizar input.

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 239 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado: 89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 10s)
npm run dev                  # abre http://localhost:5173
```

Para testar manualmente:
1. Carregar exemplo "Comum".
2. Apagar FCK de peça num grupo qualquer.
3. Navegar para Etapa 1.
4. Painel mostra pendência da peça.
5. Clicar "Ir para Etapa 4" no item → deve rolar até o input do FCK
   da peça correta e dar foco.

## Como publicar no Netlify

Sem mudanças no `netlify.toml`. Push para `main` dispara rebuild.

## Como configurar Supabase

Sem mudanças no schema. Sem migration. Sem ação em banco.

## Como migrar para .NET 8 + SQL Server

Sem impacto. Mudança puramente de UI no frontend. Quando o backend
.NET retornar issues, eles terão o mesmo contrato `ValidationIssue`
e tudo funciona igual.

## Próximo ciclo recomendado

**v5.22.22** — Link compartilhável `?draft=:id` + lista
`/meus-rascunhos`. Fecha os cenários de borda da estratégia "voltar
depois sem fricção" (troca de máquina, múltiplas obras paralelas).
Pequeno-médio.

**v5.22.23** — Cobertura Step6/Step7 no PendenciasPanel. Requer
validation service expor IDs persistentes para usuários e fornecedores
(hoje o `path` traz índice numérico). Médio.

**v5.22.24** — Highlight visual do input focado (pulse animation 1.5s).
Pequeno; mais polimento que features.

**v5.22.25** — Correção de labels obsoletas no validationService.
Pequeno; dívida técnica.
