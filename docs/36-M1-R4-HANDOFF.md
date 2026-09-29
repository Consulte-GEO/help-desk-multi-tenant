# Handoff — Help Desk M1-R4

**Base remota:** b9481b9fabde2fd9c442e44099bc17608b59571a, codex/m1-reproducibilidade. **Situação:** incremento local; M1 aberto.

## Ler primeiro
PROJECT_HELP_DESK.md, README/AGENTS e docs04/05 do checkout atual, docs34–38 deste pacote, e o plano `docs/superpowers/plans/2026-09-28-transaction-client-events.md`. Histórico de R2/R3 preservado; seus estados não substituem este fechamento.

## O que mudou
Proteção por cliente físico em runTransaction; bloqueio de SQL depois de evento fatal; distinção entre indisponibilidade antes de COMMIT e confirmação desconhecida depois do envio; cliente emprestado não pode liberar conexão nem executar depois de encerrado. Erro depois de COMMIT já confirmado não desfaz a gravação. Listener estável evita acumulação e preserva listeners externos. Sem migration/API/grant/dependência nova.

1.133 testes Node passaram (19 novos sobre R3), incluindo os 6 TLS reais herdados. HTTP em memória:35. SQL:207 escritos,0 executados nesta rodada. Browser:0 aprovados. Instalação/audit/typecheck padrão e gate não aprovados; typecheck global suplementar passou. Nenhuma publicação.

## Aplicar UMA variante
- Checkout sem R2/R3: `patches/helpdesk-m1-r2-r3-r4.patch` sobre a base remota compatível.
- Checkout com exatamente o R3 entregue: `patches/helpdesk-m1-r4-only.patch`.

Não aplicar as duas. Confirmar preimages, caminhos novos, hashes e fingerprint no manifesto. `git apply --check` antes de `git apply`. Em divergência, conciliar; não usar --reject/forçar, substituir hashes ou copiar overlay indiscriminadamente. Checkout com somente R2 precisa de conciliação explícita ou da integração do R3; a variante R4-only não significa R2→R4.

A recuperação local prova equivalência dos arquivos de código/configuração/testes, não a história remota inteira. Nunca force-push a história recuperada. Não restaurar README/AGENTS/docs04/05 antigos. Atualizá-los depois da integração preservando os registros anteriores.

## Próxima prioridade — M1 conectado
1. Reinspecionar HEAD, integrar em branch local revisável e preservar trabalho concorrente.
2. Executar instalação pelo lock real, verify e audit no registry autorizado. Corrigir causas reais; tipos globais não substituem npm ci.
3. PostgreSQL17 descartável:207 casos sem skips, incluindo interrupção do backend obtido pela própria fixture. Nunca executar esse runner contra o Supabase remoto. Confirmar nova conexão, ausência da mensagem não confirmada e listener único com pg8.16.3.
4. TLS6 e HTTP/browser71; homologate:local e check:homologation com fingerprint novo e logs íntegros.
5. Em ambiente autorizado, completar TLS/pg/cleanup e a execução dentro da Function; Auth humano/M2M, revogação e isolamento entre contas. Não ligar a flag de produção só para permitir o teste.
6. Capacidade/abuso, restore, residência/RPO/RTO, revisão independente e aceite do M1. Só depois M2 administrativo.

## Revisão focal
`src/infrastructure/transaction.ts`, `tests/m1-transaction-events.test.ts`, helper de eventos e os três casos M1-R4 no final de `supabase/tests/rls.test.ts`. Preservar snapshots, idempotência, command tags e SQL histórico. Não refazer controles do R2/R3.

Exceção síncrona de release não foi redesenhada. O descarte real e o comportamento com driver/rede continuam exigindo execução conectada. As fixtures Node não comprovam rollback PostgreSQL. As autorizações relatadas no handoff remoto são históricas, não autorização atual para escrita externa.
