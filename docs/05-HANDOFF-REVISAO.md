> **Checkpoint Consulte GEO M06 (13/10/2026):** fonte47bee4e homologada4418/390/192; API0.28/schema candidato0.21, montagem e conversa pública concluídas na branch/PR31draft. Ver [relatório142](142-CONSULTEGEO-RUNTIME-M06-2026-10-13.md) antes dos estados históricos abaixo. Origem real/jornada/worker/aceite hospedado permanecem próximos.

> **HDN-01l — revisão de 13/10/2026:** cumulativo integrado, correções de fingerprint/build/recusas/browser e revisão independente concluídas. CI4246/326/168 aprovado sem skips; evidência canônica verificada. PR30 mesclado/publicado, 44 assets de produção e fronteira readonly conferidos; atendimento fechado. [Estado e limites](138-REVISAO-HDN01L-2026-10-13.md).

> **Painel após login — 12/10/2026:** corrigido retorno que ocultava a aplicação após /me válido. Modo simples abre painel, menus e saída desktop/mobile; disponibilidade do atendimento fica explícita, sem consultas prematuras nem contagens fictícias. PR29 integrado/publicado, CI3741/294/156 aprovado e39assets conferidos. Backend/gate preservados. [Correção e evidências](137-PAINEL-APOS-LOGIN-2026-10-12.md).

> **Acesso simples — 12/10/2026:** UI temporária apenas e-mail/senha/Entrar; operação única descoberta automaticamente. Recursos avançados preservados, hidden/inert e com reativação comentada em web/access-mode.js. PR28 integrado/publicado; CI3741/294/152 sem skips e39assets conferidos. API0.27.0/schema0.19.0, atendimento fechado. [Comportamento, reativação e evidências](136-ACESSO-SIMPLES-2026-10-12.md).

> **HDW-00/00b — revisão de 12/10/2026:** ferramentas privadas integradas sobre d38cfad; corrigidos caminhos Windows, fingerprint da política e limites do parser/metadados. API0.27.0/schema0.19.0, atendimento fechado; 41 fontes/300 itens pending e cinco quarentenas. PR27 mesclado/publicado; CI3736/294/139 sem skips e38assets de produção verificados. Estado, validação e limites em [revisão HDW](135-HDW00B-REVISAO-E-INTEGRACAO-2026-10-12.md).

> **Continuidade HD-P03 — produção:** clientes read/Auth/write adaptados a production, três exemplos de site separado removidos e 140 testes focais aprovados. CI Linux run37560232763 aprovado: 1.450 aplicação, 215 PostgreSQL e 79 interface. PR4 integrado em0789dc3 e código publicado em produção (deploy6ac5aaaf); aceite operacional pendente. [Política e evidência](116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **HD-P03 — 06/10/2026:** homologação hospedada na mesma base/site HelpDesk, conforme decisão do usuário. CI Linux 1.447/215/79 aprovado; PR4 pronto para revisão. Aceite Auth/Function/base atual permanece pendente. Leia [116-HD-P03-VALIDACAO-EM-PRODUCAO.md](116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **Decisão do usuário — 06/10/2026:** O único ambiente do Help Desk é produção: site helpdesk-consultegeo e projeto Supabase HelpDesk xaelbntjnvztznnpcvtm. Desenvolvimento, implantação e validação hospedada usam esse destino. Não solicitar ambiente ou credenciais de teste ao usuário.

> **HD-P02 — 06/10/2026:** recuperação da abertura corrigida;14 testes focais e79 verificações de interface aprovados. Windows1447/1424/23 (mesmas falhas anteriores); CI novo/aceite hosted pendentes. Leia [115-HD-P02-RECUPERACAO-DA-ABERTURA.md](115-HD-P02-RECUPERACAO-DA-ABERTURA.md). M1 operacional aberto.

> **Estado pós-merge — 06/10/2026:** leia [HD-P01](114-HD-P01-ESTADO-POS-R24.md), que prevalece sobre o histórico abaixo. CI R24 1436/215/71; gate hospedado fechado; M1 operacional aberto.

# Help Desk M1-R24 — Handoff e backlog

Leia [estado/revisão R24](113-M1-R24-REVISAO-E-ESTADO.md), [documento mestre](../PROJECT_HELP_DESK.md) e [handoff R23](112-M1-R23-REVISAO-MERGE-HANDOFF.md). R20–R22 já integrados; não reaplicar patches nem mesclar a branch auxiliar ops. Base desta revisão: `072287f`.

## Backlog prioritário

| Entrega | Estado | Próxima evidência |
|---|---|---|
| Revisão/integração R20–R23 | PR #2 já mesclado; revisão R24 e correção documental | CI e publicação exatos da rodada R24 |
| Instalação/lock/audit/typecheck | Aprovados localmente no R24 | Logs preservados; lock inalterado |
| Suíte integral | Windows 1.413/1.436; 23 falhas documentadas | CI Linux completo sem reduzir gates |
| PostgreSQL/browser | CI R23 215/71; ambiente Windows local indisponível | Novo CI com evidência coerente |
| Cadastros e validação em produção | Destino definido pelo usuário; sem ambiente adicional | Cadastros e configuração privados de produção |
| Function/Auth/M2M | Publicação técnica; gate 503 confirmado | TLS/papel/grants/RLS, login/refresh/logout, sessões e privacidade reais |
| Escritas/concorrência/recuperação | Clientes já implementados; homologação pendente | Correlacionar efeitos/recibos/outbox sem repetir intenção |
| Capacidade/restauração/governança | Pendente | Limites, residência/RPO/RTO, responsáveis e aceite |
| M2 | Não iniciado | Fechamento formal de M1 |

Os três clientes produzem planos sem rede. Homologar no site/base existentes, com identificadores reais de teste e segredos somente no ambiente do processo. Exemplos com sites alternativos não autorizam nem exigem provisionamento. Não usar PostgreSQL hospedado para os testes destrutivos ou ampliar grants para fazê-los passar.

A autorização direta do usuário permite commit, merge e publicação técnica sem Claude. Atendimento real continua dependendo de homologação e aceite; não abrir o gate para contornar isso.

Handoff anterior integral: [histórico R23](history/r23-05-HANDOFF-REVISAO.md).
