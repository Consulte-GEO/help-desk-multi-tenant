# M1-R4 — proteção das transações contra erros assíncronos do cliente

**28/09/2026. Correção do runtime normal; não é ativação de produção.**

## Origem e reprodução
O R3 protegeu o diagnóstico privado, mas `runTransaction` ainda entregava o cliente físico ao callback e dependia apenas das rejeições das Promises de consulta. O listener do pool no runtime não substitui o tratamento de erros do cliente retirado do pool.

A rodada reproduziu a lacuna com EventEmitter real e um adaptador SQL sintético, em processos Node separados. A suíte inicial teve 18 casos: 16 falharam e dois confirmaram comportamentos já corretos. Erros assíncronos encerraram subprocessos e imprimiram a mensagem sintética `PRIVATE_TRANSACTION_SENTINEL`. Não foi constatado incidente, exposição de credencial real ou perda de dados no ambiente hospedado. Não houve conexão real ao PostgreSQL nesta rodada.

## Mudança implementada
`src/infrastructure/transaction.ts` passa a registrar uma observação estável por objeto de cliente físico. O WeakMap armazena somente a condição de falha. O listener não registra nem retém o objeto de erro, credenciais, identidade de usuário ou payload de SQL. Nenhum listener de outro proprietário é removido; operações sucessivas não adicionam uma observação por requisição.

Toda consulta do callback e do controle transacional usa a mesma conexão e verifica seu estado antes de enviar e depois de receber a resposta. Uma falha fatal observada impede novas consultas, inclusive uma tentativa inútil de rollback. A conexão é encaminhada para descarte pelo pool, sem reconexão automática e sem repetir o callback.

O callback recebe uma interface emprestada: não pode liberar o cliente e não pode executar SQL depois que seu callback terminou. Uma referência antiga não pode voltar a usar uma conexão que já está atendendo outra conta. A identidade continua instalada no início da transação e as consultas de controle continuam limpando os dois seletores `app.*`.

## Fronteiras da confirmação
| Momento | Resposta e efeito |
|---|---|
| Falha fatal antes do envio de COMMIT | 503 `database_unavailable`; nenhum COMMIT enviado depois da falha. |
| Falha após envio de COMMIT, sem confirmação confiável | 503 `transaction_outcome_unknown`; consultar/reautorizar ou usar a mesma chave, nunca repetir automaticamente. |
| Rejeição SQL comum sem evento fatal | Uma tentativa de ROLLBACK; com confirmação, preserva o erro SQL/de domínio e permite reuso. |
| Rollback sem confirmação | Descartar a conexão; não declará-la reutilizável. |
| Evento somente na liberação/ociosidade depois de COMMIT confirmado | Não desfaz nem repete uma escrita já confirmada. O cliente fica marcado como inválido, e o pool mantém a responsabilidade pelo descarte real. |
| Referência emprestada depois do callback | 503 `database_unavailable`, antes de enviar qualquer SQL. |

Não são feitas inferências de rollback confirmado apenas porque houve descarte. O tratamento de exceção síncrona lançada por `release()` não foi redesenhado nesta entrega; o foco é evento assíncrono e fronteira de uso do cliente. A validação de cleanup efetivo com o driver real continua pendente. Nenhuma promessa de cancelamento de processamento de aplicação em andamento: o que se bloqueia é o próximo SQL pelo cliente emprestado.

## Cobertura de teste
19 novos testes Node: oito posições de evento (BEGIN, configurações, trabalho, COMMIT, ROLLBACK, liberação, intervalo de aplicação e ociosidade), tentativa de continuar depois de capturar falha, corrida antes de COMMIT, 25 reusos sem acumular listeners, cliente morto retornado indevidamente pelo adaptador, referência antiga, liberação precoce, integração com consultas de controle e UnitOfWork, preservação de erros comuns e gate.

Três casos PostgreSQL novos, ESCRITOS e não executados:
1. Interromper apenas o backend obtido de um pool próprio dentro do banco descartável; verificar que a mensagem da transação interrompida não foi persistida e que a próxima transação usa outro backend.
2. Reusar conexão para outra conta e recusar consulta pela referência emprestada anterior sem alterar a identidade atual.
3. Repetir consultas de controle com pg real e verificar uma única observação transacional adicional no mesmo cliente.

O teste de interrupção está dentro do guard de banco novo/local existente. Usa o PID obtido da própria conexão, filtra banco/role/backend no catálogo e nunca é um procedimento de teste para Supabase remoto. Nenhuma migration foi alterada.

## Compatibilidade
API/interface 0.19.0; schema esperado 0.18.0; 11 migrations históricas; 18 operações HTTP. Sem endpoint, grant, nova dependência, mudança de contrato, snapshot ou chave de idempotência. `pg` continua 8.16.3. R2/R3 continuam no pacote consolidado. Os erros públicos usados já existiam.

## Fontes e limites
Documentação primária consultada em 28/09/2026: https://node-postgres.com/apis/client (eventos de cliente) e https://node-postgres.com/apis/pool (erros de clientes ociosos, conexão retirada e release). Sustentam o modelo de eventos, não comprovam a execução deste código com pg real. As provas desta rodada são os logs locais do pacote; simulação do driver não é PostgreSQL ou Netlify.
