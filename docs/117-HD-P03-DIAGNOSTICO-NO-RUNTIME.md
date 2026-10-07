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

## CI final do handler por evento

[Run37562949239](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37562949239), tentativa1, merge de teste `9ea3d791a60dcdf8b96c6370f58b282f7399190a`, HEAD `b66a55caf9c371fa46ccc4375ce26683c12b9b30`: **1.458/1.458 aplicação, 215/215 PostgreSQL e 79/79 interface**, zero falhas/skips. Todos os gates e CodeQL aprovados.

Artefato `11458235002`, ZIP SHA256 `529e738df365299c05232335097f47bf7b0d5088955c11bfa1da1874f14a2f70`; fingerprint `2a9aa86e17c92ec3f196a794f0c8ed21c388b6cc58b1ccc285ff75c35f37c249`. Origem, fingerprint e hashes verificados; conjunto integral em `evidence/hd-p03/event-runtime-ci`, inclusive logs preservados byte a byte, e gate canônico atualizado pelo mesmo conjunto. `check:homologation` aprovado. A revisão do handler tipado também não encontrou achados acionáveis. Publicação e resultado privado continuam sendo verificações separadas.

## Publicação e verificação real

[PR5](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/5) integrado em `5a868d56c8651bbdd4ae03cd0c1fe4f7cf8f5a45`. Check final [run37563284230](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37563284230) e Netlify aprovados. Deploys de produção `6ac5b2c00570e40008d33c36` e repetição controlada `6ac5b35ab718b99e8567b291` ready, mesmo código/site/base. Evento `deploy_succeeded` registrado; API continua `/v1/*`. Quatro arquivos públicos conferidos por SHA256 e cabeçalhos CSP/DENY/nosniff preservados.

GET e POST com evento forjado ao diagnóstico negados com **403**, sem credenciais. Public-config continua **503 release_gate_closed**. Os logs privados registraram uma invocação por deploy, porém sem JSON do preflight. Portanto **conexão/TLS/papel real ainda não estão comprovados**. Não atribuir a falta de relatório a senha, banco ou certificado sem evidência.

Para distinguir descarte por binding de ausência de execução, os eventos recusados agora deixam registro sanitizado `helpdesk.runtime-preflight.skipped`, somente três comparações booleanas, `credentials_read:false`, `success:false` e zero operações. Nenhum valor/shape/body de evento ou segredo é registrado. O teste foi observado falhar com zero registros e passar com cinco registros e zero leituras de configuração. Esse ajuste exige novo CI/fingerprint antes de publicar; mantém todas as condições de isolamento.

CI do ajuste de observabilidade: [run37564309366](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37564309366), HEAD `549ef8b5a7b61c01633e8abfb06e59c6b5a1b32a`, **1.458/215/79**, todos aprovados. ZIP do artefato `11458166736` SHA256 `c4d86c20100b2a3ba34144cb9c037176920e2baedcf2ea23c4011ac5bd468cb7`; fingerprint `ae187f7fcaa4b046d06adc9791f363e811ad811d5a549367057c47c73b67711e`. Fonte/run/hashes verificados, cópia integral em `evidence/hd-p03/observation-runtime-ci` e gate canônico; revisão separada sem achados. Logs originais e negativos públicos sanitizados em `evidence/hd-p03/runtime-publication.json` e `runtime-public-denials.json`.

## Resultado real confirmado — 07/10/2026

[PR6](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/6) integrado em `4cf75ae3c4aa690fb4b772331b535fdf5628169e`, todos os checks aprovados ([run37564749073](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37564749073)). Deploy `6ac5b705b4bc5d0008aa04d5` e repetição observada `6ac5b7f030eb733685fe1c47` ready/publicados no mesmo site, mesmo SHA/fingerprint executável. Arquivos e cabeçalhos conferidos; gate continua fechado.

O histórico privado complementou o conteúdo após atraso de disponibilização. Em leitura de 07/10/2026 03:17:23 UTC foi obtido o relatório da execução **03:10:01.780Z–03:10:02.263Z**, requestId `9d2194e0-4945-4090-8c91-01ba97f7e01c`, vinculado ao deploy final. **Todos os dez checks passaram:** configuration, driver, connection, tls, read_only, database_role, schema, database_security, rollback e cleanup. Confirma a conexão real da Function com TLS verificado, identidade restrita e guards de banco, sem abrir atendimento. Evidência sanitizada: [runtime-accepted.json](../evidence/hd-p03/runtime-accepted.json), [runtime-final-deploy.json](../evidence/hd-p03/runtime-final-deploy.json).

A hipótese de descarte por bindings **não se confirmou**; nenhuma condição de isolamento foi removida. Não confundir histórico inicialmente vazio nem stream sem mensagem na janela observada com falha de banco, senha ou execução. O registro de descarte permanece útil para negativas futuras, mas não é o resultado positivo desta execução.

`operational:false`, `auth_tested:false`, `business_operations_dispatched:0`. Contagens de produção reinspecionadas: um workspace, zero contas e zero tickets, como no início. **HD-P03/M1 ainda não encerrados:** faltam identidade humana real, M2M e percurso de atendimento com cadastros efetivos, testes de autorização/efeitos e recuperação/capacidade. Esses aceites não decorrem do probe nem do CI; não solicitar outro ambiente ou credenciais de teste e não inventar cadastros para declarar sucesso.
