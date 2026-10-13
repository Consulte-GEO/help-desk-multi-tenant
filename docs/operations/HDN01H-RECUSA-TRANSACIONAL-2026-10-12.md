# HDN-01h — recusa lógica obrigatória na transação

## Estado

Incremento local sobre o cumulativo HDN-01g e a principal `6e069005beaa12d7cb55c77af92478c21f7526ca` de `Consulte-GEO/help-desk-multi-tenant`. Não altera login/painel, scopes, fatores Auth, SQL candidato, migrations, deploy ou flags hospedadas. A prioridade continua a validação PostgreSQL e a integração completa do checklist; esta correção não conclui a HDN-01.

Base funcional: RF-CEN-07/11 do levantamento fornecido pelo usuário; plano V2 e handoff HDN-01g. Checklist obrigatório antes de finalizar; ação sensível exige conferência, não autorização automática para executar no GEO.

## Falha demonstrada

O guard original do caminho legado recusa alterações terminais fora do workflow estruturado. Uma recusa pode ocorrer DEPOIS de uma resposta SQL bem-sucedida (instalação parcial, resposta malformada, decisão restritiva ou command tag incompatível). O runner já conserva erros de consulta e de admissão, mas não sabia que esse validador lógico havia falhado.

Quatro regressões demonstraram que, quando o chamador capturava a recusa e retornava normalmente, o runner solicitava COMMIT das gravações anteriores. A reprodução usa guard/runner reais e um driver controlado que contabiliza gravações em staging, COMMIT e ROLLBACK. Não prova ocorrência na produção.

## Correção

`rejectTransactionValidation(client: SqlClient, error: unknown): never` foi acrescentada ao executor existente `src/infrastructure/transaction.ts`. Só o exato cliente emprestado de um callback ativo possui associação com o estado privado em WeakMap. A função marca a validação obrigatória como recusada e relança o mesmo erro; ela não lê nem retém o conteúdo desse erro.

O estado admite apenas invalidação. Não há setter público, flag reversível, GUC, endpoint, nova permissão ou nova credencial. O runner recusa consultas subsequentes e COMMIT quando essa falha foi observada. Se o chamador engolir o erro, retorna `transaction_validation_failed` (503) com mensagem local segura. Se propagar o erro, seu significado original é preservado.

O guard legado chama essa função no tratamento da própria recusa, depois de normalizar a mensagem. Esse é o único consumidor novo. Não se tentou tornar toda exceção de qualquer validador implicitamente fatal.

## Semântica mantida

- Operação aceita em chamado sem vínculo continua confirmando uma vez.
- Erro SQL continua tendo a classificação `transaction_statement_failed`.
- Erro original propagado impede COMMIT sem ser trocado arbitrariamente pelo novo código.
- Consultas já iniciadas são aguardadas antes da limpeza; não se despacha rollback sobre trabalho pendente deliberadamente.
- COMMIT confirmado não é desfeito por erro tardio; confirmação perdida permanece `transaction_outcome_unknown`, sem nova gravação automática.
- A associação é encerrada ao terminar o callback e removida ao liberar. Cliente antigo, cópia ou outra transação não invalidam uma operação independente.
- Falha do rollback mantém a solicitação de descarte da conexão; o código não afirma que a limpeza física aconteceu quando ela não foi confirmada.

## Contrato de integração e limites

O chamador deve aguardar o guard e passar o cliente exato emprestado por `runTransaction`, não `{...client}` ou outro proxy. A recusa de um objeto sem associação continua lançando erro, mas não pode alterar o estado de outra transação. Código server-side que deliberadamente usa outro cliente, ignora promises ou emite SQL arbitrário não está coberto por uma garantia universal.

A proteção NÃO é uma invariante SQL para todos os caminhos terminais, NÃO instala checklist em categorias sem vínculo e NÃO fornece o armazenamento final do workflow. Promover o candidato, publicar templates/bindings e ligar o fluxo estruturado continuam pendentes. O banco antigo inteiramente sem tabela/helper continua compatível; instalação parcial não é tratada como ausência.

## Teste nativo escrito

Acrescentado um cenário em `supabase/tests/execution-checklist-scenarios.ts`: faz uma marcação real no banco descartável, provoca recusa LOCAL do guard por revisão incompatível, captura a recusa e exige rollback conjunto de snapshot, auditoria e recibo. O teste não depende de um erro SQL que já abortaria a transação naturalmente. O conjunto passa de 29 para 30 subtestes escritos; zero deles foi executado nesta rodada.

O SQL candidato `supabase/candidates/hdn_execution_checklist.sql` permanece byte a byte idêntico ao da HDN-01g. Os 12 arquivos de migration históricos não foram modificados.

## Verificação local

Baseline HDN-01g: 504/504. RED dirigido do guard: 5 testes, 1 aprovado e 4 falhas esperadas. RED da API do runner: 12 testes, 4 controles aprovados e 8 falhas pela proteção ausente. Após a implementação foram acrescentados três casos de revisão ao runner: erro original adicional, objeto de erro hostil e transações concorrentes independentes.

Final: 566/566 (504 da base, 20 novos e 42 regressões compartilhadas reexecutadas). A expectativa antiga que permitia sucesso após capturar a recusa foi corrigida; mantém a asserção de nenhum UPDATE proibido e agora exige nenhum COMMIT e rollback. Nenhum teste removido, skip, supressão ou aumento do prazo do produto.

Três mutações detectadas: retirar invalidação no guard (4 falhas), retirar conferência pré-COMMIT (9) e retirar conferência pré-query (2). Fontes restauradas e hashes conferidos antes da repetição final.

Tipos focais: TypeScript 5.8.3 e tipos Node 25.1.0 globais, strict/noUncheckedIndexedAccess e opções do projeto. Não é instalação pinada, typecheck integral ou CI oficial. O typecheck inicial indicou caminho incorreto dos tipos e uma tupla readonly incompatível no novo teste; corrigidos o harness e a tipagem da fixture, sem alterar produto por isso.

Autorrevisão realizada; sem ferramenta de subagente/revisor independente. O template adicional da skill não foi recuperado; a revisão foi realizada sobre diff, contratos e matriz de falhas. Evidências locais não substituem SQL17, browser/CI ou aceite operacional.
