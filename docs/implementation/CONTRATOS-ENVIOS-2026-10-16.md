# Conformidade dos envios existentes — HD-002

## Escopo autorizado

Continuidade dos itens prioritários após o merge/publicação do PR65. Recorte delimitado sobre fluxos existentes: corrigir o documento de erro de quatro handlers montados e qualificar os recibos de escrita do core contra o OpenAPI existente. Não cria rota, campo de cadastro, operação ou concessão de acesso. MFA e Novo GEO seguem adiados, scanner cancelado e modelos técnicos homologados ausentes.

## Divergência reproduzida e correção

O schema `Problem` exige `title`, mas os handlers de workflow, checklist de execução, abertura Consulte GEO e catálogo/rascunho devolviam esse erro sem o campo. Os novos cenários atravessam a composição real `createConsulteGeoRuntimeHandlers`, recusam autenticação antes de SQL/diretório e reproduziram separadamente as quatro falhas de contrato. Gate fechado e conflito de versão/resultado incerto também falharam pelo mesmo motivo.

Cada handler recebe somente o título genérico estático “Não foi possível concluir a solicitação.”. Os mapas de código/status, detalhes seguros, UUID de correlação, diagnóstico de precondição, admissão e instruções para resultado incerto permanecem. Não substituir esses tradutores pelo erro genérico do core: a mensagem específica de `transaction_outcome_unknown` orienta conciliação da mesma intenção/chave e não pode virar repetição automática. O handler opcional de intake genérico/anexos não é montado nem ampliado como parte desta entrega.

## Qualificação acrescentada

`tests/openapi-write-responses.test.ts` reutiliza o gate offline existente; não adiciona dependência ou validador ao runtime. Dez cenários novos:

- Criação201/replay200 com Location, ETag e marcador de replay. Após alteração posterior, o recibo reproduzido conserva a versão original e não duplica chamado.
- Mensagem pública e nota interna201/200; identidade do recibo no replay e ausência da nota no canal público/outbox.
- Prioridade, atribuição e transição200; recibo/ETag originais no replay, sem interpretar recibo histórico como consulta atual.
- Falta de versão428, versão divergente412, entrada400 e mídia415 no core, com snapshot de memória inalterado.
- Quatro cenários separados de recusa401/403 na composição montada, sem SQL ou fallback legado; corrigem a divergência reproduzida.
- Recusa503 por gate fechado antes de autenticação/SQL e sem fallback.
- Workflow412/503, erro desconhecido sanitizado e instrução de conciliação preservada, sem Retry-After automático para resultado incerto.

As respostas passam pelo schema do método/status/mídia reais; cabeçalhos privados e a correlação são conferidos separadamente. Os recibos de sucesso usam HTTP + serviço/unidade de trabalho reais em memória. O cenário de erro do serviço de workflow usa uma porta sintética para provocar recusas; não é prova de commit PostgreSQL ou callback produtivo. O mapa de recursos da composição não pode ser consultado nos cenários de recusa inicial: o pool da fixture falha se utilizado.

Resultado red/green: quatro cenários de core passaram antes da correção; seis cenários operacionais falharam por contrato (incluindo cada um dos quatro handlers). Depois da adição do título,10/10 passaram. A primeira versão do teste de criação trocava a identidade, e foi corrigida para manter o mesmo principal antes de avaliar replay; nenhuma alteração do produto foi feita para satisfazer essa fixture equivocada. Conjunto focal final com handlers/leituras/checklist/rascunhos:92/92 aprovado. OpenAPI45 operações,21 migrations e lock conferidos. Compilador, build, revisão independente e CI completos serão registrados após conclusão.

## Limites e continuidade

HD-002 permanece parcial. O gate não é validador genérico de requisições, cabeçalhos serializados ou todas as respostas da API. ETag/Location/replay são verificados pelos cenários acima; o schema de corpo não comprova sozinho esses recibos. Sucessos duráveis CG/checklist/intake e suas combinações continuam com suas bancadas existentes; nenhuma jornada humana hospedada é substituída pelas fixtures.

Sem alteração de OpenAPI, DSL, formulários publicados, política SLA, outbox, grants, segredos, SQL ou flags. Não repetir operações reais em produção para fabricar conformidade. Após qualificação, abrir PR de revisão da continuidade; publicação dessa nova fonte permanece distinta da autorização de publicação do PR65.

Próximos recortes ainda executáveis: ampliar a conformidade de requisições/cabeçalhos e demais respostas existentes; validação de e-mail somente em versão explícita e com equivalência DSL/publicador/SQL/UI; busca de conversa com contrato/audiência próprios. SLA/autoridade continuam sujeitos à definição vigente, sem inventar regras técnicas ou antecipar MFA/Novo GEO.
