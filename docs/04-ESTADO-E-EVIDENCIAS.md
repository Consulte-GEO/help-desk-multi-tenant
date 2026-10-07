> **HD-P03 — 06/10/2026:** homologação hospedada na mesma base/site HelpDesk, conforme decisão do usuário. CI Linux 1.447/215/79 aprovado; PR4 pronto para revisão. Aceite Auth/Function/base atual permanece pendente. Leia [116-HD-P03-HOMOLOGACAO-NA-MESMA-BASE.md](116-HD-P03-HOMOLOGACAO-NA-MESMA-BASE.md).

> **Decisão do usuário — 06/10/2026:** homologar no site helpdesk-consultegeo e na mesma base/Auth HelpDesk existentes. Não exigir nem criar ambiente separado. [Política HD-P03](116-HD-P03-HOMOLOGACAO-NA-MESMA-BASE.md) substitui as exigências anteriores de destino isolado.

> **HD-P02 — 06/10/2026:** recuperação da abertura corrigida;14 testes focais e79 verificações de interface aprovados. Windows1447/1424/23 (mesmas falhas anteriores); CI novo/aceite hosted pendentes. Leia [115-HD-P02-RECUPERACAO-DA-ABERTURA.md](115-HD-P02-RECUPERACAO-DA-ABERTURA.md). M1 operacional aberto.

> **Estado pós-merge — 06/10/2026:** leia [HD-P01](114-HD-P01-ESTADO-POS-R24.md), que prevalece sobre o histórico abaixo. CI R24 1436/215/71; gate hospedado fechado; M1 operacional aberto.

# Estado corrente — Help Desk M1-R24 / 05-10-2026

Fonte atual: [113-M1-R24-REVISAO-E-ESTADO.md](113-M1-R24-REVISAO-E-ESTADO.md). Base R23 `072287f`, R20–R22 integrados. M1 operacional aberto; M2 não iniciado.

Instalação, audit, typecheck, contratos, segredos, build e conferência das evidências passaram localmente. Node Windows: 1.413 aprovados, 23 falhas, sem skips; Docker/Chromium indisponíveis. CI Linux histórico R23: 1.436 Node, 215 PostgreSQL e 71 HTTP/browser aprovados. Esses estados não se substituem.

Site atual `helpdesk-consultegeo`, ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`; frontend respondeu HTTP 200 e a Function R23 respondeu 503 `release_gate_closed`. Supabase HelpDesk: onze migrations e 25 tabelas privadas com ENABLE/FORCE RLS; `helpdesk_app` sem superuser/BYPASSRLS. A introspecção não comprova TLS/grants/login dentro da Function ou homologação hospedada.

Registro anterior preservado em [histórico R23](history/r23-04-ESTADO-E-EVIDENCIAS.md).
