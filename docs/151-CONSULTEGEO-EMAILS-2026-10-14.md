# Emails operacionais Consulte GEO — 14/10/2026

Canal Resend, remetente Consulte GEO — Help Desk <helpdesk@consultegeo.org> e origem https://helpdesk.consultegeo.org. O teste técnico autorizado para thiago@consultegeo.com.br foi recebido com SPF/DKIM aprovados. Click tracking permanece habilitado. A operação usa os templates publicados de abertura, devolutiva pública e resolução; notas privadas não são enviadas.

## Conexão exclusiva

O usuário informou o Session pooler `aws-0-ca-central-1.pooler.supabase.com:5432/postgres`. Foi preparado um login exclusivo `helpdesk_notification_worker` com senha independente, sem privilégios administrativos, herança, grants novos ou alteração dos dados de atendimento. O papel executa somente os13 helpers qualificados e não acessa diretamente tabelas de domínio ou Auth.

Na primeira sessão, o TLS entre cliente e pooler passou, mas o PostgreSQL informou backend sem TLS. O runtime recusou a ativação. O ajuste oficial de SSL enforcement estava desativado; foi habilitado pelo CLI autenticado no projeto HelpDesk, sem modificar código, CA ou guards. A leitura do provedor confirmou `currentConfig.database=true` e `appliedSuccessfully=true`.

A sessão nova de19:26:27Z passou em todas as oito verificações do contrato: schema, papel, ACL, helpers, tabelas, clientes, settings e TLS. `session_user=current_user=helpdesk_notification_worker`, PostgreSQL170006, schema0.24.0,67 tabelas e13 helpers. O cliente também confirmou TLSv1.3, CA e hostname verificados. CA SHA `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.

## Publicação

A revisão automática inicialmente recusou salvar a nova DSN com senha no Netlify porque exigiu autorização específica do destino. O usuário respondeu expressamente: “Autorizo salvar essas duas variáveis no Netlify”. A gravação autorizada abrange somente `HELPDESK_NOTIFICATION_DATABASE_URL` e `HELPDESK_NOTIFICATION_DATABASE_CA`, Secret, Production/Functions, projeto helpdesk-consultegeo. As variáveis de API key, remetente, origem e Click tracking existentes são preservadas.

As duas variáveis foram instaladas e verificadas às19:30:49Z como Secret, contexto único Production e scope Functions, no site/team autorizados. Uma nova sessão de19:30:29Z repetiu os oito checks aprovados. A flag `HELPDESK_NOTIFICATION_DELIVERY_ENABLED=true` foi configurada pelo conector Netlify; sua publicação está em conclusão. O worker tem schedule a cada minuto, apenas para o deploy de produção publicado, orçamento25s, pool máximo1 e um evento/entrega por ciclo. A leitura anterior à liberação confirmou oito rotas ativas, três com destinatário solicitante, zero chamados MRV e zero planos/tentativas/recibos de notificação; não foi criado chamado fictício para forçar envio.

O teste técnico recebido não comprova envio pelo outbox. A confirmação de envio de um chamado real será registrada separadamente; resposta accepted do provedor também não representa entrega confirmada. O callback Resend depende de seu segredo nativo e continua etapa própria. Novo GEO permanece adiado.
