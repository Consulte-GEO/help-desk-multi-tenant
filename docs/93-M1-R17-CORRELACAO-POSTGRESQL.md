# M1-R17 — Aceitação HTTP correlacionada com efeitos privados PostgreSQL

## Escopo
Base local R16, fingerprint `85ab24a0f2c22f10851601a7cf0369974e250276d1da99e1cc2df8ae738d37c1`.
Base upstream observada em 01/10/2026: `78bbb00112331531168ae24600604cb7f3148770`.
A próxima lacuna do handoff é correlacionar os clientes R10/R12/R15/R16 com o banco real.
Esta rodada não cria outro CLI hospedado nem altera domínio, grants, migrations ou produção.

## Especificação
1. Acrescentar cenários à suíte PostgreSQL existente, herdando o guard de banco local fresco e usando `helpdesk_app` para autenticação privada e operações de atendimento.
2. Cada cenário possui workspace, contas, produtos/instâncias, contratos, pessoas e integração próprios. O administrador é usado somente no preparo sintético e na observação privada; nunca no handler.
3. Reutilizar o cliente de gravações existente, com os 28 controles de leitura e 43 passos humano/M2M. A identidade humana no provedor é sintética e distinta do principal; a resolução de grants e sessões M2M passa pelo PostgreSQL.
4. Observar, em um único SELECT, oito coleções do workspace: tickets, mensagens, notas, eventos, outbox, recibos idempotentes, auditoria e write_effects. Comparar somente em memória, sem imprimir conteúdo privado.
5. GETs, resolução de cobertura, replays e recusas devem preservar integralmente esse recorte. Uma comparação de coleções incompletas ou duplicadas não pode aprovar.
6. Ao fim do percurso, exigir exatamente dois tickets novos, duas mensagens, cinco eventos/outboxes/write_effects e cinco recibos; nenhuma nota nova, nenhum efeito na conta B, histórico anterior preservado. Conferir autoria, versões, snapshots e os vínculos evento/efeito/outbox/recibo.
7. Simular perda da resposta HTTP APÓS o handler concluir cada uma das cinco mutações válidas. Uma nova invocação deliberada com as mesmas chaves deve recuperar o resultado sem duplicação. Isso não simula perda de COMMIT, já coberta em testes próprios.
8. O consumidor de outbox não é executado. A suíte não prova o Supabase Auth real, TLS, Function Netlify, entrega externa, capacidade, restauração ou operação.

## Execução planejada
- [x] Reproduzir baseline R16 e verificar fingerprint.
- [x] Escrever regressões do comparador/observação antes da implementação.
- [x] Implementar helper test-only com saída de erro fechada.
- [x] Registrar os seis percursos PostgreSQL na suíte principal e atualizar o mínimo do gate.
- [x] Executar os comandos disponíveis sem reaproveitar aprovação histórica; registrar os limites.
- [x] Revisar diff, preparar patches alternativos, fonte recuperável, estado e handoff.

## Limites de evidência
O teste é executável somente pelo ambiente PostgreSQL descartável explicitamente habilitado.
Se Docker/pg não estiverem disponíveis, os cenários permanecem ESCRITOS, não EXECUTADOS.
O teste do comparador com linhas sintéticas não prova a correção do SELECT no PostgreSQL.
Uma fotografia antes/depois detecta mudanças persistentes no recorte, não todos os efeitos transitórios nem fatos fora das oito coleções.
Não associar este resultado à homologação hospedada nem encerrar M1 por contagem de testes.

- [ ] Executar os215cenários em PostgreSQL real e aprovar o código integrado no CI.

Implementação concluída localmente; banco não executado. Evidências e limites em docs94.
