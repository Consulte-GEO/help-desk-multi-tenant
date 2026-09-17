# Continuidade — Help Desk v0.11.0

Base `7acc0e13cba1ee4ee439de35eae4e8413cecc695`. Branch `work/helpdesk-v0.11.0`. Commit de entrega no manifesto/bundle. Leia README, AGENTS, documentos04/15 e plano atualizado. Fontes originais preservadas; histórico local não corresponde ao site publicado.

## Próxima execução prioritária

1. Reinspecionar GitHub/Supabase/Netlify antes de integrar. Última leitura: repo vazio; schemas consultados/ledger vazios; deploy manual antigo. Não presumir ausência de trabalho concorrente nem autorização de publicação.
2. Resolver dependências em registry autorizado: `npm run deps:resolve`; revisar lock/árvore/integridades/origens/licenças/alertas. Executar `npm ci --ignore-scripts`, `npm run verify`, `npm audit --audit-level=high`. Não fabricar lock nem substituir tipos locais por globais no CI.
3. `npm run check:migrations`:8 arquivos preservados/schema0.9.0. Não recalcular hashes para ocultar alteração. Executar `npm run test:db:local` com PostgreSQL17 descartável e papel restrito.125 casos:117 principais+8 upgrade. Docker padrão/native só instalado e não root. Sem banco remoto como fallback.
4. Confirmar fresh/upgrade001–007→008, catálogo/grants/RLS/triggers, cache reautorizado, quotas e COMMIT/ROLLBACK reais. Exercitar novo filtro mine/unassigned antes de LIMIT, perfis mistos, revogação entre páginas, SQL parametrizado e consulta inválida sem SELECT do recurso. As duas fixtures antigas agora usam colunas explícitas.
5. Homologar Auth humano/M2M e tradução auth_user_id→principal.id; os IDs não precisam ser iguais. Workspace/principal/grants persistidos devem ser UUIDs. Aliases só no domínio/demo. Confirmar login/logout/expiração/refresh, pooler/TLS, IP confiável e driver/Functions reais. A UI atual não implementa revogação humana no provedor.
6. Executar `npm run test:ui:local`:32 HTTP+27 browser. Conferir filtros em perfil operador/cliente/misto, paginação, saída/retorno, drafts e respostas atrasadas, prioridade/atribuição/histórico, teclado/foco/mobile390px. Não contornar restrições de navegador/rede.
7. Executar `npm run homologate:local` e `npm run check:homologation`. Piso710/125/59 refere-se a aprovações efetivas sem skips, não contagem de testes escritos. Relatório local não aprova runtime, capacidade, backup/restore ou publicação. Definir decisões operacionais aplicáveis e manter HELPDESK_RELEASE_APPROVED fechado até aprovação explícita.
8. Concluído o marco, iniciar M2: bootstrap, convites/vínculos e administração de catálogo/contratos/versionamento com auditoria. Depois integrar dispatcher/ledger/notifications, SLA/filas, anexos e consumidores reais conforme dependências. Não usar mais features como substituto dos testes de banco.

## Revisão dirigida

- `src/domain/input-values.ts`, `authentication.ts` e `principal-validation.ts`: strict UUID e texto persistível; principal distinto de Auth ID.
- `src/application/conversation-result.ts` e `HelpdeskService.accessible/conversation`: autorizar pai e conferir todos os filhos antes de serializar. Falha503 não parcial. Isso não substitui RLS.
- `ticket-search.ts`, listTickets em memória/Postgres e handler: assignment por operador em cada conta; antes de LIMIT; cursor inclui filtros. Sem IDs de outros agentes.
- `web/ticket-list-state.js`, app.js/index.html e OpenAPI: limpeza na mudança de identidade e rascunho preservado; no-runtime schema0.9.0.
- `tests/review-boundaries.test.ts`, `review-assignment-filter.test.ts`, SQL/browser/smoke e evidências review-v011.

## Invariantes e limites

API0.11.0/schema0.9.0,8 migrations/23 tabelas/18 operações. Nenhuma nova permissão de banco. Ownership nunca concede acesso; mine/unassigned somente consulta em conta de operador, não fila completa. Unassigned é nulo, não dono inativo. Cache mantém resposta original. Notas e eventos de atribuição são internos. Rejeitar NUL/surrogate, não substituir. ETag/cursor/UUID não autorizam.

710 testes locais incluem mocks do driver; SQL125/browser27 não aprovados. M1 aberto; administração, anexos, SLA operacional, entregas e conectores permanecem ausentes. Sem revisor independente/pentest/carga/restore. ZIP/bundle não autorizam push/deploy/migration ou alteração de segredo/MFA.
