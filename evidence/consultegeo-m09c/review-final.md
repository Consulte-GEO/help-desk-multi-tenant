# M09c — revisão independente e resolução

Registro resumido da única revisão final realizada por review_consultegeo_m09c (GPT-6-astra, contexto novo, high). Range inicial ca40dfc..de89364, com delta de preparação do contador d920e04 examinado na mesma revisão. Esta é a preservação do resultado da avaliação; os testes posteriores são evidência do implementador, não uma segunda revisão.

Resultado: 0 Critical, 2 Important, 0 Minor. O revisor executou 113 testes focais com sucesso. Não executou PostgreSQL17 nem instalou schema hospedado.

1. Important: o domínio contava o mínimo do assunto em UTF16, enquanto o CHECK histórico do core exige três caracteres Unicode. “😀a” era aceito na prévia e rejeitado na persistência. Aceito e corrigido: mínimo de três code points antes da prévia; máximo histórico em UTF16 preservado. Teste local subject-red → subject-green e cenário nativo com “😀a” recusado / “😀ab” criado. Nenhum enfraquecimento do CHECK.
2. Important: a confirmação parcial do snapshot não detectava alterações de prioridade, relógios ou respostas por um BEFORE trigger. Aceito e corrigido: comparação integral dos valores realmente persistidos do ticket, contador, snapshot e recibo, além do digest de snapshot verificado no COMMIT. Cenários nativos com os quatro mutadores falharam antes da correção e passaram na rodada d0c2eb7 e seguintes. A supressão de cada efeito também exige rollback integral.

O delta do contador foi considerado coerente: preparação explícita pelo operador, sem default de 10001, sem autoseed/reset; ausência recusa, incremento por UPDATE CAS. Nenhum achado adicional.

O revisor deixou quatro pontos para julgamento do responsável: qualificação real M08; instalação hospedada; montagem da UI; envio real de emails. Mantidos nos respectivos incrementos e registrados como decisões com custos no ledger. A aprovação dos testes não afirma esses aceites.

Durante a qualificação nativa, o implementador corrigiu a ambiguidade variável/coluna request_id no trigger deferido e a perda do erro confiável draft_expired na consulta emprestada. A fixture de expiração também passou a observar o lock nativo e vencer antes do lock_timeout real de 2000ms. Logs anteriores, RED/GREEN e resultado final source-bound acompanham esta entrega.

Minors adiados: nenhum.
