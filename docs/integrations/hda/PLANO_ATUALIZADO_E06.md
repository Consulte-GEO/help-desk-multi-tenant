# Plano atualizado — E06 / HD-DA-CADASTROS

**14/10/2026 · 2.0+E06 · base conectada ea7a4454 (PR43).** Este checkpoint prevalece sobre o estado de desenvolvimento dos relatórios anteriores; não altera o plano de negócio V2.

| Pacote | Estado real após a revisão |
|---|---|
| HDA-00 | Parcial; origem API/IdP, host e Claude CLI reais não qualificados |
| HDA-01 | Contratos locais preservados; interoperabilidade .NET e integração integral pendentes |
| HDA-02 | Persistência/recibos/composição testados no subconjunto; PostgreSQL e cadeia completa ainda não executados |
| HDA-03 | Não iniciada; abertura + operação + tarefa na mesma transação |
| HDA-04 | Processador revisto: espera abortável e quarentena testadas; CLI real não qualificada/montada |
| HDA-05 | Contrato candidato de prévia; leitura/validação real na origem pendentes |
| HDA-06 | **Parcial:** projeção, controller e consulta visual somente leitura testados; sem endpoint, edição, histórico completo ou montagem no app |
| HDA-07 | Aprovação vinculada ao conteúdo não implementada |
| HDA-08 / HDA-09 | Execução idempotente na origem e callback/conciliação dessa escrita não implementados |
| HDA-10 | Visão minimizada do cliente preparada; publicação do resultado final e notificação HDA pendentes |
| HDA-11 | Piloto e aceite operacional HDA pendentes |
| HDA-12 / HDA-13 | Provisionamento GEO + IdP e expansão cadastral pendentes |

## Prioridade 1 — sair do bloqueio de persistência

No ambiente do Codex com checkout integral: instalar o lock, aplicar somente o patch correspondente, conferir versões/migrations e executar a regressão canônica. Usar o runner PostgreSQL 17 não-root em cluster descartável; seus erros reais precisam ser corrigidos sem reduzir guards. Executar primeiro o candidato com fixture própria e depois a composição sobre as migrations históricas completas em outro cluster. Memória e provas estáticas não liberam esta etapa.

Provar login restrito, RLS, relações compostas, revogação/expiração durante esperas, concorrência da reserva, unicidade da tarefa, recibos, resultado desconhecido e rollback tardio. Qualificar publicador de bindings, quotas/retenção e role dedicada do worker. Só então preparar a migration aditiva e atualização de manifests/prontidão; não aplicar o arquivo de candidato na produção.

## Prioridade 2 — conectar a abertura (HDA-03)

Integrar chamado, operação, snapshot e tarefa na mesma transação/cliente. Preservar protocolo/contador, recibos e outbox Resend. Testar clique duplo, reenvio, rollback depois do evento, respostas tardias e ação não elegível. Falha de análise não deve desligar atendimento humano.

## Prioridade 3 — completar a consulta entregue (HDA-06)

Implementar porta de leitura autorizada por público com revalidação de acesso e snapshot consistente. Montar no shell com fetch de sessão e assets canônicos. Completar histórico/diff/edição somente quando houver comandos transacionais correspondentes, com If-Match e idempotência. Não copiar dados privados para o DTO de cliente. Repetir as 49 verificações visuais também no fluxo HTTP/autenticado real.

## Prioridade 4 — qualificar análise real e aprovação

Qualificar instalação/versão/hash/modelo/credencial dedicada do Claude, supervisor e isolamento. A instância em quarentena não é prova de que o processo foi encerrado: operação real precisa de monitoramento e reinício seguro. HDA-07 deve aprovar a revisão exata e revalidar ação, destino, vínculos, política e permissão antes da execução determinística.

## Decisão registrada

A E06 revisitou os pré-requisitos; eles continuam indisponíveis. Desenvolveu-se a consulta local HDA-06, expressamente permitida em paralelo no plano E05, e corrigiu-se um bug concreto do processador. Não houve reclassificação de HDA-02 como concluída nem nova simulação anunciada como homologação. O atendimento publicado não foi alterado.
