# Worker persistido de emails Consulte GEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materializar e despachar emails Consulte GEO pelo ledger PostgreSQL com entrega Resend correlacionada.

**Architecture:** Canal e máquina existentes são preservados. Papéis privados de worker executam somente helpers limitados; planos e transições/CAS/auditoria são atômicos. Callback nativo verificado é minimizado e correlacionado pelo ID da mensagem no ledger; resultados incertos permanecem incertos.

**Tech Stack:** PostgreSQL17, TypeScript Node22, pg8.16.3, Resend HTTP/Svix.

**Spec:** docs/superpowers/specs/2026-10-14-consultegeo-operacao.md

## Global Constraints

- Reutilizar o canal Resend e a máquina de entrega existente.
- Timeout/ACK incerto não autoriza reenvio com chave nova.
- Remetente deve estar verificado; segredo deve ser privado em Functions Production.
- Teste real somente para destinatário explicitamente autorizado.

## Review Focus

- Dois workers não podem despachar a mesma intenção; COMMIT de sending perdido impede chamada ao provedor.
- ACL/endereço verificado mudado suprime despacho antes da chamada, sem usar endereço do formulário.
- Template não publicado/hash alterado e fonte normalizada incoerente devem recusar.
- Callback duplicado, conflito, fora de ordem ou anterior ao ACK deve ser retido/correlacionado sem inventar intenção.
- SENDING vencido vira UNKNOWN, nunca pending; UNKNOWN não é reenviado após janela de idempotência.

### Task 1: Store e candidato SQL privado

**Files:** Create supabase/candidates/hdn_notification_delivery.sql; src/infrastructure/notification-delivery-store.ts; src/application/resend-delivery-receiver.ts; tests/notification-delivery-store.test.ts; tests/resend-delivery-receiver.test.ts; supabase/tests/notification-delivery-scenarios.ts. Root owns native gate wiring, versions/manifests/security inventory, Netlify mounts and live credential provisioning.

**Interfaces:**
- Consumes NotificationDeliveryStore/DeliveryTransaction in src/application/outbox-dispatch.ts; NotificationPlanTransaction in src/application/notification-outbox.ts; existing parse/new/recover/claim/start/finish/apply DeliveryRecord functions; native requireVerifiedResendEvent in resend-events.ts.
- Produces createPostgresNotificationDeliveryStore(pool) exposing the existing durable delivery and planning contracts, bounded materialization from private immutable sources and NotificationRecipientAuthority. Session/current role exactly helpdesk_notification_worker, no super/bypass/createrole/createdb/replication/inherit/outgoing membership/private ownership; only fixed helper SQL, never application/request pool.
- SQL helpers source normalize ticket.created from hdni snapshot bundle.outbox joined with actual core/outbox/effect. Workflow source projects only semantic IDs/type/version/resourceHash/protocol/instant from immutable workflow commit and actual public event/outbox; no notes/private body. Unhandled source kinds explicit empty routing, never imaginary notifications.
- Published immutable public templates, routing and unique per-event plans/intents; unique event+recipient+channel. Records/leases/attempts/correlation/callback receipts/audit private, no raw address/body/credential in receipts. Worker table rights remain zero; exact helper allowlist required at promotion.
- Verified recipient helper queries only exact current eligible active human via supabase_user_id and verified auth.users email, with current account/ticket/resource/scopes authorization and grant TTL. Current address is dispatcher-only result, never public status/audit. No broad auth.users worker SELECT.
- Receiver correlates verified native event messageID to known accepted providerMessageId under same record/event lock. Unmatched native event persists minimal private receipt for later reconciliation (does not confirm a ticket), including callback before ACK. Stable eventId/hash dedup; stale event times ignored with receipt, contradictory equal-time/terminal flags attention. Do not invent Resend provider sequence: if reducer sequence needed, explicitly qualified local chronological projection of native event timestamp, bounded safeinteger and never receipt-arrival sequence.
- Native scenario exported runNotificationDeliveryScenarios according to existing fixture convention; root wires it after qualifying candidate. Test identity/contact fixtures synthetic only in disposable PG17.

- [ ] Read interfaces/spec and write focused tests for contracts and all Review Focus conditions. Observe unit RED; document original native qualification need.
- [ ] Implement restricted SQL candidate, atomic CAS/claim/source-plan/recipient/template/correlation and adapters. Bind sender channel resend; no provider call inside DB transaction. SQL state invariants deny arbitrary unsafe transition/intent mutation, template hash mismatch and misleading plan effect ACKs.
- [ ] Implement verified native receiver and durable unmatched receipts without mounting public endpoint yet.
- [ ] Run focal Node tests/typecheck and self-review. Report exact native hook/inventory/allowlist plus gaps honestly.
- [ ] Commit owned files only; no remote mutation, existing migration/manifest/security contract/runtime changes, secrets or deploy.

### Task 2: Qualificar e montar operação real

**Files:** Root owns CLI-generated append-only migration/security contracts, netlify/functions scheduled worker/webhook and runtime config.

- [ ] Promote qualified candidate with current native security inventory, role allowlist and original CI/review.
- [ ] Configure restricted worker credential privately with TLS verification; compose worker/scheduler and bounded signed callback; publish immutable templates/routing.
- [ ] Verify authenticated ticket deep links and private callback limits before selecting provider.
- [ ] Confirm configured verified sender/APIkey/webhook secret, run explicitly authorized pilot and record provider acceptance separately from delivery.
- [ ] Enable only qualified gates after actual hosted checks; keep Novo GEO deferred.
