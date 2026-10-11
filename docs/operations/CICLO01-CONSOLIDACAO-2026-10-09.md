# Ciclo 01 — consolidação e pré-requisitos de execução

**09/10/2026 — entrega preparatória local.** Não é uma nova aprovação do CG03 e não modifica sua lógica de autorização.

## Objetivo

Reunir a entrada CG03I com o plano de ciclos e um diagnóstico repetível. O primeiro resultado útil é identificar se a fonte candidata correta está sobre um checkout apto, antes de iniciar o runner oficial. O objetivo maior continua sendo executar a composição E/G/H/I no PostgreSQL 17 e provar os 31 cenários que permanecem pendentes.

## Uso

No checkout reconciliado, sem copiar package/lock do recorte:

```sh
node scripts/check-cg-consolidation.mjs --help
node scripts/check-cg-consolidation.mjs --root .
```

Quando o executável PostgreSQL 17 não está no PATH, apontar para o diretório de uma instalação local confiável:

```sh
node scripts/check-cg-consolidation.mjs --root . --postgres-bin /caminho/confiavel/pgsql/bin
```

O caminho é da ferramenta local, **não uma URL de banco**. O programa usa somente `postgres --version`, com argumentos separados, sem shell, limite de saída e timeout. Não inicia cluster, consulta SQL ou troca a versão exigida. Não é instalador nem adaptador da aplicação.

A configuração de entrada padrão está em `docs/operations/CG03I-CONSOLIDATION-INPUTS.json`. Ela descreve os 60 arquivos da entrega I e os hashes das 12 migrations antigas obtidos do manifesto remoto na base consultada. Não inclui o código novo do próprio verificador em seu fingerprint de entrada; a integridade dos arquivos desta entrega é registrada separadamente no pacote.

Depois de corrigir deliberadamente algum arquivo I no ciclo de integração, esta referência fica desatualizada e precisa de uma nova versão revisada. Não recalcular hashes automaticamente apenas para eliminar uma divergência. Alteração esperada deve ter diff, testes e procedência.

## O que a verificação cobre

- Presença e SHA256 dos arquivos declarados no pacote de entrada.
- Presença de um conjunto mínimo de arquivos de checkout e runners existentes.
- Presença, inventário e hashes exatos das migrations históricas e correspondência com o manifesto schema 0.19.0.
- Node 22 compatível com o recorte do plano, versão17 do executável PostgreSQL e versões instaladas declaradas de pg/TypeScript/tipos/Netlify.
- Recusa de caminhos inválidos e de links simbólicos nos arquivos de fonte/migrations verificados.
- Diagnóstico sem conteúdo dos arquivos, DSNs, tokens ou argumentos desconhecidos.

Metadados de versões são lidos de package.json das dependências, sem importar seu código. Isso **não substitui** `npm ci`, verificação de lock, auditoria ou integridade da instalação.

## Estados e códigos de saída

| Saída | Significado |
|---|---|
| exit0 / `ready_for_existing_runners` | Somente os arquivos e pré-requisitos examinados coincidiram. Ainda é necessário executar os runners, SQL/upgrade, navegador, CI e revisão. |
| exit2 / `blocked` | Há entrada inválida ou alguma pendência. O JSON informa os códigos e, quando apropriado, os caminhos relativos. |

`sqlExecuted`, `ciExecuted` e `productionApproved` são **sempre false**. O programa nunca muda esses campos ao encontrar um relatório antigo ou uma flag de aprovação no disco. `nextCommands` é apenas uma lista orientativa, restrita a scripts existentes do projeto; **nenhum desses comandos é executado** pelo diagnóstico. Com bloqueios, essa lista fica vazia.

O diagnóstico verifica um subconjunto declarado e requisitos mínimos. Não certifica checkout integral, commit Git, árvore completa, autoria, revisão independente, segurança ou aceitação operacional. Sua inspeção de arquivos não é uma transação atômica do filesystem; usar uma fonte estável e repetir os gates após mudanças concorrentes. Os arquivos de entrada e o executável local escolhido devem vir de origem confiável.

## Resultado observado no ambiente desta entrega

- 60 arquivos de entrada esperados: **60 coincidentes**.
- 12 migrations históricas: **não presentes no recorte local**. Seus hashes esperados foram preservados; não foram inventadas cópias para aprovar a inspeção.
- 14 arquivos mínimos de checkout/runners ausentes; `scripts/test-ui-local.mjs` está presente entre os 15 requisitos mínimos.
- Node 22.16.0 observado; PostgreSQL 17 não observado.
- Cinco dependências não verificadas no recorte.
- Resultado real **blocked / exit2**, com `nextCommands: []` e as três flags de execução/aprovação falsas.

A saída real está em `evidencias/preflight-real-local.json`. Ela não é falha de teste da ferramenta: é o diagnóstico correto de um pacote parcial. Os testes da ferramenta usam diretórios temporários e respostas de versão sintéticas claramente identificadas; não são execução PostgreSQL.

## Testes desta rodada

```sh
node --experimental-strip-types --test --test-reporter=tap \
 tests/cg-consolidation.test.ts tests/cg-consolidation-cli.test.ts
```

32 testes do núcleo e8 da CLI, total40 aprovados na execução conjunta. RED32 e RED8 observados antes de implementar as duas partes. Nenhum skip. Nos testes da CLI, a resposta de versão é interceptada por um preload exclusivo do harness, para não depender de um shell de sistema. A interface do produto não recebe uma opção de versão fictícia. Não há banco nessa fixture nem evidência SQL. Três mutações de cobertura (ignorar hash, aceitar PostgreSQL incompatível e aprovar produção sem testes) foram detectadas; o código foi restaurado e os40 testes repetidos.

O código de domínio, os candidatos SQL, as migrations, grants, runtime, package/lock e configurações hospedadas não foram modificados. A suíte focal393 da entrega I é histórica; não foi somada à suíte40 nem reclassificada como execução desta rodada.

## Próxima ação objetiva

Em um checkout completo e ambiente autorizado com PG17, reconciliar o patch EFGHI da fonte local, executar este diagnóstico, corrigir as pendências reais e seguir os runners existentes. Conferir o registro dos cenários E/G, executar a composição e corrigir resultados com RED/GREEN. Depois gerar CI source-bound novo e revisão independente. Não reenviar o SQL bloqueado por outro caminho nem reutilizar o resultado histórico D como aprovação.
