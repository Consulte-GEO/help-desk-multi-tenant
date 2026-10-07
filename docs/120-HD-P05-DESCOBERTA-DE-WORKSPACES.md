# HD-P05 — descoberta e seleção de workspaces

Fatia de acesso humano necessária ao HD-P03: a tela existente exigia um UUID manual antes de validar a identidade. O plano prevê descoberta e seleção das operações às quais a pessoa já pertence. Não depende da definição do primeiro cliente, contrato ou SLA.

## Comportamento

O UUID manual continua opcional para compatibilidade. Sem UUID, a interface autentica no Supabase e consulta GET `/v1/workspaces` com o access token em memória. Uma opção é selecionada automaticamente; duas ou mais exigem escolha explícita. Nenhuma lista de clientes, ticket, escopo ou papel é retornada nessa etapa. `/me` revalida o workspace escolhido antes de confirmar acesso, inclusive se o vínculo tiver sido revogado desde a descoberta.

O endpoint valida a identidade no provedor usando o adaptador existente, não metadata/JWT decodificado, email ou headers de workspace. Credenciais/sessões M2M não podem listar workspaces. Query selectors são recusados. A lista usa principal humano ativo e membership OU grant de conta ativo. Discovery não concede scopes nem transforma membership em acesso a todos os clientes.

Respostas inválidas, IDs duplicados, nomes inválidos ou mais de50 opções produzem falha segura sem catálogo parcial. O helper SQL retorna até51 registros como sentinela de excesso; essa é uma fronteira técnica da primeira fatia, não limite comercial anunciado. O limitador distribuído de ingresso permanece ativo e discovery compartilha o orçamento de autenticação aplicado à troca de tokens.

Durante escolha múltipla, a sessão não autoriza requests de atendimento. Cancelamento encerra a sessão recém-emitida no provedor; falha/ausência de workspace também solicita encerramento. Saída não confirmada é informada. Respostas tardias não reinstalam uma sessão cancelada. Senha é limpa, tokens permanecem em memória e operações de domínio não são repetidas automaticamente.

## Banco e publicação

API/interface0.20.0, schema0.19.0 e19 operações. Migration012 é aditiva; os bytes/checksums001–011 permanecem intactos. Acrescenta somente helper privado readonly e marcador de schema. Helpdesk_app recebe EXECUTE desse helper, não SELECT/INSERT/UPDATE de tabelas administrativas. PUBLIC/anon/authenticated/service_role continuam sem execução/acesso privado. O catálogo de segurança inclui explicitamente o helper.

Antes da implantação: CI de aplicação, PostgreSQL17/upgrade e interface; revisão independente; evidência por fingerprint. A migration deve ser aplicada apenas após homologação, coordenada com o deploy para reduzir o intervalo em que código e schema recusam incompatibilidade. Nenhum afrouxamento dos checks de startup ou abertura do gate é permitido.

## Evidências e limites

Testes negativos foram escritos antes da implementação. Cobrem identidade do provedor, M2M, catálogo inválido/vazio, timeout, escolha explícita, cancelamento e expiração. PostgreSQL real verificará vínculos e revogação, grants, escopos ausentes e overflow. Browser usa provedor sintético e testa descoberta, escolha, cancelamento e revogação entre descoberta e `/me`.

CI, revisão e verificações de produção serão registrados após execução. Não afirmar login humano real a partir desses dublês. Não cria workspace, convite ou membros, não altera scopes/MFA e não conclui M1 nem HD-P05 completo.
