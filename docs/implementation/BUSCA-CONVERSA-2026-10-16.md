# Busca local na conversa pública — HD-019

> **Estado corrente:** PR68 revisado e qualificado na fonte9ab8b70, CI7273 verificações; preview da implementação conferido. Ainda sem merge/publicação em produção. Os registros intermediários abaixo preservam o histórico da qualificação.

Estado inicial: implementação autorizada em continuidade ao levantamento. Base publicada PR67, `f7ff73ae1a3279a38b22419f9f5755e8b51b0f2c`, deploy `6ad2892dd4bec684a4e7c792` READY em16/10/2026 às17h30 Brasília. Manifesto120/120 e controles públicos/recusas anônimas conferidos; provas em `evidence/response-headers-20261016/production/`. Sem migração nessa publicação.

## Desenho e limites

Reaproveitar `conversation-state.js`, a leitura autorizada existente e a renderização do chamado. Acrescentar busca literal por texto nas mensagens públicas já carregadas, com anterior/próxima, teclado e indicação de quantidade de mensagens encontradas e cobertura carregada. A busca realça o artigo da mensagem sem reescrever seu texto, ocultar a conversa ou interpretar HTML. Não pesquisar notas, descrição, metadados, outros chamados ou histórico ainda não carregado; não chamar APIs por digitação ou navegação. A paginação manual existente amplia o conjunto pesquisável e preserva a mensagem selecionada quando ela ainda existe.

O estado de busca pertence a workspace/pessoa/chamado e é limpo ao trocar de contexto, iniciar nova leitura de detalhe, perder acesso ou sair. Nenhum termo em URL, storage ou log. Busca é apresentação, não autoridade nem evidência de leitura. Não implementar busca global como efeito deste recorte. MFA/Novo GEO adiados, scanner cancelado e modelos técnicos ausentes preservados. Nenhum SQL, contrato público, scope, flag ou política de negócio novo.

## Execução e revisão

- [x] Regressões de busca literal, limites, paginação, navegação e limpeza antes da implementação.
- [x] Módulo pequeno `web/message-search.js` e contrato TypeScript; composição no shell, estilos responsivos e inclusão no build.
- [x] Navegador real com Auth/API sintéticos: notas não pesquisadas, conteúdo hostil literal, teclado/foco, paginação, troca de chamado, recusa, logout, resposta tardia,390px e nenhuma requisição por busca.
- [x] Gate completo, revisão independente, fonte/CI/preview e evidências identificados antes de declarar entrega qualificada. Merge/publicação da próxima entrega não presumidos da autorização específica para PR67.

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

## Qualificação integral da fonte corrigida

[CI38966480993](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38966480993) aprovado sobre `9ab8b704f3788fe238e0b868039e0ad836bc12cc`: **5906 aplicação +700 PostgreSQL17 +667 interface =7273**, zero falha/skip/cancelamento/todo. O gate Linux incluiu a jornada de busca12/12. Lock, instalação limpa/audit, tipos, contratos, migrations/upgrade e build aprovados no mesmo gate. São seis novos cenários Node e12 verificações de navegador, não7273 funcionalidades novas.

Artefato original `helpdesk-homologation-9ab8b704f3788fe238e0b868039e0ad836bc12cc-38966480993-1`, digest `sha256:d1dd238d1282e831994d4fb0d232edc554dcdaac3d7470a3199ef01e65a5d6a9`; fingerprint `f0ea1e24207eadec392008cd1f50f1856e563ba0421b7401a279e8db7c892fe2`. Relatório e seis logs originais em evidence/homologation; ci-qualified.json registra a fonte/run e hashes. Verificador integral aprovado antes/depois da cópia. Commits de documentação/evidência não alteram esse fingerprint. O primeiro CI falho continua preservado e identificado como falho.

HDA38966480748 e Apoio38966480792 aprovados na mesma fonte. Revisão da inclusão na fixture encerrada:1/1 build repetido pelo reviewer e25/25 focais inspecionados. Sem achados bloqueantes. [PR68](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/68) aberto; merge de teste e preview ainda em conferência.

## Preview e entrega para revisão

[Prévia do PR68](https://deploy-preview-68--helpdesk-consultegeo.netlify.app) pronta na documentação qualificada `df5f52e432d0f9128307076e3cacd9790ce0a389`, deploy `6ad293dd506c3c102f05d617`. Seis arquivos conferidos: message-search.js/app.js/CSS byte a byte, HTML com inserção nativa do provedor estritamente identificada e entry/facade do Apoio conforme manifesto SHA1. Recibo em preview.json. Nenhuma API autenticada produtiva ou comando foi inferido dessa inspeção. A primeira prévia anterior ao recibo aprovado falhou e não é prova qualificada.

Quatro análises CodeQL e agregado, regras de headers/redirects e preview aprovados. [Gate do merge de teste38967593676](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38967593676); consultar seu estado no provedor. A publicação da atualização documental final será conferida separadamente, sem mudar o fingerprint da implementação. A autorização desta rodada permitiu publicar o PR67, não presume merge/publicação do PR68.

Próximos recortes: busca global com audiência própria no servidor; validação semântica de campos existentes com nova versão e paridade; projeção de SLA após reconciliação de política. Administrativos sensíveis/modelos técnicos continuam condicionados, sem liberar os adiamentos ou reativar scanner. HD-019 permanece parcial.

## Publicação autorizada do PR68

Em16/10/2026 o titular autorizou merge e produção. Merge `c6d398fac03efd2439923c39dce47307b73e0bb7` às21:41:41Z; Netlify `6ad29a17a2836c92c65ed8a2` READY/publicado às21:45:32.835Z (18h45 Brasília). Conferidas121/121 entradas do manifesto por HTTPS/SHA1, capacidades e controles privados. Quatro recusas anônimas401 conformes ao OpenAPI, correlação e headers privados preservados; sem escrita de negócio ou migration. Recibos em `evidence/message-search-20261016/production/`. Não é aceite humano autenticado. A continuidade é a busca por descrição documentada separadamente; HD-019 permanece parcial.
