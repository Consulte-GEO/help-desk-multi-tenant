# Help Desk M1-R15 — Estado e evidências

**Data:** 01/10/2026. **Entrega local, M1 aberto. Não publicada, homologada ou operacional.**
Base remota observada: `78bbb00112331531168ae24600604cb7f3148770` (R9). Base local funcional: R14, fingerprint `722e5bb449cd4844f7b08d224a60bcf57367f39b4f2032ccb5b9730cae59b101`.
O commit local e o fingerprint final constam no manifesto externo. A história local recuperada não é a história completa upstream.

## Entrega
Extensão do cliente existente `scripts/hosted-write-acceptance-core.ts`, novo exemplo opt-in e 17 testes em `tests/m1-hosted-machine-write.test.ts`. Sem novo comando, endpoint, dependência, tabela ou migration. Compatibilidade API/interface0.19.0/schema0.18.0. Onze migrations/lockfile preservados.

A configuração opcional `includeMachineWrites:true` altera o hash da confirmação e acrescenta21 passos M2M às18 verificações humanas. O plano antigo não ganha mutações. Os28 controles prévios R10 permanecem. Identidade, escopo e cobertura da integração são conferidos antes de gravar, inclusive antes da gravação humana. Chaves M2M têm namespace separado e são estáveis por executionId.

Criação/mensagem/replay/conflitos da integração, ator integration, versão1→2/normal, unicidade no recorte consultado, recusas de conta/produto e de privilégios de atendente e recusas entre dois autores da mesma conta. Não há exclusão automática ou retry de erro. Relatórios não contêm tokens/corpos sensíveis; resultado HTTP não atesta atomicidade SQL/outbox entregue.

## Verificações desta rodada
Caminhos abaixo relativos a `evidence/m1-r15/`.

| Verificação | Resultado e alcance | Evidência |
|---|---|---|
| Baseline R14 | 1.347 testes aprovados | 01-baseline.log |
| RED inicial | 12 falhas / 5 controles aprovados, antes da extensão | 02-red.log |
| Primeira implementação | 12/17; erro de expectativa do novo cliente em conta/produto | 03-first-green.log |
| Focal após ajuste | 17/17 aprovados; zero skips | 04-green.log;21-focused-final.log |
| Suíte completa | 1.364/1.364, zero falhas/cancelamentos/skips/TODO | 05-full-tests.log;20-verify-final.log |
| Integração limpa do pacote | 1.364 testes aprovados após aplicar o patch cumulativo em cópia limpa; ambas as variantes conferidas por bytes/fingerprint | 22-clean-integration-tests.log;integration-verification.json |
| Novo percurso HTTP | 28 controles+39 passos passaram com handler real, memória e identidades sintéticas; inclui1 teste de socket HTTP loopback | 21-focused-final.log |
| TLS loopback herdado | 6 casos incluídos na suíte; não PostgreSQL/TLS hospedado | 20-verify-final.log |
| Instalação oficial | Não aprovada: npm ci interrompido (timeout/exit124), sem registry alternativo ou lock sintético | 06-install.log;06-install.exit;environment.json |
| Audit | Não aprovado: EAI_AGAIN registry.npmjs.org; a chamada externa que agrupou os comandos excedeu prazo e não capturou exit final da auditoria | 07-audit.log;environment.json |
| TypeScript padrão | Exit2: tipos locais node/pg ausentes | 08-typecheck.log;20-verify-final.log |
| TypeScript suplementar | TS18046 reproduzido na checagem do array de scopes; corrigido com referência local estreitada; saída0 | 09-typecheck-supplemental.log;10-typecheck-supplemental-fixed.log |
| PostgreSQL | 209 cenários existentes, ZERO executados nesta rodada; Docker ausente | 11-postgres.log |
| Migrations | 11 arquivos íntegros; nenhuma execução SQL | 12-migrations.log |
| Lock | Coerência aprovada, bytes preservados | 13-lock.log |
| Contratos | Estrutura das18 operações aprovada; não conformidade OpenAPI integral | 14-contracts.log |
| Build | Frontend estático aprovado, não empacotamento da Function | 15-build.log |
| Segredos | Scan heurístico sem padrão reconhecido, não pentest/auditoria integral | 16-secrets.log |
| Interface | 35HTTP memória aprovados; navegador bloqueado em page.goto com ERR_BLOCKED_BY_ADMINISTRATOR, zero checks browser aprovados | 17-interface.log |
| Gate | Não aprovado; `verify` também parou no typecheck padrão | 18-release-gate.log;20-verify-final.log |
| Exemplo CLI | Plano sem rede/token: planned/none,28+39, flagsfalse | 19-machine-plan.json |

A checagem suplementar utilizou TypeScript5.8.3 e tipos globais Node25.1.0; NÃO é a toolchain travada Node22.15.30 nem npm ci aprovado. Os passos de aceitação não são somados à contagem1364 nem classificados como testes SQL.

## Revisão e falhas preservadas
O contrato canônico `deny()` oculta conta/produto não autorizados com404/resource_not_found. A primeira implementação do cliente esperava403 nesses dois cenários e falhou. Corrigido o cliente para exigir404/códigoexato, SEM alterar permissões, core ou SQL e sem aceitar qualquer recusa como sucesso. Nota/prioridade continuam exigindo403/forbidden. Duas autorias na mesma conta não compartilham automaticamente acesso.

A revisão confirmou adesão explícita, hash antigo recusado antes da rede, pré-condições antes de mutações, namespace de chaves distinto, perda da resposta de criação/mensagem interrompendo a rodada, nova invocação deliberada com as mesmas chaves sem duplicação na memória, recibo adulterado recusado, actor_type correto, coleções incompletas recusadas, versões e contagem de efeitos intactas após recusas. Não há revisão independente nesta rodada.

## Fronteiras de evidência
IMPLEMENTADO e TESTADO_LOCALMENTE: sim. SQL_ESCRITO:209 existentes. SQL_EXECUTADO nesta rodada:0. BROWSER_EXECUTADO com aprovação:0. DEPLOYADO/HOMOLOGADO/OPERACIONAL deste incremento:não.
Não acessamos banco remoto, não executamos os clientes contra produção ou Auth real, não lemos segredos, nem fizemos push/PR/merge/deploy/migrations/mutações externas. Capacidade, concorrência hospedada, restore, efeitos PostgreSQL e aprovação operacional permanecem pendentes.
