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

## Diagnóstico do primeiro CI e correção da fixture

Fonte1835f8d/run38953442104 e merge38953497420 falharam em browser-smoke.py:71, retry de notas invisível. Aplicação5900 e PG700 aprovados, interface não qualificada. Relatório/seis logs originais com hashes/digest preservados em evidence/response-headers-20261016/initial-failure/; não são evidência aprovada. O verificador integral de homologação corretamente recusa o run falho; preservação diagnóstica confere somente bytes/hashes.

O smoke alterava o transporte com unroute antes do retry explícito. networkidle/classe selected não vinculavam os dois refreshes anteriores às respectivas respostas de notas. Uma lista anterior obsoleta pode retornar de list() e seu chamador ainda iniciar detail(); após unroute a leitura200 oculta retry. O revisor reproduziu deterministicamente essa ordem com list extraída e createTicketListState real. A execução local instrumentada observou200,200,503,503 antes do unroute, mostrando que uma leitura anterior atravessava a mudança da fixture; passou nessa execução e não comprova por si só a reprodução visual da falha do CI.

Corrigida somente a fixture: cada um dos dois refreshes anteriores aguarda sua resposta200 de notas; interceptor de indisponibilidade fica instalado com estado explícito até a ação de recuperar, sendo removido após200 e restauração do rascunho. Asserções de erro/visibilidade/privacidade/rascunho mantidas; acrescentada exigência de seção open. Sem sleep/retry, aumento de timeout, alteração de produto ou remoção de testes. Smoke local completo40/40 aprovado com Python3.14/playwright1.64, loopback/dados sintéticos próprios; relatório original em local-smoke/. CI final ainda necessário na bancada Linux fixada em1.63.

### Segundo diagnóstico, independente da recuperação de notas

Run38955073919 da fontec8958b7 aprovou5900 aplicação/700PG, mas parou antes do smoke de notas: browser-ticket-summary.py:51, Page.wait_for_function/EvalError de CSPscript-srcself. Log original/report/hash/digest em second-failure/, sem qualificar esse run. Localmente a versão anterior passou6/6, portanto não foi reproduzida a exceção CSP nessa máquina. O diagnóstico da chamada e equivalência foram conferidos pelo revisor.

Substituída somente a espera de expressão querySelector!==null por locator(...).first.wait_for(state='attached'), mesma exigência de um elemento no DOM, inclusive oculto. Mantidas CSP/configuração, asserções e timeout. Não foi habilitado unsafe-eval nem desativada política do navegador. A execução corrigida e novo CI ainda precisam confirmar a fonte final.

Suíte de totais corrigida6/6 aprovada em loopback próprio; saída original em local-smoke/ticket-summary.txt. Contrato45 operações reconferido. Nova qualificação integral pendente.
