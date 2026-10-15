# Implementation Report · Implantação Consulte GEO v5.22.19

## Resumo executivo

**Pedido do Thiago** (1 item, via texto):

> *"Em alguns casos o usuário não terá alguma informação pois esqueceu de
> coletar antes de começar o preenchimento e terá que voltar depois para
> completar. Avalie como contornar isso. Eu pensei em (A) salvar e
> enviar link por email para depois continuar, ou (B) salvar no browser/
> cookies e mostrar mensagem dizendo que ao reabrir o usuário continua
> do ponto onde parou. Faça uma análise e proponha a melhor solução."*

**Resposta entregue**: defesa em profundidade em três camadas
(autosave + banner de retomada + beforeunload). Email descartado como
operação primária por fricção alta; cookies descartados por limite de
4KB (snapshot ultrapassa).

**Status**: implementado, validado.
**Build verde · 203 OK pipeline (+23) · 89 OK contraste · zero cor nova ·
zero ação manual no Supabase**.

## Diagnóstico

### O que existia hoje no pacote (antes de mexer)

1. **Persistência funcional** em `setupDraftService.ts`: `saveDraft`,
   `loadDraft`, `listDrafts`, `deleteDraft`. Supabase como primário,
   `localStorage` como fallback automático silencioso. `migrateLegacySnapshot`
   cobrindo 3 transições históricas.
2. **Vuex state** com `isDirty`, `lastSavedAt`, `draftId` já presentes.
   `isDirty=true` em 40+ mutations.
3. **Action `persistDebounced` declarada como no-op** — tinha 9 call sites
   no `SetupPage.vue` esperando algo do outro lado.
4. **Botão "Salvar rascunho"** funcionando manualmente; sem autosave, sem
   retomada automática.
5. **Sem `beforeunload`** — fechar a aba descartava qualquer edição não-salva.
6. **`saveStateText`** com feedback fugaz ("Rascunho salvo") sem permanência.

### O que estava quebrado/incompleto

- Toda a infraestrutura de salvamento estava feita; faltava só a **UX**
  para retomar quando o usuário fecha a aba e volta depois.
- `persistDebounced` no-op = 9 call sites desperdiçados.

### O que foi alterado

1. `setupDraftService.ts` — adicionado `LastDraftPointer` (interface),
   `LS_LAST_DRAFT_KEY` (constante), `getLastDraftPointer` /
   `setLastDraftPointer` / `clearLastDraftPointer` (funções),
   `saveDraftSilent` (variante noexcept).
2. `store/modules/setup.ts` — `AUTOSAVE_DEBOUNCE_MS = 3000`, módulo-level
   `autosaveTimer`, `persistDebounced` reescrita do no-op para autosave
   real, `saveDraft` e `loadDraft` agora gravam pointer, `reset` limpa
   pointer + cancela timer.
3. `components/ResumeDraftBanner.vue` — **novo**.
4. `views/SetupPage.vue` — imports + registro do componente, `data()` ganhou
   `resumeBanner` e `beforeUnloadHandler`, `mounted()` lê pointer e
   monta `beforeunload`, novo `beforeUnmount()`, handlers
   `onResumeDraft` e `onDismissResume`, template renderiza banner.
5. `styles/design-system.css` — bloco `.resume-draft-banner*` (só layout).
6. `scripts/cleanup-legacy.cjs` — `ResumeDraftBanner.vue` adicionado à
   allowlist.
7. `smoke-pipeline.ts` — 23 testes novos.
8. `package.json` — bump 5.0.22-18 → 5.0.22-19.
9. `README.md` — header e seção de mudanças.
10. `docs/CHANGELOG_SOLICITACOES.md` — entrada v5.22.19.

### O que foi validado

- Pipeline: **203 OK / 0 FAIL** (eram 180; +23 testes novos)
- Contraste: **89 OK / 0 FAIL** (sem cor nova — banner reusa `.alert.info`)
- Build: **verde em 7.70s**
- Typecheck strict: limpo (`npx vue-tsc --noEmit`)
- Diff contra o ZIP original confirma exatamente os 10 arquivos
  alterados, nada órfão.

### O que NÃO pôde ser validado

- **Comportamento em browser real** (banner aparecendo no `mounted`,
  beforeunload bloqueando fechamento): sandbox sem navegador. Smoke
  testa que o código **está lá**, não que **se comporta corretamente**.
- **Latência real do Supabase** para o autosave 3s: sandbox sem
  credenciais Supabase. O fallback LS roda sempre, então mesmo
  com Supabase fora o snapshot está preservado.
- **Migration de rascunhos da v5.22.18** abrindo na v5.22.19: schema
  do snapshot não mudou nesta versão (só ferramenta de UX), então
  `migrateLegacySnapshot` não precisou ser estendido. Rascunhos
  v5.22.18 abrem direto.

## Decisões registradas

### Por que três camadas em vez da Opção A (email) ou Opção B (cookies/browser) do Thiago

**Cookies** descartados: limite 4KB; snapshot médio já ultrapassa com
3-4 estruturas. Só `localStorage` (já em uso) ou IndexedDB serviriam.

**Email como primária** descartado: fricção alta (escrever email →
enviar → abrir caixa → clicar) para o caso comum (mesmo usuário,
mesma máquina, 30 minutos depois). Email fica reservado para uma
futura camada secundária (passar tarefa para colega).

**Camadas combinadas** ganham porque cobrem casos diferentes:
- Camada 1 (autosave): protege contra esquecimento de salvar manualmente
- Camada 2 (banner): resolve "voltar depois" sem precisar lembrar URL
- Camada 3 (beforeunload): protege a janela de debounce (3s)

### Por que ponteiro separado em vez de auto-carregar último rascunho

Reler automaticamente o último rascunho seria invasivo: o usuário
pode ter terminado uma obra e querer começar outra. O **ponteiro
+ banner** dá controle: o sistema oferece, o usuário decide.

### Por que LS_LAST_DRAFT_KEY separado do LS_KEY (cache do fallback)

Razões:
1. `LS_KEY` pode ter dezenas de rascunhos (CRUD). O ponteiro é
   "qual foi tocado por último" — decisão de UX, não de dado.
2. Funciona mesmo no modo Supabase: ponteiro local, snapshot remoto.
   `loadDraft(pointer.id)` busca no Supabase normalmente.
3. Botão "Limpar rascunho" (mutation `reset`) limpa só o ponteiro,
   sem tocar nos rascunhos remotos do Supabase.

### Por que `saveDraftSilent` em vez de só try/catch no autosave

Encapsulamento. O autosave chama `saveDraftSilent`; falha de rede ou
de Supabase devolve `null` sem propagação. O `saveDraft` "manual"
(botão verde) continua lançando em erro para que o `try/catch` no
`SetupPage.onSave` consiga mostrar "Erro ao salvar". Duas APIs com
contratos diferentes para casos de uso diferentes.

### Por que NÃO dispara audit log no autosave

`recordAudit` envia para `setup_audit_events`. 1 evento a cada 3s
poluiria a tabela sem agregar valor — o snapshot final é o que importa.
Audit explícito permanece no `saveDraft` manual (intencional e raro)
e no `loadDraft` (rastreável).

### Por que reusar `.alert.info` no banner em vez de cor própria

O smoke-contrast já validou `--info-fg/--info-bg` em modo claro e
escuro. Criar `.draft-resume-bg/--draft-resume-fg` exigiria nova
entrada lá. `.alert.info` reusado = zero risco, zero código novo de
contraste.

### Por que ` allow-list` no cleanup-legacy

Build falhou de primeira porque `scripts/cleanup-legacy.cjs` (pre-build
guard) apaga arquivos não-conhecidos de `src/components`. Adicionar
`ResumeDraftBanner.vue` à allowlist é o caminho correto — esse script
existe justamente pra evitar arquivos órfãos no Netlify.

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / Resend
- `npm install` em 4s (deps já em cache)

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `frontend/src/components/ResumeDraftBanner.vue` | 86 |
| `IMPLEMENTATION-REPORT-V522-19.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/services/setupDraftService.ts` | +95 linhas (pointer + saveDraftSilent) |
| `frontend/src/store/modules/setup.ts` | persistDebounced reescrita; pointer em saveDraft/loadDraft/reset; constantes do debounce |
| `frontend/src/views/SetupPage.vue` | imports, components, data, mounted, beforeUnmount, methods, template (banner) |
| `frontend/src/styles/design-system.css` | +43 linhas (`.resume-draft-banner*`) |
| `frontend/scripts/cleanup-legacy.cjs` | +2 linhas (allowlist) |
| `frontend/smoke-pipeline.ts` | +148 linhas (bloco v5.22.19) |
| `frontend/package.json` | version bump |
| `README.md` | header + nova seção v5.22.19 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.19 |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Saída relevante |
|---|---|
| `unzip -q ...` | Estado limpo da v5.22.18 |
| `md5sum` em arquivos chave | Confirmou que ZIP original está intocado |
| `npm install` | up to date, 82 packages |
| `npx tsx smoke-pipeline.ts` (baseline) | 180 OK / 0 FAIL |
| `npx tsx smoke-contrast.ts` (baseline) | 89 OK / 0 FAIL |
| `npm run build` (baseline) | ✓ built in 7.30s |
| `npx vue-tsc --noEmit` (após cada bloco) | limpo, sem output |
| `npx tsx smoke-pipeline.ts` (final) | **203 OK / 0 FAIL** |
| `npx tsx smoke-contrast.ts` (final) | **89 OK / 0 FAIL** |
| `npm run build` (final) | **✓ built in 7.70s** |

## Implementado com sucesso

- [x] Autosave debounce-safe 3s
- [x] Ponteiro do último rascunho neste navegador
- [x] Banner "Continuar onde parei" com tempo relativo pt-BR
- [x] Botão "Começar novo" limpa o ponteiro
- [x] `beforeunload` se `isDirty=true`
- [x] `saveDraftSilent` noexcept
- [x] Audit log preservado só para saves manuais
- [x] `reset` limpa pointer + cancela timer
- [x] CSS sem cor nova (reusa `.alert.info`)
- [x] Smoke pipeline +23 testes
- [x] `cleanup-legacy.cjs` allowlist atualizado
- [x] README + CHANGELOG atualizados
- [x] Package version bump
- [x] Backend .NET skeleton: **intocado** (não foi visto, não foi alterado)

## Parcialmente implementado

Nada.

## Não implementado

Por design, fica para versões futuras:

- **Link compartilhável `?draft=:id`** — útil para troca de máquina
  e passar tarefa para colega. Não bloqueia o caso de uso pedido.
- **`/meus-rascunhos`** — lista de rascunhos do dispositivo. Útil
  para múltiplas obras paralelas.
- **Envio por email** (Resend) como secundária do link compartilhável.
- **Painel de pendências** — listagem de campos faltantes ainda
  ausentes para conclusão. Era a Camada 4 da proposta original
  (resolve o problema na raiz: "não tenho o dado agora"); pode entrar
  na próxima versão.

## Correções importantes aplicadas

### Build inicialmente falhou: `cleanup-legacy` removeu o componente novo

Sintoma: `Could not resolve "../components/ResumeDraftBanner.vue"`.
Causa: `scripts/cleanup-legacy.cjs` (prebuild hook) apaga qualquer
`.vue` em `src/components/` que não esteja na sua allowlist.
Correção: adicionada entrada `'ResumeDraftBanner.vue'` na allowlist.

### Smoke usou `require` em arquivo ESM

Sintoma: `ReferenceError: require is not defined`. Causa: padrão
`require` inválido em projeto `"type": "module"`. Correção: `const fs
= await import('node:fs')` (mesmo padrão dos blocos anteriores).

## Regressões evitadas

- `loadDraft` continua chamando `migrateLegacySnapshot` (não quebrei a
  cadeia de migração; só adicionei `setLastDraftPointer` em sequência).
- `saveDraft` manual mantém todos os comportamentos antigos +
  `setLastDraftPointer` (mesmo dado que o autosave grava).
- `persistDebounced` antes era `async` no-op; agora é não-async mas
  retorna void (igual ao no-op anterior). Os 9 call sites no `SetupPage`
  já chamam sem `await` (`this.$store.dispatch('setup/persistDebounced')`
  sem `await`), então mudança de assinatura é transparente.
- Mutation `reset` agora cancela `autosaveTimer` — sem isso, um timer
  pendente poderia disparar `saveDraft` em cima do estado vazio
  imediatamente após reset, salvando "obra sem nada" no Supabase.
- `beforeUnloadHandler` é guardado em `data()` e removido em
  `beforeUnmount` — sem isso, vazaria listener entre navegações SPA
  (entrada/saída de `/r/:id` ou `/c/:protocolo`).

## Validações realizadas

| Critério §16 | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 203 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 7.70s |
| `.env.example` existe, sem secrets reais | ✅ (não foi tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura na interface | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke garante |
| Projetista é texto livre | ✅ smoke garante |
| Rascunho salva e recarrega | ✅ smoke garante código presente |
| JSON técnico gera e valida contra schema | ✅ smoke da v5.22.18 |
| Excel técnico exporta | ✅ smoke da v5.22.18 |
| Validações aparecem | ✅ smoke da v5.22.18 |
| Auditoria registra eventos | ✅ smoke da v5.22.18 |
| Documentação atualizada | ✅ README + CHANGELOG + este relatório |
| Backend .NET skeleton intacto | ✅ não foi tocado |

## Bloqueios reais (técnicos / ambiente / dependência / credenciais)

- **Browser real**: sandbox sem `chromium-headless`, então o banner
  visualmente e o `beforeunload` interativo não foram testados.
  Smoke garante que o código está presente e o build empacota tudo.
- **Supabase**: sandbox sem credenciais. `saveDraftSilent` integra com
  o fallback LS, que sempre roda. Em produção, o caminho Supabase do
  autosave precisa de teste manual.

## Pendências que exigem ação manual

1. **Teste em browser real** após deploy no Netlify: abrir
   `setup.consultegeo.org`, preencher Etapa 1, esperar 3s, recarregar a
   página, ver banner aparecer.
2. **Teste em browser real** do `beforeunload`: editar campo e
   imediatamente apertar Cmd+W / Ctrl+W — confirmar que o browser pede
   confirmação.
3. **Teste com Supabase ativo**: verificar que após autosave o registro
   em `setup_drafts` foi atualizado (sem audit log a cada 3s).
4. **Teste de regressão**: abrir rascunho da v5.22.18 — deve carregar
   normalmente (schema não mudou).

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 203 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado: 89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 8s)
npm run dev                  # abre http://localhost:5173
```

Para testar o banner: preencher algo na Etapa 1, esperar 3s (aparece
"Rascunho salvo"), recarregar (F5), o banner aparece no topo.

Para testar beforeunload: preencher um campo qualquer, imediatamente
(< 3s) apertar Ctrl+W / Cmd+W. Browser deve pedir confirmação.

## Como publicar no Netlify

Sem mudanças no `netlify.toml`. Push para a branch principal dispara
rebuild automático. GitHub Action das Edge Functions continua igual
(não foram alteradas nesta versão).

## Como configurar Supabase

Sem mudanças no schema. Nenhuma migration nova. O ponteiro
`LastDraftPointer` é puramente local (localStorage). Tabelas
existentes continuam idênticas.

## Como migrar futuramente para .NET 8 + SQL Server

Sem impacto. As mudanças desta versão são:
- Frontend-only
- Localmente no navegador (pointer no LS)
- Reusam `saveDraft` (que será re-apontado para a API .NET futuramente)

O backend .NET precisará só implementar o endpoint
`PUT /api/implantacao-estrutura/drafts/{id}` (já listado em §8 do
contexto). O autosave chama o mesmo endpoint do save manual.

## Próximo ciclo recomendado

**v5.22.20** — Camada 4 da proposta original: **painel de pendências
persistente**. Lista campos faltantes (warnings ainda não resolvidos)
no rodapé do wizard com link direto para a etapa+linha. Resolve o
problema na raiz: "esqueci de coletar agora". Combinação ideal: o
usuário avança tranquilo, vê na hora o que falta, autosave protege
o que ele já preencheu, banner garante retomada se ele fechar a aba.

**v5.22.21** (sugestão) — link compartilhável `?draft=:id` + lista
`/meus-rascunhos`. Cobre os cenários de borda (troca de máquina,
múltiplas obras paralelas).
