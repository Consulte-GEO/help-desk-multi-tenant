# CG-03i — consultas recusadas e consistência dos erros

**09/10/2026 — entrega local; não integrada e não aprovada para produção.**

## Base e objetivo

Plano vinculante: Help Desk Consulte GEO — plano de implantação, CG-03 e protocolo de entrega. Base remota consultada: PR26, `f60baed8022b28e067a702b3dd51031e86983017`, ainda draft. A fonte de trabalho é o pacote CG03H local (SHA-256 `8e6a34f662881c57f8e6cbe047088bb552a0746af111148661a8785a85732703`). E/F/G/H não estavam no HEAD remoto. Não reaplicar H sobre esta entrega.

A prioridade continua sendo a composição SQL, não acrescentar outro subsistema. O container não possui PostgreSQL, CLI, Docker ou parser PostgreSQL; o registry não resolveu por DNS e o download oficial de fonte PostgreSQL falhou. Não houve remoção de guards, uso de banco hospedado para fixtures ou repetição da gravação SQL bloqueada por outro caminho. A spec complementar e o contrato real da origem continuam ausentes.

## Achado 1 — uma Promise concluída pode conter uma consulta malsucedida

O rastreador H retirava uma consulta do conjunto de pendências tanto no sucesso quanto no erro. Se o callback capturasse a rejeição e retornasse normalmente, não restaria pendência nem recusa de admissão para impedir COMMIT. Um erro no cliente/driver não é garantia de que a transação do servidor já esteja abortada. A validação de argumentos no `Query.submit` do pg8.16.3, por exemplo, pode recusar antes de enviar SQL.

Reprodução executada com transporte controlado: WRITE; consulta rejeitada; erro capturado; callback retorna; versão anterior solicita COMMIT e confirma o efeito simulado. Isso é evidência do comportamento do executor, não prova de gravação real ou incidente em produção.

`runTransaction` agora registra permanentemente a falha de uma consulta nessa execução. Novas consultas não são admitidas depois da falha observada e o cheque anterior ao COMMIT exige que nenhuma consulta tenha falhado. Consultas que já haviam sido iniciadas são drenadas pelo mecanismo H; não há cancelamento fictício ou retry. `transaction_statement_failed` é uma resposta local segura para erro absorvido pelo callback. Se o erro original sai do callback, ele continua preservado.

Falhas de admissão/identidade e saúde da conexão preservam suas regras. Uma conexão saudável após ROLLBACK confirmado pode ser reutilizada; o estado de falha de consulta é da transação, não global ao pool. COMMIT já confirmado e confirmação perdida mantêm o comportamento anterior.

Ruling: não suportar recuperação de consulta dentro do mesmo callback por SAVEPOINT. Não faz parte do contrato de publicação atômica e não foi encontrado no `src` indexado da branch padrão; a busca não substitui inspeção integral. Se futuramente houver necessidade, especificar uma API própria de recuperação, sem apagar silenciosamente a marca de falha.

## Achado 2 — erros de parsing não são decisões locais de acesso

Uma exceção lançada durante a leitura de um descritor de resposta podia imitar um `HelpdeskError` com código de mismatch. O parser a repropagava, inclusive com mensagem privada. A inspeção do código de um erro SQL também podia lançar nova exceção sem sanitização.

`resource-access-store.ts` agora aceita como 403 do parser apenas a instância de recusa criada naquela própria chamada. Exceções vindas dos dados são resposta inválida/503, não uma decisão de autorização. A consulta do descritor do código SQL recebe tratamento protegido. Não executa getters de códigos e não propaga mensagens livres de traps. Mismatch legítimo continua 403; nenhuma permissão é concedida por essa classificação.

## Composição com o publicador

O publicador reconhece `transaction_statement_failed` como recusa de persistência antes de existir resultado preparado. Depois que o callback retornou recibo preparado, uma exceção com esse formato não prova rollback: mantém resultado desconhecido. O código/status/mensagem livre do transporte não são usados como aprovação.

## Evidências

Baseline H:371/371. Novos22 testes:15 de estado de consultas;5 de erro de snapshot;2 de composição do publicador. RED observado:12 falhas no primeiro grupo,4 no segundo e1 no terceiro; casos de compatibilidade restantes já passavam. GREEN final393/393, zero falhas/cancelamentos/skips/TODO.

Quatro mutações testadas e revertidas: esquecer falha12; omitir verificação anterior ao COMMIT12; confiar no código de erro do parser3; perder classificação do novo erro1. Reexecução final393 após restaurar os arquivos. Typecheck focal aprovado com TS5.8.3 e tipos Node25.1.0 globais; não é instalação validada pelo lock.

Os testes usam o executor, resolvedor e publicador reais, com transporte/autoridade controlados. Não demonstram RLS, durabilidade, locks do PostgreSQL ou atendimento no navegador.

## Cenário real escrito, não executado

Foi acrescentado um cenário ao `resource-publication-scenarios.ts`: publica cobertura/observação/recibo na mesma transação, provoca recusa do pg por argumento `values` não-array, captura a recusa e verifica que a transação não pode confirmar e os quatro contadores permanecem zero. As funções SQL e os guards são os mesmos, sem novo runner. A negação do argumento no driver foi conferida no código-fonte pinado; o cenário completo NÃO foi executado no banco.

Os15cenários E permanecem sem execução; G passa a16cenários escritos sem execução nesta fonte. Os três candidatos SQL D/E/G foram preservados byte a byte. Não modificar totais esperados de CI manualmente.

## Integração ainda pendente

Continuam pendentes SQL17 integral, upgrade, migration CLI/manifest/readiness, contratos de identidade/fonte/publicador, revisão independente, CI novo, evidência canônica e handlers. Não alterar as12 migrations antigas, os dois scopes de Thiago, configuração Auth ou gates de liberação. O CI histórico D não aprova E/F/G/H/I.

Fontes externas consultadas: código `pg@8.16.3`, `packages/pg/lib/query.js`, método `submit` (https://raw.githubusercontent.com/brianc/node-postgres/pg@8.16.3/packages/pg/lib/query.js); documentação de parâmetros https://node-postgres.com/features/queries; PostgreSQL17 https://www.postgresql.org/docs/17/plpgsql-control-structures.html e https://www.postgresql.org/docs/17/explicit-locking.html. Consulta do changelog.md Supabase não completou pelo leitor web. Nenhuma dependência foi adicionada/atualizada.
