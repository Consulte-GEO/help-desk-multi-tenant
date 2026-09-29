# Help Desk M1-R6 — estado e evidências

**Referência local: 28/09/2026, America/Sao_Paulo. Logs em UTC, inclusive 29/09. Implementado e testado localmente. Não deployado, homologado ou operacional. M1 aberto.**

## Base
R5 recuperado diretamente do bundle entregue, commit `b0a544d53f5978aa75170a0827315d4d623e7f5c`, em pasta nova e branch `work/m1-r6-validacao-real`. SHA256 do ZIP R5 conferido: `7bf435a2e646e34d0e7a62c29220be343e6c3aea94101f54a150eb25751970ab`. Base remota lida: `b9481b9fabde2fd9c442e44099bc17608b59571a` em `codex/m1-reproducibilidade`. O commit final e o fingerprint estão no manifesto externo da entrega. A história do bundle é local recuperada, não a história completa upstream.

## O que mudou
Contenção da exceção de liberação da conexão para preservar o resultado transacional já decidido, marcação lógica de conexão inválida e diagnóstico fechado. Quatorze testes Node novos e dois PostgreSQL escritos. Sem migration, grant, endpoint, dependência, configuração de runtime ou funcionalidade M2.

## Resultados desta rodada
Evidências em `evidence/r6/`; comandos e saídas efetivas em `commands.json` e arquivos `.log`.

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline R5 | 1.163/1.163 aprovados | 01-baseline.log |
| RED focal | 14 falhas: reprodução dos resultados substituídos/erro bruto, evento ausente e mínimo antigo do gate | 02-release-red.log |
| GREEN focal | 14/14 aprovados | 03-release-green.log |
| Regressão de aplicação | **1.177/1.177**, zero falhas/cancelamentos/skips/TODO | 04-application.log; 16-verify.log |
| Lock | Coerência aprovada, arquivo preservado | 05-lock.log |
| Migrations | 11 arquivos preservados; não executa SQL | 06-migrations.log |
| npm ci | Não concluído; tentativa interrompida após limite externo de 25 s mais encerramento do processo | 07-install.log; commands.json |
| npm audit | Log registrou EAI_AGAIN no endpoint oficial; wrapper foi interrompido antes de registrar exit code | 08-audit.log; commands.json |
| PostgreSQL | Docker ausente, **0 testes executados nesta rodada** | 09-postgres.log |
| TypeScript padrão | Exit 2, definições locais node/pg ausentes | 10-typecheck.log |
| OpenAPI | Verificação estrutural aprovada | 11-contracts.log |
| Build | Somente frontend estático aprovado; sem bundle novo de Functions | 12-build.log |
| Scan | Nenhum padrão reconhecido; heurístico, não pentest | 13-secrets.log |
| HTTP/browser | 35 HTTP com memória aprovados; browser bloqueado por ERR_BLOCKED_BY_ADMINISTRATOR | 14-browser.log |
| Gate | Não aprovado; não reaproveitar aprovação da base para código novo | 15-gate.log |
| Verify | Aplicação1177 passou; falhou no TypeScript | 16-verify.log |
| TLS | 6 testes reais em loopback aprovados, já incluídos nos1177 | 17-tls.log |
| Pacote | Conferências before/after, hashes, patches e recuperação em cópia limpa | package-validation.json e logs do empacotamento |

O timeout de instalação é limite da tentativa nesta sessão, não alteração dos timeouts do produto. A tentativa de streaming do executor local foi recusada antes de executar qualquer comando e foi substituída por execuções síncronas. Tentativas de baixar o pacote pg no registry oficial e fonte PostgreSQL17.6 no FTP oficial não forneceram arquivos. Nenhuma política de rede/navegador, DNS ou registry foi modificada. Não houve PostgreSQL alternativo nem reaproveitamento de banco remoto.

## Distinção dos estados
IMPLEMENTADO: sim. TESTADO_LOCALMENTE:1177. TLS_TRANSPORTE_LOCAL_REAL:6 incluídos. HTTP_MEMÓRIA:35. SQL_ESCRITO:209, sendo193 principais+16upgrade. SQL_EXECUTADO_NESTA_RODADA:0. BROWSER_APROVADO_NESTA_RODADA:0. DEPLOYADO_NESTA_RODADA:não. HOMOLOGADO:não. OPERACIONAL:não. Instalação, audit, typecheck padrão e gate não aprovados. Nenhuma checagem global é apresentada como substituição.

A evidência CI de1045/201/71 na base remota é histórica e não aprova R2–R6. A nova suíte local não comprova descarte/rollback físico, Auth real, a Function hospedada, capacidade, backup/restore ou operação.

## Revisão e riscos
Revisão pelo próprio executor, sem revisão independente. A revisão da fixture SQL corrigiu a comparação do indicador `replayed`: ele muda entre criação e recuperação; o ticket deve permanecer igual. Esse ajuste foi anterior a qualquer execução SQL e não é reportado como teste aprovado. Proteção lógica após falha de release não comprova descarte físico; cliente retido pode consumir capacidade do pool. Telemetria é melhor esforço e pode não chegar ao destino. Esses limites permanecem bloqueadores operacionais, não são ocultados por uma resposta de escrita confirmada.

## Efeitos externos
Somente leituras do GitHub/documentação e tentativas de obtenção de dependências/fontes oficiais. Sem push, PR, merge, deploy, SQL remoto, criação de usuário, MFA, secrets, buckets, flags de liberação ou infraestrutura paga.
