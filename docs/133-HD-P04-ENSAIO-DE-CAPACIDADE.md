# HD-P04 — Medição local de capacidade e isolamento

Recorte preparatório do plano: [perfil, execução e pendências](operations/M1-CAPACIDADE-E-RECUPERACAO.md). Medidor limitado/sanitizado e dois cenários PostgreSQL reais no runner existente; nenhum novo runner remoto, endpoint, política, índice, migration, SLO ou liberação operacional.

Estado:10 focais e CI1679/231/123 aprovados; medição PostgreSQL e artefato source-bound verificados abaixo. Checks finais aprovados, PR22 integrado/publicado e fronteira do site verificada. Docker local não disponível; nenhum substituto em Supabase de produção foi usado. API/interface0.27.0/schema0.19.0,12 migrations e19 operações preservados.

Revisão independente corrigiu um Important: quotas precisavam do wrapper transacional do runtime.2 regressões RED provaram ausência de BEGIN e rollback/lease; helper agora compõe withControlTransactions e10 focais GREEN aprovados. Sem Critical. Dois Minors registrados: movimento regressivo entre tarefas de relógio customizado (default performance.now monotônico) e falha de fingerprint antes do finally pode atrasar fechamento do pool descartável. Sem nova revisão da correção; tipos/contratos/scan/build aprovados.

Assunção de reaproveitar um único PID indefinidamente corrigida por regressão RED/GREEN: idle timeout10s do driver pode trocar o backend sequencialmente. Prova agora confere máximo de uma lease simultânea, nenhuma lease restante e número positivo de backends distintos observados, sem publicar PIDs nem mudar configuração do pool.10 focais aprovados. Windows1678/1655/23 antes dessa regressão adicional: somente limites conhecidos de plataforma; não representa aprovação Linux. Source CI novo obrigatório.

## Medição executada em CI Linux

[CI 37843524455](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37843524455) aprovado:1679 aplicação,231 PostgreSQL e123 interface, zero falhas/skips. Fonte `ea93a1aa19519723dc5e617cbbe6b30063fcc0bf`, fingerprint `a310e7e106af2c42a5ea3a0bf78d5c6af46d43292b20c5c809cbd458f8da134a`. Artefato11579011485, SHA256 `726234159fc76e216751ce418cedc8fd916ccae6020c301c5221470b291f6736`, ZIP oficial/fonte/seis logs e relatório de capacidade conferidos antes de copiar para o canônico. UUID do ensaio6bc6aeff-2f00-494a-a992-42ba67248dcc; report [latest](../evidence/capacity/latest.json) associado à mesma fonte.

47 amostras no perfil de negócios,25 tickets/eventos/outbox/intents,8 recusas entre contas/workspaces,24 resultados de busca integral; zero erros, contexto limpo, máximo de uma lease simultânea e nenhuma lease restante. Mais96 amostras nas4 políticas de quota: vizinho compartilha o orçamento de workspace, outro workspace continua permitido. Nenhum resultado autoriza produção ou encerra M1.

| Coorte/operação | N | P50 operação ms | P95 operação ms | P95 espera de admissão ms | P95 desde admissão ms |
|---|---:|---:|---:|---:|---:|
| busy/create | 16 | 76.952 | 78.687 | 158.591 | 235.503 |
| busy/replay | 8 | 45.349 | 70.818 | 235.506 | 261.016 |
| busy/read | 4 | 6.052 | 10.723 | 3.568 | 14.292 |
| busy/list | 1 | 42.994 | 42.994 | 0.003 | 42.997 |
| neighbor/create | 4 | 76.267 | 81.452 | 119.531 | 196.844 |
| neighbor/read | 4 | 7.603 | 11.617 | 4.464 | 15.838 |
| neighbor/list | 1 | 21.802 | 21.802 | 0.123 | 21.925 |
| other_workspace/create | 4 | 76.195 | 79.599 | 129.153 | 206.287 |
| other_workspace/read | 4 | 8.431 | 10.673 | 6.148 | 16.662 |
| other_workspace/list | 1 | 25.237 | 25.237 | 0.144 | 25.381 |

Operação inclui espera do pool e múltiplas queries/transações conforme a operação. Admissão mede espera pelo worker; desde admissão mede ambas. Busca/list é a coleção completa por páginas, não latência de uma única página HTTP. Leitura inclui sucesso e recusa; grupos N1/N4 têm percentis iguais/próximos ao máximo e não estimam p99 populacional. Máquina CI com PostgreSQL17 descartável e principais injetados; nenhuma meta/throughput/Auth/latência hospedada prometida.

| Política | Ocupada OK/429 | Vizinha OK/429 | Outro workspace OK/429 |
|---|---:|---:|---:|
| ingress | 1/15 | 4/0 | 4/0 |
| token_exchange | 1/15 | 4/0 | 4/0 |
| principal | 1/15 | 4/0 | 4/0 |
| workspace | 1/15 | 0/4 | 4/0 |

Quotas medidas próximas ao limite por fixtures; não são1800 requests reais nem disputa SQL entre múltiplas instâncias. API/runtime/schema/config/scopes intactos. Checks finais/merge/publicação concluídos no PR22, fronteira do site verificada abaixo.

[PR22](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/22) integrado pelo merge `ad7806f7786c6a82c9f3fe99f8f877763bc1d157`, após checks finais37844545816/37844537701, CodeQL e preview aprovados. Produção Netlify `6ac80765a7a2130007930890` pronta para esse merge. [Prova de fronteira](../evidence/m1-capacity/production-boundary.json):11 arquivos byte a byte e23 verificações totais, API0.27.0 e operationalfalse preservados. Config/capabilities200; me/discovery401, consulta forjada400, sessão M2M recusada401 e quatro rotas de atendimento503. Auth sem bearer401 e recover sem destinatário400, sem e-mail real. Scopes revision2 continuam contexts:resolve/tickets:read; contas/tickets/fatores selecionados0. O deploy publica o código/evidência do ensaio; não é medição de capacidade hospedada. Piloto/HD-P03/SLO/múltiplas instâncias/retenção/restore/RPO/RTO permanecem pendentes; M1 aberto e atendimento fechado.
