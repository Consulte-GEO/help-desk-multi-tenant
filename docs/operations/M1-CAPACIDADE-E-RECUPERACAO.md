# M1 — Capacidade e recuperação: preparação HD-P04

O aceite real de HD-P03 continua pendente. Esta entrega prepara medições locais reproduzíveis; não encerra M1, não libera atendimento e não define SLO, RPO/RTO ou dimensionamento de produção. API/interface0.27.0 e schema0.19.0 preservados, sem migration/configuração/grant novo.

## Ensaio de capacidade disponível

Reutiliza `npm run test:db:local`, seu banco PostgreSQL17 descartável e os cenários registrados em `supabase/tests/rls.test.ts`. O guard exige opt-in, URLs loopback coincidentes, banco helpdesk_test, papéis dedicados e base nova. Não aceita URL Supabase, credencial remota, base existente ou fallback. As fixtures administrativas sintéticas ficam só nesse banco descartável; requests usam helpdesk_app sem BYPASSRLS. Auth é injetado por principais sintéticos: este ensaio não prova o provedor nem a fronteira HTTP.

`tests/performance/m1.ts` valida todo o perfil antes de iniciar, limita256 tarefas/16 workers, executa cada tarefa uma única vez e espera workers em andamento antes de rejeitar falha de relógio. Relatório não conserva mensagem de erro, principal/conta/workspace, texto de ticket, IP, HMAC ou conexão. Mede tempo da operação (incluindo espera do pool), espera de admissão no runner e tempo desde a admissão coletiva até o retorno. Percentis usam nearest rank, sem interpolação; incluem recusas/erros e mostram contagens separadas. Ausência de amostra produz null, nunca latência zero fictícia.

| Perfil fixo | Prova solicitada ao PostgreSQL real |
|---|---|
| Pool restrito max1,8 workers,32 tarefas de escrita |24 intenções intercaladas entre conta ruidosa16, vizinha4 e outro workspace4;8 replays de uma intenção já criada. Total25 tickets/eventos/outbox/intents, sem duplicação. Não é retry automático após falha. |
|12 leituras concorrentes |4 leituras autorizadas e8 recusas404 por conta/workspace distintos; nenhuma exposição de ticket vizinho. |
|3 buscas com cursor |Coleções completas de16/4/4 tickets, páginas5, busca literal fixa; nenhum ID duplicado ou fora da conta. |
|4 políticas de quota,24 tarefas por política |Ingress120/min, token_exchange10/min, principal120/min, workspace1800/min conforme SQL atual. Fixture near-limit, somente no banco descartável, deixa uma unidade restante; não altera função, política ou relógio. |

No perfil de workspace a conta vizinha compartilha a quota e também pode ser recusada; outro workspace mantém seu orçamento. Nos demais perfis, vizinho usa identidade/IP sintéticos distintos e não herda o limite do ator ruidoso. Recusas não consomem parcialmente os outros budgets. O teste confere Retry-After1–60, janela de minuto e contagem persistida. Antes de cada perfil pode esperar até15 segundos pela janela seguinte; essa espera de preparação fica fora da medição. Se a janela mudar durante a amostra, o teste recusa aprovação em vez de interpretar reset como capacidade. Near-limit comprova atomicidade/distribuição no banco, não throughput de1800 requests reais.

Pool medido tem uma conexão própria para esta instância sintética; conexões do administrador/runner não fazem parte desse teto. Instrumentação consulta PID na primeira conexão para conferir reutilização; estatísticas publicadas contêm somente número de conexões/leases. Não prova limites globais de conexões nem justiça de escalonamento entre múltiplas Functions. Preparação de dados, warm-up e fechamento do pool não compõem as latências de requests.

## Evidência

SQL gera `evidence/capacity/workload.json` e `latest.json`, ligados ao fingerprint integral da fonte e ao mesmo UUID de execução dos dois cenários. O segundo cenário recusa relatório de outra execução/fonte. Artefato CI novo deve conter relatório e logs SQL aprovados; arquivos antigos não provam uma nova execução. Nenhuma medição SQL está aprovada até a execução efetiva. Dez testes do medidor/wrapper passaram após RED por módulo ausente e por caminho de quota sem controle transacional; cenários SQL/typecheck/CI/revisão/publicação são registrados conforme execução.

No Windows deste workspace não há Docker/PostgreSQL17 descartável apto; não usar o Supabase de produção como substituto. O CI Linux já dispõe do runner Docker protegido e produzirá a medição real. O relatório é comparável apenas com máquina, perfil, PostgreSQL/driver e fonte identificados. Pequena amostra não sustenta promessa de carga ou p99 de produção.

## Trabalho restante para fechar HD-P04

- Aceite HD-P03 com identidades e cadastros reais autorizados; produto/conta/serviço/responsável do primeiro piloto ainda precisam ser definidos.
- Aprovar carga representativa, metas de disponibilidade/latência/erro, custos e limites por camada; medir Function↔banco/pooler/TLS no destino real.
- Medir múltiplas instâncias/noisy neighbor, retenção e expiração de idempotência sob volume representativo. Este perfil mede replay, não ensaio de retenção.
- Inventariar backup banco/configuração/segredos/objetos aplicáveis, provar restauração em destino seguro aprovado, conferir contagens/hashes/proveniência, tempo observado e política de eventos antigos.
- Definir residência/região, RPO/RTO e responsáveis pela operação/recuperação. Sem deslocamento automático de região ou criação de infraestrutura.

## Decisões

Preparação local antecipada não substitui a dependência HD-P03: o custo é manter M1 e o atendimento sem liberação. Perfil fixo e near-limit reduzem custo/tempo do CI; o custo é não provar capacidade/fairness/volume de produção. API/schema ficam iguais porque não há alteração de runtime; o release desta evidência é identificado pelo SHA/fingerprint. Não foram removidos fatores MFA ou ativado o template recovery, nem ampliados os escopos do administrador.

Quota usa withControlTransactions como o runtime, incluindo BEGIN, identidade vazia/timeouts e COMMIT/rollback na medição. O caminho SQL serializado verifica budgets completos, não disputa entre múltiplas conexões/instâncias. Robustez pendente: relógio customizado regressivo entre tarefas pode ser aceito, apesar de default performance.now monotônico; falha de fingerprint após criar fixture pode atrasar fechamento do pool descartável. Não passar relógio customizado não confiável nem chamar esse recorte de capacidade/restore de produção.

O número de backends distintos observados ao longo do ensaio pode exceder1 devido a reciclagem sequencial por idle timeout. O teto é uma conexão/lease simultânea, não um PID eterno; o driver não foi reconfigurado para mascarar esse comportamento.
