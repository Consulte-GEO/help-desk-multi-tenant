# Help Desk M1-R4 — estado e evidências

**28/09/2026. Implementado e testado localmente. NÃO publicado, homologado ou operacional. M1 aberto.**

## Base
Remoto consultado: `b9481b9fabde2fd9c442e44099bc17608b59571a`, branch `codex/m1-reproducibilidade`. Incremento anterior: M1-R3, fonte `7ea5f2ff652f5a26e729e13400b7898a6a417350499cf268aab6d2afbe82196b`.

A recuperação usa bundle original, deltas do commit remoto já consultados e o overlay R3. O fingerprint da fonte executável/configuração/testes coincidiu exatamente com o R3 antes de implementar. O lock foi restaurado byte a byte do conteúdo upstream, validado pelo Git blob `8d971935c5eb0af71ebf6bc8d2c74801c1187dad`; não foi resolvido novamente nem substituído por lock sintético.

Fingerprint final: `5c5aaf8cf6d1e4c94bc735bd50ef1f2ab96233114dbe57f5ce4a3d15280c5151`. Commit local final e hashes do pacote ficam no manifesto externo, evitando autorreferência. História local recuperada NÃO equivale à história remota. README/AGENTS/docs04/05 atuais do GitHub não são substituídos por documentos históricos no patch.

## Resultados atuais
Caminhos de evidência relativos a `evidence/r4/`.

| Verificação | Resultado | Evidência |
|---|---|---|
| Recuperação da fonte R3 | Fingerprint coincide, lock coincide | 01-source-recovery.log |
| Baseline | 1.114/1.114 aprovados | 02-baseline.log |
| RED da correção | 16 falhas/2 aprovações, subprocessos com erro não tratado | 03-runtime-events-red.log |
| GREEN + regressões transacionais anteriores | 29/29 | 04-runtime-events-green.log |
| Regressão intermediária | 1.132/1.132 | 05-application-regression.log |
| RED do gate | 18 aprovados/1 falha esperada | 06-gate-red.log |
| GREEN com gate e transações anteriores | 30/30 | 07-gate-green.log |
| Migrations | 11 verificadas e preservadas; nenhum SQL executado | 08-migrations.log |
| Lock | Coerência aprovada, não comprova instalação | 09-lock.log |
| Instalação offline | Falhou ENOTCACHED; dependências não disponíveis | 10-install-offline.log |
| Auditoria | Falhou EAI_AGAIN no registry; sem parecer de vulnerabilidades atual | 11-audit.log |
| Typecheck padrão | Falhou por dependências/tipos locais ausentes | 12-typecheck-standard.log |
| PostgreSQL | **207 escritos: 191 principais+16 upgrade; 0 executados nesta rodada**; Docker ausente | 13-postgres.log |
| Typecheck suplementar | Saída 0 com compilador/tipos globais; não equivale ao ambiente do lock | 14-typecheck-supplemental.log |
| TLS local real | 6/6, testes herdados do R3 e incluídos na suíte Node | 15-tls-local.log |
| HTTP em memória | 35/35 | 16-browser.log |
| Browser | 0 checks aprovados; ERR_BLOCKED_BY_ADMINISTRATOR antes das asserções | 16-browser.log |
| Verify padrão | **1.133/1.133 Node**, depois exit 2 no typecheck | 17-verify-standard.log |
| Contratos | Estrutura das 18 operações aprovada; não conformidade OpenAPI integral | 18-contracts.log |
| Build | Frontend estático aprovado; sem novo bundle Functions | 19-build-static.log |
| Scan de segredos | Sem padrão reconhecido; heurístico, não pentest | 20-secret-scan.log |
| Gate | Reprovado; evidência anterior não aprova código novo | 21-homologation-check.log |
| Whitespace | Sem erro | 22-diff-check.log |
| Patches e recuperação da entrega | Ver manifesto, package-validation.json e log de aplicação final | package-validation.json / 23-final-package-tests.log |

A primeira tentativa do script auxiliar de empacotamento teve erro de sintaxe Python antes da execução; foi corrigida sem alterar o produto. Registro em `24-package-tool-first-attempt.txt`. As duas aplicações limpas seguintes foram verificadas, e a suíte cumulativa aprovou novamente 1.133/1.133.

## Estados separados
IMPLEMENTADO: sim. TESTADO_LOCALMENTE: 1.133 testes, 19 novos sobre R3. TLS_TRANSPORTE_LOCAL_REAL: 6, subset dos 1.133. HTTP_MEMÓRIA: 35. SQL_ESCRITO: 207. SQL_EXECUTADO_NESTA_RODADA: 0. BROWSER_APROVADO_NESTA_RODADA: 0. DEPLOYADO_NESTA_RODADA: não. HOMOLOGADO: não. OPERACIONAL: não.

A base remota tem evidência histórica de 1.045/201/71 em CI e configuração do destino. Esses fatos não são apagados nem transferidos automaticamente ao código R4. Os 19 casos novos usam a lógica transacional real e fronteira SQL sintética; não são 19 testes de banco. As strings PRIVATE_TRANSACTION_SENTINEL nos logs RED são dados sintéticos deliberados, nunca credenciais reais.

## Revisão e riscos
Revisão local pelo mesmo executor; não houve revisor independente. A mudança foi limitada ao uso do cliente de transação e a seus testes. Eventos em diferentes fases, preservação de erros comuns, identidade por conexão, callbacks não repetidos, listeners alheios e rejeição de referências antigas foram revistos. Suíte anterior e novas regressões passaram localmente.

Ainda falta executar com driver do lock/PostgreSQL/TLS reais, comprovar descarte/reuso/interrupção e os 207 casos, completar navegador e ambiente de dependências, testar dentro da Function e com Auth/M2M reais, carga/abuso, restauração, revisão independente e governança. Exceções síncronas de release não foram redesenhadas. Nenhuma política de rede ou navegador foi contornada.

## Efeitos externos
Somente leitura do GitHub nesta rodada. Sem push, PR, merge, deploy, migration remota, conexão ao Supabase, alteração de dados, usuários, senhas, MFA, segredos, buckets ou recursos pagos. `HELPDESK_RELEASE_APPROVED` permanece intocado. M2 não iniciado.
