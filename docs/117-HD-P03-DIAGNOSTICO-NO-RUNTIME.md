# HD-P03 — diagnóstico privado dentro do runtime publicado

Continuidade de 06/10/2026, base `11dba29`. HD-P01/02 já integrados; não repetir a correção de abertura nem o PR4. O destino continua sendo o site `helpdesk-consultegeo` e o projeto HelpDesk `xaelbntjnvztznnpcvtm`.

## Problema e implementação

As cinco variáveis de backend do site estão no escopo Functions/production. A URL de banco e HMAC são segredos write-only: a API/CLI não retorna seus valores originais. Logo, o preflight local existente não consegue comprovar essa configuração. Não exportar credenciais, trocar senhas, ampliar escopos ou inventar aprovação para contornar esse limite.

A Function `netlify/functions/runtime-preflight.mts` executa **o mesmo** `runRuntimePreflight(...,{connect:true})` no servidor que já recebe essas variáveis. Não introduz outro framework de aceite. O probe existente valida configuração, driver, conexão/TLS, transação READ ONLY, papel restrito, versão do schema, segurança do banco, rollback e cleanup. Não executa DDL ou operação de negócio.

É uma Scheduled Function, sem `path` HTTP e sem leitura de body/headers. Pode ser acionada pelo controle autenticado **Run now** no painel Netlify; não possui URL pública de diagnóstico. O cron `0 0 1 * *` executa um probe limitado no primeiro dia de cada mês, 00:00 UTC (21:00 do dia anterior em São Paulo). Não é worker de entrega, limpeza ou clock de SLA.

O wrapper `src/infrastructure/hosted-preflight.ts` lê configuração somente durante invocação, projeta campos/códigos permitidos e registra um relatório JSON sanitizado nos logs privados. Falha de configuração/transport/log não expõe exceções ou valores. Checks incompletos, duplicados ou falhos não anunciam sucesso. `production_approved:false`, `operational:false`, `auth_tested:false` e zero operações de negócio permanecem explícitos. O gate HTTP não é alterado.

Documentação oficial: [Secrets Controller](https://docs.netlify.com/build/environment-variables/secrets-controller/), [Scheduled Functions e Run now](https://docs.netlify.com/build/functions/scheduled-functions/).

## Validação local e revisão

Sete regressões novas cobrem execução lazy, delegação/connect, gate fechado, exceções, projeção, checks inválidos e configuração sem rota pública. O teste de checks inconsistentes foi observado falhar antes da correção e passar depois. Seleção com runtime/config existentes: **52/52**, zero falhas/skips.

Typecheck, contratos (18 operações), onze migrations, lock, build e secrets aprovados. Suite Windows com rede local disponível: **1.457 testes, 1.434 aprovados, mesmas 23 falhas anteriores**, nomes comparados integralmente. A primeira execução restrita teve 66 falhas, incluindo HTTP local bloqueado; não confundir esse resultado com regressão validada. CI Linux completo ainda deve produzir evidência nova para esta fonte, sem reduzir gates.

Revisão por agente separado: nenhum achado acionável. Nenhuma migration, grant, conta, credencial, ticket, cobertura ou variável remota foi alterada nesta implementação.

## Aceite no servidor

1. Aprovar CI do SHA e instalar o conjunto exato gerado no gate de build.
2. Integrar/publicar no site existente e conferir que `runtime-preflight` é scheduled e `api` mantém `/v1/*`.
3. Acionar **Run now** no painel Functions; consultar o JSON `helpdesk.runtime-preflight` nos logs privados e registrar checks/códigos sanitizados, deploy e horário.
4. Confirmar que GET público do diagnóstico não executa a Function e que o gate de atendimento permanece fechado.
5. Tratar a causa de um check falho; probe aprovado não conclui Auth humano, M2M, efeitos, recuperação ou HD-P03/04.

Resultado hospedado será acrescentado após execução real. A existência deste arquivo ou da Function não é prova de conexão nem conclusão de M1.
