# v0.8.0 — Prioridade auditável e histórico autorizado

## Escopo e enquadramento
Incremento local sobre v0.7.0. Recorte operacional de HD-301 antecipado sobre o ticket existente + evolução HD-105. Não fecha M1 e não entrega M2/backoffice, SLA, filas, anexos ou notificações externas. Banco candidato 0.8.0 por mudança real de permissões, constraints e cache; API/interface 0.8.0.

## PATCH /v1/tickets/{ticket_id}
Objeto JSON estrito com `priority` (low/normal/high/urgent) e `reason`. Exige identidade/workspace autorizados, tickets:read e tickets:write, Idempotency-Key e If-Match exato. A rota não aceita query ou outros campos. Motivo: 1–2000 pontos de código Unicode após trim, sem controles C0/C1 ou surrogate isolado.

Somente humano operador da conta (agente com vínculo ou administrador do workspace) pode alterar. Requester, gestor da conta e M2M não podem; um grant de agent forjado em M2M não muda isso. A autorização precede o replay. Banco candidato também consulta papéis/scopes vivos nos helpers/guard. UI não é fronteira de autorização.

| Situação | Resultado |
|---|---|
| Mudança válida | 200, nova prioridade, version + 1, updated_at atualizado e ETag. |
| Mesma prioridade | 200 com versão intacta; sem novo evento/outbox. Registra resposta idempotente. Motivo, versão e autorização continuam obrigatórios. |
| Reenvio idêntico | 200, resposta original e Idempotency-Replayed=true; pode ser versão antiga. Consultar GET para estado atual. |
| Mesma chave, conteúdo/versão diferentes | 409; não aplica segunda mutação. |
| Versão desatualizada | 412; atualizar, revisar e confirmar explicitamente. |
| If-Match ausente / malformado | 428 / 400. |
| Encerrado ou cancelado | 409 para nova alteração; replay válido não reabre nem altera. |
| Falha de confirmação | Resposta controlada, sem retry automático; falha de rede não comprova ausência de gravação. |

O comando não altera identidade, conta, produto, estado, cobertura ou snapshot contratual. Não recalcula SLA (relógios operacionais continuam não implementados).

## Evento, privacidade e outbox
A aplicação grava atualização, `ticket.priority_changed`, outbox mínima e resultado idempotente na mesma transação. Evento guarda `from`, `to`, `reason`, `version`. DTO de cliente contém somente `from`, `to`, `version`. Operador recebe o motivo interno; esse fato não concede acesso a notas internas sem sua capacidade específica.

A outbox contém envelope já utilizado pelo produto e `data={ticket_id,version}`. Não contém motivo. Isso preserva intenção, **não significa envio de e-mail/webhook**, pois dispatcher/worker continuam pendentes. O histórico funcional não substitui auditoria administrativa imutável ou retenção regulatória.

## Migration 007 — candidata, NÃO executada
`20260916000700_ticket_priority.sql` parte do schema 0.5.0 e propõe:
- UPDATE somente da coluna priority além das colunas antes autorizadas, sem UPDATE da tabela inteira.
- Guard de prioridade humana/operador, scopes e estados terminais, preservando os guards de contexto/versão/status.
- Evento de prioridade permitido e validação de shape; policy restritiva para sua criação; motivo obrigatório sem campos extras.
- Shape mínimo de outbox sem justificativa; constraint trigger diferido exige evento/outbox correspondentes à mudança de prioridade/versão.
- Extensão dos helpers de cache para `priority.change:{id}`, vínculo ao ticket real e reautorização do operador no replay.
- schema_version=0.8.0 e remoção de EXECUTE público/clientes para as funções privadas afetadas.

Nenhuma tabela nova: 23 candidatas. As seis migrations anteriores são preservadas por hash. As sentinelas locais verificam o arquivo/consultas geradas, **não** provam parse, grants, RLS, trigger, lock ou plano de consulta. Revisar fresh install e upgrade 001–006 → 007 com dados fictícios em PostgreSQL 17. A aplicação altera três colunas em SQL parametrizado com predicado workspace/account/id/version.

## Interface
Formulário restrito à equipe para prioridade e motivo. Mensagem pública e razão de prioridade possuem rascunhos independentes. A operação captura versão/body/chave e contexto de sessão/ticket; edição durante espera não é apagada por resposta anterior. Erro 412 oferece atualização explícita sem apagar o motivo; não reenvia automaticamente com versão nova. Repetição inalterada após falha preserva a chave.

O histórico é carregado ao abrir a seção. Usa o GET timeline existente, 50 itens por página e teto de 500 itens na tela, sem alegar total do histórico. Erro permite retry; páginas antigas, duplicadas, malformadas, fora de ordem ou com cursor repetido não entram parcialmente. Troca A→B→A recebe nova geração e invalida respostas antigas. Atualização do histórico é independente do conteúdo das mensagens.

Renderização usa textContent e rótulos conhecidos, não JSON arbitrário, corpo de notas, IDs de autor ou dumps. Cliente recebe apenas eventos públicos. Contagens são de eventos carregados, não estatísticas globais. Datas mostradas seguem o fuso local do navegador. Paginação é viva, não snapshot.

## Bases técnicas externas (consultadas em 16/09/2026)
- RFC 9110 §13.1.1 / §15.5.13: If-Match e 412. https://www.rfc-editor.org/rfc/rfc9110.html
- PostgreSQL 17 CREATE TRIGGER: constraint trigger AFTER ROW, deferrable e WHEN. https://www.postgresql.org/docs/17/sql-createtrigger.html
- PostgreSQL 17 §4.1.6: precedência de operadores; extração JSON explicitamente parentetizada antes de subtração de chaves. https://www.postgresql.org/docs/17/sql-syntax-lexical.html
Estas fontes fundamentam o desenho; não atestam que a migration foi executada.
