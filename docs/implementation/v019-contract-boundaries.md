# v0.19.0 — Plano de correção da resolução contratual

Base: `3ecd5abb185cf04333c00b6f5349b5563a5779d4`. Continuidade de M1/CON-06; nenhuma publicação.

## Resultado pretendido
Comparar vigência `[validFrom, validUntil)` sem truncar microssegundos nem aceitar rollovers de calendário.
Recusar uma resposta de cobertura incompatível antes de escolher contrato/criar chamado; não substituir falha de persistência por `no_coverage`.
Preservar snapshots e recibos, inclusive reenvio de chamado criado quando o contrato ainda era válido.

## Arquivos e sequência
1. Testes negativos em `tests/v019-contract-boundaries.test.ts` usando o domínio/serviço reais, limites de microssegundos, respostas controladas do Store e rollback de memória.
2. Comparador de instantes explícitos em `shared/instant.js` e declarações, compartilhado sem alterar os cursores UTC. Datas com fuso explícito e até seis casas; sem timezone local implícito ou normalização de datas impossíveis.
3. `src/domain/contracts.ts`: resolução temporal exata, limites inclusivo/exclusivo e ordem determinística, sem ler relógio global.
4. `src/application/coverage-result.ts`: validar a coleção inteira (até 100), namespace, identificadores, flags booleanas, versão, período e política JSON antes da resolução. Rejeitar duplicatas e dados malformados com erro seguro, sem conteúdo interno.
5. Integrar a validação a `HelpdeskService.resolve/create` mantendo a amostra de relógio após esperar as coberturas. Não revalidar vigência em replay histórico autorizado.
6. Testes HTTP de rollback/erro seguro/reenvio e cenários PostgreSQL escritos para futura homologação; manifesto das 11 migrations preservado.
7. Executar suites locais, typecheck padrão e suplementar separados, contracts, migrations, build, HTTP/browser; documentar os bloqueios reais. Revisar diff e empacotar código/patch/bundle.

## Fora deste incremento
Sem migration, novo endpoint, novo grant, edição de contrato, backoffice, SLA, dispatcher, anexos, instalação alternativa de registry ou uso de banco remoto para testes. PostgreSQL/DOM não serão declarados aprovados sem execução efetiva.
