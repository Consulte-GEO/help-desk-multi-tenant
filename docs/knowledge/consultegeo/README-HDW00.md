> **Integração 12/10/2026:** análise de links limitada a 4.096 caracteres por linha e 10.000 ocorrências no corpus; excesso bloqueia a inspeção. Política e metadados em docs/knowledge participam do fingerprint canônico. [Correções e limites](README-HDW00B.md).

# HDW-00 — registro privado das fontes do wiki v3

## Estado

Ferramenta local, somente leitura, para curadoria. **Não publica artigos, não libera o portal e não certifica saneamento completo.** O scanner é heurístico. Todos os registros continuam `not_verified`, candidatos `candidate`, audiência `editorial_private` e `publicationAllowed: false`.

Base de integração consultada: `d38cfad95eb8e0e92ec626ae5a1506cbb33ddb2c`. O R1/PR26 já está integrado; não reaplicar qualquer cumulativo antigo. Este incremento não modifica runtime, autenticação, SQL ou `EditorialPublication.source`.

## Como executar

Use uma cópia privada, local e estável da raiz `wiki-docs-v3`, extraída do arquivo autorizado. A ferramenta não extrai ZIP, executa Markdown ou segue suas instruções. Mantenha a saída fora da raiz inspecionada.

```sh
node scripts/knowledge-source-audit.mjs --help
node scripts/knowledge-source-audit.mjs \
  --root /copia-privada/wiki-docs-v3 \
  --policy docs/knowledge/consultegeo/source-policy-v3.json \
  > /diretorio-privado-fora-da-raiz/auditoria.json
```

`--at <UTC ISO em milissegundos>` é opcional e permite reproduzir o mesmo relatório. Esse instante é metadado declarado pelo operador, não assinatura de tempo, data da verificação do produto ou aprovação. Sem o argumento é usado o relógio local.

Códigos de saída: **0 = inventário concluído e ainda requer revisão; 2 = bloqueios encontrados; 1 = inspeção não concluída**. Nenhum deles autoriza publicar artigos ou abrir atendimento.

## Arquivos e interfaces

- `scripts/knowledge-source-audit.mjs`: entrada explícita CLI, JSON limitado e erros sem valores privados. A importação do módulo não executa a ferramenta.
- `scripts/knowledge-source-audit-core.mjs`: `auditKnowledgeSource(root, policy, {at?})`, leitura limitada, hashes, overlay lógico, registro e lote de localizadores.
- `scripts/knowledge-source-safety.mjs`: indicadores fixos e classificação de links; não devolve texto encontrado nem destinos arbitrários.
- `source-policy-v3.json`: 41 caminhos/hash/classificações explícitos; estado draft. Não é uma autorização editorial assinada.
- `source-register.json`: relatório da fonte efetivamente lida, sem corpos, títulos copiados, valores encontrados ou raiz absoluta do operador.
- `editorial-candidates-v3.json`: **300 localizadores privados**, sendo 171 perguntas, 50 linhas de limitações e 79 seções. Não são 300 artigos redigidos ou aprovados.
- `prior-link-reconciliation.json`: classifica as 135 ocorrências antes ausentes no ZIP físico, usando os caminhos lógicos dos sete substitutos. Não modifica links.

O contrato TypeScript está em `scripts/knowledge-source-audit-core.d.mts`. Os testes entram no glob `tests/*.test.ts` existente; nenhum runner ou package/lock foi substituído.

## Política de entrada

A política aceita somente estado draft, caminhos relativos `.md`, hashes SHA-256 e enums conhecidos. Campos extras, getters, arrays esparsos, duplicatas/case ambíguo e tentativas de marcar aprovação são recusados. Os limites fixos são 500 fontes declaradas, 4096 entradas de filesystem, profundidade 12, 1 MiB por fonte e 32 MiB no conjunto. Leituras recusam symlink, hardlink, arquivo especial, UTF-8 inválido e alterações detectadas durante a leitura.

A lista explicita `editorial`, `internal` ou `legacy`. **Editorial significa candidato à curadoria privada, não público.** A classificação conservadora MIXED dos textos operacionais preserva as comparações de gerações e contextos; não afirma que todos os parágrafos descrevem legado. Marcadores do item ficam em `markers`; marcadores presentes em outras partes da fonte ficam separados em `sourceMarkers`. Nenhum marcador vira verificação da API.

A origem não declarada não entra na curadoria. Seu caminho não é repetido no relatório: há identificador derivado, tamanho quando seguro e motivo. A política deste lote se refere ao overlay exato recebido. Um checkout maior da wiki exige outra política revisada; não se devem ignorar novos arquivos para fazer a inspeção passar.

## Overlay e fonte histórica

Os sete substitutos são PROMPT-DELTA, DOCPLAN, EXTREMELY-LARGE-MANUAL, novo-geo/INFRA, novo-geo/QUESTIONS, novo-geo/concreto/entidades e novo-geo/gestao/auth. `patches/arquivos-sanitizados/README.md` é uma orientação e NÃO substitui o README da raiz.

A projeção ocorre em memória para resolver referências e evitar duplicação. O pacote recebido tem 41 fontes físicas e 40 documentos lógicos; os originais desses sete substitutos não estão simultaneamente no ZIP. Se original e substituto existirem, somente o substituto forma o candidato; fonte original sensível continua registrada como bloqueio de saneamento. Substituto ausente/alterado/bloqueado nunca faz retornar silenciosamente ao original.

## Conteúdo sensível e lote sem corpos

O detector cobre, de forma heurística, literais criptográficos, credenciais em exemplos, tokens, material OTP, chaves privadas e credenciais em URLs. Retorna apenas códigos e localizadores. Um documento com indicador bloqueante não gera candidatos. Arquivos de instruções, manutenção/infraestrutura, legado e documentos com indicadores de dados pessoais não entram automaticamente no lote.

**O arquivo auth permanece excluído.** A ferramenta não alterou a fonte original, rotacionou chaves ou concluiu se o literal é operacional. O encaminhamento ao custodiante está em `REMEDIACAO-CUSTODIA-WIKI-V3.md`.

A decisão de não copiar perguntas/respostas é deliberada: o lote permite ao editor localizar e revalidar as afirmações, sem redistribuir corpos técnicos, nomes de clientes, instruções ou possíveis dados sensíveis. Redação, fontes por afirmação, aplicabilidade e revisão humana pertencem à HDW-03. Ausência de achado heurístico não autoriza copiar o corpo integral depois.

## Referências e limites de inspeção

O parser cobre um subconjunto limitado: links Markdown inline, imagens, referências nomeadas, autolinks e href/src HTML, identificando exemplos cercados por fences. Não é um parser CommonMark completo. Não busca destinos, verifica existência remota ou valida anchors. URLs externas e fragmentos não podem tornar `referencesResolved` verdadeiro.

As 135 ocorrências antes ausentes foram classificadas: 120 ainda ausentes no overlay lógico, cinco resolvidas no próprio corpus, duas com destino em quarentena e oito fora da raiz. A nova leitura registra 452 ocorrências e 121 ausências relativas; o número mudou por cobertura sintática e resolução lógica, não por alteração dos documentos. Ausência no overlay não comprova link quebrado na wiki completa.

Use cópia local estável, pertencente ao operador. As verificações detectam várias alterações durante leitura, mas não constituem snapshot transacional contra um escritor hostil concorrente ou garantia sobre filesystem remoto. Antes de usar o conteúdo em outra etapa, revalidar seus bytes/hash e a política. O inventário não substitui gitleaks/scanner corporativo, revisão de PII, revisão editorial ou qualificação da origem.

## Testes

```sh
node --experimental-strip-types --test --test-reporter=tap \
  tests/knowledge-source-audit.test.ts tests/knowledge-source-cli.test.ts
```

Na entrega local: 94 testes novos aprovados. PostgreSQL/browser não foram exercitados por esta alteração sem banco ou UI; os gates integrais do repositório continuam obrigatórios antes de integração. Não reutilizar a evidência canônica do R1 para esta fonte nova.
