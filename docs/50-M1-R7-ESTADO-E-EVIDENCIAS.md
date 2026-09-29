# Help Desk M1-R7 — estado e evidências

Referência local: 28/09/2026, America/Sao_Paulo. Logs UTC em 29/09/2026. **Implementado e testado localmente; não deployado, homologado ou operacional. M1 aberto.**

## Base
R6 recuperado em pasta nova do bundle entregue, commit `5aedc4885b9e6edeb3bb7ca47b0fc397c366701f`. ZIP de entrada SHA256 `08196ad810c277968d1ac9f1f089dc740c809716815f84c2d5dd1167067435c7`. Branch local `work/m1-r7-validacao`. GitHub consultado: `codex/m1-reproducibilidade`, commit `b9481b9fabde2fd9c442e44099bc17608b59571a`. A recuperação local não é a história completa upstream. Commit e fingerprint finais constam no manifesto externo, evitando autorreferência.

## Mudanças
Workflow com fonte isolada sem evidências históricas; execução independente de aplicação/PostgreSQL quando preparo de browser falha; interface permanece bloqueadora; upload da tentativa separado por SHA/run/attempt. Não há mudança em src, migrations, grants, dependências, configuração de produção ou domínio do produto. Ler docs49 para escopo e limitações.

## Resultados executados
Logs relativos a `evidence/r7/`; comandos, horários e exit codes em `commands.json`.

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline R6 | 1177/1177 aprovados | 01-baseline.log |
| RED inicial | 12 falhas: estágio ausente e comportamento antigo de orquestração/workflow | 02-ci-red.log |
| GREEN inicial | 12/12 aprovados | 03-ci-green.log |
| Regressão intermediária | 1189/1189 aprovados | 04-application.log |
| Revisão RED | 2 falhas reais: colisão do archive e destino resolvido com quebra de linha; 12 passaram | 09-review-red.log |
| Revisão GREEN | 14/14 aprovados | 10-review-green.log |
| Primeira regressão no checkout |1191/1191 aprovados |18-final-tests.log |
| Fonte isolada antes do ajuste das fixtures |1189/1191; dois sentinelas dependiam de manifests em evidence/ |22-staged-tests.log |
| Fixture como fonte — RED/GREEN | Uma nova asserção falhou por arquivo ausente;29testes focais passaram após preservar as referências |23-fixture-red.log;24-fixture-green.log |
| Suíte final com referências preservadas |**1192/1192**, zero falhas/cancelamentos/skips/TODO |25-application-fixtures.log |
| TLS real em loopback | 6/6, já incluídos nos1192 | 20-tls.log |
| HTTP em memória | 35 aprovados antes de falhar no browser | 16-browser.log |
| PostgreSQL | Runner recusou Docker ausente; **0 executados** nesta rodada;209 escritos herdados | 11-postgres.log |
| Browser | ERR_BLOCKED_BY_ADMINISTRATOR;0 checks aprovados nesta rodada | 16-browser.log |
| npm ci offline | Exit1/ENOTCACHED; dependências não instaladas | 07-install-offline.log |
| npm audit oficial | Exit1/EAI_AGAIN; nenhuma aprovação de auditoria | 08-audit.log |
| Lock e migrations | Coerência/integridade aprovadas; onze SQL byte a byte preservados | 05-lock.log;06-migrations.log;21-compatibility.json |
| TypeScript padrão | Exit2, tipos/dependências locais ausentes e diagnósticos decorrentes; não aprovado | 12-typecheck.log |
| Verify final | Aplicação1192 passou; comando terminou exit2 no TypeScript |28-final-verify.log (primeira tentativa em19-verify.log) |
| Contratos/build | Estrutura18operações aprovada; somente frontend estático | 13-contracts.log;14-build.log |
| Scan de segredos | Heurístico sem padrões reconhecidos; não auditoria integral | 15-secrets.log |
| YAML/sintaxe | Verificações locais aprovadas; não são execução do workflow remoto | 21-compatibility.json |
| Gate | Não aprovado na fonte final |29-final-gate.log |
| Fonte isolada corrigida |1192/1192 aprovados; só recibo novo na pasta evidence |26-staged-final-tests.log;27-staging-rehearsal.json |
| Preservação de inputs |Onze migrations/lock intactos;duas fixtures iguais aos originais |30-final-integrity.json |

A tentativa de rede ao registry e ao FTP oficial de PostgreSQL falhou na resolução DNS. Não foram alterados DNS, registry, política de rede ou navegador. A instalação offline foi uma tentativa limitada ao cache existente, não substitui npm ci reproduzível no CI. Não houve verificação suplementar global apresentada como instalação válida.

## Evidência versus operação
IMPLEMENTADO: sim. TESTADO_LOCALMENTE:1192. SQL_ESCRITO:209. SQL_EXECUTADO_NESTA_RODADA:0. BROWSER_APROVADO_NESTA_RODADA:0. DEPLOYADO_NESTA_RODADA:não. HOMOLOGADO:não. OPERACIONAL:não. CI_REMOTO_EXECUTADO_NESTA_RODADA:não.

Os testes de Git/tar e TLS são reais locais. Os testes da orquestração usam executor sintético; não comprovam209cenários de banco. A aprovação histórica1045/201/71 registrada no remoto não foi transferida para R2–R7. Um recibo source.json ou um artefato contendo apenas preparo não libera produção.

## Revisão e efeitos externos
Revisão pelo próprio executor, sem revisor independente. As falhas da revisão e os dois sentinelas dependentes de evidence/ foram reproduzidos antes da correção. Os manifests-base foram copiados byte a byte para fixtures versionadas; nenhuma assertion ou migration histórica foi alterada para aceitar resultado diferente. Não houve mudança no código de atendimento, descarte físico de conexões, idempotência, contratos ou snapshots. Leituras GitHub e documentação; nenhuma escrita remota, push, PR, merge, deploy, migration, alteração de dados/usuários/MFA/segredos/buckets ou flag de liberação.

O resultado da extração CLI da fonte real, os checks de integração e os testes posteriores ao commit acompanham o manifesto externo e o relatório de pacote; não se reescrevem hashes para adaptar relatórios antigos.

A verificação de whitespace acusou espaços nos logs TAP brutos de testes históricos. Os logs foram preservados; não foram normalizados para ocultar a ocorrência. O diff de código/documentação é verificado separadamente do histórico de saída.
