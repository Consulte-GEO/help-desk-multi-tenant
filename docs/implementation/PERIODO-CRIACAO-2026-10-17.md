# HD-019 — período de criação na fila e nos totais — 17/10/2026

## Desenho e critérios

Acrescentar `created_from` (inclusivo) e `created_before` (exclusivo), opcionais/independentes, à lista e ao resumo. São instantes canônicos UTC Z com3/6 dígitos fracionários, normalizados sem perder microssegundos; se ambos presentes, início estritamente anterior ao fim. Ausentes mantêm a consulta/cursores existentes. Filtros não concedem audiência: manter RLS, workspace, conta/obra, escopos e interseção de operador dos filtros privados.

Aplicar no PostgreSQL antes de LIMIT/contagens e no adaptador de memória com comparação exata. SQL parametrizado, manter posições antigas quando ausentes e calcular as novas após os parâmetros privados opcionais. Cursor e gerações da lista/resumo incluem o intervalo normalizado; mudança invalida resultados antigos. API core e scoped usam as mesmas chaves, recusam repetidos, intervalos vazios/invertidos, datas impossíveis, offsets/frações não canônicos. OpenAPI documenta as duas rotas.

Interface: dois datetime-local opcionais em Filtros adicionais, rótulos e ajuda claros: criação, America/Sao_Paulo, início incluído/fim excluído. Conversor próprio pequeno, baseado no round-trip existente dos calendários/e-mails, recusa lacunas e ambiguidades de fuso e datas impossíveis; não altera o monitor de e-mails. Estado visual mantém valores de parede enquanto a consulta usa UTC canônico. Filtros aplicados/pendentes, limpar/logout, erro sem submissão, resumo, consultas rápidas e mobile390px qualificados. Consultas rápidas preservam o período (como q/prioridade); o filtro de período não torna falsa a indicação da situação/responsabilidade.

Não altera registros, schema/migrations, estados/SLA, política, MFA, Novo GEO, scanner, modelos técnicos ou destinos MCP.

## Plano de execução direta (após publicação do PR71)

1. Branch nova codex/ a partir da produção combinada conferida. Escrever RED em testes focados para gramática/normalização/microssegundos/limites/contagens >página/ACL/revogação/cursores e estado cliente.
2. Implementar application/ticket-search, allowlists HTTP core/scoped, predicado de PostgreSQL, estado cliente/consultas rápidas e schemas OpenAPI; testes reais com login restrito PG17 e binds opcionais.
3. Conversor de parede/SaoPaulo com casos DST real (gap/overlap), gramática e ano inválido; ligar controles/formato de filtros aplicados, dirty state e limpeza. Browser real com API/Auth sintéticas desktop/mobile, usando o shell existente, verifica a mesma query da lista/resumo e nenhuma gravação.
4. Focais/tipos/contratos/build/lock/secrets, revisão independente somente leitura, PR para revisão e CI integral fonte/merge. Preservar relatórios originais, qualificar preview e atualizar checkpoint/estado canônico. Não integrar esse novo PR sem sua autorização própria.

## Pontos de revisão

- Precisão3/6 dígitos e igualdade nos extremos: nenhum Date arredondando o filtro no servidor.
- Datas antigas/lacunas/overlaps e fuso do navegador diferente de SaoPaulo.
- Sem filtro: SQL/cursores/filas existentes preservados; binds depois de localContexts e filtro interno opcionais.
- ACL antes da paginação/total; período público não libera filtro privado em conta de manager.
- Filtros pendentes inválidos e resultados atrasados não substituem consulta aplicada; limpar/logout apagam controles e estado.


## Verificações iniciais

Base de produção c24b759, após os merges/publicações70/71 conferidos. RED:7 casos de domínio/relógio e8 bindings SQL falharam antes da implementação; browser inicial recusou ausência dos controles. GREEN:77 focais de janela/busca/resumo/visões, compilador TypeScript e45 operações de contrato aprovados. Chromium real com Auth/API sintéticas:7 grupos aprovados, desktop/390px, navegador em America/Los_Angeles com filtros em Brasília, sem gravação; capturas conferidas. PG17 real ainda pendente no CI; runner nativo do projeto recusa Windows, e essa proteção foi preservada.

Consultados em17/10 o [changelog Supabase](https://supabase.com/changelog.md), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [tipos temporais PostgreSQL17](https://www.postgresql.org/docs/17/datatype-datetime.html). Nenhuma atualização de SDK, servidor ou configuração derivada dessa consulta; manter os índices existentes tickets_cursor/tickets_account_cursor/tickets_requester e predicados sobre created_at sem converter a coluna por linha.
