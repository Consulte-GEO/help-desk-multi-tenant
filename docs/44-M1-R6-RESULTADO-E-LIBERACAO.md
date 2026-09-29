# M1-R6 — Resultado transacional e falha de liberação

## Escopo
Correção da pendência de exceção síncrona de `release()` explicitamente registrada no R4 e no backlog R5. Base local: R5 `b0a544d53f5978aa75170a0827315d4d623e7f5c`. Base remota observada: `b9481b9fabde2fd9c442e44099bc17608b59571a`. Sem nova função de negócio, contrato HTTP, migration, grant ou dependência.

## Defeito reproduzido
`runTransaction` devolvia a conexão em um `finally` sem conter exceções desse cleanup. Nos testes, o callback completou e a consulta recebeu a tag `COMMIT`, mas a exceção da liberação substituiu o retorno. O mesmo aconteceu com o erro `transaction_outcome_unknown` e com recusas 404/409/412 anteriores. A reprodução isolada mostrou o erro bruto sintético no resultado do chamador. Não foi observado vazamento em produção, e o wrapper HTTP já possui sua própria sanitização; este achado é na fronteira transacional, não prova exposição externa.

## Regra implementada
| Resultado antes do cleanup | Após release lançar |
|---|---|
| COMMIT recebido/confirmado | Preservar o valor retornado, inclusive o recibo e snapshot; nunca repetir a operação. |
| COMMIT enviado, confirmação perdida/incompatível | Preservar `503 transaction_outcome_unknown`; recuperar com a mesma chave autorizada. |
| Erro de domínio antes de COMMIT | Preservar a mesma instância/classificação do erro anterior. |
| Rollback também falhou | A exceção de release não substitui a decisão anterior; não afirmar rollback confirmado. |
| Mesmo objeto de conexão devolvido num pedido posterior | Recusar antes de BEGIN, devido à marcação de conexão inválida. |
| Referência emprestada retida depois do callback | Continua inativa; não envia SQL. |

`commitConfirmed` só é marcado depois da confirmação de `COMMIT` e da verificação de saúde da conexão já existente no R4. Não há segunda chamada automática a release dentro da mesma transação, reconexão ou repetição do callback. Uma aquisição posterior inválida ainda tem sua própria tentativa de descarte, sem executar SQL.

A marcação da conexão é uma proteção lógica em memória. Não significa que o socket foi fechado, que o pool liberou sua capacidade ou que o servidor confirmou rollback. Se o adaptador lançar antes de devolver o cliente, ele pode continuar retido: descarte físico e observabilidade operacional ainda precisam ser comprovados com o driver e ambiente reais. Não acessar métodos privados do driver para simular confirmação de descarte.

## Diagnóstico fechado
A falha produz, em melhor esforço, uma linha de diagnóstico:

```json
{"component":"helpdesk.database","event":"connection_release_failed","commit_state":"confirmed"}
```

Valores de `commit_state`: `confirmed`, `unknown`, `not_requested`. O último significa apenas que este fluxo não solicitou COMMIT; não é atestação de rollback ou inexistência de efeitos. O evento não contém mensagem/stack do erro, URL, SQL, token, identidade, assunto do chamado ou payload. O objeto lançado nem sequer é inspecionado. Falhas síncronas ou Promises rejeitadas do destino de log não alteram o resultado nem geram recursão/retry de log. Sem nova fila de telemetria ou garantia de entrega desse diagnóstico.

## Testes e alcance
Quatorze testes Node novos: preservação de recibo confirmado; perda de confirmação; tag COMMIT incompatível; quatro recusas/rollback; recusa do objeto invalidado; referência emprestada; consulta de controle; dois modos de falha de log; objeto de erro hostil; mínimo do gate. Todos executam o código real da transação com SQL sintético em subprocessos, não PostgreSQL.

Dois testes PostgreSQL novos foram escritos dentro do guard de banco novo/local existente. Um cria ticket e força erro do adaptador depois de descarte real; outro oculta a confirmação depois de COMMIT real e também força o erro de release. Conferem recuperação pela mesma chave, recibo, um ticket, um evento e uma outbox. O teste verifica `replayed:false` na criação e `replayed:true` no replay; a igualdade é do ticket, não desse indicador. Esses dois testes NÃO foram executados nesta rodada. A falha de release é injetada pelo teste: não se afirma que o próprio `pg` a produziu espontaneamente.

## Compatibilidade e revisão pendente
API/interface 0.19.0; schema 0.18.0; 11 migrations históricas preservadas; pg 8.16.3 e lock intactos. M1 aberto. Sem liberação, mudança de segredo/usuário, alteração remota ou M2.

Documentação primária consultada: https://node-postgres.com/apis/pool e https://node-postgres.com/apis/client. A documentação orienta a propriedade da conexão e sua devolução ao pool; as conclusões sobre a falha do Help Desk vêm dos testes desta entrega. A tentativa de preparar PostgreSQL nativo usou a referência oficial https://www.postgresql.org/docs/17/install-make.html, mas nenhum servidor foi obtido/iniciado.
