# Help Desk M1-R16 — Handoff e backlog

## Retomada
Ler PROJECT_HELP_DESK.md, README/AGENTS, handoff upstream R9, docs89–92 e manifesto. Remoto consultado em 01/10/2026: `78bbb00112331531168ae24600604cb7f3148770`. R10–R16 permanecem incrementos locais. Autorizações históricas não autorizam novas operações externas.

R16 corrige uma lacuna de aceitação: quatro GETs ao fim do bloco M2M detectam notas inesperadas e mudanças no chamado humano, mensagens ou timeline depois das recusas. Dados comparativos são privados ao processo. Somente modo `includeMachineWrites:true` ganha etapas: 43, mais 28 controles R10. Legado/false continuam com 18. Nenhuma intenção de gravação, chave, configuração, permissão, credencial ou endpoint novo.

## Integração segura
- R9 exato, sem R10–R15: aplicar somente `helpdesk-m1-r10-r16.patch`.
- R15 exato: aplicar somente `helpdesk-m1-r16-only.patch`.
- Checkout intermediário ou alterado: reconciliar pelo manifesto e diff; não forçar, não aplicar as duas variantes, não reaplicar R2–R9.
- Source recuperada é equivalente por fingerprint executável, não um clone da história completa remota. Não fazer force-push de commits locais nem substituir diretórios por cima do checkout.

## Backlog prioritário
| Prioridade | Tarefa | Critério de saída | Estado |
|---|---|---|---|
| P0-INTEGRAR | Integrar R10–R16 no checkout real | HEAD/base/diff/alterações concorrentes conferidos | Pendente externo |
| P0-CI | Toolchain padrão e CI no código integrado | npm ci/audit/typecheck; 1.375 aplicação, 209 PostgreSQL17, 71 HTTP/browser sem skips; mesma fonte | Pendente |
| P0-REVIEW | Revisão independente dos incrementos | Nenhuma regressão de escopo/autorização, efeitos, privacidade ou falsos positivos de aceitação | Pendente |
| P0-AMBIENTE | Homologação isolada autorizada | Auth/dados/outbox/canais isolados; identidades e fixtures explícitas | Pendente |
| P0-AUTH | Executar R11 e R10 | Sessões reais, identidade/escopos, expiração/revogação e recuperação comprovadas | Clientes locais; destino pendente |
| P0-WRITE | Executar R12/R15/R16 e correlacionar efeitos SQL | Gravações humanas/M2M, replays/concorrência/atomicidade e tentativas recusadas verificadas | Clientes locais; destino/SQL pendentes |
| P0-OPS | Function/TLS, carga, backup/restore e governança | Residência/RPO/RTO e aceite documentados | Pendente |
| M2 | Administração genérica | M1 encerrado por evidências e aceite, não por flag | Não iniciado |

## Revisão dos riscos
O estado do chamado humano é observado antes e depois do bloco M2M. `available_actions` não entra na comparação, pois é consultivo. A nota interna é lida pelo agente A já dotado de `notes:read`; a integração continua proibida de acessar notas. Coleção sem permissão, paginada ou indisponível não equivale a coleção vazia. Corpo e snapshots não entram no relatório.

Hash de configuração e chaves permanecem iguais, porque as novas operações são somente leitura; isso não transfere aprovações do código anterior nem dispensa autorização atual. Falhas interrompem a rodada; nenhuma exclusão/correção/reconciliação automática. Reenvio usa a mesma configuração e chaves somente com retenção e autorização ainda válidas.

Estado desta rodada: 1.375 Node aprovados; 35 HTTP memória; SQL e browser não aprovados aqui. `verify` falhou no typecheck padrão, instalação/audit bloqueados; typecheck global é suplementar. Nenhuma publicação ou mutação remota. Leituras HTTP não provam os efeitos não expostos pela API; correlacionar SQL em ambiente autorizado. Não acrescentar funcionalidades M2 para substituir este fechamento.
