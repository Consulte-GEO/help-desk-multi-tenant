# Revisão local — v0.15.0

Escopo: R14-04/R14-05, contrato e CLI offline, migration009, guards, fixtures e upgrade. Revisão pelo próprio implementador; sem subagente/revisor independente ou pentest.

- `resolve_human` e `has_scope` leem o mesmo teto versionado. Nenhuma concessão por `assigned_to`, metadata ou papel admin. Escopo não dá acesso a conta. Integrações continuam em sua tabela própria.
- Perfil ausente/[] não concede operações. A migration preserva direitos legados somente de relações humanas ativas já existentes; futuros usuários precisam ser provisionados.
- Table24 sem policy ou grants do app; helpers de getter/alteração/trigger sem EXECUTE público/app. Setter SECURITY INVOKER não promove privilégios. Histórico captura SQL session_user, não a pessoa humana em um futuro painel. Correlação fornecida é rastreio, não autorização nem assinatura.
- Advisory lock por workspace/pessoa + expected_revision + PK. A concorrência e o comportamento dos snapshots precisam ser testados no PostgreSQL, não estão comprovados por sentinelas.
- `UPDATE`/`DELETE` de histórico são recusados por trigger. Um owner pode alterar DDL ou usar TRUNCATE; isto não é WORM nem substitui governança do login de provisionamento.
- Recibo de nota continua escopado ao principal/operação/chave; notes:write/tickets:read/operator exigidos na leitura do cache. Collection SELECT continua dependendo de notes:read. Não se adicionou INSERT RETURNING, que exigiria avaliar SELECT. Datas de cache/quota não mudaram.
- Novo plano não carrega driver, abre conexão ou herda URLs. Lê arquivo regular sem seguir symlinks, verifica descriptor e lê no máximo16KiB+1. Saída contém IDs/motivo de configuração e deve ser tratada como documento administrativo, não publicada nos logs/clientes.
- Quantidade de tabelas no readiness estava hardcoded23; regressão falhou e passou com inventário central. Vários fixtures de sucesso precisaram indicar a nova versão e cardinalidade, sem remover testes negativos.
- Typecheck encontrou `await` em callback não async de uma nova asserção SQL. Corrigido o teste e repetido o compilador suplementar. SQL não executado.
- As migrations001–008 estão intactas. Nona migration e schema0.15 são mudança real. OpenAPI só versão; não há nova rota, nova GUI administrativa ou nova dependência.
- R14-06 (generalização de evento/outbox no banco) permanece aberto. Esta entrega não recalcula SLA, cria dispatcher, envia notificações ou resolve a revogação imediata de JWTs.

Referências consultadas: PostgreSQL17, Row Security Policies; CREATE POLICY; CREATE TRIGGER; PL/pgSQL Trigger Functions. Elas justificam os mecanismos, não homologam este SQL. URLs registradas em docs19.
