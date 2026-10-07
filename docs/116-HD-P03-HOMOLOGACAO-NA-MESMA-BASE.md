# HD-P03 — Homologação na mesma base do Help Desk

Decisão expressa do usuário em 06/10/2026, America/Sao_Paulo: não haverá ambiente separado de homologação. Este registro substitui as exigências anteriores de site, projeto Supabase ou branch de banco isolados para o aceite hospedado.

## Destino definido

| Recurso | Destino |
|---|---|
| Site Netlify | helpdesk-consultegeo |
| ID do site | 9781cd85-7dc1-4ef5-868b-947e389a9d4d |
| Projeto Supabase | HelpDesk |
| ID da base/Auth | xaelbntjnvztznnpcvtm |
| URL Auth | https://xaelbntjnvztznnpcvtm.supabase.co |
| Branch de banco separada | Não será criada |

A homologação usa o site e a base existentes, com cenários identificáveis e vínculos próprios de teste. Workspaces/contas diferentes são dados necessários para provar isolamento do produto dentro da mesma base; não constituem outro ambiente. `environment: "homologation"` nas fixtures identifica a finalidade da execução, não um projeto adicional.

Os clientes existentes já aceitam `helpdesk-consultegeo` com permalink de deploy explícito; não exigem backend separado. Continuar usando `test:hosted:read`, `test:hosted:auth` e `test:hosted:write`, sem outro framework. Exemplos com nomes de site alternativos pertencem aos testes de validação do destino; não são infraestrutura a provisionar.

## Execução

1. Vincular o código exato ao CI Linux e ao permalink que será testado. O PR de continuidade é [PR4](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/4), inicialmente em rascunho, HEAD `5129a87345b37952e2fd613b9ebd0b9048221889`.
2. Conferir configuração de runtime/TLS/papel restrito no projeto atual. A decisão de usar uma base única não concede privilégios de request nem altera RLS/scopes.
3. Preparar pessoas, contas, produtos/coberturas e credenciais de teste nessa base, com identificadores reais e registros marcados. Senhas/tokens ficam fora do Git e dos relatórios.
4. Executar os três clientes em modo plano com esses identificadores; depois read, Auth/sessões e write, mantendo as confirmações de origem/configuração e os resultados por cenário.
5. Ajustar a configuração necessária para testar a Function na base atual pelo processo registrado de preflight/publicação. Abrir o caminho de teste não equivale a declarar M1 operacional concluído.
6. Correlacionar efeitos/recibos/outbox, negativas, revogação, replay e navegador real. Preservar resultados desconhecidos; não repetir mutações com outra chave.

Os runners de CI com banco descartável verificam migrations fresh/upgrade e cenários destrutivos automaticamente. São ferramentas de teste locais/CI, não um ambiente hospedado permanente. Restore/recriação destrutiva não devem apagar a base atual nem dados existentes; os ensaios operacionais devem preservar o serviço e os dados dessa base.

## Estado de execução desta continuidade

Site e projeto conferidos nos conectores; nenhuma branch Supabase existente. A ausência de ambiente separado não é bloqueio e não deverá ser solicitada novamente.

Três clientes executados em modo plano com templates: read28, Auth12 e write43 verificações planejadas, `transport: none`, sem aprovação hospedada. Esses IDs de exemplo ainda não provam fixtures reais ou execução pela Function.

Consulta agregada da base atual: um workspace/uma pessoa humana; zero contas, coberturas, conexões e tickets. Fixtures reais precisam ser cadastradas nessa mesma base; nenhuma conta existente foi alterada nessa consulta.

CI Linux [37554188619](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37554188619), PR4/HEAD5129a87/merge de teste2480c426: aplicação1447/1447 e PostgreSQL215/215 aprovados; interface falhou no cenário antigo de indisponibilidade de notas (`browser-smoke.py:63`, botão notes-retry invisível). O teste iniciava leituras sucessivas e mudava o comportamento de rede sem esperar o refresh terminar. A correção aguarda término das leituras antes de trocar a rota, preservando todas as asserções. Nova execução CI exigida, sem somar aprovações entre runs.

Artefato do run falho11453799151: SHA256 `e2689ac290bf371c28947699c3e63d6576d84640ebdc9233ddf4878ff360f972`, conferido no download. O resultado não foi alterado nem promovido a aprovado.

A correção de sincronização passou nas79 verificações de interface locais, preservando os quatro artefatos históricos. Os14 testes focais passaram com transporte loopback habilitado; uma tentativa no sandbox registrou três `fetch failed` por restrição de rede e não foi contada como aprovação. Typecheck, contratos, migrations e lock foram conferidos. [Log próprio da interface](../evidence/hd-p03/interface-synchronized.txt).

## CI Linux final aprovado

[Run 37558111964](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37558111964), tentativa 1, HEAD do PR `7481b0a19ef8ccedac363312604733fe40eb9e5b`; commit de teste de merge `798484f1516f9e4bc14c683fd6a594a968f5df91`. Instalação/lock/audit e gates aprovados: **1.447 aplicação, 215 PostgreSQL e 79 interface**, sem falhas/cancelamentos/skips/TODO. Este run substitui o resultado falho para o novo código, preservando o registro anterior.

Artefato `11455598986`, SHA256 `20985a1b48ebeb43adef257194e042f5a312fd323efc23618bc1fe9f050c9b73`. ZIP, fingerprint `3941d1685cc71858852df2458191ace9c984d2691e8f30588f722a3725da1bf3` e hashes dos seis logs conferidos pelo verificador existente. Evidência mantida em [ci-linux](../evidence/hd-p03/ci-linux/homologation/latest.json); `platform_approved: false`. PR4 pronto para revisão.

## Runtime do site atual

Metadados consultados somente para helpdesk-consultegeo: URL do Supabase coincide com xaelbntjnvztznnpcvtm; variáveis de banco, CA, chave publicável e HMAC cadastradas no contexto production. A API oculta os valores das variáveis secretas; uma tentativa de validar essa representação retornou invalid_configuration antes de qualquer conexão. Isso não é diagnóstico de configuração efetiva inválida: o preflight com os valores reais permanece **não executado**, `secret_value_not_available`, zero operações de negócio. Nenhum segredo foi escrito no relatório e nenhuma variável remota foi modificada.

Pendência concreta para executar read/Auth/write: cadastrar as contas/coberturas/conexões e identidades de teste na base atual, disponibilizar credenciais em canal privado e executar o preflight com os valores reais no runtime. A API publicada permanece com gate fechado até a configuração de teste apropriada nesse mesmo site. Não solicitar outro ambiente como pré-requisito.

## Preparação da integração e publicação

Na continuação, a reinspeção confirmou PR4 aberto, base `b4dd000` e ausência de alteração concorrente. Os checks de qualidade/CodeQL passaram; os checks Netlify falharam porque o gate canônico ainda apontava para a evidência histórica. `npm run check:homologation` reproduziu a recusa localmente.

O conjunto exato do run37558111964 foi copiado para `evidence/homologation`, incluindo os seis logs e os relatórios, preservando os bytes e o arquivo histórico em HD-P03. O verificador existente conferiu fingerprint e hashes antes e depois da cópia; `check:homologation` passou. Nenhum teste foi dispensado, gate removido ou aceite hospedado concedido. A integração/publicação ainda precisa ter seu SHA e resultado registrados após execução.
