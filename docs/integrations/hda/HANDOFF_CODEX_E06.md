# Handoff para o Codex — E06 cumulativa

**Épico HD-DA-CADASTROS · 14/10/2026 · integração local, não liberação de automação.**

## Entrada e limites

Leia 00_LEIA_PRIMEIRO.md, EXECUCAO_E06.md, REVISAO_E06.md, PLANO_ATUALIZADO_E06.md e o plano V2. Reinspecione AGENTS.md, PROJECT_HELP_DESK.md, docs de arquitetura/segurança e o estado mais recente do repositório. Base consultada: `ea7a4454f30c45f35dece6e4a702591c55c79cd5`, principal `codex/m1-reproducibilidade`, PR43. Não presumir que ainda seja o HEAD.

Não fazer push/merge/deploy, mudança de banco/Auth/grants/segredos ou executar Claude/serviços pagos como consequência implícita da aplicação do patch. A decisão operacional é separada. Não publicar fixture de cliente sintético.

## Seleção de patch

- Sem os arquivos HDA: `patches/HDA_E01_A_E06_CUMULATIVO.patch`.
- Com E05 exata: `patches/HDA_E06_DELTA_SOBRE_E05.patch`.
- Com uma versão intermediária/divergente: comparar `ALTERACOES_E06.json`, hashes e arquivos; não forçar aplicação, não reaplicar E01 por cima e não apagar alterações concorrentes.

Aplicar apenas um. `repo/` contém o overlay. **Não substituir package.json, tsconfig.json, node_modules, transaction.ts, operations-ui.js ou tokens com cópias de `verificacao/context/`.** Essas cópias existem exclusivamente para reproduzir os testes focados deste pacote.

```sh
git status --short
git switch -c work/hda-e06-integration
git apply --check /caminho/do/pacote/patches/HDA_E06_DELTA_SOBRE_E05.patch
git apply /caminho/do/pacote/patches/HDA_E06_DELTA_SOBRE_E05.patch
npm ci --ignore-scripts
npm test
npm run typecheck
npm run check:contracts
npm run check:migrations
npm run check:consultegeo-upgrade
npm run check:secrets
npm run build
```

O exemplo mostra o delta; trocar explicitamente pelo cumulativo quando a árvore não tiver HDA. Manter o lock canônico e seus checks/audit. A contagem da suíte total do repositório será diferente dos 452 testes do subconjunto.

## Prova nativa obrigatória

O runner entregue em etapas anteriores é `scripts/test-registration-db-native.mjs`. Primeiro consultar sua documentação e seus pré-requisitos, sem apontar ambiente hospedado. Ele exige Linux não-root, instalação canônica, pg 8.16.3, binários PG17 e banco/cluster próprios. Executar o SQL candidato somente pelo caminho descartável. Preparar depois a prova sobre cadeia completa e driver real para o serviço E05. `supabase/candidates/hda02_analysis_persistence.sql` não é instalador de produção.

## Consulta visual nova

Arquivos de produto: `src/application/registration-drafts.ts`, `shared/registration-review.{js,d.ts}`, `web/registration-review-state.js`, `web/registration-automation.{js,css}`. Reutilizam `web/operations-ui.js`, `web/operations-experience.css` e `web/design-tokens.css` canônicos. A fábrica é opcional, não está em web/app.js nem no build publicado.

A autorização do público pertence ao servidor. Não criar um endpoint que aceite `audience=internal` livremente. Não entregar ledger/RegistrationState integral ao navegador. A porta `read` só recebe a projeção validada, com no-store e prazo curto. O host deve abortar o sinal em logout, troca de contexto ou perda de acesso conhecida.

Teste offline de DOM, no checkout com TypeScript e Playwright/Chromium disponíveis:

```sh
python tests/browser-registration-automation.py
```

`HDA_CHROMIUM` pode indicar o Chromium local e `HDA_BROWSER_EVIDENCE` um diretório privado de evidências. O teste resolve `typescript` do projeto; `HDA_TYPESCRIPT_PATH` é uma opção de tooling local, não configuração do produto. Não é necessário desativar políticas de navegação. O teste não faz navegação HTTP; para liberar montagem, acrescentar/reexecutar o fluxo autenticado nos runners oficiais.

## Correção do processador

Revisar `registration-analysis-worker.ts`: `runOnce` deixa de esperar indefinidamente por um analisador que ignora cancelamento, mas mantém a instância ocupada até ele realmente terminar. Se não terminar, reinício depende do supervisor qualificado; não limpar a flag busy para forçar nova execução. Retorno tardio não cria rascunho.

## Critérios para fechar esta integração

A árvore completa deve passar regressão, tipos com versões do lock, contratos, migrations, build e revisão independente. HDA-02 só pode ser concluída com SQL real e prova de cadeia completa. HDA-06 continua parcial mesmo com DOM verde: ainda faltam endpoint autorizado, histórico/edição e jornada real. Aprovação e escrita no Novo GEO continuam fora deste pacote. Atualizar os documentos mestres com os resultados efetivos, sem reutilizar fingerprint de homologação antigo para código novo.
