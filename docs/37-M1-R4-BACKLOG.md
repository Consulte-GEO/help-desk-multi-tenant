# Backlog — Help Desk após M1-R4

**28/09/2026. M1 aberto. Ordem por dependência, não cronograma.**

| ID | Prioridade | Entrega/aceite | Estado |
|---|---|---|---|
| M1-R4-01 | P0 | Proteger cliente transacional contra eventos e referências vencidas, sem replay automático | Implementado;19 testes Node novos passaram;pg pendente |
| M1-INT | P0 | Conciliar R2+R3+R4 com HEAD atual e registrar a fonte integrada | Pacote preparado;sem push/PR nesta rodada |
| M1-DEPS | P0 | npm ci pelo lock, typecheck local e audit concluídos no ambiente executor | Bloqueados nesta rodada;histórico de base CI existe |
| M1-PG | P0 | 207 casos PostgreSQL17 fresh/upgrade aprovados, zero skips | Escritos;0 executados nesta rodada |
| M1-DRIVER | P0 | pg8.16.3/TLS reais;interrupção,rollback/descarte,reuso de pool | 6 testes de transporte Node não substituem este gate |
| M1-UI | P0 | 35HTTP+36browser;desktop/mobile,sessão,erros e respostas tardias | HTTP35 passou;browser bloqueado |
| M1-EVID | P0 | Novo homologate:local/check:homologation com fonte integrada e logs revisados | Não aprovado |
| M1-HOST | P0 | Function hospedada usa configuração real sem abrir produção indevidamente | Pendente;diagnóstico CLI não prova execução no host |
| M1-AUTH | P0 | Jornada humana/M2M real,renovação/revogação e isolamento A/B | Pendente no percurso hospedado |
| M1-OPS | P0 | Capacidade/abuso,backup/restore,runbooks,RPO/RTO/residência e segurança operacional | Pendente |
| M1-REVIEW | P0 | Revisão independente e aceite formal do M1 | Não realizados nesta rodada |
| M2-ADMIN | Posterior a M1 | Administração genérica de memberships,capacidades,contas,produtos/instâncias,serviços,contratos/coberturas,equipes/filas e conexões | Não iniciado |
| M3+ | Posterior | Atendimento avançado,SLA/roteamento,dispatcher,anexos e conectores de dois produtos | Mantidos no roadmap,sem antecipação |

Não repetir diagnóstico de configuração como se encerrasse testes conectados. Não usar quantidade de testes ou versões como percentual de conclusão. Nenhuma especificidade de GeoLab/Financeiro no núcleo. Integrações traduzem referências externas para conceitos genéricos.
