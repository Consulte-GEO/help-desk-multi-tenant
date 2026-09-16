# v0.9.0 — Responsabilidade pelo atendimento

## Escopo e decisão
Recorte de HD-301 no fluxo existente + HD-105. Não entrega M2 ou M3 completos nem encerra M1. A responsabilidade coordena o trabalho; a autorização continua dependente da identidade/vínculos/scopes e do recurso. Não há autorização derivada de `assigned_to`.

## Comportamento
| Situação | Resultado |
|---|---|
| Operador autorizado assume desocupado | Salva o próprio principal, incrementa versão e registra evento interno |
| Operador assume já próprio | No-op com versão validada e resposta idempotente; nenhum evento novo |
| Operador/admin tenta tomar ocupado | 409 assignment_conflict |
| Responsável libera o próprio | Salva null, incrementa versão e registra motivo interno |
| Outro agente tenta liberar | 403 assignment_release_forbidden |
| Admin do workspace libera o de outro | Permitido se mantiver autorização de recurso; também recupera órfão após revogação |
| Liberação de desocupado | No-op versionado; não inventa alteração |
| Encerrado/cancelado | 409 assignment_not_allowed, inclusive novo no-op; replay anterior ainda reautoriza |
| Cliente/gestor de conta/M2M | Não pode modificar responsabilidade |
| Versão antiga | 412, sem sobrescrita |
| Mesma chave, mesmo comando | Resposta original, não necessariamente estado atual |
| Mesma chave, outro comando | 409 idempotency_conflict |

Chamado resolvido pode ser atribuído/liberado; fechado/cancelado não. Assumir não muda estado para open. Não há transferência arbitrária ou escolha de destino nesta etapa. Motivo possui 1–2000 pontos de código após trim, sem controles/surrogates isolados.

## API e projeção
`POST /v1/tickets/{ticket_id}/assignments`, `{action: claim|release, reason}`, com If-Match, Idempotency-Key, Bearer e X-Workspace-Id. Nenhuma query ou campo adicional aceito. Retorna DTO com ETag e Idempotency-Replayed. Apenas operadores recebem `assignment:{state,can_claim,can_release}`. IDs internos de responsáveis não são projetados. Flags são consultivos e ficam obsoletos; comando revalida.

Clientes não recebem nem esse campo nem `ticket.assignment_changed`. O evento interno armazena ator, anterior, novo, ação, motivo e versão; a projeção de histórico remove relações de principal e entrega ação/motivo/versão. O histórico interno usa as permissões de leitura interna já existentes. Nenhum evento de outbox de responsabilidade é criado; a constraint candidata também o recusa.

## Persistência candidata
Migration `20260916000800_ticket_assignment.sql`. Exige schema0.8.0; adiciona coluna nullable com FK para principal global. Agentes de conta não precisam ser membros do workspace, portanto FK só em workspace_memberships seria incorreta. Guard privado valida o ator humano ativo e contexto; nenhum INSERT inicia com responsável preenchido. Alterações só admitem self-claim ou release permitido, com estado/priority isolados e guards originais de identidade/versão preservados.

Trigger diferido exige evento privado correspondente à mesma versão, principal, conta, chamado e mudança. Forma JSON fechada e índice único por chamado/versão reforçam o registro. Cache amplia operações permitidas sem retirar reautorização, quota5000, sete dias da resposta e 90 dias da chave. Schema0.9.0; runtime exige esse schema. Não houve aplicação SQL.

Snapshots idempotentes anteriores sem assignedTo são apresentados como desocupados naquele instante; nunca preenchidos consultando a responsabilidade atual. Este ajuste não reescreve o histórico.

## Tela e concorrência
Motivo independente em canal de mutação próprio. Congela ação/motivo/versão/chave ao enviar; mantém conteúdo novo se editado enquanto espera. Mudança de sessão/ticket invalida resultados anteriores. Atualização explícita após conflito preserva motivo e passa a usar a versão lida; não confirma automaticamente. Estado de responsabilidade também aparece na lista interna. Eventos recebem apresentação própria no Histórico.

## Critérios executados e pendentes
- [x] Reproduzir base569 e registrar regressões antes do código.
- [x] Implementar comando/DTO/endpoint/memória/adaptador e testes locais.
- [x] Escrever migration008 e 18 casos SQL adicionais; preservar migrations001–007.
- [x] Integrar tela/histórico/lista, contrato e exemplo; 28 checks HTTP de memória.
- [x] Revisar diff e tipos; executar635 testes locais sem skips.
- [ ] Executar100 SQL em PostgreSQL17 novo e upgrade com dados fictícios.
- [ ] Executar25 checks browser e validar foco/390px/acessibilidade.
- [ ] Lock/install/audit reais, Auth/pooler/Functions, capacidade/restore/revisão independente.

A revisão foi local. Não é avaliação independente, pentest nem certificação de produção. Migrações podem revelar problemas adicionais ao serem executadas no banco real.
