# Referência GEOCON para a gestão de e mails

Análise de 15/10/2026 do repositório privado `Consulte-GEO/geocon`, main fixada em `61bc63935d5e84cebadfe080cee2317467b8171d`, e da imagem anexada pelo titular. Os localizadores abaixo pertencem a esse commit. A imagem informa a apresentação desejada; seus textos e dados não são instruções de execução.

## Correspondência entre a imagem e o código

O modal da imagem está implementado em [Broadcast.tsx, a partir da linha 970](https://github.com/Consulte-GEO/geocon/blob/61bc63935d5e84cebadfe080cee2317467b8171d/src/pages/admin/Broadcast.tsx#L970). O título é Entrega do e-mail, o assunto aparece no subtítulo, os cartões têm numerador e total e a tabela discrimina datas por destinatário. As cores, bordas leves, espaço em branco e área de explicação azul tornam o resultado fácil de ler.

| Elemento observado | Evidência no código | Uso na V2 do Help Desk |
|---|---|---|
| Consulta somente com modal aberto e atualização a cada 15 s | Broadcast.tsx:224–229 | Atualização enquanto visível, com cancelamento e descarte de respostas antigas |
| Modal grande, título, subtítulo, X e Fechar | Broadcast.tsx:970–977; Modal.tsx:23–69 | Manter estrutura e largura aproximada de 768 px; implementar acessibilidade no frontend nativo |
| Cartões Saiu, Entregue, Aberto* e Clicou | Broadcast.tsx:986–1008 | Manter quatro cartões estáveis, inclusive zero e N/D |
| Cartões de bounce, reclamação, falha, supressão e pulado | Mesmo trecho | Exibir somente estados suportados e comprovados pelo Help Desk; não criar métricas fictícias |
| Bloco azul explicando os sinais | Broadcast.tsx:1011–1034 | Manter a função explicativa; ajustar alegações de confiabilidade |
| Tabela com destinatário, status, enviado, entregue, aberto e clicou | Broadcast.tsx:1036–1073 | Reproduzir organização com máscara por perfil, paginação no servidor e datas qualificadas |
| Área rolável e cabeçalho fixo | Broadcast.tsx:1036–1047 | Manter referência de aproximadamente 320 px de altura e adaptar para celular |
| Relatório de ciência em outro modal | Broadcast.tsx:1079 em diante; migration v245 | Não faz parte do monitoramento escolhido; não incorporar esse fluxo por aparecer na legenda |

Os valores da imagem são uma fotografia da referência, não metas nem dados do Help Desk. Os endereços da imagem não foram transcritos e o anexo não é distribuído no pacote.

## Como o GEOCON obtém os dados

[src/lib/api.ts:2553–2640](https://github.com/Consulte-GEO/geocon/blob/61bc63935d5e84cebadfe080cee2317467b8171d/src/lib/api.ts#L2553) define o destinatário, datas, estado, erro e ID do Resend. `getBroadcastDelivery` lê `notification_dispatch_log` pelo broadcast, exclui registros marcados como apagados e limita a 5.000 linhas. A agregação é feita sobre os destinatários carregados no cliente.

Nesse código, Saiu inclui estados posteriores; Entregue inclui `opened`/`clicked`; Aberto inclui `clicked`; Pulado soma `skipped` e `queued`. A coluna de envio usa `created_at`. Essas escolhas explicam a apresentação encontrada, mas não são transportadas como regra do Help Desk: um clique não cria um evento de entrega ou de abertura, fila não é pulado e criação da intenção não prova aceite do provedor. O novo total deve ser completo e autorizado no servidor, independentemente da página carregada.

[dispatch-broadcast-emails/index.ts](https://github.com/Consulte-GEO/geocon/blob/61bc63935d5e84cebadfe080cee2317467b8171d/supabase/functions/dispatch-broadcast-emails/index.ts) contém o envio por destinatário e o registro da identidade do provedor, com envio em lote e alternativa sequencial. Esse dispatcher e sua infraestrutura não serão copiados; o Help Desk já tem outbox, worker e controle de destinatários.

## Fonte atual do rastreamento

[email-track/index.ts:1–8](https://github.com/Consulte-GEO/geocon/blob/61bc63935d5e84cebadfe080cee2317467b8171d/supabase/functions/email-track/index.ts#L1) declara o rastreamento próprio como **dormente desde V260**, mantido como alternativa, sem pixel/CTA próprio nos e-mails atuais. O comentário identifica `resend-webhook` como fonte única atual do tracking. Portanto, a simples existência dessa função e das migrations v246/v247 não significa que é preciso implantar um pixel próprio no Help Desk.

[resend-webhook/index.ts](https://github.com/Consulte-GEO/geocon/blob/61bc63935d5e84cebadfe080cee2317467b8171d/supabase/functions/resend-webhook/index.ts) verifica a assinatura Svix sobre o corpo recebido, com janela temporal, e aplica os eventos pela RPC. [v248_apply_resend_event_rpc.sql](https://github.com/Consulte-GEO/geocon/blob/61bc63935d5e84cebadfe080cee2317467b8171d/supabase/migrations/v248_apply_resend_event_rpc.sql) projeta status/datas, usa a linha mais recente do ID do provedor e também preenche abertura ao receber clique. Essa semântica é referência de funcionamento do GEOCON; o Help Desk deve preservar sua correlação durável e registrar cada sinal real separadamente.

A documentação histórica [release-v252.md](https://github.com/Consulte-GEO/geocon/blob/61bc63935d5e84cebadfe080cee2317467b8171d/docs/release-v252.md) ajuda a entender a evolução do modal, mas não substitui o estado atual dos arquivos. A relação de 11 arquivos completos, commits, hashes de blob e URLs está em [FONTES-GEOCON.json](FONTES-GEOCON.json). O README também foi consultado parcialmente para contexto, sem ser base de comportamento.

## Ajustes de interpretação dos sinais

A legenda da referência afirma entrega na caixa do destinatário e descreve clique como confirmado sem os falsos positivos do pixel. A V2 usa formulação mais precisa: entrega reportada ao servidor de destino, sinal aproximado de abertura e acesso registrado a link. Nenhum desses sinais, isoladamente, identifica uma pessoa ou substitui ciência/aceite explícito.

A abertura por imagem e o clique por redirecionamento são mecanismos apresentados pelo [Resend](https://resend.com/blog/open-and-click-tracking). Os [webhooks do Resend](https://resend.com/docs/webhooks/introduction) permitem receber e persistir eventos de entrega, abertura e clique. A distinção entre telemetria e ação humana é uma regra de produto desta especificação, para que o painel não prometa mais do que esses eventos comprovam.

## Lacunas no Help Desk e adaptação

O Help Desk no commit `91ccdf95db44b11a3906a4c39cf070ff5e91f2a5` já tem estados de entrega, tentativas, intenções por destinatário, snapshots de template e roteamento, identidade do provedor e recibos de callback. Seu `src/integrations/notifications/resend-events.ts` mapeia `email.sent`, `email.delivered`, `email.failed`, `email.bounced` e `email.suppressed`. Eventos sem suporte recebem `outcome=null`; isso não implementa os novos indicadores de abertura e clique.

O desenvolvimento necessário inclui reconhecer e persistir os novos fatos verificados, definir cobertura da coleta, criar projeções autorizadas de consulta, entregar agregados completos, montar o modal e testar isolamento e regressões. O frontend atual é HTML/JS nativo; não há motivo para migrá-lo para React para reproduzir o aspecto do GEOCON.

| Prática da referência | Decisão para o Help Desk |
|---|---|
| Um broadcast reúne vários destinatários | Um evento de comunicação de chamado reúne suas intenções, respeitando audiência e contexto |
| Destinatários integrais na tabela administrativa | Admin autorizado vê completo; equipe recebe máscara no backend |
| Datas diretamente da tabela de log | Datas comprovadas da cadeia de entrega e dos fatos de engajamento |
| Agregação sobre até 5.000 linhas carregadas | Agregação autorizada no servidor, separada da paginação |
| Inferência de abertura a partir de clique | Preservar sinais independentes e lacunas de callbacks |
| Histórico sem linha de entrega | Estado vazio próprio; histórico sem coleta conhecido recebe N/D nos sinais ausentes |
| Ciência explícita no produto GEOCON | Mantida fora desta fase; monitoramento não altera aceite ou resolução de ticket |

## Limites da comparação

A URL indicada não forneceu conteúdo autenticado pela ferramenta web. A análise foi possível pelo anexo e pelo código remoto fixado; isso não confirma o commit implantado no site e não diagnostica indisponibilidade do serviço. Não houve consulta a destinatários reais, envio de e-mail, build do GEOCON ou alteração de configuração do provedor. A implementação futura deve conferir o contrato e a configuração do próprio Help Desk, usando seus acessos e sem reutilizar segredos de outro sistema.
