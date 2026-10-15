# Implantação do monitor V2 — 15/10/2026

O titular autorizou expressamente o merge do PR52, a implantação produtiva, a migração e a validação de aberturas/cliques. Posteriormente autorizou o uso restrito da chave Resend e do segredo de webhook existentes, sem exibir/gravar valores, e um e-mail técnico para thiago@consultegeo.com.br. Isso não autoriza alterar configurações compartilhadas de outros produtos, ampliar permissões ou inventar fatos históricos.

## Publicação e banco

- PR52 integrado em `0181e53a5808864a5e4e607f50c26bebf2ad9a22`, às18:58:25Z. Gates do HEAD2db932c aprovados:5739 aplicação,697 PostgreSQL17 e632 interface; HDA e CodeQL aprovados.
- Netlify HelpDesk `9781cd85-7dc1-4ef5-868b-947e389a9d4d`: deploy inicial `6ad122533fd9ab551d2f6168`, production/ready, publicado às18:59:21.523Z. Código compatível com26 foi publicado antes de migrar o banco.
- Supabase HelpDesk `xaelbntjnvztznnpcvtm`: aplicada somente a migration oficial21 `20261015162000_email_monitor_v2.sql`, SHA256 `5028c17914469cfc524665963e637755e78e127dab572542d81e734efa136e0c`. Registro remoto `20261015190027_email_monitor_v2`; schema0.27,88 tabelas/233 funções/516 constraints. Prefixo20 preservado e guards anterior/final aprovados pela execução transacional.
- As duas tabelas novas têm ENABLE/FORCE RLS e ACL exclusiva do owner, sem grants de app/worker/clientes. Marcador de armazenamento HDA mantém1.0.0. Onze intenções existentes preservadas, sem criação ou edição de chamados.
- Scheduler real após promoção, às19:02Z: notification-worker, registration-worker e wiki-notification-worker responderam204. Essa execução ociosa comprova admissão, não envio de negócio nem coleta de engajamento.

## Requalificação e limites da coleta

A instância da API inicializada antes da migração reteve a qualificação26 e devolveu `email_monitoring:false`. A republicação documental ba58089/deploy6ad125ffcb5047ded54bbef3 preservou esse resultado inclusive no permalink, pois o bundle da Function não mudou. O handler tem inicialização compartilhada por instância; republicar arquivos estáticos/documentação não garante reinicialização da Function deduplicada.

Foi configurada, pelo conector oficial Netlify, a revisão não secreta `HELPDESK_EMAIL_MONITOR_DEPLOYMENT_REVISION=20261015-schema27`, somente Production/Functions. Ela não é uma flag de permissão ou de ativação, não é lida pelo código e não substitui os guards: sua função operacional é produzir uma nova revisão de ambiente da Function após a migração, para que a inicialização existente qualifique o banco27. Publicar a nova revisão e conferir o resultado público antes de declarar o monitor disponível. Não retirar o gate nem modificar catálogo/permissões para contornar esse estado. A configuração pública omite `operational` quando ativa; `operational:false` é o fechamento explícito.

O Netlify devolve valores secretos mascarados pela API de gerenciamento: não foi possível obter valores utilizáveis para a validação Resend, mesmo após a autorização restrita. O retorno400 obtido ao testar o valor de gerenciamento não comprova credencial inválida no runtime; não substituir/rotacionar segredos por essa evidência. A revisão automática recusou a extração direta de token local para republicação; usar o Git CD/CLI oficial. O navegador integrado também não conectou. Foi solicitada ao titular a abertura de uma aba Resend autenticada no Chrome ou participação direta no painel.

`opened_started_at` e `clicked_started_at` permanecem nulos até comprovação real de cada sinal. Não retroagir, não associar mensagem técnica a chamado por assunto/endereço/tags e não fabricar callback assinado. Os122 recibos anteriores à promoção têm event_type nulo, preservados como legado. Não representam evidência de abertura/clique.

## Requalificação confirmada

Commit documental178dfb5, deploy6ad12713c5e78c984f9a21b1, production/ready, publicado às19:19:31.018Z com a revisão de ambiente acima. A API passou a informar `email_monitoring:true`, preservando o atendimento ativo. O smoke HTTPS conferiu os91 arquivos estáticos por SHA256 e13 verificações de configuração/capabilities, endpoints privados anônimos401, workers públicos403, webhook sem assinatura401, headers, deep link e Wiki. Recibo em `evidence/email-monitor-production-20261015/publication.json`.

Os três workers responderam204 pelo scheduler também às19:20/19:21Z. Não houve mudança de fonte executável: `npm run check:homologation` permanece aprovado para SHA256377fa67122d2c79bdbd609f541f57202e1eb2f45c8492c2f5a575a71e483f253. Os novos commits tratam documentação/evidência.

Foi identificada uma alternativa à configuração por credenciais: a notificação já recebida por Thiago, `[CG-10002] Nova mensagem do solicitante`, contém recursos nativos de rastreamento existentes. Em19:24:51–52Z, GET técnico controlado no pixel devolveu200/image-gif e no link devolveu302 exatamente para a página de leitura do chamado. Nenhuma mensagem nova ou alteração de chamado foi feita e nenhuma configuração compartilhada de GEOCON/GEOLAB foi modificada. Isso só comprova resposta dos recursos: o callback assinado e a associação persistida exigem evidência separada. A consulta técnica é automatizada; não deve ser descrita como leitura humana. O conector Gmail já entrega `body.content` decodificado: não reaplicar quoted-printable com base apenas no header original. Uma primeira tentativa auxiliar com dupla decodificação recebeu400 e não é evidência de coleta.

Também foi usado um segundo e-mail já recebido por Thiago e ainda marcado UNREAD, `[CG-10001] Solicitação recebida`, para reduzir a incerteza de deduplicação de uma leitura anterior. Somente pixel e redirecionamento de leitura foram consultados às19:27:43Z;200/image-gif e302. Não houve acesso de escrita ao chamado nem marcação de leitura no Gmail pelo conector. Os GETs técnicos não são leitura humana.

Até a leitura19:28:26Z, nenhum recibo com event_type havia sido persistido. A consulta de observabilidade de19:24:40–19:28:26 não encontrou requisições à Function resend-webhook. Portanto os GETs válidos **não qualificam a coleta** nem justificam preencher as datas de início. O próximo passo depende de conferir no painel Resend a integração exata `https://helpdesk.consultegeo.org/integrations/resend/events`, a assinatura de `email.opened`/`email.clicked` e suas tentativas reais, preservando URL, segredo e eventos existentes. Não alterar o domínio compartilhado: os recursos nativos já respondem e não há evidência que justifique mudar sua configuração.

A permissão para usar segredos existentes foi concedida, mas a API Netlify não devolve seus valores utilizáveis e o navegador integrado não conectou. Foi solicitada abertura/autorização de aba Resend autenticada no Chrome; essa ação do titular permanece pendente. Não criar chave nova, ampliar acesso ou adicionar endpoint de diagnóstico que exponha segredos. A validação autenticada da tela e a coleta de eventos reais não foram concluídas.

Atualizar este checkpoint com os callbacks comprovados e eventual início da cobertura. Testes sintéticos/CI não substituem esses registros. Não repetir seeds, bootstrap ou migration19; não alterar CG-10001/CG-10002, MFA ou adiamentos de novos clientes.
