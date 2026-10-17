# SDD ledger — plan: docs/superpowers/plans/2026-10-17-contratos-acesso.md

Base: 0651eb6dde8bbe5119e5f12e9c9b455a97f58cc5
Pre-flight: no shared interfaces; one bounded task.
Ruling: continue the explicitly authorized next priorities in the existing checkout on a dedicated branch; no new infrastructure or approval needed for offline contract qualification.
Task 1: RED12/10pass/2expectedfail observed on the branch before contract changes; GREEN12/12; focal115/115. Initial build failed sandbox DNS ENOTFOUND at npm ci; repeat with normal approved network pending. Direct types, formal45operations, lock and heuristic secrets passed before the build attempt.
Ruling: preserve unrelated OpenAPI bytes/semantics; use generator extension but patch current JSON only on target operations/schema/header definitions.
Build repeated with permitted network: exit0; no dependencies or gates changed. Contract-scope proof passed; target JSON GREEN12/12 after preserving unrelated bytes. Final review pending.
Final reviewer:12/12, generator parity confirmed, no runtime/privacy issue; oneP2 coverage gap. One fix pass added token/schema + synthetic204 body mutants,117/117 focals, direct types exit0. Existing validator already rejected these values; coverage added without claiming a runtime regression or fabricating RED. CI of final source required.
Task 1: complete — final source and merge CI qualified, original logs/report verified by fingerprint; preview 6ad3a95a43409751d62bce22 / 9958b9adee1c1648c70a1ee315cd404ddb81afe8 in10 assets passed. No new production deployment. Later documentary head checks remain an external final delivery check.
