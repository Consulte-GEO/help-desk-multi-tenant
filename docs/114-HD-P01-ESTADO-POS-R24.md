# HD-P01 — Estado pós-merge R24 e continuidade

Conferido em 06/10/2026 (America/Sao_Paulo). [Plano](superpowers/plans/2026-10-06-helpdesk.md), [fotografia inicial](roadmap/2026-10-06/LEIA-PRIMEIRO.md). Base documental local `7d92c62`; executável publicado `b4dd00040605bd11f22d97636b5a973075e7cef2`.

## Código, CI e publicação

- Remoto GitHub `github`: `Consulte-GEO/help-desk-multi-tenant`. `origin` continua bundle local histórico. `git ls-remote --symref` reconfirmou branch padrão `codex/m1-reproducibilidade` e HEAD `b4dd00040605bd11f22d97636b5a973075e7cef2`, sem atualização concorrente nesse HEAD.
- [PR3](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/3) integrado; R10–R24 não precisam ser reaplicados.
- [CI 37384076809](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37384076809): job `homologation` reconfirmado success pela API GitHub. Artefato da sessão anterior relido: attempt local `e2913b45-3902-470b-914b-cf01bdb3ac6d`, 1436 aplicação, 215 PostgreSQL, 71 HTTP/browser, todos pass/zero fail/skip. Fingerprint `659e9ad6d69d822888486a59b2c9c6bf5d39c7a3ec1391ee29fd048c0e9a6a82`, `scope: local-m1`, `platform_approved: false`. Não reexecutado nesta sessão.
- Netlify site `helpdesk-consultegeo`, ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`: [deploy 6ac427a3d1cf2d0008b257c8](https://app.netlify.com/projects/helpdesk-consultegeo/deploys/6ac427a3d1cf2d0008b257c8) ready/current reconfirmado pelo conector, commit `b4dd000`, Node22, Function `us-east-2`. Outro site histórico não é este destino.
- Novo GET sem credenciais ao [public-config do permalink](https://6ac427a3d1cf2d0008b257c8--helpdesk-consultegeo.netlify.app/v1/public-config): 503 `release_gate_closed`, request ID `efbfedd2-4b91-4a6c-9d1b-c3137b4b6be4`. Não comprova login, TLS/pooler ou banco pela Function.
- API/interface 0.19.0, schema esperado 0.18.0, 18 operações. **M1 operacional aberto; M2 não iniciado.**

## Mapa das migrations

Projeto Supabase HelpDesk `xaelbntjnvztznnpcvtm`. Consulta somente leitura ao ledger: `version`, `name`, `md5(array_to_string(statements, E'\n'))`, `cardinality(statements)`. Cada entrada tem um statement; MD5 dos bytes dos onze arquivos locais igual ao conteúdo registrado. MD5 é conferência operacional, não prova criptográfica nem validação de grants/RLS. Manifesto SHA256 local inalterado.

| Arquivo local (sem .sql) | Versão hospedada | MD5 local/ledger igual |
|---|---|---|
| 20260915000100_restrict_existing_definer | 20260928204720 | 48996eff85b236890c273960a34a094f |
| 20260915000200_helpdesk_foundation | 20260928204735 | 644e1a83f5c42064d16a4ca9d127d75e |
| 20260915000300_m1_authorization | 20260928204741 | 218eee80e373e16047d761e6af12d628 |
| 20260915000400_m1_resource_limits | 20260928204748 | a117dcfd611e0c466916c64561a0c1eb |
| 20260916000500_m1_session_lifecycle | 20260928204753 | a02a0eb096ff09964439b60d522bfe16 |
| 20260916000600_support_catalog | 20260928204808 | bf5ddbb1dda985bab0c1e93f0ecb00d1 |
| 20260916000700_ticket_priority | 20260928204814 | 06c5e806ff39d5ceafeeaceb50f82aea |
| 20260916000800_ticket_assignment | 20260928204823 | 16074dcb551607d33f4df258712856b3 |
| 20260917000900_human_scope_versions | 20260928204829 | d4ee1822d87ac0b962b0c0ddeed62f09 |
| 20260917001000_transaction_effects | 20260928204855 | 3410073ec1a1f9455f892b6ca56097a4 |
| 20260917001100_conversation_lock | 20260928204900 | 557349714bf5a3e1da4260b4bc0ce711 |

Não reaplicar migrations por diferença de timestamp. As 25 tabelas privadas ENABLE/FORCE RLS foram conferidas na auditoria anterior, sem nova auditoria de grants nesta sessão.

## Continuidade

Os [38 tickets históricos](roadmap/2026-10-06/TICKETS-HISTORICOS.csv) e [111 capacidades](roadmap/2026-10-06/CAPACIDADES-ATUAIS.csv) continuam relacionados às 33 entregas. Preservar a fotografia; registrar avanços separadamente.

HD-P01: estado/CI/destinos/ledger reconciliados. Próximo incremento HD-P02: regressão e recuperação da abertura sob resposta perdida. HD-P03/04: destino/fixtures hospedados autorizados, clientes read/Auth/write existentes, capacidade/restore e aceite. Não abrir o gate para contornar esses requisitos.

Baseline Windows/Node24.20.0 reexecutada: 1436 testes, 1413 pass, 23 fail, zero skips. Mesmas falhas R24 de POSIX/CI, symlink, OpenSSL/TLS e caminhos; nenhuma foi removida. Código novo exige evidência própria, sem reutilizar fingerprint R24.
