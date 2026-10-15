# SDD ledger — plan: docs/superpowers/plans/2026-10-15-email-monitoring-v2.md

Base: 91ccdf95db44b11a3906a4c39cf070ff5e91f2a5. Branch: codex/email-monitoring-v2.

Ruling: executar a especificação já aprovada sem nova confirmação intermediária — titular pediu implementação completa; tarefas e método nativo seguem a autorização explícita.

Ruling: ferramenta nativa de worktree recusou a referência conhecida no contexto do chat — trabalhar em branch própria no checkout Help Desk, preservando documentos não rastreados anteriores. Nenhum checkout concorrente será sobrescrito.

Pre-flight: tarefa 1 fornece eventType à 2; tarefa 2 fornece DTO à 3; tarefa 4 consome contrato HTTP fixado no plano e pode ser desenvolvida em arquivos próprios em paralelo. Integração e contratos ficam sob responsabilidade principal.

Baseline npm test em Windows: 5625 testes, 5487 pass, 138 fail, sem skips. Log ../.analysis/email-v2-baseline.log. Falhas incluem EPERM em symlink e EACCES em sockets UNIX; investigar e distinguir ambiente/regressão. Nenhuma falha foi ignorada como aprovação.

Reaproveitamento conferido por análises independentes: GEOCON fornece composição visual e cadência; GEOLAB fornece princípios de paginação/count exato e agregação no servidor. Não copiar senders, infraestrutura, inferências de funil, payload bruto ou consultas limitadas como total.

Tasks 1–4: implementadas; integração/revisão/CI da tarefa5 em andamento. Fontes históricas de especificação permanecem como registro da fase anterior; checkpoint159 descreve a implementação.

Ruling: incorporado upstream e8878675 por fast-forward, preservando HDA e Wiki. HDA ocupa schema0.26/migration20; monitor será append0.27/migration21. Contratos históricos permanecem íntegros, incluindo o contrato HDA e seus 7 RPCs de worker.

Validação local:150/150 testes focais;28/28 de integração do compiler, staging de fontes e assets; typecheck, contratos e build executados sem erros. Suíte completa Windows:5719 testes,5568 pass,151 fail. Além das restrições ambientais já observadas e timeouts de CLI sob concorrência, duas regressões reais foram encontradas e corrigidas: allowlist do demo sem novos assets e fixture de staging sem manifesto novo. Não considerar a suíte ampla local aprovada; execução Linux/PG17 real deve decidir o gate.

Diagnósticos auxiliares em PGlite:18/18 consultas,18/18 telemetria. Não qualificam RLS/login PostgreSQL real. Browser auxiliar Node/Chrome:22 verificações do componente e32 do shell com transportes sintéticos; suíte Python portátil registrada para CI.

Revisão independente do conjunto: nenhum Critical; Important de cronologia de falha sem callback e rótulos de eventos corrigidos com regressões próprias. Coorte parcial passou a mostrar fatos observados sem taxa enganosa (15/15 testes UI após os ajustes). Minor de filtro failed duplicado/rotulado como supressão e comentário de versão corrigidos. Revisão de segurança cobriu ACL antes de agregação, máscara no SQL, DTO fechado, cursor/revogação, sinais independentes e rollout25/26/27.

Publicação: nenhuma migration, configuração do provedor ou dado de produção foi alterado nesta implementação. Cobertura inicial fica nula até comprovação operacional dos sinais. Apenas validação sintética e branch de desenvolvimento autorizadas nesta etapa.
