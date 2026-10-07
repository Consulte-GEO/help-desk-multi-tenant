> **Continuidade HD-P03 — produção:** clientes read/Auth/write adaptados a production, três exemplos de site separado removidos e 140 testes focais aprovados. CI Linux run37560232763 aprovado: 1.450 aplicação, 215 PostgreSQL e 79 interface. PR4 integrado em0789dc3 e código publicado em produção (deploy6ac5aaaf); aceite operacional pendente. [Política e evidência](docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **HD-P03 — 06/10/2026:** homologação hospedada na mesma base/site HelpDesk, conforme decisão do usuário. CI Linux 1.447/215/79 aprovado; PR4 pronto para revisão. Aceite Auth/Function/base atual permanece pendente. Leia [docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md](docs/116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **Decisão do usuário — 06/10/2026:** O único ambiente do Help Desk é produção: site helpdesk-consultegeo e projeto Supabase HelpDesk xaelbntjnvztznnpcvtm. Desenvolvimento, implantação e validação hospedada usam esse destino. Não solicitar ambiente ou credenciais de teste ao usuário.

> **HD-P02 — 06/10/2026:** recuperação da abertura corrigida;14 testes focais e79 verificações de interface aprovados. Windows1447/1424/23 (mesmas falhas anteriores); CI novo/aceite hosted pendentes. Leia [docs/115-HD-P02-RECUPERACAO-DA-ABERTURA.md](docs/115-HD-P02-RECUPERACAO-DA-ABERTURA.md). M1 operacional aberto.

> **HD-P01 — 06/10/2026:** PR3/R24 integrado em `b4dd000`; CI R24 1436/215/71 aprovado, gate publicado fechado e M1 operacional aberto. Estado corrente e mapa das onze migrations em [docs/114-HD-P01-ESTADO-POS-R24.md](docs/114-HD-P01-ESTADO-POS-R24.md). Números e destinos anteriores abaixo são históricos.

> **M1-R24 — 05/10/2026:** base canônica R23 `072287f`, com R20–R22 já integrados. Estado, revisão e evidências desta rodada em [docs/113-M1-R24-REVISAO-E-ESTADO.md](docs/113-M1-R24-REVISAO-E-ESTADO.md). M1 operacional aberto; M2 não iniciado. Os estados antigos abaixo são históricos.

# Help Desk independente — API/interface 0.19.0

Produto genérico multiproduto e multicontrato. **M1 operacional aberto; M2 não iniciado.**

## Estado atual e retomada

R10–R22 estão integrados na branch padrão GitHub `codex/m1-reproducibilidade`. O PR #2 foi mesclado em `129a434`; o handoff R23 está em `072287f`. Não reaplicar patches desses incrementos.

Leia [documento mestre](PROJECT_HELP_DESK.md), [estado e revisão R24](docs/113-M1-R24-REVISAO-E-ESTADO.md), [estado](docs/04-ESTADO-E-EVIDENCIAS.md) e [handoff/backlog](docs/05-HANDOFF-REVISAO.md).

O CI Linux R23 aprovou 1.436 Node, 215 PostgreSQL 17 e 71 HTTP/browser. Na reprodução Windows R24, instalação, audit, typecheck e build passaram; a suíte Node teve 1.413 aprovações e 23 falhas, registradas sem omissão. CI descartável não equivale a homologação hospedada.

## Instalação e verificação

Preserve o lock existente:

```bash
npm ci --ignore-scripts
npm run check:lock
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
```

A suíte integral usa Linux, OpenSSL, suporte a links simbólicos, Docker local (ou PostgreSQL 17 nativo explicitamente configurado) e Chromium/Python preparado. O banco é novo e descartável; nunca apontar a suíte SQL para o Supabase hospedado. Windows não é o ambiente de referência da homologação integral.

```bash
npm run homologate:local
npm run check:homologation
```

O primeiro comando produz um conjunto coerente. Não juntar logs de rodadas diferentes nem editar relatórios para aprovar um código novo. O build estático e o empacotamento/execução da Function são verificações distintas.

## Destino e clientes de aceitação

O site atual é `helpdesk-consultegeo`, ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`. O site histórico `help-desk-multi-tenant` é outro recurso. O Supabase HelpDesk é `xaelbntjnvztznnpcvtm`; inspeção R24 encontrou onze migrations e 25 tabelas privadas com ENABLE/FORCE RLS. Isso não prova o percurso Function → PostgreSQL nem Auth/M2M.

`npm run demo` usa dados fictícios em memória. Os clientes `test:hosted:read`, `test:hosted:auth` e `test:hosted:write` apresentam plano sem rede por padrão. Homologação hospedada ocorre no site helpdesk-consultegeo e na base/Auth HelpDesk existentes. Os exemplos são templates de validação, não infraestrutura a provisionar. Execução efetiva usa dados identificáveis de teste e credenciais nessa mesma base. Não incluir credenciais em arquivos ou logs.

API/interface 0.19.0; schema 0.18.0; onze migrations históricas; 18 operações HTTP. Não abrir `HELPDESK_RELEASE_APPROVED` para contornar a homologação pendente.

## Histórico

[README anterior ao R24](docs/history/r23-README.md). Decisões arquiteturais e evidências anteriores permanecem preservadas.
