# Cabeçalhos de resposta — continuidade de HD-002

Estado: implementação delimitada após publicação do PR66; revisão e qualificação integral pendentes.

## Objetivo e reaproveitamento

O validador offline existente verificava status/mídia/corpo, mas ignorava os cabeçalhos declarados, inclusive em respostas vazias. O contrato omitindo ETag/Location nos recibos de criação e ETag na transição podia certificar uma resposta incompleta. Completar essas declarações e verificar cabeçalhos em testes evita regressão para consumidores que dependem de versão, localização e identificação de replay. Não altera handlers, autorização, comandos ou dados produtivos.

## Recorte

Reutiliza Ajv2020/formats e a validação formal local. Cabeçalhos são consultados sem distinção de caixa; required exige presença, opcionais são validados quando presentes; referências internas de resposta/cabeçalho/schema são resolvidas sem URLs, com detecção de ciclo. Header Content-Type é ignorado conforme OpenAPI; response.content continua responsável pela mídia. Respostas sem corpo também passam pela checagem. Valores não aparecem nos diagnósticos.

Suporte delimitado a strings e inteiros decimais canônicos dentro de Number.isSafeInteger, antes do schema. Retry-After1–60 aceita sua representação HTTP textual, sem coagir payloads JSON. Lista combinada, decimal, expoente, sinal positivo e inteiro inseguro não viram inteiro. Formatos/estilos não suportados são recusados quando presentes, sem prometer parser universal de headers. Não adiciona coerção a Ajv, dependências ou validador no runtime.

Contrato core: criação200/201 exige ETag/Location/Idempotency-Replayed; detalheGET exige ETag; prioridade/atribuição/transição200 exigem ETag/replay; mensagens/notas200/201 exigem replay. ETag é inteiro positivo entre aspas e Location é caminho relativo do chamado. A relação entre corpo/ETag/Location e os recibos históricos permanece nos cenários de domínio, separada da validação lexical. Nova extensão response_headers_openapi.py aplica esse mesmo recorte no gerador; não regenerar indiscriminadamente o documento inteiro, pois extensões históricas ainda não estão todas representadas no gerador.

## Verificação e evidências

Seis cenários novos: cinco do validador (presença/referências/resposta vazia; opcionais/privacidade; inteiros; schemas referenciados/imutabilidade; serialização não suportada/Content-Type) e um atravessando os handlers core reais com unidade de trabalho em memória. O último remove/corrompe cabeçalhos de sucesso e replay das operações cobertas. Primeiro resultado: cinco falhas de ausência de rejeição no validador e, após corrigir erro sintático da fixture, mais uma falha de ausência de rejeição no recibo real. Nenhuma falha foi contornada relaxando a resposta esperada.

Primeiro conjunto verde30/30, tipos raiz aprovados; testes HTTP de cobertura3/3 após permitir loopback (primeira execução sandbox teve EACCES, não falha funcional). Contrato45 operações, migrations21 e lock conferidos. Resultado da fonte final/CI/revisão ainda será registrado.

## Limites e continuidade

HD-002 continua parcial: não valida genericamente request bodies, todos os estilos de cabeçalhos ou todas as respostas nativas. Não exige cabeçalhos não declarados, não equipara recibo repetido ao estado atual nem comprova autoridade por ETag. Provas core em memória não substituem PostgreSQL/RLS, e-mail real ou aceite humano. Nenhum SQL, DSL, formulário publicado, flag, concessão ou segredo alterado. MFA/Novo GEO permanecem adiados, scanner cancelado e modelos técnicos ausentes. Próximos recortes: conformidade das demais respostas existentes; validação semântica de e-mail somente por versão explícita com paridade DSL/publicador/SQL/UI; busca de conversa com audiência própria.
