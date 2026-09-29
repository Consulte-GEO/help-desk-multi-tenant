# M1-R8 — correção de tipagem que bloqueava o CI do R7

**Data:** 29/09/2026. **Escopo:** correção de um teste de infraestrutura existente; sem feature de atendimento ou nova camada de diagnóstico. M1 continua aberto.

## Base e prioridade
Fonte R7 recuperada do bundle, commit `fd50ccdbb5a152d4089afdc9cb160fef236a7710`. GitHub consultado: branch `codex/m1-reproducibilidade`, commit `b9481b9fabde2fd9c442e44099bc17608b59571a`. Prioridade mantida: instalar dependências reais e executar PostgreSQL/CI. Não publicar, habilitar atendimento ou alterar destinos por autorização histórica.

## Achado reproduzido
O baseline executou 1.192 testes Node sem falhas. O TypeScript padrão não pôde ser aprovado por falta das dependências. Uma checagem suplementar usando TypeScript 5.8.3 e definições globais já instaladas de Node 25.1.0 isolou um erro de código:

`tests/m1-ci-isolation.test.ts(31,5): TS2339: Property 'options' does not exist on type '{ parent: string; checkout: string; temp: string; commit: string; }'.`

A fixture criava `f` sem a propriedade `options` e depois a atribuía. A inferência do objeto não incluía esse membro. Os testes executados por `--experimental-strip-types` não exercitam a checagem de tipos; passar em Node não resolve o erro de compilação. A falha de dependências não era, portanto, o único bloqueio. Não houve reprodução do erro no GitHub nesta rodada.

## Correção delimitada
Definir `CiStagingOptions` e `CiFixture`, declarar o callback de `fixture` com esse tipo e inicializar o objeto completo. Preservar o fechamento sobre `f.commit`: alguns testes alteram o commit e `options()` precisa consultar o valor atualizado, não uma fotografia da criação. Todos os valores, negativas, comparações e asserções existentes são mantidos.

Não usar `any`, index signature aberta, `@ts-ignore`, mudança de `tsconfig`, retirada de `typecheck` do `verify`, redução de contagens ou alteração de dependências para contornar a falha.

## Aceite desta correção
A mesma checagem suplementar passou depois da alteração; os 15 testes focais e a suíte completa de 1.192 passaram. A correção não adiciona testes: reutiliza o compilador e as regressões existentes. Fonte isolada e patch devem ser conferidos após o commit; resultados constam no manifesto externo. A checagem suplementar não altera o estado de instalação nem substitui a toolchain travada do projeto (incluindo `@types/node` 22.15.30).

## Requisitos que não mudaram
API/interface 0.19.0; schema 0.18.0; onze migrations; lockfile intacto; 209 cenários SQL ainda dependentes de PostgreSQL 17. Nenhuma alteração em `src/`, workflow, runner, grants, endpoints ou dados.

## Fontes externas, separadas da evidência do projeto
- Node.js, Running TypeScript Natively: https://nodejs.org/learn/typescript/run-natively — execução por remoção de tipos não faz type checking.
- TypeScript, Object Types: https://www.typescriptlang.org/docs/handbook/2/objects.html — tipos de objetos e suas propriedades.
- npm ci: https://docs.npmjs.com/cli/v10/commands/npm-ci/ — instalação a partir do lock, separada de ferramentas globais.
Essas referências fundamentam a explicação; não comprovam resultados deste projeto.
