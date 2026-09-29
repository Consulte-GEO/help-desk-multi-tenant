# Backlog — Help Desk M1-R5

| Prioridade | Item | Estado de saída / pendência |
|---|---|---|
| P0 | Recuperação R4 e baseline | Concluído localmente: fingerprint e1.133 testes conferidos |
| P0 | Inspeção de integração before/after | Implementada;30 testes novos aprovados; não aplica patches |
| P0 | Fonte recuperável e variantes de patch | Pacote cumulativo/local; validação em cópia limpa, ver evidências |
| P0 | Integração na branch de trabalho real | Pendente; nenhuma escrita no GitHub |
| P0 | npm ci, verify e audit do código R5 | Bloqueados nesta sessão; registry/tipos locais |
| P0 | PostgreSQL17/upgrade207 | Escritos e pendentes de execução na fonte R5 |
| P0 | Driver pg/TLS/descarte/reuso/resultado incerto | Casos herdados; comprovação conectada pendente |
| P0 | HTTP/browser71 |35HTTP memória passou;36browser pendentes nesta rodada |
| P0 | Gate de evidência da fonte atual | Não aprovado; não reutilizar aprovação do commit remoto antigo |
| P0 | Function/Auth humano/M2M/revogação/A-B | Validação hospedada pendente, depende de autorização adequada |
| P0 | Carga/abuso/restore/revisão/governança | Pendentes antes do aceite operacional de M1 |
| P1 | M2 administração | Não iniciado; posterior a M1 |

Não acrescentar features de conveniência para substituir os testes pendentes. Não modificar schema/API apenas para atualizar número de versão. Limitação conhecida do R4 sobre exceção síncrona de release permanece documentada; esta rodada não alterou essa fronteira nem comprovou descarte real PostgreSQL.
