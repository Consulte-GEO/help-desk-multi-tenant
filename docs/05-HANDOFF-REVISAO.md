# Continuidade — Help Desk v0.9.0

Base: `ce9a49e0e7616fc8a4a6425c478d6218499bd177`; branch `work/helpdesk-v0.9.0`. Commit final no manifesto/bundle. Sem escrita nem reinspeção remota nesta rodada. Reinspecionar destinos antes de integrar e preservar trabalho concorrente.

## Execução prioritária
1. Resolver dependências via `npm run deps:resolve`, revisar lock/árvore/origens/integridades/alertas; executar npm ci/verify/audit. Não substituir tipos locais por globais ou copiar lock sintético.
2. PostgreSQL17 novo e descartável com login restrito: oito migrations/100 cenários. Docker padrão; native exige instalação autorizada e usuário não root. Nunca usar Supabase remoto como fallback nem apagar schema existente para passar.
3. Além de fresh, homologar upgrade001–007→008 em banco separado com dados fictícios. Coluna assigned_to nasce null. Cache antigo sem campo deve continuar representando o snapshot original. Verificar concorrência, reenvio após release/revogação, schema0.9.0 e dados anteriores intactos.
4. Revisar guard_ticket_assignment, require_assignment_event, assignment_event_shape, unique index, event_scope_insert e assignment_outbox_forbidden. Não conceder acesso por assigned_to; não exigir membership global de agente vinculado só à conta. Helpers privados não executáveis por clientes/app; funções de cache preservam scopes/lifecycle/quota.
5. Rodar UI:28 HTTP+25 browser. Verificar assumir/liberar, conflito entre dois operadores, 412, refresh explícito, erro de rede incerto, rascunho durante request e A→B→A. Cliente não recebe assignment ou motivo/evento interno. Teclado, foco e mobile390px pendentes. Não contornar bloqueio do navegador.
6. Homologar pg/driver/Auth/pooler/TLS/IP/Functions. Não publicar apenas HTML nem backend0.9 com schema0.8. Medir queries/timeouts e efeitos do trigger diferido sob concorrência.
7. Executar homologate:local/check:homologation, revisar logs/fingerprint. Piso635 locais/100 SQL/53 UI; as contagens só valem se efetivamente passarem sem skips. Sucesso local não autoriza produção. Manter HELPDESK_RELEASE_APPROVED fechado até critérios operacionais/destino e decisão explícita.

## Revisão dirigida
- `src/application/ticket-assignment.ts`, HelpdeskService.changeAssignment, updateAssignment nos dois adaptadores.
- DTO/evento e lookup_idempotency após downgrade de agente.
- Migration008 e 18 testes SQL novos; sete migrations anteriores inalteradas.
- `web/app.js`, `ticket-list-state.js`, `timeline-state.js`, mutation-state e declarações.
- `tests/m1h-*`, smokeHTTP, browser e OpenAPI/exemplo.

## Invariantes
Claim somente para si em desocupado; admin libera mas não toma. Release próprio/admin com motivo. Encerrado/cancelado não muda. Nenhuma mudança de estado/contrato/prioridade/fila/SLA. Responsabilidade não participa de canReadTicket. Histórico/IDs internos não saem ao cliente; resumo do operador não inclui IDs alheios. Não produz outbox. Retry mesma chave devolve versão original; GET é o estado atual. Erro pós-COMMIT é incerto, não “não gravou”.

635 testes locais incluem doubles/estado puro. SQL100 e browser25 não foram aprovados; nenhum pentest/carga/restore/revisão independente. M1 continua aberto; M2/backoffice não iniciado. Atribuição é recorte de HD-301, não módulo completo de filas/equipes.
