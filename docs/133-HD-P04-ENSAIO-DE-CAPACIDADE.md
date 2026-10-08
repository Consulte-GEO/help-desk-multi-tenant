# HD-P04 — Medição local de capacidade e isolamento

Recorte preparatório do plano: [perfil, execução e pendências](operations/M1-CAPACIDADE-E-RECUPERACAO.md). Medidor limitado/sanitizado e dois cenários PostgreSQL reais no runner existente; nenhum novo runner remoto, endpoint, política, índice, migration, SLO ou liberação operacional.

Estado:7 testes do medidor RED/GREEN aprovados e typecheck aprovado. Checks estruturais/SQL/revisão/CI/publicação serão registrados nesta entrega conforme execução. Docker local não disponível; isso não autoriza substituir pelo projeto Supabase de produção. Medições PostgreSQL e artefato exato permanecem pendentes. API/interface0.27.0/schema0.19.0,12 migrations e19 operações preservados.

Revisão independente corrigiu um Important: quotas precisavam do wrapper transacional do runtime.2 regressões RED provaram ausência de BEGIN e rollback/lease; helper agora compõe withControlTransactions e10 focais GREEN aprovados. Sem Critical. Dois Minors registrados: movimento regressivo entre tarefas de relógio customizado (default performance.now monotônico) e falha de fingerprint antes do finally pode atrasar fechamento do pool descartável. Sem nova revisão da correção; tipos/contratos/scan/build aprovados.

Assunção de reaproveitar um único PID indefinidamente corrigida por regressão RED/GREEN: idle timeout10s do driver pode trocar o backend sequencialmente. Prova agora confere máximo de uma lease simultânea, nenhuma lease restante e número positivo de backends distintos observados, sem publicar PIDs nem mudar configuração do pool.10 focais aprovados. Windows1678/1655/23 antes dessa regressão adicional: somente limites conhecidos de plataforma; não representa aprovação Linux. Source CI novo obrigatório.
