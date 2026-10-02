# Help Desk M1-R19 — Handoff e backlog

## Ponto de retomada
Código R18 revalidado: **1.417 testes Node**. Fingerprint `66b19776e652a210ebc819e49dac7650bb27eae00c269b8c186ab55e90d84491`. Remoto ainda R9 `78bbb00112331531168ae24600604cb7f3148770`. R19 tem somente consolidação documental, nova inspeção de metadados e evidências. Não repetir o desenvolvimento dos clientes R10–R18.

Leia `PROJECT_HELP_DESK.md`, `docs/101-M1-R19-PLANO-DE-FECHAMENTO.md`, `docs/102-M1-R19-ESTADO-E-EVIDENCIAS.md` e `docs/104-M1-R19-TAREFA-CODEX.md`. Os estados anteriores ficam em histórico, sem apagar decisões. O corpo arquitetural foi mantido literalmente.

## Próxima tarefa efetiva
**Integrar uma variante no checkout real e executar a toolchain travada em ambiente apto**, obtendo 1.417 Node, 215 PostgreSQL e 71 HTTP/browser da mesma fonte. Essa tarefa ainda não foi concluída nesta sessão. Há 215 SQL escritos e zero executados no R19; o Supabase só foi inspecionado por metadados, sem executar SQL.

O lock existe e foi preservado. Usar `npm ci --ignore-scripts`; não seguir o `deps:resolve` do handoff histórico como passo normal. Não substituir versões, desabilitar TLS, abrir schema privado, enfraquecer RLS ou reduzir mínimos do gate.

## Backlog prioritário
| Item | Estado | Próxima evidência |
|---|---|---|
| Código R10–R18 / comparadores / clientes | Implementado e Node local revalidado | Integração, toolchain e CI atuais |
| Integração no GitHub | Pendente | HEAD contendo os incrementos e inspeção after |
| Instalação/auditoria/typecheck padrão | Bloqueados no ambiente atual | Logs oficiais sem falhas |
| 215 cenários PostgreSQL | Escritos, não executados nesta sessão | Banco descartável com os seis percursos R17/R18 aprovados |
| 36 checks browser | Bloqueados no ambiente atual | Chromium permitido, sem interceptações substituindo o destino pretendido |
| Fixtures hospedadas | Não demonstradas pelos metadados | Alvos, identidades, dados e outbox isolados com autorização |
| Aceitação HTTP/Auth/M2M hospedada | Pendente | Relatórios reais dos clientes existentes |
| Capacidade/restauração/governança | Pendente | Ensaios, residência/RPO/RTO e aceite |
| Revisão independente | Pendente | Outro executor revisando diff e evidências |
| M2 | Não iniciado | M1 encerrado formalmente |

## Fontes confirmadas
Netlify `helpdesk-consultegeo`, site `9781cd85-7dc1-4ef5-868b-947e389a9d4d`, deploy R9 `6abbdecfeefd99000864e661` ready. Supabase `xaelbntjnvztznnpcvtm`, PostgreSQL 17, 25 tabelas e 11 migrations por metadados. Valores de linhas são os reportados pelo conector, não uma auditoria SELECT. FORCE RLS, grants e login HTTP não foram reconfirmados. Não confundir get_project/list_tables com execução SQL ou homologação.

## Integração e segurança
R9 sem os incrementos: `patches/helpdesk-m1-r10-r19.patch` (`r9-r19`). R18 exato: `patches/helpdesk-m1-r19-only.patch` (`r18-r19`). Uma variante somente. Bases intermediárias exigem reconciliação; o pacote não concede autorização para push, merge, PR, deploy ou mudanças remotas. O snapshot de recuperação serve a uma pasta nova, não a force-push.

Se o usuário pedir apenas continuidade e os bloqueios permanecerem, retomar este ponto. Não produzir outra funcionalidade ou suíte sintética como substituto da execução real. A ausência de aprovação é um resultado válido, não um motivo para marcar o marco como fechado.
