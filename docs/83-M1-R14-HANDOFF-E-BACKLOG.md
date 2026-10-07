# Help Desk M1-R14 — Handoff e backlog

## Onde retomar
Ler PROJECT_HELP_DESK.md, README/AGENTS, o handoff remoto R9 (64), os documentos 77–80 do R13 e 81–84 do R14. Remoto observado: `78bbb00112331531168ae24600604cb7f3148770` (R9 integrado). R10–R14 são incrementos locais, não presumir publicados.

R14 corrige o descarte lógico das respostas HTTP rejeitadas durante a autenticação humana. Código em `src/infrastructure/authentication.ts`; regressão em `tests/m1-auth-response-cleanup.test.ts`. Gate mínimo de aplicação: 1.347. Não mudou SQL, autorização de conta, sessão M2M, cliente hospedado ou o comportamento normal do usuário autenticado.

## Resultado
1.333 testes no baseline e 1.347 ao final. RED 12 falhas/2 controles; GREEN 14/14. Três testes usam fetch nativo e sockets HTTP próprios; os outros verificam streams/erros/controlos. SQL e identidade são sintéticos. Padrão de tipos/instalação/auditoria, PostgreSQL, browser e gate não aprovados nesta rodada. Typecheck suplementar separado. Não houve revisão independente.

## Integração
- `helpdesk-m1-r10-r14.patch`: R9 integrado sem R10–R13.
- `helpdesk-m1-r14-only.patch`: R13 exato.

Aplicar apenas uma variante. Checkout intermediário exige reconciliação, não aplicação forçada. Conferir hashes anteriores/finais e fingerprint do manifesto. `changes/` serve para inspeção; não copiar por cima do repositório inteiro. Não reaplicar R2–R9 nem usar os commits locais para force-push.

## Backlog ordenado
| Prioridade | Ação | Condição de saída | Estado |
|---|---|---|---|
| P0-INTEGRAR | Integrar o conjunto no checkout real | Hashes/diff/base conferidos, alterações concorrentes preservadas | Pendente externo |
| P0-CI | Executar a toolchain travada e o CI existente | Instalação/audit/typecheck e 1.347 aplicação/209 PostgreSQL/71 HTTP+browser no mesmo fingerprint, sem skips | Pendente |
| P0-REVIEW | Revisão independente do runtime e suítes R10–R14 | Revisão aceita com riscos identificados, sem relaxar regras | Pendente |
| P0-PRODUCAO | Validar diretamente em produção | Site e base HelpDesk existentes; isolamento entre contas e workspaces preservado |
| P0-AUTH | Executar R11/R10 e testar falhas controladas de identidade | Evidência hospedada de sessão/acesso e recuperação; não provocar indisponibilidade em serviço compartilhado | Pendente |
| P0-WRITE | Executar R12 e correlacionar efeitos no PostgreSQL | Criação/replay/concorrência/atomicidade com provas próprias | Pendente |
| P0-OPS | TLS/Function, capacidade, restore e segurança operacional | Residência/RPO/RTO e aceite documentados | Pendente |
| M2 | Administração genérica | M1 encerrado conforme critérios existentes | Não iniciado |

Não criar outra ferramenta para substituir a execução desses gates. Um resultado local ou uma flag não encerra o M1. Autorizações históricas não permitem operações externas novas.

## Revisão focal
Confirmar uma chamada de cancelamento sem await e sem leitura do corpo, preservar o código de recusa, zero consultas SQL em falha, sucesso no leitor limitado, sem retry. Rever comportamento de cancelamento do fetch na versão Node efetivamente empacotada na Function. Os testes locais não quantificam capacidade ou retenção em produção.
