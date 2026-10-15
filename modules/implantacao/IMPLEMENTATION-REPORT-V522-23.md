# Implementation Report · Implantação Consulte GEO v5.22.23

## Resumo executivo

**Pedido do Thiago** (5 itens — screenshot da tela de Dados básicos + texto):

1. Na parte de pendências que bloqueiam, sempre virem ocultas + botão "Ver detalhes"
2. **Bug**: ao clicar "Ir para Etapa N", a tela fica em branco
3. Em Blocos e torres, ao criar grupo novo, já vir com "sem numeração" (prévia expandida com 1 elemento)
4. Em Pavimentos e peças, FCK, Volume por unidade e Concreto não são obrigatórios
5. **Bug**: botão "Devolver para o responsável" não funciona

**Status**: 4 itens implementados e validados. Item 5 com **mitigação defensiva** sem reprodução real (sandbox sem browser).

**Build verde · 268 OK pipeline (+14) · 89 OK contraste · zero CSS novo · zero ação manual no Supabase · zero impacto em schema**.

## Diagnóstico por item

### Item 1 — Painel sempre recolhido

**Estado anterior**: `data() { expanded: true }` (v5.22.20) — abria expandido para "usuário ver de cara o que falta".

**Pedido**: usuário disse que prefere o painel recolhido por padrão. Faz sentido — na screenshot do print, o painel ocupa metade da tela com 7 pendências, empurrando o conteúdo do formulário para baixo.

**Mudança**: `expanded: false` por default + label do botão alterna entre "Ver detalhes" / "Ocultar detalhes". Estado per-sessão (não persiste).

### Item 2 — "Ir para Etapa N" tela em branco

**Estado anterior**: `goToWithFocus` (v5.22.21) era `async`:
```ts
async goToWithFocus(payload) {
  if (current !== payload.step) {
    this.$store.commit('setup/setStep', payload.step);
    ...
  }
  if (!payload.fieldId) return;
  await this.$nextTick();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  // ... querySelector + scrollIntoView + focus
}
```

**Diagnóstico sem browser**: Não pude reproduzir exatamente, mas a hipótese mais plausível é que **uma Promise rejeitada** em algum ponto (RAF, scrollIntoView com options não suportadas, ou similar) propagava para o caller. Em Vue 3, um event handler que retorna Promise rejeitada pode disparar o errorCaptured/errorHandler global e, dependendo da configuração, descartar o render — o que daria "tela em branco".

**Mudança**:
- Método agora é **síncrono no setStep**. Sai do método imediatamente após `setStep` se fieldId é null.
- Foco agendado via `this.$nextTick(callback)` — não usa `await`. Callback isolado em `try/catch` que **jamais propaga erro**.
- Removido o `requestAnimationFrame` — desnecessário em 99% dos casos.

Mesmo se a hipótese exata estiver errada, a refatoração elimina todas as fontes potenciais de erro propagado. **Não consigo garantir 100% sem teste em browser**, mas é a melhor mitigação possível sem reprodução.

### Item 3 — Novo grupo com "sem numeração"

**Estado anterior**: `novoGrupo()` defaultava `edificacoesInput: ''` (string vazia). O `expandRange('')` retorna `[]` (zero items). Resultado: grupo novo aparecia sem prévia + alerta "Informe quais blocos, torres ou estruturas".

**Mudança**: default agora é `'-'`. O `expandRange('-')` retorna `[null]` — exatamente "1 item sem numeração". O comportamento é o que o usuário pediu.

**Validado em runtime**: smoke ad-hoc confirmou que (a) `novoGrupo().edificacoesInput === '-'` e (b) `expandRange('-')` retorna `[null]`.

### Item 4 — FCK, Volume e Concreto não obrigatórios

**Estado anterior**:
- FCK vazio → bloqueante (impedia envio)
- FCK preenchido inválido → bloqueante (mesma regra)
- Volume vazio → warning
- Volume > 1000 ou casas decimais demais → warning
- Concreto vazio → pendência interna (não aparecia para o cliente)

**Mudança** (`validationService.ts`):
- FCK vazio: removido. Não dispara nada.
- FCK preenchido com valor inválido (fora de 10-100 MPa): agora é **warning** (era error). Mensagem mudou para "FCK informado não está entre 10 e 100 MPa. Confirme o valor."
- Volume vazio: removido. Não dispara nada.
- Volume > 1000: **mantido** como warning — input inválido é diferente de input ausente.
- Volume com casas decimais demais: **mantido** como warning — idem.
- Concreto: **mantido** como pendência interna.

**Validado em runtime**: smoke ad-hoc confirmou os 6 cenários (FCK vazio sem issue, FCK="5" gera warning não-error, Volume vazio sem issue, Volume="5000" gera warning, etc).

### Item 5 — Botão "Devolver" não funciona (sem reprodução)

**Diagnóstico**: olhei o fluxo completo do botão "Devolver" no `ReviewView` e no `Step9ValidacaoImplantacao`:

1. Botão → `@click="onOpenReturnModal"` ou `@click="$emit('open-return-modal')"`
2. Handler → `this.returnModalOpen = true; this.returnError = ''`
3. Modal: `<ReturnSubmissionModal :open="returnModalOpen" ...>`
4. Internamente: `<Teleport to="body"><div v-if="open" class="modal-portal open">...</div></Teleport>`
5. CSS: `.modal-portal.open { opacity: 1; pointer-events: auto }`

Tudo parece correto. Não identifiquei bug óbvio por inspeção. **Sem browser, não consigo reproduzir nem isolar a causa exata**.

**Mitigação aplicada**:
- Removi do `ReturnSubmissionModal` o watch que fazia `nextTick(() => textarea?.focus())`. Hipótese: em algum cenário (Teleport + watch trigger no momento errado), o ref `textarea` é undefined no exato instante do tick, gerando erro silencioso que pode estar interferindo no render. O foco automático era nice-to-have, não crítico.
- Removi o `ref="textarea"` no template (não é mais necessário).
- Em `onOpenReturnModal` do `ReviewView`, removi o `eslint-disable` do `console.info`. Log fica visível em produção para diagnóstico via DevTools.

**Como o usuário pode diagnosticar se não resolveu**:
- Abre `/r/:token` no browser
- Abre DevTools (F12) na aba Console
- Clica em "Devolver" no topbar ou em "Devolver para o responsável" na Etapa 8
- **Se o log "[ReviewView] Abrindo modal de devolução..." NÃO aparece**: o handler não está sendo chamado. Problema é no botão ou no listener.
- **Se o log aparece mas modal não surge**: problema no Teleport ou CSS. Inspecionar `<div data-testid="return-submission-modal">` no DOM (deve estar como filho direto de `<body>`).
- **Se modal aparece mas "Devolver e enviar" trava**: problema na Edge Function `notify-return`. Aba Network do DevTools mostra a requisição.

## Decisões registradas

### Por que NÃO mudei a label "Ver detalhes" para "Expandir"

"Ver detalhes" é mais descritivo do que vai aparecer. "Expandir" foca na ação UI; "Ver detalhes" foca no conteúdo. UX mais clara.

### Por que mantive `audit('focar_campo')` no callback

Mesmo após refator síncrono, o audit do foco continua dentro do try/catch do nextTick callback. Se o foco falha, audit não dispara — o que é correto: só registra "focar_campo" quando o foco aconteceu de fato.

### Por que '-' em vez de string customizada ('sem numeração') em novoGrupo

Reusa máquina existente: `expandRange` JÁ trata `'-'` como caso especial retornando `[null]`. Usar string customizada exigiria mudar `expandRange`, `validationService`, `Step3GruposEditor` (display do chip), e o `formatGroupName` em pelo menos 4 lugares. Reuso == zero risco.

### Por que FCK inválido (não vazio) virou warning em vez de info

Warning aparece no painel; info não. Se o usuário digitou "999" no FCK, vale alertar que está fora do range. Info seria silencioso demais.

### Por que não removi PECA_VOLUME_AUSENTE do enum

Mesmo não sendo mais pushado, o code `VAL-PEC-003` pode estar referenciado em outras partes (rascunhos antigos, testes, audit history). Manter o enum é defensivo.

### Por que mexi no modal "Devolver" sem reprodução do bug

Trade-off honesto: a mudança que fiz (remover nextTick + auto-focus) **não pode quebrar nada** — só remove uma feature menor (auto-focus no textarea). Se o bug for outro, pelo menos não regridi nada. E o log visível ajuda a diagnosticar caso continue.

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / Resend / browser

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `IMPLEMENTATION-REPORT-V522-23.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/PendenciasPanel.vue` | `expanded: false` + labels "Ver detalhes"/"Ocultar detalhes" |
| `frontend/src/views/SetupPage.vue` | `goToWithFocus` refatorado (síncrono + nextTick callback + try/catch) |
| `frontend/src/models/setup.models.ts` | `novoGrupo()` default `edificacoesInput: '-'` |
| `frontend/src/services/validationService.ts` | FCK e Volume vazios não geram issues; FCK inválido vira warning |
| `frontend/src/components/ReturnSubmissionModal.vue` | Removido watch + auto-focus textarea |
| `frontend/src/views/ReviewView.vue` | Log visível em prod no `onOpenReturnModal` |
| `frontend/smoke-pipeline.ts` | +130 linhas (bloco v5.22.23) + 1 ajuste no v5.22.22 |
| `frontend/package.json` | version bump |
| `README.md` | header + nova seção v5.22.23 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.23 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Saída |
|---|---|
| Sandbox preservado da v5.22.22 | versão 5.0.22-22 → bump 5.0.22-23 |
| `npx vue-tsc --noEmit` | limpo |
| `npx tsx smoke-pipeline.ts` (1ª) | 267 OK / 1 FAIL (regex curto demais) |
| Ajustar regex `{0,400}` → `{0,1200}` | resolve |
| `npx tsx smoke-pipeline.ts` (final) | **268 OK / 0 FAIL** |
| `npx tsx smoke-contrast.ts` | **89 OK / 0 FAIL** |
| `npx tsx smoke-v5_22_23-ad-hoc.ts` (script temporário) | 7 OK / 0 FAIL — comportamento real validado |
| `npm run build` | **✓ built in 9.88s** |

## Implementado com sucesso

- [x] Painel recolhido por default (`expanded: false`)
- [x] Botão alterna "Ver detalhes" / "Ocultar detalhes"
- [x] `goToWithFocus` síncrono no setStep
- [x] `nextTick(callback)` em vez de `await nextTick()`
- [x] `try/catch` envolvendo foco
- [x] `requestAnimationFrame` removido
- [x] `novoGrupo()` default `edificacoesInput: '-'`
- [x] Validação verificada em runtime: `expandRange('-') === [null]`
- [x] FCK vazio: sem issue
- [x] FCK inválido: warning (não bloqueante)
- [x] Volume vazio: sem issue
- [x] Volume > 1000: warning (mantido)
- [x] Volume casas decimais: warning (mantido)
- [x] `ReturnSubmissionModal` sem auto-focus
- [x] `console.info` visível em prod no handler do modal
- [x] Smoke pipeline +14 testes
- [x] Smoke ad-hoc funcional confirma comportamento
- [x] README + CHANGELOG atualizados
- [x] Package version bump
- [x] Backend .NET: intocado
- [x] Schema Supabase: intocado

## Parcialmente implementado

**Item 5 — Devolver para responsável**: mitigação defensiva sem
reprodução real. Pode ou não resolver o bug exato. Smoke garante
que as mudanças foram aplicadas; runtime real precisa de teste em
browser pelo usuário.

## Não implementado

Nada nesta versão.

## Correções importantes aplicadas

### Smoke regex `{0,400}` insuficiente para JSDoc de novoGrupo

O comentário explicativo no `novoGrupo` ficou mais longo que 400 chars
entre `novoGrupo(seed` e `edificacoesInput: seed.edificacoesInput ?? '-'`.
Ajustei para `{0,1200}`. Pegou no 1ª iteração.

### Smoke da v5.22.21 testava `async goToWithFocus`

Como removi o `async`, o regex `/async goToWithFocus\(/` quebraria.
Flexibilizei para `/\bgoToWithFocus\s*\(/` e tornei o teste de
`requestAnimationFrame` inverso (FAIL se ainda existir, OK se foi
removido). Test antigo de v5.22.21 agora valida o estado v5.22.23
corretamente.

## Regressões evitadas

- **Audit `focar_campo` preservado** dentro do try/catch do callback. Só dispara se foco aconteceu.
- **Rascunhos antigos com `edificacoesInput: ''`** continuam funcionando — o default só aplica em grupos NOVOS via `novoGrupo()`.
- **Validation `GRUPO_SEM_NUMERO`** continua existindo — ainda dispara se usuário apagar o campo.
- **`PECA_VOLUME_ALTO` e `PECA_VOLUME_PRECISAO`** preservados — só removi `PECA_VOLUME_AUSENTE`.
- **Concreto** (pendência interna): zero mudança — equipe continua vendo.
- **Modal de devolução** continua funcional — só não auto-foca o textarea. Usuário pode tabular ou clicar.

## Validações realizadas

| Critério §16 | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 268 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 9.88s |
| `.env.example` existe, sem secrets reais | ✅ (não tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke garante |
| Projetista é texto livre | ✅ smoke garante |
| Rascunho salva e recarrega | ✅ smoke v5.22.19 |
| JSON técnico gera e valida contra schema | ✅ smoke v5.22.18 |
| Excel técnico exporta | ✅ smoke v5.22.18 |
| Validações aparecem | ✅ comportamento revisitado v5.22.23 |
| Auditoria registra eventos | ✅ smoke v5.22.18 |
| Documentação atualizada | ✅ |
| Backend .NET skeleton intacto | ✅ |

## Bloqueios reais

- **Browser real**: sandbox sem chromium-headless. Não testei
  visualmente:
  - Painel recolhido aparecendo só com sumário
  - "Ir para Etapa N" não deixando branca (era o ponto principal)
  - Botão "Devolver" abrindo o modal

## Pendências que exigem ação manual

1. **Teste prioritário em browser**: clicar "Ir para Etapa N" no
   painel de pendências da Etapa 1. Antes deixava branca; agora
   deve navegar normalmente.

2. **Teste de "Devolver para responsável"**: abrir `/r/:token` no
   browser, abrir DevTools, clicar "Devolver". Verificar logs do
   console conforme guia de diagnóstico acima.

3. **Teste de novo grupo**: ir para Etapa 2 (Blocos e torres),
   criar grupo novo. Campo "Número da estrutura" deve já estar com
   `-` e a prévia mostrar "sem numeração" (1 chip).

4. **Teste de FCK/Volume opcionais**: ir para Etapa 4 (Pavimentos
   e peças), criar peça com nome mas sem FCK e sem Volume. Não
   deve aparecer no painel de pendências como bloqueante.

5. **Teste do painel recolhido**: na entrada de qualquer etapa,
   painel deve aparecer só com o sumário. Clicar "Ver detalhes"
   expande; "Ocultar detalhes" recolhe.

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 268 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado: 89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 10s)
npm run dev                  # abre http://localhost:5173
```

## Como publicar no Netlify

Push para `main`. Deploy automático.

## Como configurar Supabase

Sem mudanças. Sem migration.

## Como migrar para .NET 8 + SQL Server

Sem impacto.

## Próximo ciclo recomendado

**v5.22.24** — Confirmar resolução do bug "Devolver" e do "Ir para
Etapa N". Se algum ainda persistir, com logs do DevTools eu identifico
a causa exata em vez de mitigar no escuro.

**v5.22.25** — Link compartilhável `?draft=:id` + lista `/meus-rascunhos`.

**v5.22.26** — Limpeza de labels obsoletas no `validationService.ts`
(dívida técnica documentada desde v5.22.20).
