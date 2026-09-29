# Handoff — Help Desk M1-R6

Leia PROJECT_HELP_DESK.md e docs44–48 antes de alterar a entrega. Fonte R5 recuperada do bundle local; commit-base b0a544d53f5978aa75170a0827315d4d623e7f5c. Remoto lido b9481b9fabde2fd9c442e44099bc17608b59571a, branch codex/m1-reproducibilidade. Não confundir a recuperação com um clone integral upstream.

## Resultado
Correção da exceção síncrona de release registrada no backlog R5. Uma falha de cleanup não substitui a confirmação de COMMIT, transaction_outcome_unknown nem recusa anterior. Conexão logicamente invalidada e evento fechado; nenhum replay/retry automático. 1177 testes de aplicação e35 HTTP de memória passaram. TLS6 está incluído. SQL209 escritos/0executados e browser0aprovado; instalação/audit/typecheck padrão/gate não aprovados. M1 continua aberto e M2 não iniciado.

## Integração
Usar uma variante somente:
- helpdesk-m1-r2-r6: base compatível com o remoto sem R2–R5.
- helpdesk-m1-r6-only: R5 exato já integrado.

Verificador R5 preservado: executar before, aplicar o patch escolhido e executar after. Não editar hashes para aceitar conflito, nem aplicar R6-only sobre R2/R3/R4. Para um checkout intermediário, conciliar em branch revisável sem sobrescrever trabalho concorrente. Source/bundle em pasta nova para estudo/testes; nunca copiar toda a árvore sobre um checkout vivo ou force-push.

## Próxima prioridade
A próxima entrega necessária é execução conectada, não expansão do número de testes sintéticos. Usar ambiente com registry autorizado, Docker/PostgreSQL17 e navegador permitido. Executar instalação/verify/audit,209SQL/upgrade e71HTTP/browser; gerar evidência nova de homologate:local/check:homologation. Depois, com autorização atual, validar pg/TLS e a execução DENTRO da Function, Auth/M2M, revogação e isolamento. Não ligar HELPDESK_RELEASE_APPROVED como atalho.

A fila restante inclui capacidade/abuso, descarte de conexões, restore, residência/RPO/RTO, revisão independente e aceite M1. Só depois M2.

## Revisão focal
src/infrastructure/transaction.ts: release executado uma vez por transação; confirmação de COMMIT marcada apenas após tag/saúde; nenhum erro de cleanup inspecionado; tentativa de log isolada de erro síncrono/Promise rejeitada. A invalidade em WeakMap impede SQL em eventual reuso do mesmo objeto, mas NÃO atesta fechamento físico. O destino de log recebe somente component/event/commit_state.

supabase/tests/rls.test.ts: as novas fixtures usam driver/banco reais quando executadas, porém falhas de release e confirmação são injetadas pelo adaptador. Forçar descarte real antes do erro evita a própria fixture reter conexão. Rever commit confirmado, recibo/flag replay e uma única linha de ticket/evento/outbox. Não executar esses testes em Supabase remoto.

Sem alteração de API0.19/schema0.18, 11migrations, lock ou grants. Nenhuma autorização remota anterior é herdada.
