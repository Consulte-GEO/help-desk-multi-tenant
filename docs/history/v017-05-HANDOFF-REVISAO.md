# Continuidade — Help Desk v0.17.0

Base `35426e0d90753902e977c71f0717c9c37302bedd`, branch `work/helpdesk-v0.17.0`. Ler README, AGENTS, documentos04/21 e plano. Sem inspeção/escrita remota nesta rodada. Reinspecionar os destinos antes de integrar e preservar trabalho concorrente. Não pressupor repositório vazio.

## Próxima execução

1. Resolver dependências no registry autorizado (`npm run deps:resolve`), revisar o lock real/árvore/integridades/alertas/licenças. Executar npm ci/verify/audit. Tipos globais não substituem a dependência declarada. Não fabricar lock ou alterar regras de rede.
2. Conferir dez migrations (`npm run check:migrations`), iguais à v0.16 por bytes/hashes. Schema permanece0.16.0; não gerar migration cosmética. API/interface são0.17.0.
3. Executar187 cenários PostgreSQL17 descartável:173 principais e14 de upgrade. Docker padrão/native só instalado autorizado e não root. Nada de banco real de clientes, limpeza de schema preexistente ou remote fallback.
4. Revisar os SELECTs: to_char em UTC preserva US, CASE recusa era/ano incompatíveis, ORDER BY qualifica a coluna nativa, predicado usa timestamptz/UUID com parâmetros. Confirmar que pg retorna texto, não Date. EXPLAIN/custo com RLS, página muito concorrida, timestamps iguais e microssegundos, TimeZone não UTC. Testes locais não provam essas propriedades.
5. Repetir todos os casos anteriores de perfis/versionamento/cache/write_effects e upgrades. Oito casos novos usam relógio de teste preciso, não campo HTTP livre. Não remover triggers para semear casos de teste. Fonte/corpo/evento anteriores não são reescritos.
6. Homologar UI:35HTTP+36browser. Novo `/shared/instant.js` precisa estar no build raiz. Validar lista, detalhe, mensagens/notas, histórico com três/seis dígitos, IDs de desempate, paginação, rascunhos, erro/retry, troca de conta/perfil, foco/mobile. O navegador bloqueou antes das asserções; não contornar políticas.
7. Homologar Auth/M2M/pooler/TLS/IP/Functions reais. Codecs de API devem aceitar date-time de comprimento variável. Recibos idempotentes preservam a forma histórica. Reiniciar listagem/histórico no rollout para descartar cursor antigo já truncado; não há como reconstruir dígitos perdidos apenas pelo cursor.
8. Rodar homologate:local/check:homologation; mínimos982/187/71 são contagens efetivamente aprovadas sem skips. Manter HELPDESK_RELEASE_APPROVED fechado até decisão explícita, homologação do destino e capacidade/restore/revisão.

## Revisão dirigida

- `shared/instant.js` e declaração: calendário, limites, comparação exata, representação antiga de milissegundos.
- `src/infrastructure/postgres.ts`: projeção textual e ordenação/predicado nativos; erro seguro de dados inválidos. Nenhum parser global de pg alterado.
- `pagination.ts`, `memory.ts`, `conversation-result.ts`, `replay-result.ts`: mesma ordem do cursor, validação íntegra, instante histórico exato sem modificar resposta.
- `web/conversation-state.js`, `timeline-state.js`, `ticket-actions.js`, `ticket-list-state.js`: validação/comparação antes de apresentar.
- Build/demo/smoke e fingerprint: shared incluso, sem CDN/fallback.
- `tests/v017-*`, SQL017 em `rls.test.ts`, browser e OpenAPI. Testes de PG escritos não são casos aprovados; quatro HTTP extras estão dentro dos982.

## Invariantes

Nenhuma alteração de autorização, estado, prioridade, responsável, fila, SLA, TTL ou sessão. Precisão não é monotonicidade, snapshot da coleção nem ordenação por atualização. Conteúdo de cache histórico não é reformatado; não repetir gravação diante de erro. Datas impossíveis/NULL não viram valores artificiais. Novos SELECTs não modificam os dados.

R14-04/05/06 continuam candidatos de banco anteriores. M1 aberto, M2/SLA operacional/anexos/dispatcher/conectores não entregues. Não houve revisão independente, pentest ou restore. Pacote/bundle não autorizam publicação.
