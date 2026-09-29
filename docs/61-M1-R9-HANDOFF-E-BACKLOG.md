# Handoff e backlog — Help Desk M1-R9

Ler PROJECT_HELP_DESK.md, docs59–62 e o handoff remoto atualizado antes de editar. Base local R8 `ebb598af29a187c20d71d7395edabe3b722eebd0`; remoto observado `b9481b9fabde2fd9c442e44099bc17608b59571a`. Commit final no manifesto. Branch local work/m1-r9-validacao; bundle representa recuperação local, não história completa do GitHub.

## Entregue
Correção limitada ao gate existente de evidências: um diretório por execução, um arquivo correspondente a cada etapa, sem duplicatas ou atalhos simbólicos intermediários. O CLI recusou as fixtures incorretas após o patch. Oito novos testes e 1.200 Node aprovados; TypeScript suplementar passou, padrão continua não aprovado. Nenhuma alteração do runtime, contratos, migrations, dependências ou workflow.

## Integrar
Escolher **uma** variante: `helpdesk-m1-r2-r9` para a base compatível com o remoto sem R2–R8; `helpdesk-m1-r9-only` para o R8 exato. Inspecionar before, aplicar somente o patch escolhido, inspecionar after. Em versões intermediárias, conciliar o diff; não forçar o patch. Source/bundle apenas para recuperação em pasta nova; não sobrepor o checkout remoto. Preservar concorrência e os documentos/evidências do remoto.

## Backlog priorizado
| Prioridade | Próxima entrega | Saída necessária |
|---|---|---|
| P0 | Integrar R2–R9 no checkout real | Arquivos e fingerprint compatíveis, sem sobrescrever mudanças concorrentes |
| P0 | Toolchain travada | npm ci, typecheck e audit aprovados com o lock e registry oficiais |
| P0 | PostgreSQL17 local descartável | 209 cenários executados sem skips; fresh/upgrade e driver reais |
| P0 | Interface e gate | 35 HTTP +36 browser; evidências da mesma tentativa e do mesmo código; total 71 |
| P0 | Function/Auth/M2M no destino | Execução real autorizada; não abrir HELPDESK_RELEASE_APPROVED para contornar validações |
| P0 | Capacidade, recuperação e operação | Carga/abuso/descarte, backup/restore, residência/RPO/RTO, revisão independente e aceite |
| P1 | M2 administrativo | Somente após fechamento do M1 |

A pendência do gate sobre mistura de diretórios/etapas está corrigida localmente. Isso não homologa a procedência dos logs nem o banco. Não criar mais uma camada de diagnóstico como substituto da execução das etapas existentes. SQL209 continua escrito/não executado nesta rodada. Aprovações históricas não passam para o código novo.

## Revisão focal
Testar mistura de diretórios com hashes válidos, troca install/audit, duplicate check, symlink na pasta do run e controle positivo. Não remover a conferência de hashes/contagens/fingerprint. O log precisa corresponder à etapa; um mesmo arquivo não representa duas etapas. Registrar que o relatório continua sem assinatura de plataforma.

Nenhuma autorização remota é herdada. Push/disparo CI/deploy, segredos, usuários e dados exigem autorização atual específica.
