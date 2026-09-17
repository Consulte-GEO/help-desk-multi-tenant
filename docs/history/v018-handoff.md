# Continuidade — Help Desk v0.18.0

Base `07dc51f263fbf2dcd49f4605bec0c1a43d57e2ca`. Branch local `work/helpdesk-v0.18.0`. Leia README, AGENTS e documentos 04/22. Nenhuma inspeção ou escrita remota nesta rodada; não presumir que o GitHub/Supabase/Netlify continuam como nas leituras históricas.

## Ordem de execução

1. Reinspecionar os destinos antes de integrar, preservar trabalho concorrente e não publicar sem autorização. Código e bundle desta entrega são locais.
2. Resolver dependências no registry autorizado (`npm run deps:resolve`), revisar lock real/origens/versões/integridade/licenças/alertas, executar `npm ci --ignore-scripts`, `npm run verify`, `npm audit --audit-level=high`. Não usar tsc global nem lock sintético como substitutos. A tentativa desta sessão falhou EAI_AGAIN.
3. Conferir `npm run check:migrations`:11 arquivos/schema0.18.0. Os dez anteriores são os mesmos da v0.17.0. Não recalcular hashes para ocultar mudanças. Aplicar 011 com o mesmo owner aprovado; CREATE OR REPLACE preserva o proprietário e não deve ganhar permissões públicas.
4. Executar `npm run test:db:local` em PostgreSQL17 local novo e descartável. 196 casos:180 principais+16upgrade. Docker padrão; native apenas com binários autorizados e usuário não root. Nenhum banco remoto como fallback; não apagar schema/banco preexistente para tornar o teste verde.
5. Homologar nota-only end-to-end: `tickets:read` e `notes:write`, sem `tickets:write` ou `notes:read`; SELECT pai permitido, SELECT FOR UPDATE filtrado, primeira nota e próprio recibo funcionam, coleção e mensagem pública negadas. Conferir que o trigger interno bloqueia sem mudar versão/estado/contrato/prioridade.
6. Homologar concorrência: KEY SHARE retido enquanto nota conclui; dois autores com notas distintas; mesma key quatro vezes; recibos e efeitos únicos; rollback e revogação. Verificar FOR NO KEY UPDATE na função real, owner/ACL/search_path e todas as constraints. Testar junto aos casos anteriores de write_effects.
7. Executar a injeção SQL de recibo suprimido somente no banco descartável: INSERT/0 deve produzir 503 antes de COMMIT, removendo nota, evento e efeito. O trigger de teste não é migration e não pode ser criado no ambiente de clientes. Não substituir assert por sucesso se a política/grant divergir.
8. Executar o upgrade final010→011 e os anteriores no banco separado de testes. Comparar os registros e metadados do helper; validar nota-only em chamado legado e reenvio de criação original. Esse teste não é restauração de backup.
9. Homologar Auth/M2M, pooler/TLS/IP e Functions reais. Conferir command/rowCount/rows do driver instalado, contador1 para os statements sem RETURNING, UPDATE0 para conflito e resultado incerto após COMMIT. Não adicionar INSERT RETURNING a notas privadas como atalho. API0.18 exige schema0.18.
10. Executar UI35HTTP+36browser. Não houve nova funcionalidade visual, mas os perfis restritos devem funcionar no backend homologado. Não contornar ERR_BLOCKED_BY_ADMINISTRATOR. Depois executar homologate:local/check:homologation, revisar logs e fingerprint; mínimos1002/196/71 são aprovações efetivas, não testes apenas escritos.

## Arquivos prioritários

| Arquivo | Revisão |
|---|---|
| `src/application/helpdesk.ts` | Apenas addNote consulta pai sem FOR UPDATE; autorização e idempotência permanecem. |
| `src/infrastructure/write-result.ts`, `postgres.ts` | Confirmação por comando/contagem, sem RETURNING, UPDATE0 distinto de protocolo inválido. |
| `supabase/migrations/20260917001100_conversation_lock.sql` | Função substituída, NO KEY UPDATE, nenhum grant/policy ampliado, versão real do schema. |
| `supabase/tests/rls.test.ts`, `upgrade.test.ts` | Nove novos casos e duas expectativas antigas de USING corrigidas, não executadas. |
| `tests/helpers/v018-driver.ts`, `tests/v018-*.test.ts` | Double não prova RLS; sockets comprovam transporte, rollback e recibos controlados. |
| `src/observability/codes.ts` | Erro fechado sem dados/SQL privados. |

## Invariantes

Notas não alteram o chamado nem geram outbox. Recibo não é coleção. Responsabilidade não autoriza. Bloqueio interno não concede escrita pública. Não remover locks dos comandos que atualizam o ticket. Uma confirmação de INSERT não prova COMMIT. Sem retry automático ou chave nova diante de falha. Um erro de confirmação final ainda pode ter resultado incerto. Migrations históricas e conteúdo de clientes não são reescritos.

M1 continua aberto; M2, SLA operacional, anexos, dispatcher e conectores reais continuam fora da entrega. 1002 testes locais incluem doubles; PostgreSQL e navegador não homologados. Sem revisor independente, pentest, capacidade/restore ou liberação de produção. Manter `HELPDESK_RELEASE_APPROVED` fechado.
