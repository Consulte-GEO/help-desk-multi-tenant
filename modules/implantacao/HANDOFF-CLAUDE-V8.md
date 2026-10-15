# HANDOFF · Implantação Consulte GEO · V8 / v5.22.45

Data de fechamento: **07/08/2026**
Projeto Supabase: `yglcnirbnbwjqpvalqif`
Site Netlify: `setupobras` (`https://setup.consultegeo.org`)

## 1. Estado executivo

A V8 foi implementada sobre a fonte V7 fornecida e está versionada como
`5.0.22-45`. O commit funcional/documental de referência anterior a este
handoff é `3178ee05c3bebee5421df14fefd2b05c3f03bdac`; o patch contém todo o
histórico desde a baseline V44 `f663bc9`.

O estado operacional é híbrido:

- **Supabase V8 ativo:** migrations 016–023 aplicadas;
- **Edge Functions V8 ativas:** `submit-for-validation` versão 4 e
  `share-draft-link` versão 1, ambas com verificação JWT habilitada;
- **frontend V8 ainda não publicado:** o GitHub `main` observado permanece em
  `69b2e0d6d7d2612cba46a489dee70bf2f4ae5172` e o Netlify de produção continua
  servindo o commit `2f35b6cf55236fbd5a7aaa6bcc7da8b901363d56`;
- **gates npm oficiais bloqueados pelo ambiente:** o registry interno retorna
  `404` para `vuex@4.1.0` e o endpoint de audit também retorna `404`;
- **gates funcionais e estáticos executáveis concluídos:** Pré-análise,
  SimilarityEngine, fluxo browser da Pré-importação, Pós-importação, laudos,
  contraste e writer XLSX passaram; o smoke estrutural manteve 1 FAIL conhecido
  pela ausência do workflow de Edge Functions.

Enquanto o frontend V8 não for publicado, o site atual não deve ser tratado como
homologação da V8. O banco/Edges já obedecem ao contrato novo por token.

## 2. Fonte de verdade e topologia

```text
frontend/                       aplicação Vue publicada pelo Netlify
  src/                          Vue 3 + TypeScript + Vuex 4 + Bootstrap 5
  public/
    importa.html                Pré-importação + Pós-importação
    pre-analise.html            triagem determinística
    laudos.html                 leitor de laudos PDF
    assets/                     motores UMD e self-tests
    vendor/                     SheetJS legado da página estática + pdf.js local
backend/                        skeleton .NET 8 preservado
supabase/migrations/            schema, RLS e RPCs
supabase/functions/             Edge Functions
schemas/                        contratos JSON
prototype/v06/                  protótipo histórico, não publicado
```

A aplicação ativa possui um único Copilot:
`frontend/public/importa.html`. Os arquivos históricos da raiz foram movidos
para `prototype/v06/`, sem hard delete.

## 3. Pré-importação V8

Arquivo principal: `frontend/public/importa.html`.

O fluxo foi reduzido para cinco etapas:

1. arquivo e configuração opcional;
2. mapeamento;
3. valores propostos;
4. validação;
5. exportação.

Antes eram seis etapas (`Insumos`, `Diagnóstico`, `Mapeamento`, `Inferências`,
`Validação`, `Exportação`) e a abertura exigia seis entradas: arquivo, estrutura,
usinas, laboratórios, traços e idades. Agora somente o arquivo é obrigatório para
começar; os cinco catálogos são referências opcionais. A validação final continua
focada nos oito campos bloqueantes reais do layout.

Principais comportamentos:

- mapeamento por sinônimos e perfil de conteúdo;
- colunas sem destino explícito marcadas como ignoradas;
- texto original preservado quando não há catálogo oficial;
- correspondência inexata nunca normalizada silenciosamente;
- propostas aceitas/rejeitadas por linha ou em massa;
- volume padrão somente após autorização explícita;
- linhas de total/legenda excluídas com justificativa;
- exportação XLSX com `Importação` e `Proveniência`;
- Pós-importação preservada no mesmo arquivo;
- handoff da Pré-análise reaproveitado quando disponível.

A régua campo → origem → obrigatoriedade está em
`docs/PRE-IMPORTACAO-CAMPOS.md`.

Campos bloqueantes por linha: Data Concretagem, N.F. DANFE, Volume, Bloco,
Unidade, Concreto, Usina e Laboratorio. Slump/Flow são condicionais; resultados
de rompimento são preservados por idade detectada.

## 4. SimilarityEngine

Arquivos:

```text
frontend/public/assets/similarity-engine.js
frontend/public/assets/similarity-selftest.js
tools/run-similarity-tests.js
```

Regras implementadas:

1. Slump nominal extraído do traço, sem aplicar tolerância;
2. Flow nominal extraído do traço, sem criar Slump para autoadensável;
3. traço por FCK + aplicação: um candidato propõe; dois ou mais exigem escolha;
4. conflito de FCK vira pendência;
5. Usina/Laboratório únicos propõem preenchimento apenas dos vazios;
6. Placa vazia recebe `IMPORT` como padrão operacional;
7. Volume padrão exige `volumeDefaultAuthorized=true`;
8. célula mesclada reaproveita `safeMatrix` e registra normalização;
9. nenhum valor presente é sobrescrito;
10. toda decisão produz proveniência.

Níveis de proveniência:

```text
DADO_ORIGINAL
NORMALIZACAO_AUTOMATICA
INFERIDO_POR_SIMILARIDADE
PADRAO_OPERACIONAL
PENDENTE_CLIENTE
```

Para estender o motor, crie função pura que devolva `proposalBase`, registre-a
em `Converter.queueProposal` e acrescente self-test + runner. Nunca escreva
diretamente em campo já preenchido.

## 5. Excel e laudos

### Writer XLSX do wizard

`xlsx-js-style` foi removido. O wizard usa
`frontend/src/vendor/xlsxStyleLite.ts`, carregado dinamicamente pelos serviços de
exportação. O subconjunto coberto inclui:

- múltiplas abas;
- estilos, fontes, preenchimentos, bordas e alinhamento;
- formatos numéricos;
- mesclas;
- filtros;
- larguras/alturas;
- painéis congelados;
- aba ativa.

O writer foi validado em workbook sintético e na exportação técnica de 13 abas,
com abertura pelo `openpyxl`. Vuex 4 permanece a store oficial; a tentativa de
substituí-lo por uma store local foi revertida.

### Laudos

`pdf.js` deixou de ficar inline em `laudos.html` e passou a ser self-hosted:

```text
frontend/public/vendor/pdf.mjs
frontend/public/vendor/pdf.worker.mjs
```

O teste browser extraiu seis resultados de um PDF local, sem erros de console ou
página.

## 6. Supabase e segurança

Migrations V8:

```text
20260807_016_close_setup_submissions_and_admin_view.sql
20260807_017_make_setup_audit_append_only.sql
20260807_018_draft_token_rpcs_and_close_setup_rls.sql
20260807_019_harden_setup_admin_and_indexes.sql
20260807_020_harden_client_audit_rpc.sql
20260807_021_restore_is_admin_for_public_rls.sql
20260807_022_harden_draft_write_rpcs.sql
20260807_023_reconcile_draft_write_rpcs.sql
```

Todas constam no histórico remoto. A 023 reconcilia a definição final da 022;
não reescreva nenhuma migration aplicada.

### Modelo de posse

O navegador gera `draftId + draftToken`. O token:

- é armazenado localmente pelo navegador;
- não é devolvido pelas RPCs;
- não concede acesso a outro draft;
- entra no link compartilhável apenas no fragmento
  `#draft=<uuid>&token=<uuid>`;
- é revalidado pela Edge antes de qualquer operação com `service_role`.

### RPCs do cliente

```text
get_draft_by_token(uuid)
list_drafts_by_tokens(uuid[])
upsert_draft_by_token(...)
cancel_draft_by_token(uuid, uuid)
record_export_by_token(...)
list_exports_by_token(...)
record_audit_by_token(...)
list_audit_by_token(...)
```

Todas fixam `search_path`, revogam `PUBLIC` e removem `access_token` do retorno.

### Estado por tabela

| Objeto | `anon` direto | `authenticated` direto | Canal do cliente |
|---|---|---|---|
| `setup_drafts` | bloqueado | admin `SELECT` | RPC por token |
| `setup_submissions` | bloqueado | admin `SELECT/UPDATE` | Edge por id+token |
| `setup_exports` | bloqueado | admin `SELECT` | RPC por token |
| `setup_audit_events` | bloqueado | admin `SELECT/INSERT` | RPC por token |
| `setup_tickets` | sem grant direto | policies admin | Edge/RPC específica |
| `setup_review_comments` | sem grant direto | policies admin | RPC por token |
| `admin_dashboard_items` | sem grant | authenticated `SELECT` | `security_invoker=true` |

### Validação remota executada

- criação e retry idempotente por UUID/token;
- atualização por token correto;
- rejeição de token incorreto;
- cancelamento idempotente;
- rejeição de save/cancelamento em draft bloqueado ou não editável;
- auditoria válida e rejeição fora da allow-list;
- negação de privilégios tabulares diretos para `anon`;
- leitura pública de `setup_step_help` preservada;
- teste transacional da migration 023 com limpeza total dos dados de teste.

## 7. Edge Functions

Estado remoto confirmado em 07/08/2026:

| Função | Versão | Estado | JWT |
|---|---:|---|---|
| `submit-for-validation` | 4 | ativa | habilitado |
| `share-draft-link` | 1 | ativa | habilitado |
| `importa-openai` | 1 | ativa | conforme configuração existente |

A submissão valida id+token+status+lock, cria submission/ticket, revalida o lock
e compensa registros parciais antes do envio de e-mail. O compartilhamento
valida posse e estado antes de enviar o link por fragmento.

As Edges V8 já estão ativas no projeto remoto e seus fontes foram
inspecionados. Não foi criado workflow nesta V8 porque os secrets do GitHub não
foram confirmados. Um pipeline futuro só deve ser adicionado depois de cadastrar
`SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_ID`, com `workflow_dispatch`,
environment protegido e confirmação explícita.

Não foi executado o caminho positivo de ticket/e-mail para evitar efeitos reais.
Uma tentativa de testar apenas respostas de erro por HTTP no container foi
bloqueada pela resolução DNS do ambiente.

## 8. Gates executados

### Verdes

| Gate | Resultado |
|---|---:|
| Pré-análise Node | `27/27` |
| SimilarityEngine | `12/12` |
| self-test browser do Copilot | `18/18` |
| Pré-análise no browser | `27/27` |
| fluxo browser da Pré-importação | 10 linhas; total excluído; aceite/rejeição; Pós-importação OK |
| export da Pré-importação | 2 abas; 10 linhas; 132 linhas de proveniência |
| laudos PDF browser | 6 resultados; 0 erros |
| contraste | `89 OK, 0 FAIL` |
| smoke estrutural alternativo | `578 OK, 1 FAIL` conhecido |
| transpile selecionado TS/Vue/Edge | 11 alvos; 0 erro |
| writer XLSX | ZIP/XML OK + abertura `openpyxl` OK |
| `git diff --check` | OK |
| migration 023 no banco | create/update/wrong-token/cancel/cleanup OK |

O smoke estrutural alternativo foi executado com `ts-node` global e um shim
**temporário** da API `createStore`, removido após o teste. Ele não substitui a
validação do Vuex 4 real.

### Bloqueados no ambiente

| Comando oficial | Resultado |
|---|---|
| `npm ci` | `404` para `vuex@4.1.0` no registry interno |
| `npm run build` | não executável sem dependências instaladas |
| `npm run typecheck` | `vue-tsc` indisponível após falha do `npm ci` |
| `npm run smoke` | `tsx` indisponível após falha do `npm ci` |
| `npm run smoke:contrast` | `tsx` indisponível após falha do `npm ci` |
| `npm audit --omit=dev` | endpoint de audit retorna `404` |

Repita todos os gates oficiais em registry npm íntegro. Não trate os fallbacks
como aprovação de build/typecheck/audit.

## 9. GitHub e Netlify

### GitHub

- `main` observado: `69b2e0d6d7d2612cba46a489dee70bf2f4ae5172`;
- branch local `codex/v8-v5.22.45` criada no commit `8d5f6ec`;
- os commits V8 estão no repositório local e no patch entregue;
- nenhum commit V8 foi enviado ao remoto;
- não houve force-push nem alteração destrutiva do `main`.

Foi tentado `git push -u origin codex/v8-v5.22.45` com prompt desativado. A
operação falhou antes da autenticação porque o container não resolveu
`github.com`. O conector GitHub disponível para esta etapa expôs somente leitura.
Use o ZIP/patch em branch e abra PR.

### Netlify

- site: `setupobras`;
- deploy observado: `6a75f5a745722500080cea23`, estado `ready`;
- commit publicado: `2f35b6cf55236fbd5a7aaa6bcc7da8b901363d56`;
- frontend V8 não implantado.

O deploy não foi disparado: o repositório ligado ainda não contém a V8 e os
gates npm oficiais não fecharam. Promover agora publicaria uma fonte diferente
da árvore validada.

## 10. Achados residuais

Fora do escopo do módulo de implantação:

- **P1:** `public.external_cache` sem RLS; a tabela estava vazia, mas o contrato
  de consumidores precisa ser definido antes de habilitar policies;
- cinco views legadas ainda sinalizadas como security-definer;
- funções legadas com `search_path` mutável;
- leaked-password protection desabilitada;
- advisors genéricos para RPCs `SECURITY DEFINER` anônimas — as RPCs por token
  são intencionais, mas devem ser revisadas função a função.

## 11. Próximas ações obrigatórias

1. aplicar o patch ou a fonte V8 em branch do GitHub, sem force-push;
2. usar registry íntegro e executar `npm ci`, build, typecheck, smoke, contraste
   e audit;
3. criar deploy de preview Netlify a partir dessa branch;
4. executar E2E remoto: salvar/recarregar/compartilhar/submeter, admin, status,
   Pré-importação, Pós-importação e laudos;
5. conferir rotas e headers;
6. promover produção somente após o preview;
7. tratar `external_cache` e advisors legados em ciclo separado.

## 12. Comandos de retomada

```bash
cd frontend
npm ci
npm run build
npm run typecheck
npm run smoke:all
npm audit --omit=dev

cd ..
node tools/run-intake-tests.js
node tools/run-similarity-tests.js
python3 tools/run-importa-v8-browser-tests.py
```

Depois de publicar os commits e confirmar os secrets, crie um workflow manual
protegido para redeploy das Edges. Não adicione o arquivo antes de validar
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` e o environment de produção.

## 13. Regressões que não podem voltar

- similaridade nunca sobrescreve dado original;
- FCK conflitante não escolhe traço;
- Flow não cria Slump;
- volume sem autorização fica pendente;
- token de draft não volta em payload;
- `anon` não recupera acesso tabular direto;
- auditoria permanece append-only;
- `service_role` nunca entra no frontend;
- Vuex 4 permanece a store oficial;
- `publish` do Netlify permanece `frontend/dist`;
- protótipo histórico não volta à raiz/publicação;
- migrations aplicadas não são reescritas.

## 14. Decisões de arquitetura e o que não fazer

- evoluir o Copilot existente, sem reescrever `SheetReader`, `HeaderEngine`,
  `WorkbookProfiler`, `ColumnProfiler`, `IntakeBridge` ou a Pós-importação;
- manter similaridade local e determinística; IA continua opcional para
  ambiguidades agregadas;
- manter a aba `Importação` limpa e registrar auditoria em `Proveniência`;
- tratar catálogos como referência opcional, preservando texto do cliente quando
  não houver match seguro;
- usar migrations aditivas; a 023 corrige a 022 sem reescrever histórico;
- manter Vuex 4; não embarcar store alternativa para contornar registry;
- tratar `xlsxStyleLite` como writer focado, não como SheetJS completo;
- não criar workflow sem secrets confirmados;
- não publicar frontend sem build oficial e preview;
- não abrir RLS de `external_cache` sem mapear consumidores;
- não disparar ticket/e-mail real como teste em produção.

## 15. Pendências priorizadas

### P0 — antes de produção

1. restaurar registry npm e executar todos os gates oficiais;
2. integrar a V8 em branch/PR no GitHub;
3. gerar preview Netlify e validar rotas, console e headers;
4. executar E2E remoto com destinatários controlados.

### P1 — segurança/operação

1. definir RLS de `public.external_cache` após mapear consumidores;
2. ativar leaked-password protection;
3. investigar as regras de header ausentes no deploy atual;
4. configurar workflow de Edges somente após cadastrar secrets.

### P2 — dívida legada

1. revisar cinco views security-definer de outros módulos;
2. fixar `search_path` das funções legadas indicadas pelo linter;
3. adicionar o self-test do writer XLSX ao CI quando npm voltar.

## 16. Armadilhas conhecidas

- `frontend/package.json` usa `"type":"module"`; UMD/CJS exige carga explícita;
- o Copilot ativo é `frontend/public/importa.html`; o antigo está em
  `prototype/v06/importa.html`;
- Netlify usa `base="frontend"` e `publish="dist"`; nunca publique a raiz;
- migrations 016–023 já estão aplicadas; não edite arquivos registrados;
- Edges V8 já estão ativas; não faça redeploy de fonte anterior;
- o deploy de produção ainda é V7, embora banco e Edges estejam em V8;
- token de draft deve permanecer no fragmento/localStorage, nunca em log;
- o FAIL do smoke por workflow ausente é deliberadamente visível.

## 17. Como retomar em 5 passos

1. Extraia o ZIP completo V8 ou aplique `V8-v5.22.45.patch` sobre `f663bc9`
   usando `git am`.
2. Em registry íntegro, execute `npm ci`, build, typecheck, contraste, smoke e
   audit; não avance com falha nova.
3. Confirme migrations 016–023 e Edges ACTIVE v4/v1; não reaplique migration já
   registrada.
4. Publique branch/PR e gere preview Netlify mantendo `base=frontend` e
   `publish=dist`.
5. Faça o E2E controlado completo, valide headers e só então promova produção.
