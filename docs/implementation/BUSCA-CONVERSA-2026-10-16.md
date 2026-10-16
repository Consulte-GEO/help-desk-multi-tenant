# Busca local na conversa pública — HD-019

Estado inicial: implementação autorizada em continuidade ao levantamento. Base publicada PR67, `f7ff73ae1a3279a38b22419f9f5755e8b51b0f2c`, deploy `6ad2892dd4bec684a4e7c792` READY em16/10/2026 às17h30 Brasília. Manifesto120/120 e controles públicos/recusas anônimas conferidos; provas em `evidence/response-headers-20261016/production/`. Sem migração nessa publicação.

## Desenho e limites

Reaproveitar `conversation-state.js`, a leitura autorizada existente e a renderização do chamado. Acrescentar busca literal por texto nas mensagens públicas já carregadas, com anterior/próxima, teclado e indicação de quantidade de mensagens encontradas e cobertura carregada. A busca realça o artigo da mensagem sem reescrever seu texto, ocultar a conversa ou interpretar HTML. Não pesquisar notas, descrição, metadados, outros chamados ou histórico ainda não carregado; não chamar APIs por digitação ou navegação. A paginação manual existente amplia o conjunto pesquisável e preserva a mensagem selecionada quando ela ainda existe.

O estado de busca pertence a workspace/pessoa/chamado e é limpo ao trocar de contexto, iniciar nova leitura de detalhe, perder acesso ou sair. Nenhum termo em URL, storage ou log. Busca é apresentação, não autoridade nem evidência de leitura. Não implementar busca global como efeito deste recorte. MFA/Novo GEO adiados, scanner cancelado e modelos técnicos ausentes preservados. Nenhum SQL, contrato público, scope, flag ou política de negócio novo.

## Execução e revisão

- [x] Regressões de busca literal, limites, paginação, navegação e limpeza antes da implementação.
- [x] Módulo pequeno `web/message-search.js` e contrato TypeScript; composição no shell, estilos responsivos e inclusão no build.
- [x] Navegador real com Auth/API sintéticos: notas não pesquisadas, conteúdo hostil literal, teclado/foco, paginação, troca de chamado, recusa, logout, resposta tardia,390px e nenhuma requisição por busca.
- [ ] Gate completo, revisão independente, fonte/CI/preview e evidências identificados antes de declarar entrega qualificada. Merge/publicação da próxima entrega não presumidos da autorização específica para PR67.

Busca global no servidor, audiência específica para pesquisa de notas, visões persistentes e projeção de SLA seguem pendentes nos respectivos recortes. HD-019 não será encerrado integralmente por esta entrega.

## Qualificação local e achado de revisão

Seis novos cenários Node;24/24 focais com paginação e estado de conversa aprovados. Chromium local completo11/11, com API/Auth sintéticos, capturas desktop/390px inspecionadas. Typecheck, contrato45 operações, lock, scan heurístico e build completo aprovados; logs originais nesta pasta de evidências. Uma primeira execução do scan pelo wrapper local expirou120s e não foi declarada aprovada; execução direta e sequência final concluíram normalmente. Nenhuma asserção removida ou prazo de teste ampliado.

A ausência inicial do módulo/controle foi registrada em unit-red/browser-red. A composição inicial omitiu o asset da demonstração (corrigido na allowlist). A fixture mobile foi corrigida para abrir o detalhe pela navegação vigente, e a fixture da lista passou a usar o DTO de lista sem available_actions. Esses diagnósticos originais estão separados; não são prova de funcionalidade aprovada.

Revisão independente identificou retenção após403 na página anterior. O Chromium reproduziu a falha mantendo busca/mensagens; browser-revoked-page-red.txt preserva a prova. O catch agora reusa discardRefusedDetail e só age sobre detalhe/ticket/generation vigentes. Mensagens, busca, projeções e rascunhos recusados são removidos, com atualização explícita da lista. A recusa tardia de uma página de outro chamado é ignorada. Os dois cenários passaram no ensaio verde. Falha transitória continua distinta de perda de acesso; o conector não repete comandos.

CI integral Linux, revisão final do fix e preview ainda serão registrados. Nenhuma publicação da busca realizada. A referência canônica de produção foi consolidada em docs/ESTADO-ATUAL.md, com ponteiros no README/AGENTS/plano/estado e histórico preservado (HD-001).

A reinspeção encontrou uma segunda corrida: detalhe200 iniciado antes da recusa de paginação podia repor mensagens no DOM oculto após403. Reproduzida no Chromium e preservada em browser-detail-race-red.txt. O descarte agora incrementa s.detail, invalidando também a leitura de detalhe anterior; a regressão mantém esse GET retido, aplica403 e só depois libera200. Nenhuma política ou timeout foi alterado.

Revisão acumulada encerrada sem achados bloqueantes pendentes. Segunda regressão corrigida e Chromium final12/12 aprovado, com todas as asserções anteriores preservadas; reviewer inspecionou o log e executou21 testes afetados/node-check/diff-check, sem repetir o navegador. browser-green-final.txt e browser/result.json registram o resultado atual; browser-green.txt registra o verde11 anterior.

## Primeiro CI e manutenção da fixture de build

Fonte6707cd5/run38965639426 falhou: aplicação5905/5906, PostgreSQL700/700, interface bloqueada por pré-requisito. Causa: forms-build.test.ts copia o programa de build para pasta própria, mas sua lista explícita added não incluía message-search.js; o build corretamente recusou o arquivo ausente. Reproduzido localmente em forms-build-red.txt. Acrescentado o módulo à lista, preservando e ampliando a comparação byte a byte e todas as exclusões de arquivos privados. forms-build-green.txt:25/25 focais. Runtime não alterado nesse fix. Relatório e cinco logs originais com hashes/digest em initial-ci-failure/; não são homologação aprovada. Nova fonte/CI integral pendentes.
