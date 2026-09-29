# M1-R4 — eventos do cliente nas transações de atendimento

Base: M1-R3, fingerprint 7ea5f2ff652f5a26e729e13400b7898a6a417350499cf268aab6d2afbe82196b.
Objetivo: estender a proteção necessária ao runtime normal, não criar outra feature de diagnóstico.
Escopo: src/infrastructure/transaction.ts, testes unitários/eventos e cenários PostgreSQL descartáveis. Não altera migrations, permissões, Auth, API ou gate de produção.

## Contrato e aceite
Uma observação estável por cliente físico captura apenas o fato do erro, nunca conteúdo, identidade ou credenciais. Não remove listeners de outro proprietário e não acumula listeners por requisição. A falha torna a conexão inutilizável; o pool continua sendo o dono da destruição efetiva.
Antes de enviar COMMIT, falha de transporte => 503/database_unavailable. Depois de enviá-lo, sem confirmação confiável => 503/transaction_outcome_unknown. Nunca repetir a mutação ou trocar a chave. Falha depois de COMMIT já confirmado, apenas ao liberar/ficar ocioso, não desfaz a gravação confirmada.
Todo SQL, inclusive aquele solicitado pelo callback, usa a mesma conexão e verifica sua saúde. Após erro fatal não há SQL novo, inclusive tentativa inútil de ROLLBACK. Uma rejeição SQL comum continua tentando um ROLLBACK e preservando o erro original. Encerrar o callback invalida seu cliente emprestado; liberar o cliente é responsabilidade exclusiva do runner.

## Execução
- [x] Recuperar fonte por fingerprint, confirmar remoto e baseline 1114.
- [x] RED: 18 casos, 16 falhas e 2 aprovações; subprocessos reproduzem crash por evento não tratado.
- [x] Implementar guarda e validar casos novos + regressões existentes.
- [x] Escrever casos pg de interrupção física e reuso; executar só em banco descartável autorizado.
- [ ] Validar suite completa, integração do patch, migrations e limites da evidência.
- [x] Atualizar handoff/backlog e pacote consolidado.

Sem autorização atual, nenhuma escrita remota. Sem PostgreSQL/driver real, cenários SQL permanecem ESCRITOS, não EXECUTADOS.

## Resultados de execução
19 casos novos Node aprovados,30 focais com regressões;verify executou1133/1133 e depois falhou no typecheck padrão. Três casos PostgreSQL adicionados (207 totais),sem execução por Docker ausente. TLS6/HTTP35 passaram;browser bloqueado. Audit/instalação indisponíveis. Typecheck suplementar passou. Não houve publicação ou alteração remota.

## Fechamento do pacote
As duas variantes foram aplicadas em bases limpas e produziram o mesmo fingerprint final. A suíte na aplicação limpa cumulativa aprovou1133/1133. Handoff,backlog e estado atualizados;sem publicação.
