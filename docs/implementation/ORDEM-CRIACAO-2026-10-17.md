# HD-019 — ordem de criação da fila — 17/10/2026

## Escopo

Permitir consultar os chamados mais antigos primeiro, além da ordem atual de mais recentes. É ordenação por criação, não classificação por SLA, tempo sem resposta ou prioridade. Reutiliza fila, totais, cursores, consultas rápidas e controles existentes; nenhum modelo técnico, regra de atendimento ou autorização nova.

Contrato: `sort=oldest` usa `(created_at ASC, id ASC)`; ausente ou `sort=newest` mantém `(created_at DESC, id DESC)`. Normalizar `newest` para ausência, preservando os cursores anteriores. Aceitar somente esses valores, rejeitar repetição/valor vazio/entrada inválida. Lista e resumo aceitam a mesma configuração; ordenação não modifica o universo das contagens. Cursor inclui a ordem normalizada; mudar ordem exige reiniciar a consulta. Preservar precisão de microssegundos e desempate por identificador, sem converter datas a Date no servidor.

SQL: direção e operador são constantes escolhidas pelo servidor; jamais interpolar entrada do usuário. Cursor ascendente usa `>`; descendente usa `<`. RLS, namespaces locais, filtros públicos/privados e período continuam antes de LIMIT; mesma conexão transacional e revogação viva. Nenhuma alteração de schema, grant, índice ou dependência. Os índices B-tree existentes podem atender a direção inversa; não afirmar ganho de desempenho sem medição.

Interface: seletor “Ordem de criação” em Filtros adicionais, padrão “Mais recentes primeiro”, alternativa “Mais antigos primeiro”. Indicação da ordem efetivamente aplicada junto à lista; alterar o campo indica pendência, sem reordenar apenas a página carregada. Consultas rápidas preservam a ordem; aplicar/limpar/logout reiniciam as gerações e cursores pelo fluxo existente. Datas inválidas preservam a consulta aplicada. Celular e teclado qualificados em navegador real com Auth/API sintéticas, sem escrita de negócio.

Base: PR72 publicado em `75992c37656c7f6996b87552e7f3f23abdec3b92`, deploy `6ad369f6bb509383d7feaec7`,122 entradas HTTPS/hash conferidas; quatro recusas anônimas401 conformes, sem migration. Continuidade autorizada em17/10, execução direta em branch própria. O novo PR será entregue para revisão; merge/publicação próprios não estão incluídos na autorização do PR72. MFA/Novo GEO seguem adiados, scanner cancelado, modelos técnicos ausentes e MCP independente/local preservados.

Referências consultadas em17/10: [ordenação B-tree PostgreSQL17](https://www.postgresql.org/docs/17/indexes-ordering.html) e [comparação de linhas](https://www.postgresql.org/docs/17/functions-comparisons.html#ROW-WISE-COMPARISON). Changelog Supabase do mesmo dia já disponível localmente; nenhuma atualização de SDK/configuração/servidor derivada desta mudança.

## Verificações iniciais (checkpoint histórico anterior ao CI)

RED:8 testes de domínio/SQL falharam pela ausência da ordenação; Chromium recusou ausência do seletor. GREEN:49 focais, tipos e6 grupos Chromium desktop/mobile390 com Auth/API sintéticas aprovados. Um erro de tipagem na construção do objeto do teste foi corrigido preservando o contrato existente do resumo. O teste de PostgreSQL real usa o relógio de precisão já existente,54 registros autorizados em3 instantes de microssegundos, desempates UUID, páginas7, linhas fora do período/conta e revogação viva. Sua execução continua pendente no CI Linux, sem contornar o guard nativo Windows.

## Qualificação do PR73

Fonte **df665c089423ee905c2c85feda58ab7cb1526e9e**; CI da [fonte 39033434215](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39033434215) e do [merge de teste 39033437568](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39033437568) aprovados, com o mesmo fingerprint **b59c19120daee3c9cf5eb8850e708d7359c39ed99081e89fe6eca5728add3712**. Aplicação: **5985**; PostgreSQL17 com login restrito: **709**; interface: **691**; total **7385**, zero falha/skip/cancelamento/todo. Tipos,45 operações de contrato, build, lock, instalação e auditoria de dependências integram os gates; varredura de segredos é heurística.

Artefato original **helpdesk-homologation-df665c089423ee905c2c85feda58ab7cb1526e9e-39033434215-1**, digest **sha256:869f2d3dc76071264c8298b4d48f29013609a9e087fec7bec2215fdfadac70c3**. Relatório e seis logs originais preservados sem normalização de bytes; hashes reconferidos. O artefato do merge também foi baixado e teve relatório/logs/fingerprint conferidos, sem substituir os logs da fonte. [Fonte](../../evidence/created-sort-20261017/ci-qualified.json), [merge](../../evidence/created-sort-20261017/merge-ci.json).

O cenário PG real confirmou54 linhas autorizadas em3 instantes dentro do mesmo milissegundo, empates UUID, páginas7 em ambas as direções e totais completos. Linhas fora do período e em outra conta não participam. Cursor muda com a ordem, newest explícito aceita o cursor padrão e a revogação viva recusa os dados mesmo com principal/cursor antigos. Não se usou BYPASSRLS na aplicação nem migração nova.

Revisão independente somente leitura:79 testes aprovados, sem achados acionáveis. Chromium real com Auth/API **sintéticas**:6 grupos aprovados, desktop1440/mobile390, teclado, pendência/aplicação, preservação em consultas rápidas, formulário inválido, limpar/logout e nenhuma gravação. Capturas finais conferidas: [desktop](../../evidence/created-sort-20261017/browser/desktop-synthetic.png), [mobile](../../evidence/created-sort-20261017/browser/mobile-synthetic.png). Isso não comprova aceite humano autenticado produtivo.

Preview [PR73](https://deploy-preview-73--helpdesk-consultegeo.netlify.app), deploy **6ad36fb5cc902c220f964079**, head **843082c9ab0291b01247be77f5973e34514f01cc**:10 ativos críticos conferidos por bytes/hash, HTML admite somente inserção CDP restrita do provedor. [Recibo](../../evidence/created-sort-20261017/preview.json). Conferência do head final registrada no corpo do PR. Produção continua PR72/75992c3/deploy6ad369f6bb509383d7feaec7. Novo PR preparado para revisão, **sem merge/publicação**.

## Limites e continuidade

A paginação continua leitura viva, com páginas e totais consultados separadamente; não é exportação de snapshot congelado. Ordem por criação não é prazo de SLA, urgência ou tempo sem resposta. HD019 continua parcial para busca global de mensagens/notas, projeção atual de SLA e métricas operacionais. Nenhuma política, alçada, modelo técnico, permissão ou destino MCP novo foi criado.
