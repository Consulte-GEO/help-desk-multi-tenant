# M1-R18 — Conferência integral de recibos privados

## Base e finalidade
Base recuperada R17: commit declarado `51299891552aac86de8db5f8dc99e5ec5c0fe75e`, fingerprint `3819e2205d51535df464faff626c7cfed1969d5d979a81d98aa5d7b5d1248df8`.
Remoto observado em 01/10/2026: R9 `78bbb00112331531168ae24600604cb7f3148770`.
Continuação de P0-SQL-REVIEW: a conferência dos recibos no R17 checa operação, autoria, id e versão, mas não compara o hash do pedido e todo o resultado privado com uma referência independente.

## Critérios desta rodada
1. Reproduzir a lacuna na função real de correlação com registros sintéticos claramente identificados.
2. Na primeira resposta de gravação confirmada, comparar o recibo privado com o payload normalizado da requisição e o recurso persistido daquele instante.
3. Guardar cópia independente do recibo verificado e exigir preservação integral na correlação final.
4. Manter comparação de tempo em microssegundos: aceitar representações equivalentes com fuso explícito, recusar diferença de um microssegundo, sem regravar dados.
5. Falhas fixas sem bodies, policies, SQL, tokens ou valores privados no diagnóstico.
6. Nenhuma nova chamada HTTP, migration, grant, dependência ou comando; manter seis percursos R17 na suíte SQL existente.
7. Executar regressões e gates disponíveis. SQL sintético não aprova a suíte PostgreSQL ou ambiente hospedado.

## Plano local
- [x] Recuperar fonte e verificar baseline R17: 1.389 testes.
- [x] Registrar regressões antes da correção.
- [x] Conferir recibos na primeira escrita e na correlação final.
- [x] Executar regressão, suíte completa e verificações possíveis.
- [x] Revisar pacote e atualizar handoff/backlog.

Sem autorização inferida para operações externas. Não contornar as limitações do ambiente nem liberar produção.

## Resultados e limite
Reprodução real do comparador com fixture sintética: 13 recusas não eram detectadas, enquanto o controle íntegro passava. Após correção, 28 regressões e 1.417 testes totais passaram. Os seis percursos SQL continuam escritos, sem execução PostgreSQL nesta rodada. Estado detalhado em docs98; integração e pendências em docs99–100.
