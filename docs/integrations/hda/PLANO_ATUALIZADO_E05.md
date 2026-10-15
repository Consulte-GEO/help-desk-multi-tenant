# Plano atualizado — E05 / HD-DA-CADASTROS

**14/10/2026 · 2.0+E05 · fonte observada `ea7a4454f30c45f35dece6e4a702591c55c79cd5`.**

| Pacote | Estado real |
|---|---|
| HDA-00 | Parcial; host, CLI, API/IdP e autenticação de origem não qualificados |
| HDA-01 | Contratos locais preservados; .NET/integração integral pendentes |
| HDA-02 | Composição transacional e recuperação de recibos implementadas/testadas localmente; PG17, cadeia histórica, publicador e promoção pendentes |
| HDA-03 | Não iniciada; abertura + intenção + tarefa precisam da mesma transação |
| HDA-04 | Serviço composto com owner real e driver sintético; CLI/worker reais não montados |
| HDA-05 | Contrato candidato de prévia preservado; origem pendente |
| HDA-06 / HDA-07 | Interface de revisão e aprovação de execução não implementadas |
| HDA-08 / HDA-09 | Escrita na origem e callback/conciliação dessa escrita não implementados |
| HDA-10 / HDA-11 | Projeção pública/notificação HDA e piloto pendentes |
| HDA-12 / HDA-13 | Usuário + IdP e expansão por cadastro pendentes |

## Próximo bloco obrigatório: qualificação em banco, sem nova simulação de aceite

1. Reinspecionar a principal e o overlay cumulativo, integrar em checkout completo isolado, preservando PR43 e posteriores. Instalar o lock canônico e rodar a suíte completa, tipos, contratos, migrations, segredos, build e audit.
2. Usar Linux não-root e PG17 local. Executar o runner do candidato em seu cluster próprio, corrigindo os erros reais sem reduzir guards ou trocar de versão silenciosamente. Provar os cenários existentes e acrescentar a composição `createPostgresRegistrationTransactions`/serviço E05 com o driver pg real.
3. Em outro cluster descartável, validar o candidato sobre a cadeia completa atual. A fixture mínima do runner não prova a cadeia histórica. Provar roles reais, revogação durante consulta, COMMIT perdido, scope expiry, callback expirado, fila e recibos.
4. Qualificar publicador de bindings, quotas/retenção, login dedicado do worker, catálogo de segurança e estratégia de promoção. Só depois gerar migration aditiva via CLI e atualizar os manifests de prontidão. Não aplicar `supabase/candidates` no banco hospedado.

## Depois da prova de persistência

HDA-03: integrar abertura e intenção de análise com uma conexão/transação. Preservar contador/protocolo, snapshots, recibo e outbox Resend. Repetição e rollback tardio não devem duplicar chamado ou tarefa. Não tornar todos os tipos de cadastro automaticamente elegíveis.

HDA-04: qualificar o host real, pool separado, flags da CLI, chave dedicada, modelo, isolamento e supervisor. Instanciar a fábrica E05 usando essas dependências verificadas. `analysisEnabled` e `receiptReadEnabled` são configurações privadas independentes; nenhum exemplo liga produção.

HDA-06 pode ter sua interface local desenvolvida em paralelo com contratos sintéticos claramente identificados, sem substituir a exigência de banco. Interface de rascunho não concede aprovação nem execução. Não implementar mecanismos genéricos de automação fora das ações previstas.

## Decisão desta continuidade

A indisponibilidade foi reconfirmada, não presumida. Avançou-se na composição prevista pela E04, em vez de chamar mais testes estáticos de homologação PostgreSQL. Consequência: E05 é pacote de engenharia local e a entrada em operação continua bloqueada para HDA. O atendimento já publicado não foi desligado ou alterado.
