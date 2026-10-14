# Registro local Consulte GEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fornecer autorização persistida de contas e obras locais para a jornada Consulte GEO, sem integrar Novo GEO.

**Architecture:** Registro local explicitamente identificado, reusando vínculos, publicação completa e revisões já existentes. CLI privado prepara/aplica somente comandos declarativos de clientes/obras/permissões reais por operador qualificado, com CAS/recibo. Helpers limitados entregam contexto ao resolver e ao seletor autenticado; cadastro não cria usuários ou MFA.

**Tech Stack:** PostgreSQL17, TypeScript Node22, pg8.16.3.

**Spec:** docs/superpowers/specs/2026-10-14-consultegeo-operacao.md

## Global Constraints

- Não simular origem Novo GEO, principal, AAL2, grants ou protocolo legado confirmado.
- Administração exige capability e MFA atuais.
- Clientes serão cadastrados localmente; nenhum cliente fictício de homologação será criado em produção.
- Protocolo novo deve ter namespace distinto do legado se o último número não estiver confirmado.

## Review Focus

- Revogação ou obra desativada bloqueia toda seleção sem deixar observação anterior autorizar.
- Alteração concorrente da conta/obra/permissão deve invalidar CAS e reverter efeitos.
- TTL vencido não é renovado por timestamps fabricados no leitor JS.
- Operador app/clientes/SET ROLE não pode executar provisioning; humanos existentes e escopos preservados.
- Seleção entre contas, namespaces ou tickets alheios nunca passa pela metadata do picker.

### Task 1: Registro, provisioning e portas de leitura

**Files:** Create supabase/candidates/cg_local_registry.sql; src/infrastructure/consultegeo-local-source.ts; src/application/consultegeo-local-provisioning.ts; scripts/plan-consultegeo-local.ts; tests/consultegeo-local-source.test.ts; tests/consultegeo-local-provisioning.test.ts; supabase/tests/local-registry-scenarios.ts. Root owns wiring into rls.test.ts, migration manifests, security inventory, runtime and UI.

**Interfaces:**
- Consumes existing core accounts/products/instances/contracts/coverage and cg_resource grant/publication tables. Server source contract ResourceAccessAuthority.readAccess(query,signal), TicketResourceDirectory.readTicketResources(principal,ticketId,signal).
- Produces createPostgresLocalConsulteGeoSourcePorts(pool) using cg_local_read_access(connection uuid,tenant text,operation text), cg_local_ticket_directory(ticket uuid), cg_local_request_contexts(). Fixed exported local manifest fingerprint qualified in source. No env/caller supplied authority.
- Produces planConsulteGeoLocalProvisioning(input) bounded offline SQL plan for operator with workspaceId,expectedRegistryRevision,requestId,reason,accounts,works,permissions. Existing human IDs only, account relationship/scopes must already authorize requested operations; no implied broad grants/scopes. Completeness/publication state/observations/receipt written atomically. Proof of local source must be explicit and match during SQL admission. Actual private execution is a separate operator step; no live SQL from plan command.
- Native scenario runLocalRegistryScenarios(suite,admin,app) or existing fixture convention, candidate loaded only in owned disposable PG17. Root integrates scenario into native gate.

- [ ] Write focused unit/native tests for positive complete local source and each Review Focus condition. Observe unit RED; document native qualification need.
- [ ] Implement candidate SQL operator admission, local metadata/provisioning receipts and atomic compatible complete publication. Persisted asOf/expiresAt must match resolver and SQL admission exactly; refresh is true republication with unchanged current local decision.
- [ ] Implement server adapters and bounded offline CLI without actual clients/fake data in production.
- [ ] Run focal Node tests/typecheck; hand root native scenario and security additions to qualify.
- [ ] Commit owned files only; no remote writes, versions/manifests/runtime/UI changes or deploy.

### Task 2: Promover e montar jornada

**Files:** Root owns append-only migration/security version and runtime.ts/api.mts; web/app.js with existing request components.

**Interfaces:** Consumes Task1 helpers and ports, returns authenticated contexts and published form catalog. Existing drafts/opening stores continue to revalidate SQL scope.

- [ ] Qualify CLI-generated append-only migration and native inventory with all existing contracts preserved.
- [ ] Wire local source after restricted runtime pool is created; expose bounded authenticated contexts under existing Origin/rate/auth boundaries.
- [ ] Mount picker/catalog/existing request components; no fallback IDs, memory fixtures, unavailable lookup/files capability.
- [ ] Bind separate new protocol namespace by explicit operator decision; preserve historical receipt reading. Publish usable configured services only after actual adapters are ready.
- [ ] Review, full CI, actual hosted promotion/acceptance then enable qualified support flags.
