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


Autorrevisão das capturas: a fixture visual inicial devolvia criação fora da janela combinada. A asserção de coerência reproduziu o problema (falha sintética, sem defeito de runtime); corrigida a data do registro fictício, mantendo criação e atualização distintas.8 grupos Chromium finais aprovados e capturas atualizadas; logs anteriores preservados como tentativas, não aceite de dados reais.

## Qualificação integral da fonte do PR75

Fonte **737831ed3c5bf709240d8c016c005221abd24a51**. CI [fonte39044573537](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39044573537) e [merge de teste39044578648](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39044578648) aprovados com mesmo fingerprint **77e110f7dbaf4f03dc46e7f638ca4c0a90d19f9c92a4be6fa8d64606308a9376**: **6002 aplicação + 710 PostgreSQL17 restrito + 699 interface = 7411**, zero falhas/skips/cancelamentos/todo. Instalação limpa, audit, tipos,45 operações de contrato, build e lock integram os gates; varredura de segredos é heurística. Sem migration, dependência, índice ou grant novo.

Artefato original **helpdesk-homologation-737831ed3c5bf709240d8c016c005221abd24a51-39044573537-1**, digest **sha256:edb55b25d1a9db36ea66478e63a9489063fb4c42bc350358ece0759a52af9114**. Relatório/seis logs originais preservados sem normalizar bytes; hashes conferidos contra o código local. O artefato independente do merge também foi baixado, validado e comparado pelo fingerprint/contagens. [Fonte](../../evidence/updated-window-20261017/ci-qualified.json), [merge](../../evidence/updated-window-20261017/merge-ci.json).

O teste PG real cria17 registros próprios antes da janela, atualiza11 por comando autorizado e coloca uma linha de outra conta dentro do intervalo para comprovar sua exclusão. Verifica microsegundos,17→11por filtro,3itens/página, criação/atualização combinadas, cursor, mutação viva que muda o total para10, página seguinte com cursor anterior e revogação atual. Nenhum dado ou grant produtivo foi alterado.

Local37 focais/tipos/build/contratos/lock, revisão independente e8 grupos Chromium finais desktop/mobile390 aprovados. Corrigidas fixtures de ACL e coerência cronológica; todos os diagnósticos/RED e tentativas ultrapassadas permanecem identificados. Capturas finais conferidas: [desktop](../../evidence/updated-window-20261017/browser/desktop-synthetic.png), [mobile](../../evidence/updated-window-20261017/browser/mobile-synthetic.png). Auth/API são sintéticas; não é aceite humano produtivo.

Relatório incorporado para qualificar o preview; esta etapa ainda não é merge/publicação. PR74 permanece candidato independente e não foi incorporado à base73 deste PR75. A contagem pode diferir entre essas branches por cobrirem recortes diferentes. Produção permanece PR73/d8f1fe2/deploy6ad37227af6d1784b1404bad.
