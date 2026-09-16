# Revisão local — v0.7.0

Base: a6eb2c69ce3ea9b49eaab881ed236da43a725662. Revisão feita no próprio processo, **não independente**. Sem subagente/revisor externo ou pentest.

## Pontos verificados

- Filtro executado antes de LIMIT nos dois adaptadores; interface não filtra somente a página atual.
- Query, conta, status e prioridade parametrizados; nenhum texto do usuário interpolado em SQL. `strpos(translate(...), ...)` é correspondência literal, não sintaxe SQL/LIKE/FTS.
- Consulta permanece na tabela tickets sob papel restrito/contexto transacional; sem novas funções privilegiadas, joins de notas ou grants. Execução RLS real pendente.
- Cursor vinculado a query normalizada + filtros + workspace + principal + conta. Contexto do cursor sem filtros preservado.
- Estados usados no filtro são projeções públicas; notas, mensagens e descrição não participam do predicado textual. O DTO autorizado existente continua incluindo descrição: ela não foi removida da leitura normal de ticket.
- Logs da aplicação não recebem query/valores de filtros; teste de observador confirma. URLs podem existir nos logs de ingresso do provedor: política de redação remota ainda precisa de homologação.
- Estado da lista valida página inteira antes de aplicar, clones defensivos, invalidação por geração, retry sem duplicar, teto de 500 na interface. Nenhuma autorização depende desse estado no navegador.
- A conclusão da lista e o carregamento inicial do detalhe possuem tratamentos separados: falha no detalhe não é engolida como se fosse uma resposta atrasada da página.
- Filtros não apagam detalhe ou rascunho selecionado. O detalhe pode permanecer de um ticket fora do novo resultado: comportamento intencional para não perder trabalho.
- Na revisão da suíte browser, o assert de vazio foi direcionado ao elemento que efetivamente apresenta essa mensagem (`ticket-list`); não foi apresentada como execução do DOM. Navegador bloqueado em goto, zero asserts executados.
- Compatibilidade de busca Latin-1 explicitada. Não há remoção de acentos, Unicode case folding universal ou busca por similaridade.
- Seis migrations comparadas com a base: bytes iguais. Nenhum aumento artificial de versão de schema.

## Pendências bloqueadoras

PostgreSQL 17 real (68 casos), EXPLAIN/performance com RLS, navegador (17 checks), lock/npm ci/audit, empacotamento e execução Functions, Auth/pooler/TLS, operação/restore/revisão independente. As contagens escritas não foram somadas às aprovações locais.
