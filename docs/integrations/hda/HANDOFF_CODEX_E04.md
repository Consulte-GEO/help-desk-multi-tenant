# Handoff CODEX — E04 cumulativa

## Objetivo

Integrar a E04 sem alterar o atendimento publicado e fechar a qualificação de banco/host antes da ativação. Ler AGENTS.md, PROJECT_HELP_DESK.md e checkpoints atuais. A principal observada é `164113065839f3f985404b6ec812da311b6ade1d`; reinspecionar antes de qualquer integração.

## Escolher exatamente um patch

- Sem HDA anterior integrado: `patches/HDA_E01_E02_E03_E04_CUMULATIVO.patch`.
- Com E03 idêntica já integrada: `patches/HDA_E04_DELTA_SOBRE_E03.patch`.
- Com alterações concorrentes: comparar por arquivo e reconciliar. Não usar reset/force ou copiar uma árvore inteira por cima.

Conferir `git status --short`, rodar `git apply --check` e só depois aplicar o patch escolhido. Os 62 arquivos da E03 foram preservados byte a byte; a E04 é aditiva. `repo/` é o overlay, **não** o checkout completo.

`verificacao/context/` é exclusivamente contexto mínimo de testes. Nunca substituir package.json, tsconfig.json ou arquivos do core real pelos arquivos dessa pasta. Não há dependências de terceiros, binários Claude/PostgreSQL ou credenciais no pacote.

## Gates da árvore integral (Linux, usuário sem root)

```sh
npm ci --ignore-scripts
npm run check:lock
npm test
npm run typecheck
npm run check:contracts
npm run check:migrations
npm run check:consultegeo-upgrade
npm run check:secrets
npm run build
npm audit --audit-level=high
python scripts/verify-hda-canonical-vectors.py
node scripts/test-registration-db-native.mjs --plan
node --experimental-strip-types scripts/test-registration-db-native.mjs --execute
```

Não apontar o runner nativo para Supabase. Usar os binários PG17 locais e a dependência pg do lock. O core mínimo da fixture não comprova a cadeia histórica; qualificar também a composição real em cluster descartável. Depois produzir evidência completa da fonte atual com o processo de homologação existente. Nada de reaproveitar fingerprint de outra entrega.

## Interfaces da E04

`createRegistrationAnalysisWorker({identity,transactions,runner,enabled,readKnowledge?})` expõe `runOnce(claimCommandId, signal?)`. Sem scheduler e sem listener HTTP. A chave de claim deve vir da fila/serviço autenticado, não do solicitante. Repetição deliberada usa a mesma chave; o retorno `replay_no_launch` jamais aciona novamente o modelo.

`RegistrationAnalysisTransactions.run(scope, work, admission)` deve usar uma transação real com identity imutável, guard de admissão antes/depois das consultas e antes de COMMIT, store criado sobre a conexão emprestada e rejeição transacional obrigatória. **Só retornar depois da confirmação real do COMMIT.** Os testes de memória mostram o contrato, não fornecem implementação de produção. Nunca adotar `transactionModel` como fallback.

`createClaudeAnalysisRunner(config, credentials)` é a porta de subprocesso. Configurar o caminho canônico do binário, SHA256, versão exata, agentVersionRef, modelo explícito, orçamento e timeout. O adaptador usa flags fixas e recusa versão/hash divergentes; não tenta novamente retirando flags de segurança. Não carregar a configuração de terminal do operador. A versão candidata exige comportamento bare documentado para a família 2.1.286+; outras famílias precisam de qualificação.

A credencial entregue ao subprocesso é somente `ANTHROPIC_API_KEY`, obtida por resolvedor privado. Não expor o resolvedor ou o objeto de configuração à API pública. A chave do modelo não deve compartilhar capacidades com banco, API do GEO, email ou aprovação. Não aproveitar tokens de usuário guardados na fila.

`readKnowledge` só devolve documentos já autorizados editorialmente e ligados aos hashes da tarefa. O parser compara bytes UTF-8 exatos; não normaliza quebras/Unicode silenciosamente. Não seguir URLs de chamados. Anexos não qualificados resultam em revisão manual, sem IA.

## Recibos e falhas

- COMMIT desconhecido de claim: não invocar o modelo; consultar recibo com a mesma chave.
- COMMIT desconhecido da liquidação: usar `settlementCommandId` e `settlementPermission` retornados para consulta autorizada. Não enviar um fail compensatório nem chamar o modelo de novo.
- Recibo de outro contexto: recusado sem carregar seu operationId para o diagnóstico.
- Reserva expirada/revisão alterada/acesso revogado: descartar a saída. A recuperação continua pela fila e pelo contador já existente, sem reenvio imediato oculto.
- Desativação/cancelamento: mantém histórico e não significa desfazer cadastro; neste recorte nenhum cadastro é executado.
- Não afirmar revogação instantânea de informação já enviada ao modelo. Há revalidação nas fronteiras e suporte ao sinal do supervisor; vigilância contínua é qualificação do host.

## Revisão antes de ativar

Conferir flags reais da CLI, binário imutável, identidade Linux sem root, confinamento da rede/arquivos e ausência de credenciais herdadas. Shell false, diretório separado e grupo de processo não são um sandbox do SO. O runner não prova terminação de descendentes que escapem do grupo; o serviço precisa do confinamento apropriado. Windows nativo ainda não é suportado por esse supervisor; não mudar o host atual sem qualificação.

Preservar PR41/42, diagnósticos, Email Kit, callback, worker Resend e cadastros existentes. Não há autorização de push/merge/deploy, migration remota, configuração, convite ou cadastro de teste em produção nesta entrega.

## Saída esperada da próxima etapa

Diff reconciliado, logs reais da árvore integral/PG17, revisão independente, status de cada gate e ZIP cumulativo. Só chamar HDA-02/HDA-04 de operacional depois das provas específicas. Os 81 aceites de negócio não são encerrados pela contagem de testes Node.
