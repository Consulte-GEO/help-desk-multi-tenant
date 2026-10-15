# Implementation Report · Implantação Consulte GEO v5.22.27

## Resumo executivo

Cleanup geral consolidando 4 frentes em uma versão:
1. Bugs herdados v5.22.23 (causa raiz identificada por auditoria)
2. Acessibilidade dos 3 modais (focus trap + ESC + foco inicial)
3. CI workflow inclui share-draft-link
4. Blueprint .NET documentado

**Pipeline: 354 OK (+22) · Contraste: 89 OK · Build: ✓ 7.27s · zero
CSS novo · zero migração SQL · backend .NET intocado.**

## Frente 1 — Bugs herdados v5.22.23 (auditoria sem logs)

### Diagnóstico

Auditando código com olhar fresco encontrei 3 restos da renumeração
v5.22.11 (8→7 etapas):

| Arquivo | Bug | Sintoma | Correção |
|---|---|---|---|
| `views/SetupPage.vue` `onNext()` | `s === 8` e `s < 8` (lógica antiga) | Avançar da Etapa 7 → `setStep(8)` → nenhum template cobre → tela branca | Limites para 7 |
| `components/WizardFooter.vue` | `v-if="currentStep < 6"` | "Avançar" some na Etapa 5; usuário fica preso | `< 7` |
| `views/SetupPage.vue` Step8Preview prop | `:total-steps="8"` | Stepper inconsistente | `"7"` |
| `store/modules/setup.ts` `setStep` | `Math.min(10, step)` | Aceita steps fora dos templates | `Math.min(9, step)` + warning |

### Honestidade técnica

Não tenho repro confirmado de produção. **Não afirmo** que isso é "o
bug" relatado. **Afirmo** que são bugs reais que produzem o sintoma
"tela branca" e estavam latentes desde v5.22.11. Se o problema
persistir após esta versão, agora preciso mesmo dos logs do DevTools.

### Defesa adicional do bug "Devolver"

O composable `useModalA11y` (frente 2) foca via `querySelector`
dentro do container, **não via `$refs`**. A v5.22.23 removeu o focus
manual via $refs por suspeitar dele. Esta versão volta a focar, mas
de forma resiliente. Pode ser defesa em profundidade indireta para
"Devolver".

## Frente 2 — Acessibilidade dos modais

### Composable novo

`src/composables/useModalA11y.ts` (~165 linhas) com API imperativa
`setupModalA11y({containerSelector, onEscape})`:

```ts
mounted() {
  this.a11y = setupModalA11y({
    containerSelector: '[data-testid="share-draft-modal"]',
    onEscape: () => this.onCancel(),
  });
  if (this.open) this.a11y.activate();
}
watch: {
  open(v) { v ? this.a11y?.activate() : this.a11y?.deactivate(); }
}
beforeUnmount() { this.a11y?.deactivate(); }
```

Cobre: focus trap (Tab/Shift+Tab), focus inicial, ESC fecha,
restaura foco anterior, cleanup de listener global no
beforeUnmount.

### Por que API imperativa em vez de Composition API

Os 3 modais existentes são Options API com `defineComponent`. Manter
imperativo evita refactor forçado e mantém estilo do código.

### Por que não diretiva

Diretivas Vue rodam no ciclo mount/unmount do elemento, mas modais
usam `v-if="open"` — ao reabrir, perdemos referência antiga.

### Aplicação

| Modal | Mudança |
|---|---|
| `ShareDraftLinkModal` | Adicionou import + state `a11y` + mount/unmount/watch |
| `SubmitTicketModal` | **Substituiu** focus manual via `$refs.closeBtn` (que falhava em alguns timings) por a11y centralizada |
| `ReturnSubmissionModal` | **Volta a focar** o textarea (removido na v5.22.23 por suspeita de bug), agora via querySelector resiliente |

## Frente 3 — Workflow CI

`.github/workflows/deploy-edge-functions.yml` agora também faz
deploy de `share-draft-link` (Edge Function da v5.22.26). Antes só
deploiava `submit-for-validation` e `notify-return`.

## Frente 4 — Blueprint .NET

`docs/BACKEND_DOTNET_BLUEPRINT.md` (~530 linhas) com snippets
prontos para portar:

- `StepMappingService.cs` espelho com tabela `WizardSteps`
  preenchida pela mesma fonte (`WIZARD_STEPS` do TS)
- `ShareDraftService.cs` espelho com vantagens server-side: audit
  dentro da transação, validação de existência do draft
- `ShareDraftLinkRequest` / `ShareDraftResult` DTOs
- Endpoint controller `POST /api/.../rascunhos/{id}/compartilhar`
- JSON Schema fragment
- Configuração appsettings + Program.cs
- Testes mínimos xUnit (PathToStep, LocalizacaoForPath,
  rejeita_invalid_email, rejeita_non_existent_draft, audit_on_success)
- Tabela de riscos conhecidos (drift TS vs C#, audit duplicado,
  token vs UUID, rate limits do Resend)

**Zero linha compilada**. Quando o time .NET assumir, copia/cola.

## Validações executadas

| Validação | Resultado | Observação |
|---|---|---|
| Baseline v5.22.26 (clonado) | 332 OK | base limpa |
| `vue-tsc --noEmit` | ✅ limpo | strict |
| Pipeline | **354 OK / 0 FAIL** | +22 testes |
| Contraste | **89 OK / 0 FAIL** | zero CSS novo |
| Build | **✓ 7.27s** | mesmas chunks |

## Arquivos criados

| Arquivo | Linhas | Função |
|---|---|---|
| `frontend/src/composables/useModalA11y.ts` | ~165 | A11y centralizada |
| `docs/BACKEND_DOTNET_BLUEPRINT.md` | ~530 | Migração .NET |
| `IMPLEMENTATION-REPORT-V522-27.md` | (este) | |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/views/SetupPage.vue` | `onNext()` lógica de 7 etapas + `Step8Preview total-steps=7` |
| `frontend/src/components/WizardFooter.vue` | `currentStep < 7` |
| `frontend/src/store/modules/setup.ts` | `setStep` clamp 1-9 + warn |
| `frontend/src/components/ShareDraftLinkModal.vue` | useModalA11y |
| `frontend/src/components/SubmitTicketModal.vue` | useModalA11y (substitui focus via $refs) |
| `frontend/src/components/ReturnSubmissionModal.vue` | useModalA11y (volta focus inicial) |
| `frontend/smoke-pipeline.ts` | bloco v5.22.27 +22 testes; flex check v26 |
| `frontend/package.json` | bump 5.0.22-26 → 5.0.22-27 |
| `.github/workflows/deploy-edge-functions.yml` | deploy share-draft-link |
| `README.md` | header + seção destacada |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.27 |

## Bloqueios reais

### Por ambiente

- **Browser headless**: sandbox sem. Não validei:
  - Focus trap real (Tab/Shift+Tab fechado no modal)
  - ESC fechando modal
  - Leitor de tela anunciando focus inicial
  - Correção de `onNext` resolvendo "tela branca"

### Por dependência externa

- **Logs DevTools**: continuam pendentes. Sem eles, não há como
  afirmar que os bugs herdados foram resolvidos. As 4 correções de
  código são bugs reais identificados na auditoria, mas
  correspondência com o bug relatado depende de validação manual.

## Pendências manuais

1. **Validar correção dos bugs herdados em produção**:
   - Criar obra, avançar etapa por etapa via botão "Avançar". Não
     deve dar tela branca em nenhum ponto.
   - Clicar "Avançar" na Etapa 5 → deve ir para Etapa 6.
   - Etapa 7 ainda deve mostrar "Enviar para validação" no topo
     (botão dedicado).

2. **Validar a11y dos modais**:
   - Abrir cada um dos 3 modais
   - Pressionar Tab — foco deve circular dentro do modal
   - Pressionar ESC — modal fecha
   - Fechar manualmente — foco volta para o botão que abriu

3. **Validar deploy automático**:
   - Push qualquer mudança em `supabase/functions/share-draft-link/`
   - GitHub Action deve disparar e deployar
   - Verificar no Supabase Dashboard que a função foi atualizada

## Próximo ciclo

**v5.22.28**: Painel de gestão (entregue na mesma rodada desta).

Endereça o pedido novo: tela de login, 2 usuários (thiago@ +
atendimento@), listagem de chamados, melhorias de gestão.
