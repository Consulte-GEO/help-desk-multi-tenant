# Help Desk M1-R18 — Handoff e backlog

Leia PROJECT_HELP_DESK.md, docs97–100, README/AGENTS e o handoff upstream R9. Base remota observada: `78bbb00112331531168ae24600604cb7f3148770`. R10–R18 permanecem incrementos locais. Não herdar autorização externa de relatos históricos.

## Entrega e revisão dirigida
`assertReceiptMatchesWrite`, em `tests/fixtures/postgres-acceptance-effects.ts`, confere pedido normalizado, hash e resultado privado contra o recurso persistido após cada primeira gravação confirmada. Retorna cópia independente. `correlate`, em `supabase/tests/hosted-acceptance-scenarios.ts`, exige igualdade integral do recibo no fim. Os seis percursos existentes foram mantidos; não há novo runner, endpoint ou operação de domínio.

Conferir especialmente: nomes camelCase do domínio versus snake_case do banco; `createdAt`/`updatedAt` em microssegundos; `assignedTo:null` na criação; resultado histórico de prioridade; `reason.trim()` e versão esperada no hash; ausência de campos extras; namespace por principal/operação/chave. O helper cobre as cinco mutações válidas desta fixture, não todos os comandos possíveis do produto. Mensagens e políticas não podem aparecer nos diagnósticos.

A suíte local passou em 1.417 testes, com 28 novos; 215 cenários SQL continuam sem execução nesta rodada. Typecheck suplementar não substitui instalação/typecheck oficial. A assinatura exportada de `correlate` serve somente aos testes; não deve virar API pública.

## Próxima ordem obrigatória
| Prioridade | Ação | Critério |
|---|---|---|
| P0-INTEGRAR | Reconciliar cumulativo R10–R18 ou R18-only com HEAD real | Uma variante, hashes compatíveis, sem sobrescrever trabalho concorrente |
| P0-CI | Usar lock e toolchain oficial | npm ci, audit, typecheck, 1.417 Node, 215 PostgreSQL, 71 HTTP/browser da mesma fonte |
| P0-SQL | Executar os seis percursos R17 agora com o R18 | Conferir o recibo inicial e os cinco efeitos; replay e perdas HTTP não duplicam dados |
| P0-REVISÃO | Revisão independente do acumulado | Outro executor, com logs e diff; não simplesmente repetir a conclusão deste handoff |
| P0-PRODUCAO | Validar diretamente em produção | Site e base HelpDesk existentes; isolamento entre contas e workspaces preservado |
| P0-HOSPEDADO | Clientes R10/R11/R12/R15/R16 e banco | Sessões, gravações, isolamento e correlação comprovados no destino |
| P0-OPERAÇÃO | Function/TLS, concorrência, capacidade, restore e governança | Evidências próprias; residência e RPO/RTO definidos e aceitos |
| M2 | Administração multiproduto/multicontrato | Somente após fechamento comprovado de M1 |

## Integração
R9 sem os incrementos locais: `helpdesk-m1-r10-r18.patch`. R17 EXATO: `helpdesk-m1-r18-only.patch`. Aplicar somente uma alternativa. R10–R16 ou um checkout modificado precisam de reconciliação explícita; não forçar patches.

Fingerprint final executável: `66b19776e652a210ebc819e49dac7650bb27eae00c269b8c186ab55e90d84491`. Os hashes de entrada/saída e o commit local constam no manifesto. A fonte `recovery/source.tar.gz` é snapshot para pasta nova, sem a história Git completa, dependências ou evidência de homologação. Não usar force-push ou substituir o checkout.

As evidências do pacote R18 são desta rodada; os registros históricos do R17 permanecem no pacote anterior. Nenhuma aprovação histórica se transfere para a fonte atual. Os logs incompletos e bloqueados são preservados e não são usados como aprovação.
