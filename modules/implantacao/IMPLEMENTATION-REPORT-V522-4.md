# Implementation Report · Implantação Consulte GEO v5.22.4

## Resumo executivo

UX da Etapa 6 reorganizada conforme feedback do Thiago após primeiros
testes em produção:

1. **Botões "Exportar Excel" + "Enviar para validação" no topo** da
   página da Etapa 6 (não mais no rodapé do card de envio).
2. **Botão "Exportar JSON" removido** do fluxo do cliente — fica
   acessível apenas à equipe na ReviewView `/r/`.
3. **Cores semânticas** nos botões do rodapé do wizard (Voltar e
   Salvar rascunho).
4. **Botões "Carregar exemplo"** restritos às Etapas 1, 2 e 3.
5. **Bloqueio do envio** quando exemplo carregado e nada editado —
   evita que o cliente envie um exemplo pré-cadastrado sem
   personalizar.
6. **Prefixo "Exemplo:"** em todos os placeholders cinzas dos campos.

Backend `.NET` skeleton intacto. Stack fechada. Edge Function v5.22.3
preservada (sem mudanças nesta versão). Smokes 50 lógica + 42 contraste.

## Ambiente usado

- Node 22.22.2 / Vue 3.4.38 / Vite 5.4.6 / TS 5.4.5 / Vuex 4.1 /
  Bootstrap 5.3.3
- Supabase project_id `yglcnirbnbwjqpvalqif`

## Arquivos criados

- `IMPLEMENTATION-REPORT-V522-4.md` (este arquivo)

## Arquivos alterados

### Frontend
- `frontend/package.json` — 5.0.22-3 → 5.0.22-4
- `frontend/src/components/AppShell.vue`
  - Botões "Carregar exemplo" só renderizam se `currentStep <= 3`
  - Slot novo `top-actions-extra` para CTAs específicos por etapa
- `frontend/src/components/Step6Preview.vue`
  - Botões Exportar Excel / Exportar JSON / Enviar removidos da base
  - Novo card "Envio para validação" só com textarea + alerts
  - Novo prop `exampleUnchanged` (alert condicional)
  - Emit `export-json` removido (não existe mais no fluxo do cliente)
- `frontend/src/components/WizardFooter.vue`
  - Voltar com classe `.btn.nav-back` (azul-marinho discreto)
  - Salvar rascunho com classe `.btn.success` (verde)
- `frontend/src/views/SetupPage.vue`
  - Computed `isExampleUnchanged`, `bloqueantesCount`, `submitButtonTitle`
  - Handlers `onLoadExampleCommon/Projetista` usam `loadExampleSnapshot`
    com payload `{ snapshot, key }`
  - Slot `top-actions-extra` populado na Etapa 6 com 2 botões CTA
    (Exportar Excel + Enviar)
  - Step6Preview agora recebe `:example-unchanged="isExampleUnchanged"`
  - Emit `export-json` removido do binding com Step6
- `frontend/src/store/modules/setup.ts`
  - Novo state: `exampleLoadedKey: 'common' | 'projetista' | null`
  - Novo state: `exampleBaselineHash: string | null`
  - Helper `computeUserContentHash(snapshot)` — hash JSON estável da
    parte editável do snapshot
  - Novo getter `isExampleUnchanged` — compara hash atual com baseline
  - Nova mutation `loadExampleSnapshot({ snapshot, key })`
  - `replaceSnapshot` agora limpa `exampleLoadedKey` e `exampleBaselineHash`
  - Action `submit` bloqueia com mensagem específica se exemplo intocado
- `frontend/src/styles/design-system.css`
  - Header atualizado para v5.22.4
  - `.btn.success` (verde semântico, light + dark)
  - `.btn.nav-back` (azul-marinho discreto, light + dark)
- Placeholders prefixados com "Exemplo:" em 7 componentes:
  - `Step1DadosBasicos.vue` (7 placeholders)
  - `Step3GruposEditor.vue` (3 placeholders)
  - `Step4Concretos.vue` (4 placeholders, incluindo SLUMP no lugar de FLOW)
  - `Step5PecasEditor.vue` (8 placeholders)
  - `EditDrawer.vue` (3 placeholders)
- `frontend/smoke-pipeline.ts` — +5 cases v5.22.4

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Resultado |
|---|---|
| Cópia v5.22.3 → v5.22.4 working | OK |
| `npm install` | OK |
| `npm run typecheck` | 0 erros TS |
| `npm run build` | OK em 7,50s |
| `npm run smoke` | **50 OK / 0 FAIL** |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** |
| `npm run smoke:all` encadeado | OK |

## Implementado com sucesso

### UX da Etapa 6
- ✓ Botão "Exportar Excel" verde (.btn.success) no topo
- ✓ Botão "Enviar para validação" magenta (.btn.brand) no topo
- ✓ Botão "Exportar JSON" removido do fluxo do cliente
- ✓ Card "Envio para validação" simplificado: só textarea + alerts
- ✓ Alert novo "Edição obrigatória" quando exemplo intocado
- ✓ Alert "Envio bloqueado" quando há erros de validação
- ✓ Botão Enviar fica desabilitado se: loading OR bloqueantesCount > 0
  OR isExampleUnchanged
- ✓ Tooltip do botão Enviar explica por que está desabilitado

### Botões de exemplo restritos
- ✓ `v-if="currentStep <= 3"` no AppShell
- ✓ Botões somem totalmente nas Etapas 4, 5 e 6

### Cores no rodapé do wizard
- ✓ Voltar = `.btn.nav-back` (azul-marinho discreto)
- ✓ Salvar rascunho = `.btn.success` (verde-acinzentado)
- ✓ Avançar = `.btn.primary` (navy, já era)
- ✓ Ambos os botões funcionam em light e dark

### Bloqueio de exemplo intocado
- ✓ Mutation `loadExampleSnapshot` registra `exampleBaselineHash` no
  momento do load
- ✓ Helper `computeUserContentHash` calcula hash JSON estável apenas
  do conteúdo "personalizável" (exclui audit local, step, theme)
- ✓ Getter `isExampleUnchanged` compara hash atual com baseline
- ✓ Quando usuário edita qualquer campo via mutations que alteram
  metadata/grupos/concretos/etc., o hash muda e o getter vira false
  automaticamente
- ✓ Action `submit` lança erro humanizado se bloqueio ativo

### Placeholders prefixados
- ✓ 25 placeholders revisados manualmente
- ✓ Convenção: `Exemplo: <valor de exemplo>` para todos os campos
  onde o placeholder mostra um valor que poderia ser confundido com
  dado real
- ✓ Mantém: "Opcional", "Nome do gestor", "Digite livremente"
  (são instruções, não exemplos)
- ✓ Troca específica pedida: `FLOW 10±2 CM` → `SLUMP 10±2 CM` no
  placeholder do Step4Concretos
- ✓ Placeholder do FCK agora é exatamente "Exemplo: FCK 30 | BRITA 1 | SLUMP 10±2 CM"

### Smokes
- ✓ +5 cases v5.22.4 cobrindo:
  - Estado inicial `isExampleUnchanged === false`
  - Após `loadExampleSnapshot` → `isExampleUnchanged === true`
  - Após edit de 1 campo → `isExampleUnchanged === false`
  - Placeholder do FCK com SLUMP (sem FLOW)
  - Step1 com pelo menos 5 placeholders prefixados
- ✓ Total: **50 OK lógica** (32 → 37 → 41 → 45 → 50 cumulativo)
- ✓ **42 OK contraste** preservado

## Parcialmente implementado

Nenhum item parcial.

## Não implementado

- **Persistência do `exampleLoadedKey` no rascunho**: hoje, se o
  usuário carrega exemplo, salva rascunho, fecha o navegador e
  recarrega, o `exampleLoadedKey` volta a null. O bloqueio não
  persiste. Trade-off aceitável: rascunho salvo é, na prática, "dado
  do usuário" — porque ele já tomou a ação de salvar. Se quiser
  persistir, precisaria adicionar 2 colunas em `setup_drafts`.
- **Diferentes mensagens para example "common" vs "projetista"**:
  o alert é genérico. Suficiente pro MVP.
- **Animação de transição** dos botões do topo entre etapas: aparecem/
  somem sem fade. Sem impacto funcional.

## Correções importantes aplicadas

- O placeholder do FCK tinha `FLOW` (erro de tradução do termo
  `FLOW`/`SLUMP`) — corrigido para `SLUMP` conforme pedido.
- O sweep de placeholders distinguiu **instruções** (mantidas como
  estavam: "Opcional", "Nome do gestor") de **exemplos** (prefixados).

## Regressões evitadas

- `replaceSnapshot` continua existindo e funcional (carregar rascunho
  real continua usando ele e limpa o baseline).
- `loadExampleSnapshot` é mutation nova, não conflita com nada.
- O hash não tenta detectar mudanças do step/theme/audit/showJson
  (que mudam sem ser edição real). Só conteúdo.
- Backend .NET skeleton intacto.
- Edge Function v5.22.3 (CORS dinâmico) intacta.
- Migrations SQL intactas.
- Smokes cumulativos: 32 → 37 → 41 → 45 → 50.

## Validações realizadas

- `vue-tsc --noEmit`: 0 erros
- `vite build`: OK 7,50s
- `npm run smoke`: 50/50 OK
- `npm run smoke:contrast`: 42/42 OK
- Inspeção visual via reading dos prints anteriores: layout coerente
- Hash comparison testado via smoke (carregar exemplo → edit → check)

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
Mesmo set das versões anteriores. Não testei visualmente em viewport
real (sandbox sem browser).

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Não testei interativamente o submit-com-exemplo-intocado em produção
real. O smoke testa a lógica do Vuex isoladamente.

## Pendências que exigem ação manual

1. **Aplicar o patch v5.22.4** ao repositório (git add + commit + push)
2. **Aguardar deploy Netlify** (2-3 min)
3. **Testar visualmente em aba anônima**:
   - Etapa 1: confirmar botões "Carregar exemplo" no topo
   - Etapa 4: confirmar botões de exemplo SUMIRAM
   - Etapa 6: confirmar 2 botões CTA novos no topo (Exportar Excel
     verde + Enviar magenta)
   - Etapa 6: confirmar que NÃO existe mais botão "Exportar JSON"
   - Rodapé do wizard: confirmar cores em Voltar e Salvar rascunho
4. **Testar bloqueio**:
   - Etapa 1: clicar "Carregar exemplo comum"
   - Ir direto pra Etapa 6 sem editar nada
   - Confirmar que o alerta "Edição obrigatória" aparece
   - Confirmar que o botão "Enviar" está desabilitado
   - Editar 1 campo (ex.: nome da obra) e voltar pra Etapa 6
   - Confirmar que o alerta sumiu e o botão funciona
5. **Testar placeholders**: abrir campos vazios e ver "Exemplo: ..."

## Como validar localmente

```bash
cd frontend
npm install
npm run build          # 0 erros TS
npm run smoke:all      # 50 + 42 OK
npm run dev
```

## Como publicar no Netlify

Sem mudança no `netlify.toml`. `git push origin main`. Deploy
automático em 2-3 min.

## Como migrar futuramente para .NET 8

Nenhuma mudança de schema/RPC. O bloqueio de exemplo é puramente
client-side (Vuex). O backend .NET 8 pode simplesmente ignorar essa
lógica ou replicá-la na camada de UI futura.

## Próximo ciclo recomendado

1. **Teste end-to-end em produção** com a v5.22.4 deployada
2. **Coletar feedback** se mais alguma instrução de UX precisa de
   ajuste
3. **Eventual v5.23**: notificação por email quando há novo
   comentário na review (fecha o loop sem precisar do cliente abrir
   `/s/` periodicamente)
