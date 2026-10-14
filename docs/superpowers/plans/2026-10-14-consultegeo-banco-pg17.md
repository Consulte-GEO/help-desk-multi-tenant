# Compatibilidade do operador PostgreSQL17 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promover a cadeia0.19→0.23 pelo operador hospedado sem ampliar privilégios do app ou dos serviços.

**Architecture:** Guard único como fragmento SQL compartilhado pelo compilador e wrappers finais, com perfil bootstrap exato e proprietário comum qualificado. Evidência explícita da revisão dos guards preserva histórico e corpos funcionais. Instância PG17 descartável independente reproduz o login real.

**Tech Stack:** TypeScript Node22, PostgreSQL17, Supabase CLI2.120.0, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-10-14-consultegeo-operacao.md

## Global Constraints

- Preservar byte a byte migrations001–012 implantadas, seis corpos candidatos qualificados e fixtures históricos.
- Schema permanece0.23, sem alterar funções/tabelas/policies.
- Não modificar GlobalCad.
- Upgrade remoto somente após CI original completo e revisão.

## Review Focus

- Papel de serviço com acesso por SET/INHERIT deve recusar; não normalizar grant perigoso.
- Proprietários diferentes nos quatro schemas ou administrador sem atributos exigidos devem recusar.
- Grantor superusuário diferente de OID10 deve recusar mesmo com flags idênticos.
- Falha posterior à criação dos papéis deve reverter papéis, módulos, dados e versão.
- Drift de defaults globais/locais e direitos efetivos deve recusar runtime e promoção.

### Task 1: Revisão qualificada dos guards e prova nativa

**Files:**
- Modify: scripts/consultegeo-upgrade.ts, src/infrastructure/database-security.ts
- Modify: supabase/migrations/20261013181408_consultegeo_m05_upgrade.sql, 20261013195704_consultegeo_m06_public_conversation.sql, 20261013233838_consultegeo_m09b_intake.sql, 20261014015714_consultegeo_m09c_atomic_opening.sql
- Modify: supabase/migrations.manifest.json, supabase/consultegeo-upgrade.manifest.json
- Create: scripts/consultegeo-service-membership.ts and explicit guard-revision manifest/test as appropriate
- Test: tests/consultegeo-upgrade*.test.ts, prefix M06/M09c tests, native non-super operator suite/runner

**Interfaces:**
- Consumes: current four guards and qualified immutable candidate bodies; PG17 pg_auth_members flags.
- Produces: exact accepted service membership predicate and READINESS_FLAGS owner_defaults_ok. Existing readiness API and inventory remain otherwise unchanged. Second native cluster participates in existing PostgreSQL homologation gate; no synthetic native proof.

- [ ] Write regression proving non-super direct login upgrades full16 migration chain and app readiness accepts exact bootstrap grant. Add negative tests for each Review Focus condition and legacy prefix preservation via enumerated guard-only transformation.
- [ ] Observe RED before changing implementation; retain original output in plan workspace. Local Windows may prove unit RED while native RED runs original CI on Linux PG17.
- [ ] Implement qualified owner/bootstrap predicate, guards, readiness defaults and hash-bound revision without editing historical fixtures. Retain strict preexisting role admission in M05.
- [ ] Run focal tests/typecheck/check:migrations/check:consultegeo-upgrade and complete original CI, including real separate native cluster, no skips/fallback.
- [ ] Commit only owned changes; root manages integration, review, deployment and remote upgrade.

### Task 2: Hosted promotion and verification

**Files:** evidence/publication-20261014 and new activation evidence/documents.

**Interfaces:** Consumes Task1 qualified SQL and CI source fingerprint. Produces actual hosted schema0.23 with first12 history preserved, catalog/data receipts and restricted-role readiness.

- [ ] Independently review Task1 whole change and fix material findings.
- [ ] Capture fresh provider backup state and encrypted private data receipt; compare immutable deployed SQL history.
- [ ] Regenerate exact qualified operator SQL wrappers with migration history recorded in the same transaction and apply sequentially through operator Management API.
- [ ] Verify schema/functions/tables/ACL/membership/defaults and preserved real data; keep business/email gates closed until their dependencies are qualified.
- [ ] Integrate approved source and publish through existing Netlify Git workflow; verify actual deploy identity and public endpoints.
