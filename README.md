> **Painel após login — 12/10/2026:** corrigido retorno que ocultava a aplicação após /me válido. Modo simples abre painel, menus e saída desktop/mobile; disponibilidade do atendimento fica explícita, sem consultas prematuras nem contagens fictícias. PR29 integrado/publicado, CI3741/294/156 aprovado e39assets conferidos. Backend/gate preservados. [Correção e evidências](docs/137-PAINEL-APOS-LOGIN-2026-10-12.md).

> **Acesso simples — 12/10/2026:** UI temporária apenas e-mail/senha/Entrar; operação única descoberta automaticamente. Recursos avançados preservados, hidden/inert e com reativação comentada em web/access-mode.js. PR28 integrado/publicado; CI3741/294/152 sem skips e39assets conferidos. API0.27.0/schema0.19.0, atendimento fechado. [Comportamento, reativação e evidências](docs/136-ACESSO-SIMPLES-2026-10-12.md).

> **HDN-01l — revisão de 13/10/2026:** cumulativo integrado à fonte da PR30; corrigidos fingerprint, build, recusas de acesso e preparação/compatibilidade do browser. Revisão independente concluída; CI4246/326/168 aprovado sem skips e evidência da mesma fonte verificada. Publicação em confirmação; atendimento fechado. [Estado e limites](docs/138-REVISAO-HDN01L-2026-10-13.md).

# Help Desk independente — API/interface 0.27.0

O código consolidado R1 está na principal `codex/m1-reproducibilidade`. O atendimento operacional permanece fechado; os módulos opcionais continuam candidatos até a montagem e os aceites próprios. Schema 0.19.0, 12 migrations históricas e 19 operações HTTP.

A integração HDW-00/00b acrescenta auditoria offline e seleção explícita de localizadores do wiki para revisão privada. Não monta rotas ou publica artigos. Estado, problemas corrigidos e validação corrente: [revisão de 12/10](docs/135-HDW00B-REVISAO-E-INTEGRACAO-2026-10-12.md). Consolidação dos 18 ciclos e matriz operacional: [R1](docs/134-CONSOLIDACAO-R1-2026-10-11.md).

## Instalação e gates

Node 22.16 ou superior, menor que 25; preserve o package-lock existente.

```sh
npm ci --ignore-scripts
npm run check:lock
npm run verify
npm audit --audit-level=high
```

A homologação integral de referência usa Linux, OpenSSL, links simbólicos, PostgreSQL 17 descartável e Chromium/Python. A suíte SQL nunca deve apontar para o Supabase hospedado.

```sh
npm run homologate:local
npm run check:homologation
```

A evidência precisa pertencer à fonte atual, com logs de uma mesma execução. `verify:release` verifica lock, evidência, aplicação e audit; não reutilize o fingerprint da entrega R1 para código novo. Política e metadados de `docs/knowledge` também participam do fingerprint.

## Ferramentas editoriais privadas

```sh
npm run knowledge:audit -- --help
npm run knowledge:review -- --help
```

Consulte [HDW-00](docs/knowledge/consultegeo/README-HDW00.md) e [HDW-00b](docs/knowledge/consultegeo/README-HDW00B.md). O wiki original permanece fora do repositório e de `dist`. Saídas devem ficar fora da raiz auditada. As 41 fontes e 300 decisões entregues continuam pendentes; cinco fontes estão em quarentena. Código de saída zero nunca autoriza publicação de conteúdo.

## Produção e limites

Destino: [helpdesk-consultegeo](https://helpdesk-consultegeo.netlify.app), site `9781cd85-7dc1-4ef5-868b-947e389a9d4d`, projeto Supabase HelpDesk `xaelbntjnvztznnpcvtm`. Publicação pelo Git/CD existente com gates preservados. O site histórico `help-desk-multi-tenant` é outro recurso.

`npm run demo` usa memória e dados fictícios. Clientes `test:hosted:read`, `test:hosted:auth` e `test:hosted:write` produzem plano sem rede por padrão. A jornada humana/M2M real, contratos e cadastros qualificados, restore, capacidade/SLO e aceite operacional continuam separados da publicação técnica. Não abrir `HELPDESK_RELEASE_APPROVED` para contornar essas pendências.

Leia [arquitetura](docs/01-ARQUITETURA.md), [documento mestre](PROJECT_HELP_DESK.md), [estado](docs/04-ESTADO-E-EVIDENCIAS.md), [handoff](docs/05-HANDOFF-REVISAO.md) e [segurança](docs/06-M1-SEGURANCA-E-LIMITES.md). Os checkpoints recentes prevalecem sobre descrições históricas. [README anterior à integração](docs/history/r1-README.md).
