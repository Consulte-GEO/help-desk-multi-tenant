# Help Desk M1-R17 — Estado e evidências

**01/10/2026. Implementação local; M1 aberto. Sem homologação hospedada.**

Base upstream observada: `78bbb00112331531168ae24600604cb7f3148770` (R9 integrado).
Base local: pacote R16, commit declarado `1171b21516b77fadeafb3e5092a62344af3c57e6`, fingerprint conferido `85ab24a0f2c22f10851601a7cf0369974e250276d1da99e1cc2df8ae738d37c1`.
O SHA256 do ZIP recebido e seus 371 arquivos inventariados foram conferidos. A recuperação local não é a história completa do GitHub. O baseline R16 passou nos 1.375 testes.

## Entrega
Ponte entre o cliente de aceitação existente (28 controles prévios + 43 etapas humano/M2M) e a suíte PostgreSQL descartável. Seis cenários registrados na suíte principal: percurso completo seguido de reexecução integral, e perda da resposta HTTP após cada uma das cinco mutações válidas (criação/mensagem humanas, prioridade, criação/mensagem M2M).

A fixture foi escrita para usar `helpdesk_app` em toda autenticação privada e operação de atendimento. O administrador só prepara dados sintéticos e observa os efeitos privados. O provedor de identidade humana permanece sintético; a resolução de grants e a sessão opaca M2M passam pelo adaptador real quando a suíte SQL é executada. Nenhum endpoint de observação privado foi exposto.

A observação reúne em um SELECT tickets, mensagens, notas, eventos, outbox, recibos idempotentes, audit_events e write_effects do workspace de teste. Cada leitura, resolução, replay ou recusa exige ausência de alterações persistentes nesse recorte. Os dados ficam em memória. Erros de comparação não imprimem os corpos.

Os cenários esperam dois tickets novos, duas mensagens, cinco eventos, cinco intenções de outbox, cinco write_effects e cinco recibos, sem nota ou audit_event novo. Não se inventou auditoria de operação que o código atual não produz. Conferem autoria, versões, namespace dos recibos, snapshot contratual, vínculos de evento/efeito/outbox e correlação com a primeira requisição. Reenvios completos devem preservar todos os registros.

**Os seis cenários PostgreSQL NÃO foram executados nesta rodada.** Os 14 testes Node novos validam somente o comparador/observador com respostas SQL sintéticas. Não transformar esses resultados em prova do SELECT, da fixture SQL, dos constraints/triggers ou da autorização no banco.

## Evidências da rodada
Caminhos relativos a `evidence/m1-r17/`.

| Verificação | Resultado | Arquivo |
|---|---|---|
| R16 recuperado | 1.375 aprovados | 01-baseline.log |
| Testes escritos primeiro | 14 falharam pela ausência do módulo, antes da implementação | 02-red.log |
| Helper implementado | 14 aprovados | 03-green.log |
| Mutação deliberada do comparador | Desativar a comparação provoca 8 falhas; restauração dá 14 aprovações | 09-mutated-oracle.log; 10-restored-oracle.log |
| TypeScript suplementar inicial | Detectou TS2775 e narrowing; corrigidos com funções de asserção declaradas | 06-typecheck-supplemental-first.log |
| TypeScript suplementar final | Exit 0, TypeScript 5.8.3/tipos globais Node25.1.0 | 22-typecheck-supplemental-final.log |
| Aplicação final | 1.389 aprovados, zero falhas/cancelamentos/skips/TODO | 24-final-tests-complete.log |
| PostgreSQL | Docker ausente; 215 cenários escritos, zero executados | 04-postgres-attempt.log |
| Import do módulo SQL | Sem conexão; apenas conferência de carregamento | 11-sql-import-check.log |
| Interface | 35 HTTP em memória aprovados; browser recusado por ERR_BLOCKED_BY_ADMINISTRATOR | 17-interface.log |
| Instalação padrão | Tentativa terminou no limite da ferramenta, sem resultado de instalação | 19-install.json |
| Audit | Exit 1, EAI_AGAIN no registry oficial | 20-audit.log |
| Verify | Aplicação passou; falhou no typecheck padrão por tipos Node/pg ausentes | 21-verify.log |
| Migrations/lock/contratos/scan/build | 11 migrations intactas, lock coerente,18 operações; scan heurístico e frontend estático | 12–16 |
| Gate | Não aprovado, evidência de homologação ausente | 18-gate.log |

A tentativa parcial 23 foi interrompida na ferramenta antes do resumo TAP; não foi contabilizada como aprovação. O ensaio completo é o 24. Build estático não comprova bundle de Functions. A checagem global não substitui a toolchain do lock. Os seis testes TLS herdados estão incluídos nos 1.389.

## Compatibilidade e revisão
API/interface0.19.0, schema0.18.0,11migrations e lock preservados. Nenhuma alteração em `src/`, `web/`, `netlify/`, contratos HTTP, permissões ou clientes de aceitação. Nenhum novo comando. O mínimo da suíte SQL passa de209 a215; aplicação de1.375 a1.389. O gate não aceita a execução antiga como prova do código novo.

Revisão local pelo executor: limites do workspace, identidade Auth distinta do principal, uso exclusivo do login restrito no handler, registro dentro do describe existente, fixtures próprias, preservação de chaves/intenções, falhas sem corpo privado e ausência de consumidor de outbox. Não houve revisor independente.

## Limites ainda abertos
As fotografias antes/depois não demonstram ausência de efeitos transitórios nem fora das oito coleções. Cinco transaction_ids distintos não são, sozinhos, prova de atomicidade; os constraints/triggers e testes já existentes precisam rodar em PostgreSQL. As perdas simuladas ocorrem após a resposta do handler, não no COMMIT do servidor.

Nada nesta entrega comprova Supabase Auth real, TLS do banco, Function hospedada, concorrência real no destino, entrega de outbox, carga, backup/restore, residência, RPO/RTO ou operação. Sem push/PR/merge/deploy/migration remota, mudanças de usuário, segredo, dados ou gate de produção.

Fingerprint executável final: `3819e2205d51535df464faff626c7cfed1969d5d979a81d98aa5d7b5d1248df8`. O commit local final consta no manifesto do pacote, evitando autorreferência.
