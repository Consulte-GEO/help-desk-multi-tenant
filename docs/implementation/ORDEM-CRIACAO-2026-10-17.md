# HD-019 — ordem de criação da fila — 17/10/2026

## Escopo

Permitir consultar os chamados mais antigos primeiro, além da ordem atual de mais recentes. É ordenação por criação, não classificação por SLA, tempo sem resposta ou prioridade. Reutiliza fila, totais, cursores, consultas rápidas e controles existentes; nenhum modelo técnico, regra de atendimento ou autorização nova.

Contrato: `sort=oldest` usa `(created_at ASC, id ASC)`; ausente ou `sort=newest` mantém `(created_at DESC, id DESC)`. Normalizar `newest` para ausência, preservando os cursores anteriores. Aceitar somente esses valores, rejeitar repetição/valor vazio/entrada inválida. Lista e resumo aceitam a mesma configuração; ordenação não modifica o universo das contagens. Cursor inclui a ordem normalizada; mudar ordem exige reiniciar a consulta. Preservar precisão de microssegundos e desempate por identificador, sem converter datas a Date no servidor.

SQL: direção e operador são constantes escolhidas pelo servidor; jamais interpolar entrada do usuário. Cursor ascendente usa `>`; descendente usa `<`. RLS, namespaces locais, filtros públicos/privados e período continuam antes de LIMIT; mesma conexão transacional e revogação viva. Nenhuma alteração de schema, grant, índice ou dependência. Os índices B-tree existentes podem atender a direção inversa; não afirmar ganho de desempenho sem medição.

Interface: seletor “Ordem de criação” em Filtros adicionais, padrão “Mais recentes primeiro”, alternativa “Mais antigos primeiro”. Indicação da ordem efetivamente aplicada junto à lista; alterar o campo indica pendência, sem reordenar apenas a página carregada. Consultas rápidas preservam a ordem; aplicar/limpar/logout reiniciam as gerações e cursores pelo fluxo existente. Datas inválidas preservam a consulta aplicada. Celular e teclado qualificados em navegador real com Auth/API sintéticas, sem escrita de negócio.

Base: PR72 publicado em `75992c37656c7f6996b87552e7f3f23abdec3b92`, deploy `6ad369f6bb509383d7feaec7`,122 entradas HTTPS/hash conferidas; quatro recusas anônimas401 conformes, sem migration. Continuidade autorizada em17/10, execução direta em branch própria. O novo PR será entregue para revisão; merge/publicação próprios não estão incluídos na autorização do PR72. MFA/Novo GEO seguem adiados, scanner cancelado, modelos técnicos ausentes e MCP independente/local preservados.

Referências consultadas em17/10: [ordenação B-tree PostgreSQL17](https://www.postgresql.org/docs/17/indexes-ordering.html) e [comparação de linhas](https://www.postgresql.org/docs/17/functions-comparisons.html#ROW-WISE-COMPARISON). Changelog Supabase do mesmo dia já disponível localmente; nenhuma atualização de SDK/configuração/servidor derivada desta mudança.

## Verificações iniciais

RED:8 testes de domínio/SQL falharam pela ausência da ordenação; Chromium recusou ausência do seletor. GREEN:49 focais, tipos e6 grupos Chromium desktop/mobile390 com Auth/API sintéticas aprovados. Um erro de tipagem na construção do objeto do teste foi corrigido preservando o contrato existente do resumo. O teste de PostgreSQL real usa o relógio de precisão já existente,54 registros autorizados em3 instantes de microssegundos, desempates UUID, páginas7, linhas fora do período/conta e revogação viva. Sua execução continua pendente no CI Linux, sem contornar o guard nativo Windows.
