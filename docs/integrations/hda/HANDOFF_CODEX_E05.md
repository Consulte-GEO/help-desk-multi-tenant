# Handoff CODEX — E05 cumulativa

## Escopo

Integre a composição transacional e a consulta de recibos de análise sobre a fonte corrente. Última principal observada: `ea7a4454f30c45f35dece6e4a702591c55c79cd5`. Leia AGENTS.md, PROJECT_HELP_DESK.md e checkpoints recentes; preserve PR43/diagnósticos/transportes e mudanças posteriores. Nenhuma autorização de publicação, escrita na origem ou alteração hospedada vem deste arquivo.

## Aplicação

Use apenas UM patch:

- Sem HDA integrado: `patches/HDA_E01_E02_E03_E04_E05_CUMULATIVO.patch`.
- Com E04 idêntica: `patches/HDA_E05_DELTA_SOBRE_E04.patch`.

Verifique árvore limpa/isolada e execute `git apply --check` antes de aplicar. Havendo arquivos concorrentes, compare/reconcilie; não use reset/force ou cópia de árvore por cima. `repo/` é overlay, não checkout.

**Nunca copie `verificacao/context/` para o repositório real.** Seus package.json/tsconfig e arquivos de core existem somente para testar o subconjunto. Os arquivos canônicos equivalentes permanecem os do repositório. Não distribuir node_modules, binários ou segredos.

## Testes na árvore completa

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

O runner usa `HDA_PG_BINDIR` quando os binários não estão no PATH. Rodar sob usuário não-root. Remover somente da execução isolada configurações externas de banco herdadas; nunca substituir por uma DSN de produção nem enfraquecer a recusa do runner. Ele cria e remove o próprio cluster e nunca aceita banco existente. O resultado positivo do candidato ainda exige uma segunda prova sobre as migrations históricas completas.

## Montagem depois da qualificação

`createPostgresRegistrationTransactions({pool, identity})` é o owner concreto da porta E04. O pool é fornecido pelo host após qualificação; o ator e binding são privados do servidor. Não usar `postgres`, service_role ou o pool HTTP humano como pool da CLI. O candidato prevê `helpdesk_registration_worker` para o analisador, com seu principal de integração e concessões próprias. A validação dessas identidades continua sendo tarefa real de banco/host.

O owner usa o core `runTransaction` sem copiá-lo/modificá-lo, fixa o escopo inteiro, acompanha operações completas, invalida erros obrigatórios engolidos, consome prazos por relógio monotônico e só resolve depois de COMMIT confirmado. Não adicionar verificação tardia que transforme uma confirmação recebida em recusa fictícia.

`createPostgresRegistrationAnalysisService` em `workers/dev-agent-bridge/service.ts` reúne owner, worker e leitor. Recebe `analysisEnabled`, `receiptReadEnabled`, runner e leitor editorial opcionado conforme o contrato. Não cria HTTP, cron, processo permanente ou flags. Encerramento de pool pertence ao host.

`readReceipt` recebe a chave original, finalidade original e hashes/ID esperados quando conhecidos. Retorno `recorded` não aprova cadastro; `not_observed` não permite reenviar. Todas as respostas incluem `dispatchAllowed:false` e `automaticRetryAllowed:false`. Não transformar leitura em complete/fail compensatório. Para resultado de análise incerto, reutilizar `settlementCommandId` e `settlementPermission` do worker E04. Falta de finalidade conhecida deve permanecer pendência; não adivinhar comando.

## Cautelas de integração

As flags separadas não sobrepõem autorização. A consulta atual usa a permissão da finalidade original; chamado fechado/credencial revogada pode impedir a consulta conforme SQL. Uma capacidade distinta de recuperação administrativa exige desenho e testes novos, não concessão ad hoc.

Ainda faltam PG17, cadeia histórica, build/regressão completos, qualificação de pool/TLS/binding, Claude real, API/IdP, interface e piloto. Os testes novos usam driver simulado, não provam segurança do SQL. Autorrevisão realizada; revisão independente pendente.

## Saída esperada

Evidências reais da fonte integrada, status dos gates sem inferência e pacote cumulativo atualizado. Fechar HDA-02 antes de acoplar HDA-03 à abertura. Não recontar os 407 testes locais como 81 aceites completos ou declarar HDA operacional por haver biblioteca pronta.
