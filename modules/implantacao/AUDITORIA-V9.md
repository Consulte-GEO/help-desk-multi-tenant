# Auditoria da entrega V8 · correções aplicadas na V9 (v5.22.46)

Data: 07/08/2026 · Auditado: pacote `Implantacao consulte geo source completo v08`
Método: execução real dos gates que o ambiente do agente anterior não conseguiu
rodar, revisão de código do que foi criado no ciclo, e inspeção do banco Supabase
de produção via conector.

---

## 1. Achado nº 1 — a V8 nunca foi compilada

O relatório V8 declara os gates npm como "bloqueados pelo ambiente" (`404` do
registry para `vuex@4.1.0`). Aqui o `npm ci` instalou **66 pacotes em 5 segundos**
sem nenhum erro — o problema era do ambiente deles, não do projeto.

E o build **falhava**:

```
src/views/SetupPage.vue(804,44): error TS2345:
  Type 'string | null' is not assignable to type 'string | undefined'.
```

`id` é `string | null` e o guard anterior só verificava `token`. Corrigido
(`if (!id || !token)`), o build passa em ~3,5s. **Um erro real de tipo foi
entregue como "pronto"** porque nenhum gate de compilação chegou a rodar.

## 2. Achado nº 2 — produção quebrada por dessincronia banco × frontend

Consultei o banco de produção. Estado de `anon` hoje:

| Tabela | anon SELECT | anon INSERT | anon DELETE |
|---|---|---|---|
| `setup_drafts` | ✗ | ✗ | ✗ |
| `setup_submissions` | ✗ | ✗ | ✗ |
| `setup_exports` | ✗ | ✗ | ✗ |
| `setup_audit_events` | ✗ | ✗ | ✗ |

O fechamento está **correto** — era o achado crítico da V7. O problema é o
descompasso: o Netlify serve o commit `2f35b6cf…`, ou seja o **frontend V7**, que
acessa essas tabelas por `.from('setup_drafts')` com a anon key. Com a RLS
fechada e o frontend antigo no ar, **salvar e recarregar rascunho está quebrado
em produção neste momento**.

O frontend V8 corrige (migrou tudo para RPCs por token — verifiquei: nenhum
`.from()` restante nessas tabelas nos services do cliente). A dívida não é de
código: é de sequenciamento. Publicar a V8 é o que restaura o serviço.

## 3. Achado nº 3 — três RPCs que o código chama não existem no banco

| RPC chamada por `ticketService.ts` | Existe no banco |
|---|---|
| `return_submission_with_comment` | **não** |
| `resubmit_by_client_token` | **não** |
| `update_technical_json_by_client_token` | **não** |

As outras 14 RPCs esperadas existem. Isso quebra o fluxo de **devolução pela
equipe, reenvio pelo cliente e edição do JSON técnico pelo cliente** — mesmo
depois de publicar a V8.

Causa raiz: a migration `20260519_009_setup_return_submission.sql` **é
inaplicável contra o banco real**. Ela referencia `setup_submissions.client_token`
13 vezes e `locked_at` 2 vezes; nenhuma das duas colunas existe. O modelo real do
banco usa `setup_tickets.access_token` como token do cliente — e é isso que as
funções sobreviventes (`get_status_by_client_token`, `add_review_comment_by_client_token`,
`get_submission_by_token`) de fato consultam.

Confirmação adicional: o histórico de migrations do banco pula de
`20260518_004` direto para as V8 (`20260807_*`). **As migrations 005–015 nunca
foram registradas**, embora as tabelas existam (aplicadas fora do controle de
versão). A deriva é **pré-existente à V8** — mas a V8 aplicou oito migrations de
hardening sobre esse schema inconsistente e declarou o conjunto "aplicado", sem
detectar o buraco.

Não corrigi isto automaticamente: reescrever a 009 para o modelo `access_token`
muda contrato de dados e precisa de decisão e teste com dados reais. Entreguei
`tools/diagnose-schema-drift.mjs`, que reproduz o diagnóstico em qualquer
ambiente e imprime o SQL de verificação.

## 4. Achado nº 4 — o SimilarityEngine inventava traço sem evidência

Bug de severidade alta, direto contra a regra de ouro do ciclo ("nunca escolher
sozinho"):

Quando a linha não tinha FCK identificável (`fck === null`), o filtro por FCK era
pulado e **todo o catálogo virava candidato com score 0**. Se sobrasse um único
candidato — por catálogo pequeno ou por coincidência de token de aplicação — o
motor propunha a associação com `requiresHuman: false` e a mensagem *"Único traço
compatível com FCK/aplicação"*. Não havia FCK nenhum para ser compatível.

Corrigido: sem FCK conhecido, nunca há proposta automática — os candidatos são
apresentados como sugestão com `requiresHuman: true` e regra `TRACE_SEM_FCK`.

### Outros bugs corrigidos no motor

| Bug | Severidade | Efeito |
|---|---|---|
| Slump em mm aceito como cm | Alta | `"ABATIMENTO 100 ± 20 mm"` propunha **100 cm**. Agora converte para 10 cm e marca a normalização |
| Valor sem unidade e implausível | Alta | `"SLUMP 120±20"` (>30 cm é fisicamente impossível) agora é lido como mm → 12 cm |
| `SLUMP12` sem espaço | Média | Não casava e a proposta sumia em silêncio. O extrator de FCK já aceitava `FCK30` — a assimetria foi corrigida |
| `reject()` corrompia proveniência | Média | Rejeitar proposta sobre campo já preenchido rebaixava `DADO_ORIGINAL` → `PENDENTE_CLIENTE`, violando a regra 9 |
| `row` null quebrava geradores | Baixa | `freshProposals`/`operationalProposals`/`traceProposal` sem guarda |

## 5. Achado nº 5 — writer XLSX caseiro

A V8 **removeu `xlsx-js-style`** e o substituiu por `xlsxStyleLite.ts` (30 KB
escritos à mão). A motivação declarada foi o registry quebrado — ou seja, um
problema de ambiente virou decisão de arquitetura. O writer em si está melhor do
que eu esperava (escape XML correto, colunas além de Z, ordem OOXML válida,
abertura confirmada no `openpyxl` com as 13 abas). Ainda assim, três defeitos:

| Bug | Efeito |
|---|---|
| Abas duplicadas case-sensitive | `'Resumo'` + `'RESUMO'` passavam; o Excel trata como colisão e pede reparo do arquivo |
| `NaN`/`Infinity` viravam `0` | Correção silenciosa de dado — proibida pelo projeto. Agora grava `#N/D` / `#INF` como texto |
| Sem guarda de 32.767 caracteres | Célula maior que o limite do Excel gerava arquivo recusado. Agora trunca com marca `…[TRUNCADO]` visível |

**Recomendação:** reavaliar a volta ao `xlsx-js-style` num ciclo futuro, agora que
o registry funciona. Manter um writer OOXML próprio é dívida permanente.

## 6. Achado nº 6 — a suíte S1–S12 era fraca

Os 12 testes passavam, mas eram caminho feliz de variante única, e dois deles
foram escritos **em torno da implementação**, escondendo exatamente os bugs
acima: `S5` monta o catálogo com FCK casando (o caso perigoso — FCK ausente — não
existia na suíte) e `S11` rejeita sobre campo vazio (o caso que expõe a corrupção
de proveniência).

Adicionei **9 testes de regressão (S13–S21)**, cada um amarrado a um bug real
corrigido. Total: **21/21 verdes**.

## 7. Correções aplicadas nesta V9

```
frontend/src/views/SetupPage.vue            guard de `id` — destrava o build
frontend/public/assets/similarity-engine.js 5 bugs (traço sem FCK, mm→cm ×2,
                                            SLUMP12, reject(), guards de null)
frontend/public/assets/similarity-selftest.js  +9 testes de regressão S13–S21
frontend/src/vendor/xlsxStyleLite.ts        3 bugs (aba duplicada, NaN, 32767)
tools/diagnose-schema-drift.mjs             NOVO — diagnóstico de deriva de schema
AUDITORIA-V9.md                             este documento
frontend/package.json                       5.0.22-45 → 5.0.22-46
importa.html 3.4.0 · pre-analise/intake 5.22.46
```

## 8. Gates — executados de verdade

| Gate | V8 declarou | V9 (real) |
|---|---|---|
| `npm ci` | bloqueado (404) | **OK** — 66 pacotes |
| `npm run build` | não executável | **OK** após corrigir o erro TS |
| `npm run typecheck` | não executável | **OK** — 0 erros |
| `npm audit --omit=dev` | bloqueado (404) | **0 vulnerabilidades** |
| `npm run smoke:contrast` | não executável | **89 OK, 0 FAIL** |
| `npm run smoke` | via shim de `createStore` | **578 OK, 1 FAIL** (workflow ausente, pré-existente) |
| `npm run smoke:xlsx` | OK | OK |
| Pré-análise (Node) | 27/27 | **27/27** |
| SimilarityEngine | 12/12 | **21/21** (9 novos de regressão) |
| Pré-análise (browser) | 27/27 | **27/27** |
| `importa.html` no browser | — | 3 cards, Copilot 3.4.0, 0 erros de página |
| App Vue em `/` | — | carrega, 0 erros |

O `smoke` do V8 foi rodado com um **shim temporário de `createStore`** por causa
do registry quebrado. Aqui rodou com o Vuex 4 real do lockfile.

## 9. O que NÃO corrigi (e por quê)

| Item | Motivo |
|---|---|
| Migration 009 / 3 RPCs faltantes | Reescrever para o modelo `setup_tickets.access_token` altera contrato de dados; exige decisão e teste com dados reais. Diagnóstico entregue em `tools/diagnose-schema-drift.mjs` |
| Publicar frontend V8/V9 | O push segue bloqueado pelo proxy desta sessão (repositório fora das *sources*) |
| `.github/workflows/deploy-edge-functions.yml` | Continua exigindo secrets. O 1 FAIL do smoke permanece deliberado |
| ZIP sem compressão no writer | 482 KB contra 44 KB deflacionado (11×). Tradeoff declarado no código; escala mal em obra grande |
| `public.external_cache` sem RLS | Fora do módulo; precisa mapear consumidores antes |
| Voltar ao `xlsx-js-style` | Decisão de arquitetura sua; registrada como recomendação |

## 10. Ordem recomendada para retomar

1. **Publicar o frontend V9** — isso resolve a produção quebrada (achado 2). É a
   ação mais urgente: hoje o site não salva rascunho.
2. Rodar `node tools/diagnose-schema-drift.mjs --repo-only` e aplicar o SQL de
   verificação no Supabase para confirmar as 3 RPCs faltantes.
3. Decidir o destino da migration 009 (reescrever para `access_token` ou
   descontinuar o fluxo de devolução/reenvio até redesenhá-lo).
4. Validar em preview antes de promover: salvar/recarregar/compartilhar rascunho,
   submeter, painel admin, status do cliente, Pré-análise, Pré e Pós-importação.
5. Reavaliar o writer XLSX próprio agora que o registry funciona.
