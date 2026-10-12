# HDW-00b — seleção editorial privada vinculada à fonte

> Executar com `superpowers:executing-plans`, testes antes do código. Sem nova autorização operacional.

**Objetivo:** permitir ao editor declarar, por arquivo e localizador, o que deve ser revisado, excluído ou devolvido à origem. Recusar escolhas antigas, fontes em quarentena e tentativa de promover sugestões em aprovação.
**Arquitetura:** reutilizar `auditKnowledgeSource` em toda avaliação; plano fechado editável só nas ações; vínculo por hashes da política, corpus e relatório sem instante; resultado somente de metadados. Sem rede, banco, fonte alterada, corpos extraídos ou publicador.
**Base:** plano HDW-00 fornecido pelo usuário e README-HDW00; base remota d38cfad, pacote HDW00 local ainda não integrado.

## Regras
- Source-level review_candidates não sana achados nem confirma Novo GEO.
- Listas completas e sem duplicatas; exclusão é decisão explícita, não omissão de item.
- Plano vencido por conteúdo, política/classificação ou localizador alterado é recusado; novo prepare reinicia decisões, nunca carrega aceites automaticamente.
- Conteúdo mixto, legado citado e dúvida preservam marcadores/aplicabilidade não verificada. Nenhuma origem é renomeada.
- Saneamento externo e qualificação da origem continuam bloqueadores próprios. Todos os outputs têm publicationAllowed=false/operational=false.

## Tarefas
1. Criar testes de plano, seleção, quarentena, identidade de arquivo/localizador, obsolescência, mutação e ausência de corpo. APIs `prepareKnowledgeReview(root,policy,{at?})` e `evaluateKnowledgeReview(root,policy,plan,{at?})`. Rodar RED, implementar, rodar GREEN.
2. Compartilhar leitor JSON privado limitado entre auditoria e novo CLI `--mode prepare|check`. Testar arquivo extra, symlink/hardlink, JSON excessivo/inválido, argumentos, erros sanitizados e import sem efeito. Rodar suítes anteriores sem mudar seus critérios.
3. Executar corpus real somente leitura; emitir plano com TODAS as decisões pending e resultado correspondente. Registrar 41 fontes/300 candidatos observados (não total imposto ao código), custódia em aberto e roteiro de qualificação sem API inventada. Preparar patches alternativos/cumulativo, hashes e handoff.

## Revisão final
Conferir nenhum JSON aprovando a si mesmo; impossibilidade de adicionar/omitir fonte ou localizador; seleção parcial em documento bloqueado não dribla quarentena; metadados não vazam corpos ou raiz absoluta; plano editado é sugestão, não identidade do revisor.

## Comandos
`node --experimental-strip-types --test --test-reporter=tap tests/knowledge-*.test.ts`
Typecheck focal com TS disponível; instalar pelo lock e gates integrais somente no checkout completo. Não substituir evidência canônica.
