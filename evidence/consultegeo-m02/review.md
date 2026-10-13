# Revalidação independente Consulte GEO M02/M03

HEAD: d3ed04db2f38be29a725f9ac59b5631ccf3f5849. Base cumulativa: 604478e2d05ed019baac6d92a9a04db236fafb82. Releitura do diff corretivo contra 3fb1e4664cb462bf0e00d8a7e0bb4249c25b30b7 e dos contratos relacionados ao incremento. Código/Git preservados; apenas este relatório foi escrito. Sem rede, hosted ou envio real.

**Resultado: nenhum Critical ou Important restante identificado nesta revalidação de fonte.** A qualificação PostgreSQL17 do HEAD segue pendente; isto não é aprovação de implantação ou da operação integral.

## Achados anteriores

- **Destino inelegível — corrigido em fonte.** `supabase/candidates/hdn_support_workflow.sql:376` admite no fallback somente administrador do workspace; o outro caminho exige grant agent ativo na conta. Continua exigindo identidade humana ativa, scopes read/write e cobertura integral observada/lockada. Novo teste SQL usa destinatário workspace agent e account_manager da conta e exige `workflow_assignee_denied`, sem efeitos parciais.
- **Janela retrodatada — corrigido em fonte.** `supabase/candidates/hdn_support_workflow.sql:294` compara a janela com `clock_timestamp()` em microssegundos numéricos. Replay segue anterior a essa elegibilidade. O teste SQL agora envia comando retrodatado completo (hash/audit/receipt coerentes), exige precisamente `HDW10` e confere estado/contagens preservados; não depende de uma recusa por payload incompleto.
- **Histórico de transferência — corrigido e testado localmente.** `src/http/serialization.ts:14` e `web/timeline-state.js:21` aceitam transfer; apresentação em :56 identifica atendimento transferido. O DTO mantém somente action/reason/version, sem IDs do destino. Teste novo percorre serializer, coleção e apresentação; clientes e ações desconhecidas continuam recusados. Regressões de claim/release passaram.

## Mudanças adicionais

- Resend exige texto não vazio após trim, ACK positivo com único campo id válido e nome de rejeição tipado como string. ACK contraditório permanece desconhecido. Testes novos passaram; timeout/replay continuam sob o dispatcher existente, sem retry interno.
- A fixture SQL prepara chamados existentes antes de proteger o produto pela conexão de origem. A mudança não remove RLS, altera grants da aplicação ou afrouxa o INSERT genérico. Depois, vincula recursos/perfis em fixture administrativa descartável e executa os comandos com login restrito. Não comprova intake/publisher real.

## Evidência executada

220 testes Node passaram, 0 falhas, 0 skips, em duas execuções não sobrepostas:

1. 86: support-workflow, support-workflow-postgres-store, support-workflow-durable-composition, resend-channel, consultegeo-email-brand, consultegeo-service-policy e consultegeo-transfer-timeline.
2. 134: m1g-timeline-state, m1h-assignment, notification-template, outbox-dispatch, support-workflow-application e support-workflow-checklist-composition.

Nenhuma execução PostgreSQL local. CI PG17 em andamento foi informado pelo implementador; não consultei rede nem afirmei seu resultado. Os testes novos SQL foram revisados como fonte, não certificados nesta revisão.

## Limites mantidos

O leitor semântico M06 foi explicitamente confirmado pelo implementador como próxima etapa. Corpos de request_customer/customer_reply com mudança de estado/resolve ainda ficam no ledger privado e não entram no reader público atual de ticket_messages. Não abrir SELECT do ledger privado; manter como impedimento de montagem até existir projeção autorizada. A spec versionada neste HEAD ainda não nomeia M06 nem essa limitação diretamente; recomenda-se registrá-la na documentação final.

Políticas e templates continuam draft; runtime, worker, publisher, montagem hospedada e jornada real não estão entregues por este incremento. Gate continua fechado. Nenhum Minor de código separado.

## Adendo — inspeção final em dac32bef6e116f499cf9edc1544ceccf69d1bc6b

Conferido o delta de uma linha contra d3ed04db: `tests/m1h-ui-contract.test.ts:21` troca a ação inválida do teste negativo de transfer (agora válida) para replace (continua inválida). A negativa permanece ativa, assim como o positivo dedicado serializer→timeline. Não há mudança adicional de implementação nem afrouxamento de autorização neste commit. Sem novo Critical/Important identificado; não repeti os 220 testes.

Li também a spec modificada ainda não commitada e `docs/139-CONSULTEGEO-WORKFLOW-E-EMAIL-2026-10-13.md`. Ambos agora explicitam o leitor semântico público M06, o vínculo por ID/revisão, a ausência dos textos no reader vigente e o impedimento de montagem, sem liberar SELECT do ledger privado. A pendência documental anterior está atendida.

O implementador informou PG17 355/355 no CI d3ed04db e aplicação 4317/4318, com única falha nesse teste negativo histórico; não consultei os logs/rede nesta revisão. O CI integral de dac32be permanece em andamento, sem aprovação afirmada. O trecho Validação do documento139 ainda referencia d3ed04db como em execução e precisa ser reconciliado pelo implementador com a evidência final antes do registro definitivo.
