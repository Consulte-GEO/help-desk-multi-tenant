# E03 — revisão da persistência e preparação da prova nativa

**14/10/2026 · HD-DA-CADASTROS · plano 2.0+E03.** Implementação local, sem publicação. A HDA-02 permanece parcial; este incremento não inicia a HDA-03.

## Base e alcance

E01 e E02 foram recuperadas do ZIP entregue na conversa e testadas antes de modificar o código: 227 testes aprovados. A principal do GitHub foi reinspecionada no início e no fechamento: `d5610aca8b4a5ca65567c0c92b2c7a1df5aa6da4`, PR41 (transporte de versões condicionais). O desenvolvimento ocorreu em branch local isolada, sobre um subconjunto recuperado, não em um clone completo. Não foram alterados arquivos do runtime HTTP, rascunhos públicos, Email Kit, callback, autorização central ou migrations históricas.

## Correções comprovadas em testes locais

O serviço aceitava um ACK com `recordedAt` igual/posterior ao fim da reserva, desde que a autorização geral ainda estivesse válida. Isso foi reproduzido para `claim`, `complete` e `fail`. A validação agora impõe os dois limites: autorização e reserva. O adaptador aplica a mesma condição sem depender de seu chamador. Esses testes usam um transporte em memória e exercitam a recusa/rollback do modelo, não o COMMIT PostgreSQL.

O leitor direto de recibos conferia workspace/conta/ator/binding, mas não a finalidade nem o limite de validade. Agora recusa recibos incompatíveis e envenena a instância do store. Um replay histórico válido continua sendo aceito, inclusive depois da expiração de sua reserva, sempre sem devolver uma nova reserva. A data histórica não é comparada ao início do novo scope como se fosse uma nova execução.

## Candidato SQL revisado — ainda não executado

O candidato exige `tickets:read` do core para humanos/analisadores, e `tickets:write` nas mutações humanas. A concessão HDA não substitui esse teto. O ramo humano usa a mesma chave de advisory lock da publicação de `human_scope_versions`, pois bloquear só uma revisão antiga não impediria uma nova revisão de revogação. Predicados de autoridade exigem `true` explícito (`coalesce(...,false)`), incluindo grants e relações de conta/produto/chamado.

A operação armazena `queue_hash` e a conferência diferida compara o documento da tarefa inteiro. Uma mutação isolada da tabela de tarefas também aciona a conferência. CHECKs de identidade, status e reserva rejeitam campos ausentes/NULL; `lease_until` deve corresponder ao timestamp do JSON. Isso é código candidato e inspeção estática: os novos cenários nativos precisam demonstrar o comportamento em PostgreSQL.

Não aplicar este arquivo sobre uma instalação E02 existente: o candidato é destinado a um cluster descartável novo. A promoção futura exige migration aditiva própria, gerada pelo procedimento oficial, depois dos testes. Nenhuma migration histórica, marker ou ACL hospedada foi modificada.

## Executor de testes e cenários nativos

O executor recusa mais configurações externas herdadas (`PG*` e URLs de testes), exige os metadados do pacote/lock e arquivos essenciais do repositório, confere versões dos utilitários, escreve o socket em `postgresql.conf` com escape em vez de interpolá-lo em `pg_ctl -o`, usa HOME/TMPDIR próprios e valida propriedade/symlinks antes da limpeza. Metadados aprovados não são prova de repositório íntegro ou de SQL aprovado.

A suíte nativa ganhou **12 cenários E03 preparados**: revogação de escopos, leitura sem escrita, retorno NULL de quatro predicados, grants inválidos, divergência do documento da tarefa, divergência da reserva, interferência de trigger e concorrência com nova revisão de permissão. A fixture continua sintética. Os cenários de expiração agora aguardam a validade real; não alteram registros protegidos para simular passagem de tempo.

## Evidência disponível

| Verificação | Resultado e limite |
|---|---|
| Baseline E02 | 227/227 Node |
| Cumulativo E03 | 275/275 Node; zero falhas/cancelamentos/skips |
| Novos testes | 48: 14 recibos/ACK, 10 inspeções estáticas de SQL, 20 helpers de preflight/arquivos, 4 recusas de ambiente herdado |
| Tipos | TypeScript 5.8.3; checagem focada com @types/node 22.19.7 disponível no ambiente |
| Vetores independentes | Python: 14 válidos e 12 inválidos; zero falhas; não é .NET |
| Sintaxe dos scripts | Conferida por Node, sem executar PostgreSQL |
| PostgreSQL | Não executado: binários 17, driver pinado e árvore completa ausentes |
| Clone/instalação | Rede local não resolveu o registry; download dos fontes PG também falhou |
| Build/regressão completos | Não executados |
| Navegador/CLI/Novo GEO | Não executados |
| Publicação | Nenhum push, merge, deploy, mutation hospedada, email ou cadastro |

O `@types/node` usado na verificação focada não substitui o 22.15.30 do lock original. A checagem pinada deverá ser repetida na árvore completa. As 81 linhas de aceite de negócio permanecem pendentes; 275 testes técnicos não são 275 requisitos concluídos.

A revisão foi autorrevisão. Não houve revisor independente. Logs vermelhos e verdes, inspeção de fonte e limitações acompanham a entrega.

## Próximo bloqueio concreto

Executar o candidato em PostgreSQL 17 próprio e depois sobre a sequência real de migrations. Somente após corrigir e comprovar permissões, concorrência, invariantes, upgrade e prontidão, gerar a migration de promoção e iniciar a composição HDA-03. O código não foi conectado ao “Novo chamado”.
