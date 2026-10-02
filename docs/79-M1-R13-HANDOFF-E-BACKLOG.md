# Help Desk M1-R13 — Handoff e backlog

## Onde retomar
Ler `PROJECT_HELP_DESK.md`, README/AGENTS, handoff remoto 64, documentos 73–76 do R12 e documentos 77–80 do R13. Remoto observado: `78bbb00112331531168ae24600604cb7f3148770` (R9 integrado). R10–R13 são incrementos locais; não reaplicar R2–R9.

A fonte executável R12 foi recuperada com fingerprint exato e baseline 1.320. R13 corrige exclusivamente a prontidão que precede os testes SQL descartáveis. Não muda atendimento, clientes hospedados, RLS, schema, migrations ou lock.

## Resultado da rodada
**1.333 testes Node passaram**, 13 novos. Testes focais: 15, incluindo 2 herdados. Regressões antes/depois preservadas. Typecheck suplementar passou; padrão, instalação, audit, PostgreSQL, browser e gate não aprovados. Demo HTTP: 35 aprovados. 209 cenários SQL permanecem existentes, 0 reexecutados nesta rodada. Revisão não independente.

## Integração
- `helpdesk-m1-r10-r13.patch`: R9 integrado, sem R10/R11/R12.
- `helpdesk-m1-r13-only.patch`: R12 exato.

Aplicar apenas uma variante, após `git apply --check` e conferência dos hashes do manifesto. Checkout com somente R10 ou R11 precisa de reconciliação explícita, não aplicação forçada. `changes/` serve para inspeção, não substituição de diretório. Preservar a história upstream; commits de recuperação não são para force-push.

## Backlog ordenado
| Prioridade | Entrega | Critério de saída | Estado |
|---|---|---|---|
| P0-INTEGRAR | Integrar cumulativo R10–R13 no checkout atual | Hashes/base/diff conferidos, trabalho concorrente preservado | Pendente externo |
| P0-CI | Instalação e homologação da nova fonte | Toolchain travada, audit, typecheck; 1.333 aplicação / 209 PostgreSQL17 / 71 HTTP+browser no mesmo fingerprint, sem skips | Pendente |
| P0-AMBIENTE | Destino de homologação e outbox/canais isolados | Autorização atual, fixture sintética e backend identificado; permalink não é prova de isolamento | Pendente |
| P0-AUTH/READ | Executar R11 e R10 | 12 passos de sessão e 28 controles de leitura com evidência real do destino | Clientes locais, não host |
| P0-WRITE | Executar R12 e correlacionar efeitos no banco | 28 controles + 18 verificações; idempotência, concorrência e atomicidade com provas próprias | Cliente local, não host |
| P0-AUTH-COMPLETO | Expiração, revogações concorrentes e ciclo da chave longa | Evidência real, sem relaxar perfis | Pendente |
| P0-OPS | Function/TLS/pooler, capacidade, restore, revisão independente | Residência/RPO/RTO e aceite operacional | Pendente |
| M2 | Administração genérica | M1 encerrado antes de operação M2 | Não iniciado |

## Revisão focal
`postgres-readiness.mjs`: retorno válido do probe é a única condição de saída bem-sucedida. Erros externos nunca são identificados por marcas como `wrongServer`; metadados inválidos não recebem retries. Nenhuma retentativa nova se aplica a gravações, auth ou domínio. Preservar 40/500 defaults e a checagem real pela porta publicada de loopback no executor Docker.

`m1-postgres-readiness-validation.test.ts`: callbacks sintéticos cobrem versões ausentes/coerção, configuração inválida, falha segura, metadados lidos uma vez e limite de tentativas. Não chamar esses testes de banco real. O CI precisa conferir que o driver real continua devolvendo version numérica, como no SELECT existente.

Não criar outra ferramenta local ou funcionalidade para substituir a execução dos gates pendentes. Nenhuma autorização histórica vale para push/deploy, segredos, dados ou ativação de atendimento nesta tarefa.
