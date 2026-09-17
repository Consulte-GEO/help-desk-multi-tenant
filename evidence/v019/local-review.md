# Revisão local — v0.19.0

Revisão do diff contra3ecd5abb185cf04333c00b6f5349b5563a5779d4, não independente.

- Contratos: comparação inteira sem Date.parse de frações completas; uso da função já testada para histórico, extraída ao shared. Calendário validado antes de calcular o deslocamento. Flags true estritas; início inclusivo/fim exclusivo.
- Source boundaries: coleção até100, completa e sem IDs duplicados; contexto obtido da identidade autenticada e requisição autorizada. Uma linha malformada invalida o resultado inteiro. Não se trata de prova contra banco/driver comprometidos que consigam falsificar todos os campos de forma coerente.
- Mutação: agora somente dados validados entram na seleção e snapshot; estado da memória e cache não são confirmados quando falha. Não há espera assíncrona entre amostra do relógio e resolução.
- Replay: histórico continua original mesmo após vencimento; todos os1.040 testes, incluindo recibos/transações anteriores, passaram. Extração do parser não normaliza os valores retornados.
- Catálogo: restrição por workspace/conta/produto antes de avaliar datas, com regressão falha→passa para cobertura estrangeira malformada.
- SQL: nenhum arquivo de migration modificado. Os cinco testes adicionais não foram executados; revisar timezone, formatosJSONB, instantes e scopes reais no banco descartável.
- Limites: política16KiB emJSONcompacto não equivale ao textoJSONB do banco; comparador não aumenta resolução do relógio nem implementa SLA. Datas especiais/infinity são incompatíveis, não ausência de contrato.
- Ferramentas: erro de sintaxe em fixtureHTTP e inferênciaTypeScript de fixture corrigidos; não contabilizados como falhas do produto. Fixture antigo de intervalo vazio foi tornado futuro válido, sem remover teste de período inválido.
- Declarações finais:35HTTP é memória.201SQL/36browser permanecem escritos, não aprovados; no runtime/restore/deploy. Nenhuma nova inspeção remota realizada.
