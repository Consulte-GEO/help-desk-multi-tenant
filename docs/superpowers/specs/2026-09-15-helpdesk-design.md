# HelpDesk independente — especificação de fundação v0.1.0

## Origem e autorização
Pedido do usuário: consolidar o chat Análise de Helpdesk, os dois relatórios anexos, a arquitetura e o plano e iniciar o desenvolvimento. Os relatórios são propostas; não equivalem a código já existente. O histórico recuperável confirma a necessidade de comunicação cliente–laboratório/empresa e de reutilização em qualquer sistema. Não foi recuperada a íntegra de todas as mensagens do chat anterior.

## Decisão
Monólito modular TypeScript com transporte HTTP separado do domínio, frontend no Netlify, PostgreSQL exclusivo no Supabase xaelbntjnvztznnpcvtm. Workspace representa o prestador/operação de suporte; conta representa o cliente atendido; contrato define cobertura comercial versionada. Laboratório pode ser workspace quando presta atendimento a seus próprios clientes, ou conta quando recebe suporte da Consulte GEO. Papéis são contextuais; um workspace não herda direitos sobre outro.

## Escopo da primeira entrega
Núcleo executável: resolução de coberturas (única, ambígua, inexistente), autorização de recursos, tickets, respostas públicas, notas internas separadas, transições, idempotência, concorrência otimista, snapshot contratual, evento de outbox atômico. Adaptadores de memória exclusivamente para testes/demonstração e PostgreSQL para produção. API HTTP /v1, contrato OpenAPI, interface inicial, migrations, testes e CI. Autenticação humana validada no Supabase e integração por credenciais próprias; não usar service_role.

## Fora da ativação desta entrega
Não publicar Netlify, não executar migrations remotas, não alterar MFA/segredos, não alterar o GeoLab nem bancos legados. Não ativar envio de e-mail/webhooks, upload de arquivos, IA ou calendário contratual real sem homologação. Motor puro de calendário pode ser entregue testado, sem declarar SLA operacional completo. Banco/Storage, MFA administrativo, RPO/RTO, retenção e residência são gates de produção.

## Fronteiras
Schema helpdesk_core para domínio; helpdesk_auth para memberships/credenciais; helpdesk_integration para idempotência e outbox; helpdesk_audit para trilha. Schemas não expostos na Data API. Login PostgreSQL dedicado helpdesk_app, sem BYPASSRLS, superuser ou propriedade de tabelas. Contexto request apenas por SET LOCAL dentro da transação. Helpers SECURITY DEFINER limitados, nomes qualificados, search_path vazio e EXECUTE restrito.

## Critérios
Duas operações de suporte, duas contas no mesmo workspace, dois produtos diferentes. Não basta negar acesso entre workspaces: conta A também não lê B. Integrações não acessam notas internas. Contratos são revalidados ao criar. Idempotência serializada e persistida na mesma transação. If-Match obrigatório em transições. Falha de qualquer escrita desfaz ticket/evento/outbox. Versão publicada de contrato não é editável. Testes de memória não comprovam RLS; testes reais de PostgreSQL são gate separado.
