# Cabeçalhos de resposta — continuidade de HD-002

Estado: PR67 implementado, revisado e qualificado na fontef4a166f; ainda sem merge/publicação. PR66 permanece em produção, merge4899c7d.

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

## Qualificação integral da fonte final

[CI38956201019](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38956201019) aprovado sobre f4a166f300d43b7a6c4ac30a90baac8bedda904e: **5900 aplicação +700 PostgreSQL17 +655 interface =7255**, zero falha/skip/cancelamento/todo. Instalação limpa/audit, build, types, contrato, migrations/upgrade e navegador concluídos no CI Linux. São seis novos cenários Node; não são 7255 funcionalidades novas.

Artefato original helpdesk-homologation-f4a166f300d43b7a6c4ac30a90baac8bedda904e-38956201019-1, digest sha256:e7f3588d895fb48e156dea1112d75c02a2c7a9b09eb4c92e62769dcacf030d66. Fingerprint a87cd49c3cd9ae7245ef092b8fa2597d172e483d38c89a4f4c97f64e0bc641bc. Relatório e seis logs originais preservados em evidence/homologation/, validados antes/depois da cópia com hash/contagem/fonte; recibo evidence/response-headers-20261016/ci-qualified.json. Commits posteriores de documentação/evidência preservam esse fingerprint; não homologam código distinto.

Revisão independente acumulada encerrada sem achados pendentes:23/23 testes dos dois arquivos Node modificados, contrato45 operações; delta da fixture revisado com P2 encerrado,7/7 hashes diagnósticos conferidos e relatório local40/40 inspecionado. Não houve repetição do navegador pelo revisor. Os runs iniciais falhos permanecem identificados como falhos. Nenhum teste, timeout ou política foi relaxado para obter aprovação.

[Merge de teste38956207130](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38956207130) aprovado. HDA38956201021/38956207033 e Apoio38956201066/38956207023 aprovados na fonte final/merge; quatro análises CodeQL aprovadas. Relatório original da fonte final: evidence/homologation/runs/c1f13d59-43db-44f5-a1db-76b5c6085204/report.json. check:homologation aprovado. Delta f4a166f da espera DOM admitido pelo revisor;6/6 totais locais e hash diagnóstico conferidos, sem novos achados no acumulado. Prévia do commit documental final será conferida separadamente, sem remover gates.

Após concluir esta entrega, o usuário solicitou preparar o MCP v2 anexado. Destinos GitHub/Supabase ainda não existem e o usuário determinou preparação local. O MCP será um projeto separado; nenhum merge/deploy desse PR67 nem provisionamento remoto do conector está presumido.

## Publicação autorizada do PR67

O usuário autorizou expressamente merge e implantação. Reinspeção confirmou head1874c52, base4899c7d, mergeable/CLEAN, checks aprovados e fonte local qualificada. Merge `f7ff73ae1a3279a38b22419f9f5755e8b51b0f2c` em16/10/2026 às17h29 Brasília; deploy de produção `6ad2892dd4bec684a4e7c792` READY às17h30. Manifesto120/120 por HTTPS/SHA1, controles privados/capacidades e quatro recusas401 conformes verificados. Provas originais em `evidence/response-headers-20261016/production/`. Sem migration ou escrita de negócio. Aceite autenticado e cabeçalhos de sucesso autorizados produtivos não foram inferidos de recusas anônimas.
