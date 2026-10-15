# Dev Agent Bridge — candidato HDA-04 / E04

Biblioteca de análise para serviço supervisionado separado. Sem HTTP, cron, autoexecução ou cadastro no GEO.

Leia `../../docs/integrations/hda/HDA04-analysis-worker.md` e o handoff E04 antes de compor o serviço. Exporte a factory `createClaudeAnalysisRunner` e forneça configuração privada e resolvedor de chave dedicada. Nunca instancie o runner diretamente na abertura do chamado ou dentro de uma transação.

A configuração exige `executablePath`, `executableSha256`, `cliVersion`, `agentVersionRef`, `modelId`, `maxBudgetUsd` e `timeoutMs`. São dados do operador do serviço, não campos do chamado. Confirme as flags no binário real e teste com dados sintéticos autorizados. O modo bare documentado utilizado não reaproveita o login OAuth da assinatura pessoal; a autenticação real é um gate HDA-00 pendente.

Este supervisor aceita Linux/WSL sob usuário sem root e usa grupo de processos. Não altera o host atual, não instala Claude, não cria infraestrutura e não inclui chave. Não é um sandbox; controles do SO e da rede são requisitos de implantação. O binário Node gerado pelos testes é somente fixture offline.

Os testes estão incluídos no `npm test` do repositório por `tests/*.test.ts`. Eles devem ser executados em Linux não-root. `workers/` não deve ser copiado para os assets públicos, e nenhum publish do frontend instala um serviço de worker automaticamente.
