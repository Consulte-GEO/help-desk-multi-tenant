# E05 — composição transacional e consulta de recibos da análise

**14/10/2026 · HD-DA-CADASTROS · HDA-02/HDA-04 parcialmente implementadas.**

## Escopo e autoridade

E05 liga o processador E04 ao `runTransaction` existente e permite consultar o recibo original de um comando. É uma biblioteca de servidor, não uma API HTTP, scheduler, migration ou ativação. Não confundir a recuperação de um recibo de **análise** com HDA-09, que tratará da execução real na origem.

A fonte observada do Help Desk foi `ea7a4454f30c45f35dece6e4a702591c55c79cd5`. Os quatro arquivos adicionais de contexto usados nos testes foram conferidos pelos respectivos hashes Git, incluindo o corpo integral de `src/infrastructure/transaction.ts`. Eles não pertencem ao overlay. Não houve clone integral, instalação por lock, execução PostgreSQL, leitura do banco hospedado ou chamada Claude.

## Interfaces entregues

`createPostgresRegistrationTransactions({pool, identity})` implementa `RegistrationAnalysisTransactions.run(scope, work, admission)`. `identity` possui exatamente `workspaceId`, `accountId`, `actorId` e `bindingId`; é resolução privada do servidor, nunca autoridade fornecida pelo solicitante. `pool` deve ser dedicado, previamente qualificado e ter o login exigido pelo candidato para o ator. A fábrica não cria pools, não recebe DSN e não concede privilégios. A ausência do candidato no banco causa recusa, não fallback em memória.

O escopo completo, inclusive finalidade, fica fixado em cada chamada. Alteração durante a espera ou tentativa de trocar o binding dentro do callback aborta. O mesmo cliente emprestado recebe o store e os guards `assertBorrowedTransactionIdentity` e `rejectTransactionValidation`. Não há BEGIN/COMMIT alternativo: o proprietário continua sendo o core existente.

Além das promessas SQL acompanhadas pelo core, a E05 acompanha a promessa completa de cada método do store. A transação drena operações em curso antes de liberar a conexão e recusa trabalho não aguardado. Um erro obrigatório engolido pelo callback ainda invalida a transação. O store retido depois do callback não consulta o banco e não pode invalidar uma transação posterior.

## Prazos e confirmação

A validade retornada pelo banco é convertida em orçamento relativo usando `performance.now()`, com início capturado **antes** da consulta. O tempo de transmissão e de espera consome a validade; nunca é acrescido ao prazo. A leitura de estado também reduz esse limite quando trouxer uma observação mais recente. Não se compara o relógio de parede do host ao relógio do banco.

Para conclusão/falha, o orçamento considera a reserva vigente observada na operação. Para nova reserva, considera o prazo da reserva proposta. O replay de um recibo histórico não ganha nova reserva e não é recusado apenas porque a reserva histórica venceu; ainda exige concessão nativa atual e válida. As verificações da aplicação são adicionais: o candidato SQL mantém suas próprias verificações e admissão diferida, ainda não homologadas aqui.

Antes de COMMIT, expiração provoca recusa. Depois de COMMIT já despachado, o resultado confirmado não é reclassificado por uma desativação tardia. Perda de resposta conserva `transaction_outcome_unknown`; rollback posterior não prova que nada foi confirmado. Nenhuma tentativa é repetida automaticamente.

## Consulta do recibo original

`createRegistrationReceiptReader({identity, transactions, enabled}).readReceipt(query, signal?)` recebe:

```ts
type RegistrationReceiptQuery = {
  commandId: string;
  permission: 'prepare' | 'claim' | 'complete' | 'fail' | 'retry' | 'revise' | 'cancel';
  expectedCommandHash: string | null;
  expectedOperationId: string | null;
};
```

A consulta realiza somente `lockScope` e `readReceipt`. Conferências: contexto inteiro, finalidade, identificador do comando, prazo de autorização e os dois valores esperados quando conhecidos. Nenhuma chave é criada. Campos desconhecidos, URLs, ator fornecido no corpo e finalidade `approve`/`execute` são recusados.

Retorno: `outcome: recorded | not_observed`, recibo imutável ou null, `dispatchAllowed:false`, `automaticRetryAllowed:false`, `ticketMutation:'none'` e `originMutation:'none'`. `not_observed` não significa que a operação não ocorreu. `recorded` descreve o histórico da análise, não um cadastro criado no GEO.

Se o hash esperado for desconhecido, o recibo continua vinculado ao contexto e à chave exatos; isso permite recuperar metadados, não verificar uma intenção cujo conteúdo não foi conservado nem conceder execução. Perda de transporte continua sendo erro, nunca ausência bem-sucedida.

O candidato atual exige autorização da mesma finalidade para a leitura. Revogação, expiração ou estado de chamado que recuse essa finalidade também recusam a recuperação. Não conceder novas permissões para contornar isso: uma capability específica de auditoria/recuperação em outros estados exige desenho e SQL próprios, fora desta fatia.

## Serviço composto

`workers/dev-agent-bridge/service.ts` entrega `createPostgresRegistrationAnalysisService` com pool, identidade, runner, `analysisEnabled`, `receiptReadEnabled` e `readKnowledge` opcional. Expõe `runOnce` e `readReceipt`. O runner recebe somente o contrato limitado de entrada, não pool, store ou recuperação.

As duas flags são independentes: parar novas análises não precisa impedir observação de recibos autorizados. Nenhuma flag é alterada pela biblioteca. A composição não chama o modelo na construção nem mantém transação aberta durante sua análise. O desligamento do host e encerramento do pool pertencem ao proprietário externo.

## Provas locais e dependências restantes

407 testes Node cumulativos, incluindo 62 novos da E05. O teste integrado usa o core e os módulos HDA reais sobre um **driver duplo**: o SQL não é executado. Os cenários incluem perda de ACK depois de efeito simulado, sem reenvio do analisador; nenhuma garantia de RLS, locks ou durabilidade PostgreSQL é inferida.

Permanecem obrigatórios: checkout completo, dependências do lock, PG17 candidato, composição com cadeia histórica em cluster separado, qualificação do pool/roles/TLS/binding, host real da CLI, revisão independente e aceites específicos antes da ativação. O código deve continuar não montado enquanto esses gates estiverem pendentes.
