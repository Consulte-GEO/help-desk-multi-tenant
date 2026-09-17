# Continuidade — Help Desk v0.13.0

Base `a0928abdff3b1bc01653c7af4a1b207af179d32e`; branch `work/helpdesk-v0.13.0`. Sem escrita ou reinspeção remota nesta rodada. Ler README/AGENTS/documentos04/17 e plano. Reinspecionar destinos e preservar trabalho concorrente antes de integrar.

## Prioridade

1. Resolver dependências (`npm run deps:resolve`) no registry autorizado; revisar lock real/árvore/origens/integridades/alertas. Executar npm ci, verify e audit. Não fabricar lock ou aceitar tsc global como instalação reproduzível.
2. Conferir oito migrations (`npm run check:migrations`), executar125 casos PostgreSQL17 descartável/upgrade com papel restrito. Nenhuma migration nova; schema continua0.9.0. Sem Supabase real como fallback.
3. Homologar autenticação humana/M2M, live scopes, pooler/TLS/IP e Functions. Confirmar que `available_actions` usa o principal revalidado na leitura, mas o comando revalida novamente. Remover tickets:write sem alterar a versão deve retirar os hints e negar envio posterior. Admin não supre scope; notes:read e notes:write são independentes.
4. Executar UI:35 HTTP +30 browser principais +5 humanas sintéticas. Rever consulta read-only, leitura/escrita de notas separadas, permissões em contas diferentes, motivos de reabertura, notas503/403/malformadas, conversa pública503, A→B→A, fechar/login durante resposta, refresh do canal privado e nenhum replay automático. O erro da seção privada abre o aviso e oferece atualização. Não contornar a política de navegação.
5. Confirmar preservação das garantias anteriores: cache de mutações representa resposta original **sem available_actions**; listagem também não inclui o campo. Frontend0.13 depende de GET0.13. Validadores rígidos de consumidores devem adotar TicketDetail para leitura, mantendo Ticket em comandos/listas. ETag não representa permissões.
6. Executar homologate:local/check:homologation; pisos789/125/70 referem-se a contagens efetivas aprovadas. Aprovação local não libera destino/capacidade/restore/produção. Manter HELPDESK_RELEASE_APPROVED fechado até decisão explícita e evidências.

## Revisão dirigida

- `src/application/ticket-actions.ts`, `src/http/handler.ts`: deriva funções de política/workflow sem conceder privilégios; GET somente.
- `web/ticket-actions.js`/`.d.ts`: DTO estrito, página íntegra, erro de notas isolado, respostas antigas descartadas, modo do compositor preservado durante pausa.
- `web/app.js`/HTML: sem máquina de estados duplicada; formulários só com hints atuais, erro de notas visível, rascunho pessoal distinto dos dados privados removidos.
- `tests/ticket-actions*.test.ts`, `ui-wiring.test.ts`: local/sockets/sentinelas estruturais; não confundem com navegador real.
- `tests/browser-smoke.py`, `browser-human-session.py`: três checks DOM novos e fixture GET humano atualizado; navegação bloqueada, não aprovados.
- OpenAPI (`TicketDetail`, `TicketActions`), assets/servidor demo, exemplo HTTP e `evidence/v013/`.

## Limites

API0.13.0/schema0.9.0,8 migrations/23 tabelas/18 operações. Nenhum novo grant/endpoint/dependência. Hints são consultivos; podem ficar antigos sem mudança da versão do chamado. Mensagens/notas em resolvido/fechado mantêm regras anteriores e não reabrem sozinhas. Notas inválidas limpam os itens anteriores e desabilitam o compositor privado até atualizar; rascunho pessoal permanece só na memória da mesma identidade. Sem polling de autorização, revogação instantânea de JWT, worker/notificações/SLA/anexos/backoffice.

789 locais incluem mocks;125 SQL/35 browser não aprovados. Sem revisor independente/pentest/carga/restore. Código entregue localmente não autoriza publicação.
