# HDW-00 — auditoria e registro editorial do corpus

> Continuidade do plano Wiki v3 aprovado para o próximo incremento. Método: execução local com testes negativos, implementação e revisão separada. A revisão independente/integração remota não ocorreu nesta rodada.

**Goal:** inventariar o overlay sem publicar corpos ou material sensível, preservar ressalvas e preparar a curadoria.
**Architecture:** CLI de operador → política explícita pinada → scanner limitado/overlay em memória → metadados e lote privado por localizador. Não alterar os motores nem as rotas do Help Desk.
**Tech Stack:** Node22 e built-ins; testes TypeScript no runner Node existente. Nenhuma dependência ou lock alterado.
**Spec:** plano Wiki v3, HDW-00 e §§1/3.1; diagnóstico F01–F03; CONVENCOES e ORIENTACOES como dados de origem. Base remota `d38cfad95eb8e0e92ec626ae5a1506cbb33ddb2c`.

## Interfaces e decisões

`auditKnowledgeSource(root:string, policy:unknown, {at?}):Promise<SourceAuditReport>` e `validateKnowledgeSourcePolicy(input)` estão tipados em `scripts/knowledge-source-audit-core.d.mts`.

O lote é de localizadores, não de corpos de artigos. O `EditorialPublication.source` existente não foi alterado ou preenchido artificialmente para material LEGADO. A identidade do documento é lógica e a revisão é fixada por hash; o range tem hash próprio. Uma alteração na fonte exige política nova e nova revisão; não adotar hash desconhecido automaticamente.

A política permanece draft, com classificação explícita. Os sete substitutos são projetados em memória; o README instrucional do pacote de patches não substitui o README. No overlay recebido há 41 fontes físicas/40 lógicas, e nenhum par original/substituto está simultaneamente presente.

## Tarefas e evidência desta rodada

- [x] Revalidar a base remota; tentativa de clone falhou DNS. Trabalho em recorte novo, sem alteração de código remoto.
- [x] Testes da leitura real de filesystem, proteção de saída, credenciais sintéticas, instruções, legado e overlay. Primeira rodada expôs ausência da implementação.
- [x] Scanner e auditoria somente leitura, hashes e limites. Correções do caminho lógico e do tratamento de links que apontam a documentos rejeitados.
- [x] CLI com falha segura, importação sem efeito e sem opção de publicação.
- [x] Correção de ressalvas por item, seleção explícita de linhas de limitações, placeholders documentais e limites de indicadores.
- [x] Revisão: links externos/fragmentos não são declarações de referência validada; case ambíguo e política vazia são recusados.
- [x] 94 testes focais finais; quatro mutações funcionais detectadas, fontes restauradas. Um probe inicial redundante não alterou a proteção e não foi contado como evidência adicional.
- [x] Executar auditoria real dos 41 arquivos e verificar hashes/localizadores; produzir registro e lote privados. A fonte original permaneceu idêntica.
- [ ] Custodiante trata o achado e registra saneamento/rotação quando aplicável.
- [ ] Revisão editorial independente aprova a lista de fontes e aplicabilidade.
- [ ] No checkout completo, executar instalação pinada e gates da nova branch; atualizar evidência, revisar e integrar.

## Revisão de limites

Scanner heurístico não é certificação. Parser limitado de links não é CommonMark completo. Instante do relatório é declarado pelo operador. Usar cópia local estável; não há snapshot transacional contra mutação hostil concorrente. Dados indexados não são instruções. Não houve DB, browser, IdP, fonte real ou deploy novos. Nenhum resultado local é aceite operacional.
