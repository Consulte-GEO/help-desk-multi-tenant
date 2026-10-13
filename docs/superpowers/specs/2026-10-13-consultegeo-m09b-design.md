# Consulte GEO M09b Catálogo e abertura persistentes

Continuidade autorizada pelo usuário nesta conversa, com decisões delegadas e execução inline. Base785fa2d8aa6e719763f87c8518939dc80fd91f26, mesmo worktree/PR31. Implementar persistência real do catálogo/rascunho/revisão/abertura; origem real M08 permanece porta de construção do servidor, nunca fallback.

## Jornada e decisões

POST `/v1/consultegeo/request-catalog` recebe somente serviço Consulte GEO e refs seletores. Reautoriza pessoa humana, conta, conexão/tenant/obras e scopes no resolver e PostgreSQL antes de entregar configurações públicas M09a com cobertura. O produto vem da conexão CG e o serviceCode corresponde à família M04 (`user_access`, `questions`, `backup`, `new_work`, `structure_adjustment`, `problem`). Não mapear por nome/e-mail, não criar registros de configuração ou cobertura como seed.

Perfil de abertura fixa formulário/workflow/checklist/calendário/SLA da versão publicada e prioridade da entrada. Não exigir o campo de impacto sintético do ensaio M09a. Catálogo oferece versões publicadas mais recentes por ID; rascunho antigo conserva a versão publicada original. Calendário fora do horizonte/contrato não vigente recusa abertura. As ações que exigem pessoa/evidência recusam sem lookup/Storage qualificado; incluir usuário é a primeira jornada validada. Execução na origem permanece manual.

## Persistência e autoridade

Migration15 pela CLI oficial, schema0.22.0 sobre0.21.0, prefixo14 imutável. Tabelas privadas de drafts, contador por workspace, snapshot fixado e ledger de abertura, ENABLE/FORCE RLS e nenhum acesso direto de app/clientes/publicador/worker. Helpers limitados de app reautorizam registros CG/observação completos e exatos; nenhum GUC ou bool aprovado substitui ACL. Lock de namespace/grant/observação antes de draft/configuração/coverage/contador/ticket; ordenação fixa, locks de identidade/ACL até o COMMIT.

Salvamento CAS com idempotência pelo hash original e revisão; titular/workspace/conta/refs/formulário/versão/expiração não podem mudar. Diretório de draft retorna metadata somente ao titular atualmente autorizado com cobertura completa. Cache e replay exigem autorização atual; não renovar expiry ou contexto por reenvio.

Abertura atômica: ticket core, refs CG completos/sealed, snapshot público/privado, workflow state ligado ao perfil publicado, protocolo CG10001+, evento core/audit/outbox existentes pelo mesmo ID e ledger imutável. A prévia não reserva protocolo nem produz efeito. Contador é monotônico por workspace e protegido contra reset/delete; nova abertura não reutiliza a sequência consumida. SQL recompõe dados autorizados e confirma efeitos em trigger deferido, não confia no bundle enviado pelo app. INSERT genérico protegido continua recusado, sem alterar policies/guards anteriores.

Lojas recebem o cliente emprestado da transação existente. Validação de ACK/shape/hashes é obrigatória e sticky; falha capturada não permite COMMIT. Publicação, identidade e scopes reais são revalidados no SQL. Nenhuma chamada a provider/API externa dentro do commit.

## HTTP e runtime

Registrar catálogo, GET/PUT draft, POST preview/create. Flag `HELPDESK_CONSULTEGEO_INTAKE=false`, exige workflow/origin/source/business; falhas não encaminham a outro handler. Administração separada continua disponível sob seu gate/MFA. Origem HTTPS configurada, limite de corpo/prazo, autenticação/quotas e admissão sticky ao longo das esperas atéCOMMIT. COMMIT confirmado conserva recibo; perdido exige mesma intenção. Métodos de on-behalf/attachments não montados nesta fatia.

API/interface0.29.0 para cinco operações novas; capabilities refletem portas/flags, não concessões. M09a transport/renderer preservados. A montagem no shell aguarda discovery real M08 e jornadaM10, sem catálogo/obra/pessoa fictícios no browser.

## Verificação e entrega

TDD dos profiles/fixed priority/store/ACK/admissão e HTTP. PG17 próprio deve provar catálogo só publicado/coverage/isolamento, CAS/concorrência, expiry/revogação/contexto, validação diretaSQL, ticket/snapshot/workflow/protocolo/effects atomicidade e receipt/replay após revogação. Provar upgrade/reaplicação/defaults/roles e preservação de dados antigos. Usar CI original Linux/Node22/PG17 e uma revisão fresh-context/fix pass. Relatório144/pacoteM09b/PR31draft com fonte/logs/hashes. Sem instalação remota, escrita GEO/envio, mudança Auth/grants/segredos ou deploy de produção.
