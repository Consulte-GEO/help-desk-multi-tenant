# HD-002 — Conformidade das respostas de leitura

Continuidade autorizada após o PR63, base `d3322af608e64bd7402aeb01b492f8a19f25c3b2`. O recorte verifica respostas reais dos handlers contra o OpenAPI existente. Não fecha todos os contratos do produto nem modifica regras de atendimento.

## PR63 em produção

PR63 mesclado às 13h10 Brasília em16/10/2026; deploy production `6ad24c9493f8e03c1e182b61`, READY/publicado às13h12 (`2026-10-16T16:12:08.815Z`).119 entradas do manifesto conferidas por HTTPS/SHA1, incluindo `ticket-views.js`. Resumo/lista/identidade anônimos401; fontes/migrations404, worker nativo403. Capacidades e configuração de totais continuam ativas. Sem migration, alteração de segredo ou escrita de negócio. Prova sanitizada em `evidence/ticket-views-20261016/production/publication.json`.

CI pós-merge `38929911773` aprovado; HDA `38929911835`, Apoio `38929911892` e CodeQL `38929910347` aprovados. Essa publicação não é aceite humano autenticado dos atalhos. A documentação anterior do PR63 registra a qualificação anterior ao merge; este checkpoint atualiza seu estado produtivo.

## Problemas reproduzidos e mudanças

1. A composição retorna `consultegeo_review` em `/v1/public-config`, mas `PublicConfig` proibia propriedades adicionais e não declarava esse campo. O teste de resposta composta falhou antes da correção. O OpenAPI e a extensão do gerador agora o descrevem como booleano consultivo. Nenhuma flag foi ativada.
2. O fallback de módulo indisponível retornava503 com documento incompleto, sem `title` e `request_id` exigidos pelo contrato. O teste do handler composto falhou antes da correção. O fallback usa o `problemResponse` existente e `requestIdFor`, preservando código, motivo e recusa antes de Auth/SQL/fallback legado; acrescenta correlação e `Retry-After:2` do padrão existente. Request ID não é identidade ou autorização.
3. O validador formal entregue anteriormente qualifica o documento, mas não as respostas. `scripts/openapi-response.ts` compila os schemas de resposta do documento qualificado com Ajv2020 e formatos completos. É ferramenta offline de desenvolvimento/teste; não entra no runtime HTTP ou bundle do navegador. `ajv-formats@3.0.1` é dependência de desenvolvimento direta/fixada, com lock preservado.
4. GETs anônimos produtivos confirmaram que lista e resumo recusam401, mas o leitor escopado omite `title` no erro. A regressão usa a factory real com fonte local e recusa de Auth401/403, sem SQL/diretório/fallback legado. Acrescentado somente o título ao tradutor de erros existente, sem mudar códigos, detalhes, request ID próprio, mapeamento de status ou a regra de resultado transacional desconhecido. Nenhuma recusa virou sucesso.

## Escopo da qualificação

| Cenário | Evidência automatizada |
|---|---|
| Capacidades, configuração pública e identidade | Handlers reais, modos operacional e somente autenticação |
| Capacidades/configuração compostas | Factories Consulte GEO reais, fonte local presente/ausente, business/workflow/intake/e-mail ligados ou desligados em fixtures; nenhuma consulta SQL/Auth nessas rotas |
| Lista, resumo e detalhe | Serviço/store em memória, página parcial versus total completo, solicitante versus operador, projeção pública/interna |
| Mensagens, notas e timeline | Respostas preenchidas, recusa de notas ao solicitante e sentinelas privadas ausentes da conversa/projeção pública |
| Erros |401/403/404/400/405/429/500/503, tipo JSON, status do documento igual ao HTTP, correlação, privacidade e prazo mínimo quando aplicável |
| Módulo indisponível | Composição503 sem Auth/SQL/fallback legado; cabeçalhos privados, código e correlação |

O gate exige operação declarada, status exato/faixa/default explicitamente declarado, media type JSON correspondente e schema de corpo com tipos, limites, campos obrigatórios/adicionais e formatos. Preserva a resposta original por clone, sem coerção, defaults, remoção de campos ou mensagens que copiem o payload. Resolve apenas referências internas qualificadas. Referências externas/ausentes e formatos desconhecidos são recusados. Contrato sem conteúdo exige corpo vazio. Os metadados OpenAPI da raiz são anotações para manter os JSON Pointers; não são schemas de payload. Formatos usam o plugin oficial em modo completo, somente sobre fixtures próprias.

Cabeçalhos de privacidade e invariantes de domínio são asserções próprias dos cenários, não uma promessa de validação genérica de todo Header Object OpenAPI. O validador não verifica requisições, autentica usuários, executa comandos, concede acesso ou confirma a semântica de todos os resultados possíveis. O conjunto entra no `npm test`/`npm run verify`/CI existente; não há novo processo operacional.

Referências técnicas: [formatos Ajv](https://ajv.js.org/guide/formats.html) e [gestão de schemas](https://ajv.js.org/guide/managing-schemas.html). Não executar `generate-openapi.py` e presumir reconstrução integral das extensões históricas sem conferir o diff: esta entrega atualiza apenas o campo do recorte no gerador e no documento corrente.

## Progresso e critérios de entrega

- [x] 5 testes do novo gate observados vermelhos antes da implementação; as duas divergências de runtime/contrato reproduzidas antes dos fixes.
- [x] 14 testes novos de conformidade/validador;78 verificações focais aprovadas, incluindo a suíte escopada e runtime local existentes.
- [x] Typecheck, contratos, lock, segredos heurísticos,21 migrations e build aprovados; instalação/auditoria da nova dependência sem vulnerabilidades observadas.
- [x] Revisão independente da fonte e conferência focal da correção, sem achados Critical/Important/Minor pendentes.
- [x] CI Linux integral e preservação dos relatórios originais contra o fingerprint exato.
- [x] PR próprio qualificado para revisão. A autorização de publicação específica desta rodada refere-se ao PR63.

Não há migration ou alteração de tabelas, política, grant, segredo, MFA, Novo GEO, scanner, modelos técnicos ou preferências de e-mail. Não houve envio externo ou registro fictício produtivo.

Execução ampla Windows:5872 testes,5731 aprovados/141 falhas, sem skips/cancelamentos. Todos os12 novos testes passaram. Comparação com a baseline recente encontrou três falhas adicionais no subprocesso CLI de preflight (JSON vazio após prazo de10s); a reexecução isolada desse arquivo aprovou9/9 com saída0, sem alterar código, timeouts ou fixture. As demais falhas pertencem à baseline Windows já registrada. Isso não é aprovação integral local; a qualificação integral deve vir do CI Linux apto, preservando todos os testes.

Revisão independente da fonte inicial `d8f20f7` encontrou um caso Minor no diagnóstico da ferramenta offline: `assert.equal` podia incluir o valor inválido de `status` no erro quando um schema sintético permissivo aceitava esse valor. Reproduzido vermelho com sentinela privada, corrigido comparando a igualdade como booleano em `assert.ok` e reexecutado verde. A nova regressão verifica a mensagem e a serialização da exceção. Nenhum dado real ou comportamento do runtime HTTP foi envolvido nesse fix. A execução Windows ampla acima precede esse13º teste; a qualificação integral da fonte final continua obrigatória.

O revisor conferiu o fix `e016383`, reexecutou13/13 testes novos e encerrou sem achados pendentes. Foram considerados fora do recorte: escritas/requisições/sessões/M2M, demais endpoints/combinações, headers genéricos, RLS/PG e aceite hospedado autenticado; continuam pendências próprias. Wildcards de mídia e Path Item `$ref` não aparecem no contrato corrente e não motivaram expansão especulativa.

Prova pública complementar em16/10 às16:34Z: `/v1/capabilities` e `/v1/public-config` produtivos200 passaram no gate da fonte `e016383` e na verificação de `no-store`, `nosniff` e `no-referrer`. Produção nessa prova é o PR63; o contrato candidato apenas declara o campo já retornado. Recibo sanitizado em `evidence/http-contract-20261016/public-read-contract.json`, com nomes das propriedades e sem valores da configuração. Somente GET público; não valida Auth, dados privados ou o novo fallback em produção.

Prova anônima complementar às16:37Z: `/v1/me`401 já conforme; `/v1/tickets` e `/v1/tickets/summary`401 com ausência de `title`. Prova sanitizada em `evidence/http-contract-20261016/public-anonymous-findings.json`. Segurança de acesso preservada; a conformidade desses dois corpos produtivos só poderá passar após a publicação da correção do PR64. Não tratar o achado como liberação de dados ou declarar que o fix já está em produção.

Revisão focal da extensão `e016383..f902f00` concluída sem achados: o revisor confirmou a alteração de um único campo no tradutor escopado e reexecutou14/14 novos testes. O tratamento de confirmação desconhecida permanece intacto. A fonte final para qualificar é `f902f00ae0010d9c1fe8cb253c767133d407a0ae`; resultados intermediários cancelados por supersessão não homologam esta fonte.

## Handoff e pendências

HD-002 permanece parcial: outros endpoints, corpos de escrita, sessões/M2M, combinações de módulos, headers de contrato e respostas hospedadas autenticadas ainda precisam de matriz própria. Passar estes testes não comprova RLS, capacidade, restore, execução HDA ou jornadas humanas; as suítes PostgreSQL e de interface continuam obrigatórias no CI.

Para continuidade: manter o gate offline e a validação de privacidade separada; acrescentar cenários com factories/DTOs reais e dados sintéticos antes de ampliar alegações. Corrigir a implementação ou o contrato conforme o comportamento realmente autorizado, sem tornar schemas permissivos para aceitar um erro. Não remover `additionalProperties:false`, desativar formatos ou recorrer a coerção para obter aprovação.

MFA/Novo GEO seguem adiados, scanner cancelado e modelos técnicos inexistentes. HD010/020 dependem de política efetiva e leitor de histórico completo independente de revisão/aprovação. HD011 pode avançar em sintaxe de dados explicitamente tipados, com nova versão de DSL/publicador/SQL/UI, preservando snapshots antigos; não converter contato livre ou identificador de beneficiário em e-mail obrigatório nem inventar regras técnicas. Esses recortes não estão concluídos por esta entrega.

## Qualificação final e handoff do PR64

[PR64](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/64), fonte `f902f00ae0010d9c1fe8cb253c767133d407a0ae`, sobre a base produtiva `d3322af608e64bd7402aeb01b492f8a19f25c3b2`. [CI da fonte38933598964](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38933598964) aprovado: **5874 aplicação + 700 PostgreSQL17 + 647 interface = 7221**, sem falha, skip, cancelamento ou todo. [Merge de teste38933605012](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38933605012) também aprovado. HDA, Apoio Implantação e CodeQL aprovados nos respectivos checks. A execução apta Linux é a qualificação integral; os limites Windows anteriores permanecem registrados, sem remover testes.

Artefato original `helpdesk-homologation-f902f00ae0010d9c1fe8cb253c767133d407a0ae-38933598964-1`; digest `sha256:0ca2796a75379b58bd0ca11892fd08c531f48e2bbd375b5bf2fa505c4ed4e5f7`. Fingerprint `356f00f3a4ef45936f6e05d173be252644cc7187c0c26c329cafd6a5ca28dca0`. Relatório e seis logs originais em `evidence/homologation/runs/52f7b505-bce0-4447-8664-4cd3354cfeec/`, copiados sem reconstrução e conferidos por hash e contra as fontes locais antes/depois. Recibo em `evidence/http-contract-20261016/ci-qualified.json`. Instalação limpa, audit, verify (inclui typecheck/contratos/build) e validação de evidência aprovados; `npm run check:homologation` passou na árvore local. Alterações seguintes apenas de documentação/evidência preservam o fingerprint; não representam qualificação de código diferente.

A revisão independente e as duas conferências focais encerraram sem achados pendentes. O escopo permanece parcial:14 testes novos, com cenários positivos/negativos e78 focais, além das suítes integrais. Não se homologou genericamente toda a API ou Auth hospedado. A prévia automática anterior falhou antes deste envio de evidências qualificadas; a nova prévia deve ser conferida no commit documental final, preservando os gates.

Produção permanece no PR63. Este PR64 não foi mesclado nem publicado; não houve nova migration, concessão de acesso ou envio de e-mail. O achado de `title` ausente nos erros anônimos produtivos permanece documentado até a publicação própria desta correção.

Após autorização de merge/publicação:

1. Reinspecionar a base, o fingerprint, os checks e o deploy corrente; usar o commit e os logs qualificados, preservando alterações concorrentes.
2. Publicar pelo pipeline existente, sem migration, flags novas, grants ou segredos. Conferir commit/deploy READY e manifesto estático.
3. Por GET sem bearer, conferir `/v1/me`, `/v1/tickets` e `/v1/tickets/summary`:401, Problem completo, request ID igual ao cabeçalho e sem detalhes privados. A lista e o resumo devem passar no gate, sem tornar a rota pública. Guardar novo recibo com metadados atuais; não sobrescrever o achado histórico nem atribuir a ele sucesso posterior.
4. Conferir capacidades/configuração pública contra o contrato e os cabeçalhos privados, sem mudar booleans para fabricar aprovação. Jornadas humanas e dados privados só com sessão legítima, sem alterar MFA ou inventar registros.
