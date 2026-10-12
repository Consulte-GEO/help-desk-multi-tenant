# HDW-00b — seleção editorial vinculada à versão da fonte

## O que esta etapa entrega

Dois comandos locais, sem rede e sem alteração do wiki: preparar um plano completo de decisões pendentes e conferir as escolhas do editor contra uma nova leitura dos mesmos arquivos. O motor de auditoria HDW-00 é reutilizado, não substituído. O resultado contém somente metadados/localizadores; não contém corpos, títulos copiados ou valores de indicadores.

Uma escolha `select` significa apenas **selecionado para análise editorial privada**. Não é revisão aprovada, prova da identidade do editor, saneamento de credencial, autorização de publicação ou confirmação do funcionamento da API. Nenhum publicador de `knowledge.ts` consome automaticamente a saída.

## Como preparar e conferir

Executar no checkout completo, com a cópia privada estável do wiki fora de `dist`. A saída e a política devem permanecer fora da raiz auditada. As decisões entregues neste pacote estão TODAS em pending.

```sh
node scripts/knowledge-editorial-review.mjs --help
node scripts/knowledge-editorial-review.mjs --mode prepare \
  --root /wiki-privada/wiki-docs-v3 \
  --policy docs/knowledge/consultegeo/source-policy-v3.json \
  > /revisao-privada/decisoes.json

# O editor altera APENAS action nas linhas pertinentes de sources e items.
node scripts/knowledge-editorial-review.mjs --mode check \
  --root /wiki-privada/wiki-docs-v3 \
  --policy docs/knowledge/consultegeo/source-policy-v3.json \
  --review /revisao-privada/decisoes.json \
  > /revisao-privada/resultado.json
```

`--at` pode fixar um instante UTC em milissegundos para reprodução. É metadado declarado pelo operador, não carimbo de aceite. O vínculo da revisão exclui somente esse instante: executar novamente com os mesmos arquivos e regras não obriga o editor a refazer as escolhas só pela passagem do tempo. Isso NÃO cria autorização válida indefinidamente; o plano nunca foi autorização.

Códigos: prepare exit0 = plano criado; check exit0 = há seleção privada válida; check exit2 = sem seleção concluída ou fonte incompleta; exit1 = erro, plano modificado indevidamente/desatualizado ou escolha proibida. **Nenhum código libera atendimento ou publicação.**

## Ações por fonte

| action | Significado |
|---|---|
| pending | Nenhuma decisão registrada. |
| exclude | Não propor itens desta fonte nesta seleção. Não remove a fonte do inventário nem apaga os achados. |
| request_revision | Solicitar tratamento/revisão da fonte ao responsável, sem afirmar que houve saneamento. |
| review_candidates | Permitir selecionar localizadores já considerados candidatos pela auditoria; não remove bloqueios, não muda geração/classificação. |

`review_candidates` é recusado para fonte em quarentena, ausente, superada, interna, legada ou sem candidatos elegíveis. O solicitante não consegue abrir uma exceção por um campo adicional no JSON.

## Ações por item

| action | Significado |
|---|---|
| pending | Aguardando decisão editorial. |
| exclude | Não propor este item. A linha permanece no plano para a exclusão não ser confundida com omissão. |
| select | Propor somente este localizador para análise privada. Exige review_candidates na fonte correspondente. |

O plano sempre precisa cobrir integralmente os arquivos e os localizadores atuais. Para selecionar três itens de 300, mantenha os 300 registros e escolha explicitamente; não remova os demais para tentar encurtar o plano. Uma fonte exclude/request_revision torna seus itens pendentes efetivamente excluídos da seleção; um item select conflitante gera recusa, não é corrigido silenciosamente.

É permitido preparar uma seleção de localizadores sem achados bloqueantes enquanto OUTRA fonte continua em quarentena. Nesse caso o relatório continua mostrando `auditStatus: blocked`, as quarentenas e `sanitizationVerified: false`. Essa funcionalidade não copia conteúdo nem permite publicar o corpus ou a fonte bloqueada.

## Preservação da versão

O plano fixa corpus, revisão/hash da política, hash do conjunto de arquivos e hash da auditoria sem observedAt. Cada arquivo fixa seu hash e cada localizador fixa ID e hash de intervalo. Mudanças de texto, classificação, metadados, overlay, achados ou arquivos inesperados impedem reutilizar o plano anterior.

Ao receber uma versão saneada, produza uma NOVA política revisada e um NOVO prepare. As decisões voltam a pending; não se transportam aprovações ou escolhas automaticamente para a nova fonte. Uma edição manual dos hashes, além das ações, não cria confiança: check confere tudo com os bytes atuais, e o resultado continua sem autoridade de publicação.

Planos vindos de terceiros são rascunhos não autenticados. A CLI não registra autoria ou aceite humano; esses requisitos permanecem no fluxo administrativo/editorial qualificado futuro. Getters, campos escondidos, símbolos, arrays esparsos, duplicatas, entradas desconhecidas e valores fora dos enums são recusados.

## Limites e privacidade

O leitor JSON compartilhado exige arquivo regular local, sem links simbólicos/hardlinks, com limite de 256 KiB para política e 4 MiB para plano. Confere identidade e metadados do arquivo antes/depois da leitura. Os limites da HDW-00 continuam: 500 fontes, 4096 entradas, 1 MiB por fonte, 32 MiB no corpus, 10 mil localizadores.

Na integração de 12/10, a análise de links passou a recusar linhas acima de 4.096 caracteres antes de executar expressões regulares. A fonte recebe `source_link_limit`, a inspeção fica incompleta e nenhum candidato dessa fonte é entregue. O corpus inteiro admite até 10.000 ocorrências de links; exceder a quota recusa a auditoria integral com erro seguro, sem saída parcial. Isso limita o custo e a amplificação de metadados de Markdown malformado; não é suporte integral a Markdown. Caminhos Windows admitem diferenças de caixa ASCII, preservando rejeição de links e nomes Unicode distintos. Política e metadados entregues em `docs/knowledge` agora participam do fingerprint dos gates canônicos.

O diretório deve estar estável e sob controle do operador. Essas verificações não constituem snapshot transacional contra um escritor hostil nem validação de um filesystem remoto. A auditoria de indicadores é heurística, não antivírus/scanner corporativo nem certificação de ausência de PII.

Não carregar os planos, registros ou filas deste diretório no portal público. Não anexar o wiki integral, não executar seus scripts e não testar credenciais detectadas. A lista de 300 IDs em `editorial-candidates-v3.json` e a fila Markdown permitem localizar a fonte privada sem copiar sua resposta para o relatório.

## Situação desta entrega

A execução real preservou 41 arquivos e 300 localizadores. Cinco fontes continuam em quarentena. Todas as 41 decisões de fonte e 300 de item estão pending; nenhum artigo foi selecionado pelo executor em nome do editor. O achado de auth continua sem evidência de tratamento pelo custodiante.

HDW-01 permanece uma qualificação externa pendente. Usar `docs/integrations/HDW01-QUALIFICACAO-DOCUMENTAL-NOVO-GEO.md`; não criar mapping/directory com endpoints inventados. Nem a auditoria nem esta CLI concedem scopes, alteram Auth ou montam o runtime.

## Testes e integração

`node --experimental-strip-types --test --test-reporter=tap tests/knowledge-*.test.ts`

Baseline HDW-00: 94. Esta etapa: 61 novos casos; conjunto local: 155. Tipos focais não substituem npm ci/typecheck integrais. Os testes usam arquivos e processos reais em diretórios temporários sintéticos; não simulam um sistema de publicação. Antes de integrar: gates canônicos do repo e revisão independente. Não reaplicar cumulativos antigos dos 18 ciclos.
