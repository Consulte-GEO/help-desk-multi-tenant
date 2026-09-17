# Help Desk v0.17.0 — Paginação e precisão temporal

## Escopo e problema reproduzido

Esta entrega corrige a representação temporal usada na paginação de chamados, mensagens, notas e histórico. API/interface 0.17.0; schema candidato 0.16.0. Não adiciona migrations, permissões, endpoints ou dependências. Não comprova a execução do PostgreSQL ou do provedor.

A documentação primária do node-postgres informa que valores timestamptz são convertidos para Date por padrão, com truncamento dos microssegundos. A documentação PostgreSQL informa precisão de microssegundos e o padrão US de to_char. Esse comportamento motivou uma revisão do adaptador: a leitura anterior também passava por Date/toISOString e emitia cursores com somente milissegundos.

Exemplo do risco, por raciocínio sobre a consulta, não por incidente observado no servidor: duas mensagens registradas em 12:00:00.123456 e 12:00:00.123455 podem cair no mesmo milissegundo. Se o cursor da primeira vira 12:00:00.123, a busca por registros anteriores àquele limite não inclui a segunda. Os testes locais reproduziram rejeição de cursores com seis dígitos, perda de precisão no adaptador controlado e ordenação inconsistente na referência de memória. Não foi constatada perda de mensagens em ambiente remoto.

As escritas normais atuais usam o relógio JavaScript, de precisão de milissegundos. A correção é especialmente relevante quando existem instantes mais precisos no banco, provenientes de escrita SQL, importações futuras ou relógios de maior precisão. Não afirma que toda mensagem atual possuía esse problema.

## Implementação

### Leitura do PostgreSQL sem truncar

Os SELECTs de criação/atualização de chamados e de criação das conversas passam a projetar texto UTC com to_char(... AT TIME ZONE 'UTC', ...US...). O adaptador normaliza sem perda: .123000Z continua .123Z; .123456Z permanece .123456Z. Valores nulos/incompatíveis geram invalid_database_result, sem conversão de NULL para uma data artificial.

A projeção recusa eras e anos fora de 0001–9999 por comparação de intervalo antes de formatar. Não transforma uma data anterior à era comum numa data positiva aparentemente válida. Essa expressão SQL é candidata, ainda não executada pelo servidor.

Os predicados de cursor permanecem sobre timestamptz e UUID nativos, com parâmetros. ORDER BY utiliza o nome da tabela no timestamp para não ordenar acidentalmente pelo alias textual formatado. Não foram criados índices novos nem alteradas políticas; custo/plano de consulta precisam ser medidos com PostgreSQL real.

### Contrato comum de instante

`shared/instant.js` é usado pela aplicação e pela interface. Aceita UTC Z, ano gregoriano de quatro dígitos e três ou seis dígitos fracionários. Rejeita datas impossíveis, hora 24, segundos intercalares, NUL/formatos incompatíveis e precisão acima de microssegundos. Não faz correção silenciosa de calendário.

A comparação padroniza apenas para comparar, sem modificar o objeto de origem. Portanto `.123Z = .123000Z < .123001Z`. O desempate por identificador usa a mesma ordem determinística da comparação do cursor, e não a colação variável de localeCompare. UUIDs persistidos continuam normalizados pelo contrato anterior.

O módulo é publicado em `/shared/instant.js`, no mesmo domínio. Foi incluído no build, na demonstração, no smoke de assets e no fingerprint da homologação. Não depende de CDN nem altera CSP.

### Recibos idempotentes

A comparação do instante imutável de criação não colapsa diferenças de um microssegundo. Recibos históricos com offset explícito ou fração menor continuam comparados pelo instante exato, usando milissegundos inteiros e o restante em BigInt. O calendário é validado antes; 30 de fevereiro não é aceito como 2 de março.

O recibo não é reescrito ou convertido ao formato novo. Sem nova gravação, alteração de chave, extensão de prazo ou mudança de autorização. Campos de data de um resultado idempotente preservam sua representação original; não implementar validadores de consumidor que exijam sempre 24 caracteres.

## Compatibilidade e limites

Cursores de três dígitos continuam aceitos. Isso NÃO recupera a precisão que um cursor antigo já tenha perdido. Ao atualizar o sistema, reiniciar a listagem/histórico é necessário para abandonar um cursor eventualmente truncado. Nenhuma migration poderia inferir os dígitos perdidos de um recibo já truncado; esta versão não tenta inventá-los.

A ordenação permanece `created_at DESC, id DESC`, com as mensagens apresentadas cronologicamente na interface. Não é snapshot da coleção, ordenação por atualização, mecanismo de sincronização nem garantia de relógios monotônicos. Mudanças de permissões e conteúdo entre páginas mantêm os limites das coleções vivas descritos anteriormente.

A interface pode continuar exibindo apenas dia/hora/minuto; a posição dos itens e os cursores preservam a precisão. Calendário/SLA, expiração de sessões, TTL de cache e políticas contratuais não tiveram sua semântica alterada.

Registros com datas incompatíveis são recusados, não corrigidos ou eliminados. Antes de uma integração real, executar o diagnóstico de dados/formatos com autorização e revisar os casos rejeitados. Não desabilitar a validação para fazer a demonstração parecer uma homologação.

## Evidências e novos testes escritos

32 testes locais novos: 17 de precisão/adaptador/UI puro; oito do contrato de instantes e recibos; quatro de HTTP em loopback; três de empacotamento/fingerprint. Os quatro HTTP estão incluídos no total 982, não são testes adicionais do Supabase.

Os testes HTTP de mensagens, notas e histórico percorreram 75 registros por coleção dentro de um milissegundo, em páginas de sete, e verificaram ausência de perda/duplicação e recusa de conta indevida. A lista confirmou continuidade filtrada e cursor vinculado à consulta. Os dados são sintéticos em memória.

Oito cenários PostgreSQL foram escritos: leitura exata, paginação de chamados, mensagens, notas e eventos, empate com UUID, TimeZone da sessão diferente e reenvio após roundtrip. Usam relógio preciso só de teste e papel restrito; clientes HTTP não escolhem os instantes. Nenhum foi executado nesta rodada. O total escrito passa de179 para187, incluindo14 de upgrade preservados.

Uma regressão DOM foi acrescentada com respostas de seis dígitos controladas. O navegador bloqueou antes da navegação; não foi aprovada, assim como as35 anteriores. Há36 cenários browser escritos. O HTTP normal da demonstração passou em35 checks.

## Fontes externas consultadas

- node-postgres, Data Types: `https://node-postgres.com/features/types` — conversão padrão para Date e truncamento de microssegundos.
- PostgreSQL17, Date/Time Types: `https://www.postgresql.org/docs/17/datatype-datetime.html` — precisão dos tipos.
- PostgreSQL17, Formatting Functions: `https://www.postgresql.org/docs/17/functions-formatting.html` — to_char e US.

As fontes documentam o comportamento das ferramentas. Não certificam os SELECTs deste projeto. As escolhas de formato, comparação, testes e rollout são decisões desta implementação.
