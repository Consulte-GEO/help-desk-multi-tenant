# Continuidade — Help Desk v0.8.0

Base `d05f6f6f430dd624a7c550f81d81d895e858c156`; branch local `work/helpdesk-v0.8.0`. Commit final no manifesto externo/bundle. Nenhuma publicação, migration remota ou mudança de dados, segredo ou MFA. GitHub retornou vazio nesta rodada; Supabase/Netlify não reinspecionados. Ler documentos 04/12, README, CHANGELOG e OpenAPI. Não presumir que os destinos continuam no mesmo estado antes de integrar.

## Próximos passos
1. Resolver dependências (`npm run deps:resolve`) com acesso autorizado ao registry. Revisar lock real, origens, integridades, licenças/alertas. Repetir npm ci/verify/audit. Não usar lock sintético ou tipos globais como aprovação.
2. Executar PostgreSQL 17 descartável: sete migrations, login restrito e **82 cenários escritos**. Testar fresh install e upgrade 001–006 → 007 com dados fictícios. Docker padrão; native só com instalação local autorizada e usuário não root. Nunca usar Supabase real como fallback.
3. Revisar priority_event_shape/priority_outbox_shape, guard, trigger diferido, coluna UPDATE, RLS e helpers de idempotência. Confirmar rollback por evento/outbox ausente, concorrência, no-op, replay após revogação e ausência de motivo no payload público/externo. Testar schema_version e login de runtime. Sentinelas textuais não são execução SQL.
4. Executar browser com **22 verificações escritas**, além dos **22 checks HTTP**. Conferir save, 412 real de outra sessão, rascunho durante requisição, troca de perfil/ticket, histórico tardio, paginação, foco/teclado/390px. O navegador desta sessão bloqueou em page.goto. Não contornar políticas do ambiente.
5. Homologar Auth humano/M2M, pooler/TLS, IP, driver e Functions com `pg` instalado. Backend 0.8.0 exige schema 0.8.0; não publicar somente HTML ou manter schema 0.5.0.
6. Executar homologate:local / check:homologation; revisar fingerprints/logs e contagens reais. Piso: 569 locais, 82 SQL, 44 HTTP/browser. Aprovação local não autoriza produção. Manter HELPDESK_RELEASE_APPROVED fechado até critérios de destino/operacionais e decisão explícita.
7. Homologar carga/capacidade, restauração, retenção e revisão independente. M1 permanece aberto; backoffice/identidade administrativa M2 ainda não iniciado.

## Revisão dirigida
- `ticket-priority.ts`, `HelpdeskService.changePriority`, `PostgresStore.updatePriority` e serialização de evento.
- Migration 007, sobretudo lookup_idempotency e limit_idempotency_records preservando lifecycle/quota anteriores.
- `web/timeline-state.js`, `web/mutation-state.js` + declaração, `web/app.js`, formulário e seção de histórico.
- `tests/m1g-*`, `supabase/tests/rls.test.ts`, browser e smoke-local-http.
- Contrato OpenAPI/exemplo, capacidade e fronteira de erro.

## Invariantes
Motivo só para operador; não em DTO cliente, ticketDto ou outbox. Mesmo valor não aumenta versão. Reenvio é resposta original, não leitura atual. Campo de prioridade não altera SLA/contrato. ETag e cursor não concedem acesso. Uma falha após commit é resultado incerto. Não abrir endpoint de notas ou histórico global para facilitar a interface. Histórico não é WORM/admin audit nem prova de notificação enviada.

Os testes locais incluem fixtures/controladores em memória e doubles PostgreSQL. Não somar aos 82 SQL ou 22 browser não aprovados. Não houve revisão independente, pentest, carga ou restore. O ZIP não autoriza publicação.
