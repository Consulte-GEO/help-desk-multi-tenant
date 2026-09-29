# Backlog — Help Desk após M1-R8

| Prioridade | Item | Estado / aceite |
|---|---|---|
| P0 corrigido localmente | TS2339 na fixture de CI do R7 | R8: compilador suplementar RED/GREEN; 1192 testes existentes preservados |
| P0 | Instalação e typecheck da toolchain travada | Pendente; registry inacessível. Tipos globais não aprovam instalação |
| P0 | Integrar R2–R8 e executar workflow isolado | Pendente no remoto; verificar commit/run/attempt e artefato novo |
| P0 | PostgreSQL17 fresh/upgrade/driver | 209 escritos, zero executados nesta rodada |
| P0 | Interface | 35HTTP memória passaram;36browser pendentes nesta rodada |
| P0 | Gate do código exato | Pendente; contagens e fingerprint devem corresponder à execução real |
| P0 | Function/Auth/M2M e isolamento no destino | Pendente de ambiente/operações autorizados |
| P0 | Capacidade/restore/governança/revisão independente | Pendentes para fechamento M1 |
| P1 | M2 administrativo | Não iniciado; depende do aceite de M1 |

Não aumentar testes ou construir novas ferramentas apenas para adiar a validação real. O incremento R8 remove um erro comprovado; não converte limitações de ambiente em problema resolvido.
