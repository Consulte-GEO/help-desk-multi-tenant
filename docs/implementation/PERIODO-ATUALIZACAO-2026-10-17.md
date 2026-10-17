# Período de atualização — HD-019/026 — 17/10/2026

## Escopo autorizado

Continuar os filtros previstos da fila usando a data `updated_at` do chamado. Base independente PR73 (`d8f1fe2`); PR74 continua aberto e não integra esta branch. Reutilizar gramática temporal, estados da fila/resumo, consultas rápidas, autorização e predicados existentes, sem nova migration, dependência ou grant.

API: `updated_from` inclusivo e `updated_before` exclusivo, opcionais e independentes, UTC Z canônico com3/6 casas e normalização sem perder microssegundos. Quando ambos existem, início estritamente anterior ao fim. Combinar por interseção com período de criação, busca, status, prioridade e responsabilidade. Aplicar antes de LIMIT e dos totais completos. Vincular o cursor aos filtros normalizados; paginação e ordenação continuam por criação/id, sem transformar updated_at em cursor mutável.

SQL: somente constantes de coluna/operador controladas pelo desenvolvedor e valores parametrizados. Preservar posições existentes quando os novos filtros estão ausentes; complementar parâmetros depois da janela de criação existente. Mesma audiência RLS, contas/obras e separação privada. Consultas sem os novos filtros mantêm comportamento e cursores anteriores.

UI: dois controles opcionais em Filtros adicionais, “Atualizados a partir de” e “Atualizados antes de”, conversão explícita America/Sao_Paulo, informação dos limites inclusivo/exclusivo. Mostrar filtros aplicados e alterações ainda não aplicadas, preservar nas consultas rápidas e remover ao limpar/logout. Formulário inválido não consulta nem troca a seleção aplicada. Telas desktop/mobile390 e teclado qualificados com Auth/API sintéticas.

O campo representa a atualização registrada do chamado. Não é prova de última resposta humana, última leitura, ausência de interação, prazo de SLA ou produtividade. Os dados são leituras vivas: uma atualização pode mover a linha para dentro/fora do período entre páginas, e lista/totais são consultas separadas; não se promete snapshot congelado. Sem índices novos; avaliação de índices/carga requer medição própria.

## Verificação e limites

RED/GREEN de gramática e precisão, múltiplas páginas/totais/ACL/revogação, cursor/contexto, janelas combinadas e bindings opcionais; PostgreSQL17 real com login restrito; browser real com identidade/API sintéticas, incluindo dispositivo em outro fuso. Tipos, contratos45, build/lock/segredos, revisão independente e CI fonte/merge completos; preservar relatórios/logs originais e validar prévia do head final.

Não publicar ou mesclar este novo recorte sem autorização própria. MFA/Novo GEO adiados, scanner cancelado, modelos técnicos não homologados fora do escopo; MCP permanece separado e local. Não criar dados ou e-mails de teste em produção.


## Verificações iniciais

RED observado nos12 cenários novos de domínio/HTTP/estado/SQL pela ausência do filtro; GREEN inicial32 e combinado37 focais aprovados. Compilador TypeScript direto,45 operações OpenAPI, lock e build aprovados. Browser Chromium local com Auth/API sintéticas qualificado separadamente; PG17 real e CI integral da fonte/merge ainda pendentes. Não é teste autenticado humano produtivo.

Referências conferidas: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [changelog](https://supabase.com/changelog.md), sem alteração de grants/policies/schema/API Supabase. Leitura continua pelo papel restrito existente; comprovação PG real depende do CI.


Revisão independente somente leitura da fonte68b09bf: nenhum defeito concreto de runtime; corrigida a fixture PG para que a linha de outra conta satisfaça a janela, exigindo exclusão por ACL. A página seguinte também usa o cursor anterior após uma mutação que remove a primeira linha do intervalo.37 focais e tipos reexecutados/aprovados; a execução PostgreSQL real permanece responsabilidade do CI. O revisor concluiu29 focais e relatou22 aprovações adicionais, com processo ainda aberto após o resumo; não contamos esses22 como execução concluída. Sem minor adiado.
