# HDN-01i — revisão das validações obrigatórias do adaptador

Data: 12/10/2026. Continuidade da HDN-01a–h, sobre a base consultada `6e069005beaa12d7cb55c77af92478c21f7526ca` de `Consulte-GEO/help-desk-multi-tenant`.

## Resultado e limite principal

A correção está implementada localmente. O conjunto focal foi reexecutado com **586 testes aprovados: 566 regressões e 20 novos**. Os novos testes foram executados primeiro contra H: 5 compatibilidades passaram e 15 negativas falharam porque a transação podia terminar normalmente após uma recusa capturada. Não são 15 defeitos diferentes: são manifestações de uma lacuna de composição.

**A validação PostgreSQL continua bloqueada.** Existem agora 31 cenários HDN escritos e registrados, nenhum executado nesta rodada. O candidato SQL permaneceu byte a byte igual ao recebido. Não houve migration, alteração de tabelas/grants/scopes/Auth, publicação de templates, montagem de rotas/UI, código remoto, CI oficial ou deploy.

## 1. Falha reproduzida

H introduziu `rejectTransactionValidation` no executor e ligou o guard do caminho legado a esse mecanismo. Entretanto, `createPostgresExecutionChecklistStore` ainda propagava suas próprias recusas sem invalidar a transação. Uma consulta poderia ser bem-sucedida para o driver, mas ter command tag, envelope, snapshot, metadados de evidência ou readiness inválidos. Se o chamador capturasse essa exceção, o runner podia confirmar trabalho já preparado.

O teste de mutação usa uma chamada à função de marcação que prepara uma gravação no transporte de teste e retorna um envelope inválido. Antes da correção, capturar o erro permitia COMMIT; depois, o runner recusa e segue ROLLBACK. Outros casos reproduzem readiness insegura, snapshot inválido, evidência ausente, outro chamado e coluna privada extra em opções de evidência.

O transporte desse ensaio é deliberadamente controlado e permite COMMIT após uma consulta bem-sucedida com dados incorretos. Isso verifica a proteção da composição sem depender do estado abortado que um erro SQL natural já produziria. **Não demonstra que o problema ocorreu em produção.**

## 2. Correção realizada

O adaptador mantém sua interface de sete métodos. Um wrapper privado executa cada método, aguarda sua conclusão e, diante de recusa, chama `rejectTransactionValidation` com o exato cliente emprestado recebido na construção. Não há objeto de autorização novo, campo público, flag mutável de reset, pool, transação aninhada, dependência ou repetição automática.

Métodos cobertos: `assertReady`, `read`, `queryEvidence`, `readReceipt`, `readEvidence`, `mark`, `readExecutionChecklist`. A mudança cobre as validações e exceções pertencentes a esses métodos, incluindo falhas anteriores à consulta. Não transforma qualquer retorno bruto em prova: verificações semânticas adicionais dos envelopes continuam nos consumidores existentes.

Se o chamador propaga o erro, sua classificação anterior permanece. Se o captura, a transação fica recusada: novas consultas e COMMIT não prosseguem. Outro adaptador no mesmo cliente recebe `transaction_validation_failed`, preservado com mensagem local segura. Erro SQL mantém prioridade `transaction_statement_failed` no executor. A recusa não contamina uma transação posterior que reutilize a conexão física.

Ausência legítima de recibo (`null`), leitura válida e retorno normal não invalidam a transação. Consulta em andamento é aguardada antes do rollback/liberação. A implementação não altera a distinção entre COMMIT confirmado e confirmação desconhecida.

## 3. Contrato de composição

Construir o store com o cliente do callback de `runTransaction`/`runResourceTicketTransaction` e aguardar cada método. Não fornecer um cliente copiado com spread/proxy ou um cliente cru como se houvesse registro do runner. Fora do callback ativo, a exceção ainda é propagada, mas não existe promessa de rollback por essa API.

O wrapper não é um sandbox contra um componente servidor malicioso e não implementa RLS, locks ou a invariante terminal de todos os escritores SQL. Também não captura validações que outro módulo faça sem usar o mecanismo. O armazenamento de workflow ainda exige integração na mesma conexão e proibição de caminhos alternativos de finalização.

A finalidade continua sendo RF-CEN-07 (checklist obrigatório antes de finalizar) e RF-CEN-11 (cuidados para ações sensíveis), preservando que uma nota comprova registro da declaração, não a veracidade da execução no GEO. Fonte do requisito: `Requisitos Help Desk.md`, seção Central de atendimento, linhas 197–201. Os documentos anteriores permanecem históricos.

## 4. Novo cenário PostgreSQL

Foi acrescentado um cenário em `supabase/tests/execution-checklist-scenarios.ts`, já registrado pelo runner existente. Ele usa a conexão pg real prevista no runner, executa uma marcação, exige command tag/recibo/revisão esperados e só então injeta uma coluna inesperada no envelope devolvido pelo transporte. O erro de validação é capturado pelo trabalho chamador. A asserção final exige rollback de snapshot, auditoria e recibo, com exatamente uma marcação SQL bem-sucedida antes da injeção.

O caso não pode passar por falha de setup, erro SQL natural, ausência de import ou nenhuma gravação. O wrapper de transporte é restrito ao teste; não modifica a consulta nem fornece dados sintéticos ao produto em produção. **Escrito e checado quanto aos tipos TypeScript; não executado no PostgreSQL nem validação PL/pgSQL.** Os 30 cenários anteriores permanecem presentes.

## 5. Verificações atuais

| Verificação | Situação |
|---|---|
| Integridade da entrada H | 103 hashes internos e 72 de fonte conferidos |
| Baseline H reconstruído | 566/566 aprovados |
| Novos testes sobre H, antes da correção | 20 casos: 5 passam, 15 falham (RED) |
| Novos testes após correção | 20/20 aprovados |
| Conjunto focal após correção | 586/586 aprovados, zero falhas/cancelamentos/skips/TODO |
| Typecheck focal do conjunto e do cenário SQL | Aprovado; TS5.8.3 e @types/node25.1.0 globais |
| Três mutações deliberadas | Todas detectadas (15, 2 e 2 falhas); fonte restaurada |
| PostgreSQL17 / upgrade HDN | Não executados |
| Navegador/build completo/CI oficial/audit por lock | Não executados |
| Revisão | Autorrevisão em passagem separada; independente pendente |

Durante a escrita dos testes foram corrigidas duas expectativas do próprio teste: captura de uma exceção síncrona de entrada e manutenção do código existente `checklist_store_unavailable` para cliente expirado. O produto não foi alterado para inventar uma nova classificação desse caso. A primeira tentativa de typecheck usou caminho de tipos Node inexistente; a execução aprovada usa o caminho real dentro da instalação global de ts-node, com as mesmas opções estritas.

A composição local foi reconstruída com o overlay H, suportes recuperados de arquivos anteriores e arquivos pequenos da base conhecidos por hash. Não é clone completo nem instalação das dependências pelo lock. Os métodos do adaptador e o runner são reais; identidade, estado e driver das novas verificações são controlados. Os 586 incluem as regressões compartilhadas reexecutadas, sem somar testes históricos que não rodaram.

## 6. Pré-requisitos e ausência de efeitos externos

Node22.16.0 disponível. `postgres`, `initdb`, `psql`, `pg_ctl`, Docker e CLI Supabase não foram encontrados. `git ls-remote` falhou por DNS. Download do pacote PostgreSQL17 do repositório oficial Debian falhou, sem produzir executável. Não houve mudança de DNS, política de rede ou uso do Supabase hospedado como fixture.

Leitura pelo conector GitHub confirmou a base. A tentativa de ler o changelog Supabase não foi bem-sucedida por tipo de conteúdo; não foi usada API nova do Supabase. Documentação PostgreSQL17 de locks foi consultada como referência, não como evidência de execução do candidato.

## 7. Próximo aceite obrigatório

Aplicar a composição em checkout completo, executar os 31 cenários HDN e as regressões de autorização/transações pelo runner PostgreSQL17 existente, corrigir os achados demonstrados e validar atualização do banco. Depois: publicação qualificada de templates/vínculos, armazenamento de workflow, proteção integral das escritas terminais, montagem das rotas/painel, navegador e CI da fonte exata, revisão independente e liberação por escopo.

Não habilitar uma categoria exigindo checklist enquanto seu binding/backend estiver ausente. Não reaplicar R1 ou HDW-00/00b e não reativar a interface avançada de login. Não converter testes locais em evidência de produção, nem reutilizar o relatório canônico anterior para uma fonte modificada.
