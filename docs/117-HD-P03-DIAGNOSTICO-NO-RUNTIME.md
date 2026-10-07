# HD-P03 — diagnóstico privado dentro do runtime publicado

Continuidade de 06/10/2026, base `11dba29`. HD-P01/02 já integrados; não repetir a correção de abertura nem o PR4. O destino continua sendo o site `helpdesk-consultegeo` e o projeto HelpDesk `xaelbntjnvztznnpcvtm`.

## Problema e implementação

As cinco variáveis de backend do site estão no escopo Functions/production. A URL de banco e HMAC são segredos write-only: a API/CLI não retorna seus valores originais. Logo, o preflight local existente não consegue comprovar essa configuração. Não exportar credenciais, trocar senhas, ampliar escopos ou inventar aprovação para contornar esse limite.

A Function `netlify/functions/runtime-preflight.mts` executa **o mesmo** `runRuntimePreflight(...,{connect:true})` no servidor que já recebe essas variáveis. Não introduz outro framework de aceite. O probe existente valida configuração, driver, conexão/TLS, transação READ ONLY, papel restrito, versão do schema, segurança do banco, rollback e cleanup. Não executa DDL ou operação de negócio.

É uma Function de evento, sem `path` HTTP e sem leitura de body/headers. O handler tipado `deploySucceeded` aciona o probe após uma publicação de produção no site existente; verifica o ID do site nos dois campos e o contexto antes de ler qualquer variável. Preview, outro site ou evento incompleto não executam o diagnóstico. Não há cron nem URL pública de diagnóstico, worker de entrega, limpeza ou clock de SLA.

O wrapper `src/infrastructure/hosted-preflight.ts` lê configuração somente durante invocação, projeta campos/códigos permitidos e registra um relatório JSON sanitizado nos logs privados. Falha de configuração/transport/log não expõe exceções ou valores. Checks incompletos, duplicados ou falhos não anunciam sucesso. `production_approved:false`, `operational:false`, `auth_tested:false` e zero operações de negócio permanecem explícitos. O gate HTTP não é alterado.

Documentação oficial: [Secrets Controller](https://docs.netlify.com/build/environment-variables/secrets-controller/), [gatilhos tipados por evento](https://docs.netlify.com/build/functions/trigger-on-events/). Os tipos de evento existem na dependência fixada `@netlify/functions` 6.0.0; nenhuma atualização de pacote necessária.

## Validação local e revisão

Oito regressões novas cobrem execução lazy, delegação/connect, gate fechado, exceções, projeção, checks inválidos, handler de evento e bloqueio de preview/site/evento inválido. Checks inconsistentes e mudança para evento foram observados falhar antes da implementação e passar depois. Seleção final com runtime/config existentes: **53/53**, zero falhas/skips.

Typecheck, contratos (18 operações), onze migrations, lock, build e secrets aprovados. Suite Windows da primeira versão, com rede local disponível: **1.457 testes, 1.434 aprovados, mesmas 23 falhas anteriores**, nomes comparados integralmente. A primeira execução restrita teve 66 falhas, incluindo HTTP local bloqueado; não confundir esse resultado com regressão validada. A composição final por evento acrescenta um teste e exige evidência nova de CI, sem reduzir gates.

Revisão por agente separado: nenhum achado acionável. Nenhuma migration, grant, conta, credencial, ticket, cobertura ou variável remota foi alterada nesta implementação.

## Aceite no servidor

1. Aprovar CI do SHA e instalar o conjunto exato gerado no gate de build.
2. Integrar/publicar no site existente e conferir que `runtime-preflight` é acionada por evento e `api` mantém `/v1/*`.
3. Após publicação, consultar o JSON `helpdesk.runtime-preflight` nos logs privados e registrar checks/códigos sanitizados, deploy e horário.
4. Confirmar que GET público do diagnóstico não executa a Function e que o gate de atendimento permanece fechado.
5. Tratar a causa de um check falho; probe aprovado não conclui Auth humano, M2M, efeitos, recuperação ou HD-P03/04.

Resultado hospedado será acrescentado após execução real. A existência deste arquivo ou da Function não é prova de conexão nem conclusão de M1.

## CI aprovado da versão intermediária

[Run37562342502](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37562342502), tentativa1, merge de teste `be9c13f9dc6f37ed9321de5d43fbd44392002a35` do HEAD `a020ed32ba0c4a87998da0e5a73a68b76051ff7b`: **1.457/1.457 aplicação, 215/215 PostgreSQL, 79/79 interface**, zero falhas/skips. Lock/install/audit e validação do conjunto aprovados.

Artefato `11456584212`, ZIP SHA256 `d8f0e7e8fd184848ae281867ef52d25c7fc41e36b6cb1ea636effc6e0548bb29`; fingerprint executável `af3fabc578091b4b88ad659a3820ca8c7c15ed8806326cbe8e88517484a39af3`. Origem/run/attempt, fingerprint e seis hashes de logs verificados. Conjunto exato preservado em `evidence/hd-p03/runtime-ci` e no gate canônico; `platform_approved:false` permanece. O primeiro Deploy Preview falhou pelo conjunto antigo incompatível com a fonte nova, comportamento correto do gate; não reduzir critérios para publicar.

Essa versão usava schedule mensal e Run now. O controle de navegador do painel não ficou acessível; antes de integrar, substituiu-se a agenda por evento de publicação, reutilizando o mesmo probe. Assim o aceite não depende de acesso manual ao painel e não cria rotina periódica nova. A evidência intermediária é histórica; não aprova o fingerprint final.
