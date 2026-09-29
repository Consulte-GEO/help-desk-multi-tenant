# Backlog vigente — Help Desk M1-R2

**28/09/2026. M1 aberto; M2 não iniciado.** Prioridades abaixo não atribuem inexistência a recursos já registrados no remoto.

| ID | Prioridade / estado | Entrega e critério executável |
|---|---|---|
| M1-R2-01 | Implementado e testado localmente | Preflight privado e erros seguros; 54 testes novos/1.099 aplicação aprovados. Integrar delta, sem alteração de schema. |
| M1-R2-02 | P0 / pendente de nova evidência | Reproduzir instalação/verify/audit com lock preservado; todos aprovados sem fallback para tipos globais. |
| M1-R2-03 | P0 / SQL escrito | Executar 204 casos PG17 reais descartáveis, incluindo 3 novos, grants/RLS/rollback e upgrade16/16. |
| M1-R2-04 | P0 / browser bloqueado aqui | Executar71HTTP/browser, manter regressão de sessão/contexto; zero skips e sem política contornada. |
| M1-R2-05 | P0 / depende de autorização | Preflight TLS real com login helpdesk_app, configuração protegida, relatório sanitizado e pool encerrado. Não concede liberação. |
| M1-R2-06 | P0 / pendente | Validar conectividade/guards na Function e jornada Auth/M2M hospedada; identidade real, revogação, renovação, isolamentoA/B, nenhuma credencial permanente no browser. Arquitetar mecanismo privado de homologação sem abrir produção. |
| M1-R2-07 | P0 / pendente | Confirmar carga, abuso, latência, limites e observabilidade sem dados sensíveis; limiares aprovados, sem números inventados. |
| M1-R2-08 | P0 / pendente | Restore comprovado, residência, RPO/RTO e runbooks aprovados; não confundir backup configurado com restauração executada. |
| M1-R2-09 | P0 / pendente | Revisão independente/segurança operacional e aceite formal M1 antes de ampliar produto. |
| M1-R2-10 | P1 / avaliação operacional | Revisar avisos atuais de segurança/dependências e atualização menor PostgreSQL17, com compatibilidade e restore testados; nenhuma atualização automática. |
| M2-ADM | Bloqueado por fechamento M1 | Administração genérica de memberships/capacidades, contas, produtos/instâncias, serviços, contratos/versões/coberturas, filas/equipes/M2M e auditoria. |
| POST-M2 | Roadmap preservado | Atendimento avançado → SLA/routing → dispatcher/notificações → anexos seguros → conectorA e produtoB semanticamente diferente → produção. |

## Riscos com responsável na próxima rodada

Executor Codex: validar delta/preimages, lock, testes e logs; não reclassificar diagnóstico como homologação. Revisor independente: autorização/isolamento/erro seguro/read-only/rollback e uso interno do driver. Responsável pela operação: aprovar ambiente, dados sintéticos, segredo, residência/RPO/RTO e ações remotas específicas. Esses papéis são tarefas; pessoas e valores ainda precisam de definição, não foram presumidos.

## Não fazer para acelerar

Não desligar RLS/TLS; não usar postgres/service_role no request; não trocar schema0.18 por0.19 por estética; não reaplicar migrations existentes; não ativar gate para ignorar os testes; não apresentar outbox como entrega externa; não puxar conceitos de laboratório/obra/financeiro para o core.
