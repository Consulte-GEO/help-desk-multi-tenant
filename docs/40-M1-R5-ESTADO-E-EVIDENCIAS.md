# Help Desk M1-R5 — estado e evidências

**Data local: 28/09/2026 (America/Sao_Paulo). Logs registram UTC, inclusive 29/09. Implementado e testado localmente. M1 aberto. Não publicado, homologado ou operacional.**

## Base e recuperação
Remoto consultado nesta rodada: `b9481b9fabde2fd9c442e44099bc17608b59571a`, branch `codex/m1-reproducibilidade`. Último incremento local: R4, fingerprint `5c5aaf8cf6d1e4c94bc735bd50ef1f2ab96233114dbe57f5ce4a3d15280c5151`.

Recuperei os arquivos da entrega original, os deltas upstream já identificados e o overlay R4. Antes de implementar, o fingerprint R4 coincidiu exatamente e o baseline aprovou 1.133 testes. O lock foi transcrito da leitura upstream e aceito somente depois de coincidir byte a byte com o Git blob `8d971935c5eb0af71ebf6bc8d2c74801c1187dad`; não foi criado lock sintético nem trocada versão. Uma tentativa auxiliar de recuperar um delta parou por assertion de texto divergente no script Python; a correspondência foi corrigida e o fingerprint conferido antes do baseline. Isso não foi uma falha do produto.

A fonte recuperada e o bundle local NÃO reproduzem toda a história Git/documental remota. Os documentos históricos originais foram preservados; PROJECT_HELP_DESK.md e docs39–43 indicam o estado local atual. Não force-push nem substituição indiscriminada do checkout remoto. A evidência remota de 1.045/201/71 continua histórica e não aprova este código novo.

## Resultado atual
Evidências em `evidence/r5/`.

| Verificação | Resultado | Arquivo |
|---|---|---|
| Baseline R4 | 1.133/1.133 Node | 01-baseline.log |
| RED de funcionalidade ausente | 25 testes falharam; CLI ainda inexistente | 02-integration-red.log |
| Primeira implementação | 24/25; uma expectativa de ordem de rejeição incompatível | 03-integration-green.log |
| RED do gate | 29/30; mínimo antigo não abrangia a suíte nova | 04-gate-red.log |
| GREEN focal | 30/30 | 05-focused-green.log |
| Regressão completa | **1.163/1.163**, 30 novos; sem falhas/skips/cancelados/TODO | 06-application.log |
| Lock | Coerência aprovada; preservado | 07-lock.log |
| Migrations | 11 arquivos preservados; nenhum SQL executado | 08-migrations.log |
| npm ci | Não concluído; tentativa limitada a 25 s após indisponibilidade de rede; processo encerrado | 09-install.log |
| npm audit | Falhou EAI_AGAIN no registry oficial | 10-audit.log |
| PostgreSQL | 207 escritos, **0 executados nesta rodada**; Docker ausente | 11-postgres.log |
| TypeScript padrão | Exit 2; tipos node/pg ausentes | 12-typecheck.log |
| OpenAPI | Verificação estrutural aprovada, 18 operações | 13-contracts.log |
| Build | Somente frontend estático aprovado; sem novo bundle Functions | 14-build.log |
| Scan | Nenhum padrão reconhecido; heurístico, não auditoria completa | 15-secret-scan.log |
| Gate | Não aprovado; evidência anterior não aprova fonte nova | 16-gate.log |
| HTTP/browser | HTTP memória35 aprovado; browser0, ERR_BLOCKED_BY_ADMINISTRATOR | 17-browser.log |
| Verify padrão | Node1.163 passou; depois typecheck falhou | 18-verify.log |
| Pacote e restauração | Ver relatórios de aplicação, before/after, hashes e novo baseline em cópia limpa | package-validation.json; 19-recovered-tests.log |

A primeira implementação já recusava uma reaplicação, mas por `file_mismatch`, antes de `source_mismatch`. O teste foi corrigido para o erro específico real; a recusa não foi relaxada. O teste de conflito documental também foi ampliado para usar um documento fora das raízes do fingerprint.

## Estados e limites
IMPLEMENTADO: sim. TESTADO_LOCALMENTE:1.163. TLS_TRANSPORTE_LOCAL_REAL:6 herdados e incluídos nos1.163. HTTP_MEMÓRIA:35. SQL_ESCRITO:207 (191 principais+16upgrade); sem novos SQL nesta rodada. SQL_EXECUTADO_NESTA_RODADA:0. BROWSER_APROVADO_NESTA_RODADA:0. DEPLOYADO_NESTA_RODADA:não. HOMOLOGADO:não. OPERACIONAL:não. Sem checagem TypeScript suplementar usada como substituição nesta entrega.

Revisão local pelo mesmo executor, sem revisor independente. Trinta testes do novo verificador não são trinta testes de banco. Não houve mudança no núcleo transacional de R4, API/interface0.19.0, schema0.18.0, grants, migrations ou dependências. O mínimo Node do gate passou a1.163; SQL207 e HTTP/browser71 foram mantidos.

## Efeitos externos
Leitura do GitHub e documentação pública; tentativas de npm no registry oficial. Sem push, PR, merge, deploy, SQL remoto, alteração de usuários, segredos, MFA, buckets, flags de runtime ou infraestrutura paga. Não houve fallback para outro registry ou banco. M2 não iniciado.
