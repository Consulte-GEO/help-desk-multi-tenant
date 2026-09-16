# M1c — Confirmação transacional e ciclo de vida das sessões

API/interface 0.4.0. Schema candidato 0.4.0. Implementação local, sem homologação de produção.

## 1. O problema reproduzido

A unidade transacional da v0.3.0 aguardava `query('COMMIT')`, mas não conferia o command tag retornado pelo driver. Um resultado recebido com `command: 'ROLLBACK'` ou confirmação ausente era tratado como sucesso do comando de negócio. Também era possível devolver a conexão ao pool como íntegra quando o transporte falhava no COMMIT e uma tentativa posterior de ROLLBACK respondia.

A reprodução nesta rodada utilizou um driver controlado. Isso é um defeito reproduzido no comportamento do adaptador, não um incidente observado no Supabase. Há novo teste para reproduzir o caso do COMMIT de transação abortada em PostgreSQL real; ele não foi executado neste ambiente.

## 2. Executor transacional

`src/infrastructure/transaction.ts` concentra aquisição, BEGIN, configurações locais, execução, COMMIT/ROLLBACK e liberação. A unidade de trabalho usa esse executor e não devolve o resultado do domínio antes do command tag COMMIT.

| Situação | Comportamento |
|---|---|
| BEGIN confirmado, trabalho concluído, COMMIT confirmado | Devolve o resultado e libera a conexão normalmente. |
| Erro do trabalho, ROLLBACK confirmado | Preserva o erro original e libera a conexão. |
| BEGIN/ROLLBACK sem confirmação esperada | Descarta a conexão; não a reutiliza como íntegra. |
| Erro de transporte após solicitar COMMIT ou tag de confirmação inesperado | Descarta a conexão; retorna `503 transaction_outcome_unknown`; não repete o comando. |
| Aquisição da conexão falha | Retorna `503 database_unavailable`, sem executar o trabalho. |

Receber um ROLLBACK depois de perder a confirmação do COMMIT não demonstra se o COMMIT anterior chegou a ser confirmado no servidor. Portanto, o cliente deve consultar o recurso ou repetir a operação com a **mesma** chave de idempotência, sem inventar nova chave para encobrir a incerteza.

Não foi acrescentado retry automático de comandos de negócio. Retornos 503 não significam que a gravação certamente não ocorreu.

## 3. Consultas de controle

O runtime aplica `withControlTransactions` ao pool. `query()` passa a usar uma conexão adquirida explicitamente e seu próprio envelope; `connect()` continua disponível para a unidade de trabalho, evitando transações aninhadas. Autenticação, limitador e verificações de inicialização usam essa camada.

| Parâmetro PostgreSQL | Valor candidato |
|---|---:|
| statement_timeout | 8 segundos |
| lock_timeout | 2 segundos |
| idle_in_transaction_session_timeout | 10 segundos |
| transaction_timeout | 15 segundos |
| app.workspace_id / app.principal_id em consultas de controle | Strings vazias, exclusivamente locais à transação |

Esses limites são **server-side por transação/statement**, não uma garantia de prazo máximo de toda a requisição HTTP ou de uma rede interrompida. A conexão continua com TLS verificado e aquisição limitada pela configuração do pool. Há mais round trips nas consultas de controle; medir latência/conexões no pooler real é requisito de homologação antes de calibrar valores ou otimizar o envelope.

O PostgreSQL alvo é 17. Os testes controlados verificam a sequência de chamadas; a aplicação efetiva dos timeouts no servidor ainda precisa dos testes SQL.

## 4. Troca M2M validada

A resposta privada de `helpdesk_auth.exchange_key` deixou de depender apenas de um cast TypeScript. São exigidos objeto, workspace UUID e instante com timezone explícito, finito, ainda válido e com prazo restante de até dez minutos. A leitura do relógio ocorre após a espera pelo banco.

O JSON devolvido contém somente `access_token`, `token_type`, `expires_at` canônico e `workspace_id` canônico. Campos extras privados são descartados. Credencial inválida/revogada que resulta em NULL permanece 401; resultado privado incompatível é 503 `invalid_session_result`, sem conceder token ao consumidor.

O relógio da aplicação e do banco precisa estar sincronizado: divergência capaz de exceder o limite de dez minutos é recusada de forma conservadora. Medir a divergência em homologação antes de definir eventual tolerância; esta versão não acrescenta tolerância implícita. Uma sessão gravada cujo retorno seja rejeitado pode permanecer inacessível até expirar; ela nunca é entregue como válida.

## 5. Encerramento da sessão atual

```http
DELETE /v1/integration-tokens/current
Authorization: Bearer <hd_session_...>
```

O endpoint aceita exclusivamente uma sessão curta. Não aceita chave longa, token humano, query, corpo ou identificador de outra sessão. X-Workspace-Id não é necessário e não participa da escolha do registro. Um stream efetivamente vazio é aceito, pois adaptadores HTTP podem representar ausência de corpo dessa forma. Conteúdo é recusado sem ser acumulado; espera por EOF é limitada a cinco segundos.

A operação devolve 204 com corpo vazio e `Cache-Control: no-store` tanto para uma sessão encerrada agora como para uma já ausente/expirada/revogada. Não cria uma API de consulta da existência de tokens.

Somente o SHA-256 do bearer é enviado ao banco. A função privada `helpdesk_auth.revoke_session(text)` elimina apenas o registro que corresponda ao digest. Não altera credencial, conexão, vínculos, outras sessões ou histórico de chamados. A posse do bearer é suficiente para descartá-lo: o fluxo não exige vínculos ainda ativos, mas continua sujeito ao limitador de entrada por IP confiável.

A operação não cancela comandos já autorizados/em andamento. Ela bloqueia a utilização do bearer em futuras validações após o commit da revogação. Não é revogação global de usuário, logout humano do Supabase, rotação de chave ou suporte incorporado. Também não implementa o backoffice/auditoria administrativa geral do M2.

Se o banco ou a confirmação falhar, 503 não representa logout concluído. Repetir a mesma sessão é seguro. Nenhum fallback em memória é usado. `/capabilities` anuncia `integration_session_revocation` somente se o adaptador correspondente estiver configurado; na demonstração local permanece false e uma tentativa M2M devolve 503.

## 6. Migration e compatibilidade

Migration nova: `20260916000500_m1_session_lifecycle.sql`. As quatro anteriores são preservadas byte a byte. A nova função usa SECURITY DEFINER, search_path vazio, validação estrita de digest, EXECUTE restrito a helpdesk_app e revogação explícita de PUBLIC e papéis de clientes/manutenção quando existentes. São mantidas 23 tabelas.

A versão de schema passa de 0.2.0 para 0.4.0 devido à adição real da função, não apenas para igualar o número da interface. O runtime recusa o schema anterior. Não aplicar o arquivo isoladamente em produção: primeiro executar todas as migrations em banco descartável novo e depois revisar a atualização de um banco de homologação já existente, preservando dados.

## 7. Testes e referências

A suíte SQL passa a 46 casos escritos: 35 anteriores e 11 novos para confirmação de COMMIT, timeouts, limpeza de contexto, sessões pares, workspaces distintos, repetição, expiração, privilégios, formato de digest e concorrência. **Zero cenários SQL foram executados nesta sessão.**

Há testes locais novos em `tests/m1c-*.test.ts`, inclusive regressão do stream vazio encontrada no HTTP de loopback. OpenAPI possui 15 operações em 12 paths. O endpoint novo é aditivo; o shape de tickets/conversas não mudou.

Pisos de homologação atualizados: 325 testes de aplicação, 46 de PostgreSQL e 21 de interface (10 HTTP + 11 browser). Isso não significa homologação aprovada. Fonte e logs precisam corresponder ao código atual e o runtime remoto continua como verificação separada.

Documentação técnica consultada (fontes externas; não são resultados de testes deste repositório):
- node-postgres, Result/command: https://node-postgres.com/apis/result
- node-postgres, transações na mesma conexão: https://node-postgres.com/features/transactions
- PostgreSQL 17, ROLLBACK: https://www.postgresql.org/docs/17/sql-rollback.html
- PostgreSQL 17, timeouts: https://www.postgresql.org/docs/17/runtime-config-client.html

O exemplo `examples/integration-session-lifecycle.http` contém somente variáveis, sem credenciais reais. Usar exclusivamente em backend/cliente HTTP privado contra destino autorizado.
