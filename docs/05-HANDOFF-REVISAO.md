# Help Desk M1-R24 — Handoff e backlog

Leia [estado/revisão R24](113-M1-R24-REVISAO-E-ESTADO.md), [documento mestre](../PROJECT_HELP_DESK.md) e [handoff R23](112-M1-R23-REVISAO-MERGE-HANDOFF.md). R20–R22 já integrados; não reaplicar patches nem mesclar a branch auxiliar ops. Base desta revisão: `072287f`.

## Backlog prioritário

| Entrega | Estado | Próxima evidência |
|---|---|---|
| Revisão/integração R20–R23 | PR #2 já mesclado; revisão R24 e correção documental | CI e publicação exatos da rodada R24 |
| Instalação/lock/audit/typecheck | Aprovados localmente no R24 | Logs preservados; lock inalterado |
| Suíte integral | Windows 1.413/1.436; 23 falhas documentadas | CI Linux completo sem reduzir gates |
| PostgreSQL/browser | CI R23 215/71; ambiente Windows local indisponível | Novo CI com evidência coerente |
| Fixtures e destino hospedado isolado | Não definidos/provisionados nesta rodada | IDs reais de site, banco/Auth, canais e fixtures autorizadas |
| Function/Auth/M2M | Publicação técnica; gate 503 confirmado | TLS/papel/grants/RLS, login/refresh/logout, sessões e privacidade reais |
| Escritas/concorrência/recuperação | Clientes já implementados; homologação pendente | Correlacionar efeitos/recibos/outbox sem repetir intenção |
| Capacidade/restauração/governança | Pendente | Limites, residência/RPO/RTO, responsáveis e aceite |
| M2 | Não iniciado | Fechamento formal de M1 |

Os três exemplos isolados produzem planos sem rede; não contêm IDs de recursos provisionados. Preparar o destino efetivo antes de executar, com segredos somente no ambiente do processo. Não usar PostgreSQL hospedado para os testes destrutivos ou ampliar grants para fazê-los passar.

A autorização direta do usuário permite commit, merge e publicação técnica sem Claude. Atendimento real continua dependendo de homologação e aceite; não abrir o gate para contornar isso.

Handoff anterior integral: [histórico R23](history/r23-05-HANDOFF-REVISAO.md).
