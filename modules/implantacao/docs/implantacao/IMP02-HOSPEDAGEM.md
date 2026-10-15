# IMP02 — hospedagem real preparada

`frontend/netlify/functions/import-process.mts` monta o serviço existente nos caminhos `/v1/import-processes` e `/v1/import-processes/*`. O build do Netlify detecta a função a partir do diretório base `frontend`; seus fontes e dependências ficam fora de `dist`.

A autenticação consulta `/auth/v1/user` no Supabase em cada pedido, com Bearer da sessão e chave pública. A resposta fica limitada a 64 KiB. A aplicação não decodifica JWT para autorizar identidade. Credenciais internas não podem ser construídas a partir do JSON recebido. Chamadas de escrita exigem a origem HTTPS configurada.

O schema privado `setup_import` persiste processos, revisões, recibos, artefatos, auditoria, limites e vínculos de acesso. O login `setup_import_app` não possui SUPERUSER, BYPASSRLS, CREATE ROLE, propriedade do schema ou acesso normal a usuários. O PostgreSQL usa TLS com `rejectUnauthorized:true`; CA opcional complementa a verificação das raízes do Node. A URL aceita somente o login restrito do projeto Supabase configurado, sem parâmetros que possam desativar TLS. Dois pools separados reservam duas conexões de repositório e uma de autoridade, evitando que a confirmação da permissão espere uma conexão retida pela própria gravação.

O operador cadastra `access_grants` pela administração do banco, após receber os vínculos reais de workspace, conta, solicitante e obra. Não existe endpoint normal para criar esse vínculo. `actor_id` e `requester_id` referenciam usuários reais; requester deve coincidir com ator. Suporte requer também `app_metadata.is_admin` da consulta de autenticação e da leitura viva de `auth.users.raw_app_meta_data`, repetida antes da confirmação. O predicado privado `actor_is_admin` usa SECURITY DEFINER apenas para esse booleano, exige o login de sessão restrito, fixa search_path e concede EXECUTE somente ao backend. Obra vinculada a `project_id` exige projeto ativo e associação ou autoria atual; suporte administrativo delegado pode atender esse projeto. Atualizar o vínculo incrementa `access_version`. Expiração e revogação são verificadas novamente antes da confirmação. A origem Novo GEO está **preparada**: nenhum UUID, workspace ou relacionamento é inferido.

Rotas adicionais:

- `GET /v1/import-processes/session`: `{actorId,scopes:[{workspaceId,accountId,requesterId,workRef,role}],enabled:true,sourceIntegration:'prepared'}`. Sem vínculos retorna scopes vazio.
- `GET /v1/import-processes`: `{cases:[{caseId,workspaceId,accountId,workRef,purpose,status,version,updatedAt}],more}`; até 100, ordenados por atualização. Sem paginação por identificadores fornecidos pelo cliente.
- `POST /v1/import-processes/:case/artifacts/:artifact/upload-url`: sem corpo, com Bearer e Origin. Autoriza o caso e lê o artefato pendente pelo repositório antes de assinar o upload imutável. Retorna `{url,method,headers,expiresIn}`.

As operações de processo mantêm o contrato condicional e de idempotência documentado em R03. Limite persistido: 120 pedidos por minuto por ator; o limite de IP do Netlify restringe 180 por minuto antes da autenticação.

A cota de armazenamento por processo é 1 GiB e até 1.000 arquivos registrados. Cada novo upload reserva 60 MiB, o máximo aceito pelo bucket, mesmo que o cliente declare um byte. Arquivos pending ou rejected mantêm essa reserva porque os bytes podem continuar armazenados. Somente arquivos ready passam a consumir o tamanho exato confirmado pela inspeção dos bytes imutáveis. Assim, cabem até 17 uploads ainda não validados por vez; validar arquivos menores libera espaço para novos registros. A reserva é calculada dentro da mesma transação serializada do processo. Rejeição não apaga bytes nem libera espaço sem um procedimento de remoção qualificado.

Configuração de Functions no Netlify:

| Variável | Valor/finalidade |
| --- | --- |
| `IMPORT_PROCESS_ENABLED` | `true` apenas após migration e qualificação; ausente fecha o módulo |
| `IMPORT_PROCESS_ORIGIN` | origem HTTPS exata do site |
| `IMPORT_PROCESS_SUPABASE_URL` | origem HTTPS do projeto Supabase |
| `IMPORT_PROCESS_PUBLISHABLE_KEY` | chave publishable ou anon; nunca service_role |
| `IMPORT_PROCESS_DATABASE_URL` | login restrito setup_import_app, banco postgres, sem query string |
| `IMPORT_PROCESS_DATABASE_CA` | opcional, PEM confiável; ausência usa raízes do Node |
| `IMPORT_PROCESS_RETENTION_DAYS` | opcional, padrão 90; agenda retainUntil, purge não implementado |
| `IMPORT_PROCESS_STORAGE_INSPECTOR_EMAIL` | email do usuário técnico Auth exclusivo; secret apenas Functions/production |
| `IMPORT_PROCESS_STORAGE_INSPECTOR_PASSWORD` | senha forte desse usuário; secret apenas Functions/production |
| `IMPORT_PROCESS_STORAGE_INSPECTOR_USER_ID` | UUID real e fixo dessa identidade; configuração exclusiva de Functions |
| `IMPORT_PROCESS_SCANNER_URL` / `IMPORT_PROCESS_SCANNER_TOKEN` | gateway de inspeção de conteúdo qualificado |

Ausência de scanner/credencial de inspeção mantém a verificação de artefatos indisponível. Cadastro e armazenamento não significam conteúdo aprovado, entrega ao suporte, importação executada ou integração da origem concluída.

A leitura privada usa password grant com a chave pública, seguido de confirmação
do token real no Auth. O access token é renovado automaticamente antes de expirar,
com cache apenas em memória e autenticação única por instância concorrente.
Refresh tokens não são persistidos; o antigo inspector JWT estático não é aceito.
Provisionamento, rotação, limites de sessão e evidências estão em
[IMP02-STORAGE-INSPECTION.md](IMP02-STORAGE-INSPECTION.md).

A identidade técnica também precisa da migration adicional
`20261015155558_imp02_inspector_storage_restrictions.sql` antes do seu
provisionamento. Sua fonte revisável independente é
`sql/IMP02_STORAGE_INSPECTOR_RESTRICTIONS.sql`. As policies restritivas limitam
essa identidade à leitura do bucket de inspeção e vetam escritas em todos os
buckets, mesmo diante de permissões legadas para usuários authenticated.
As duas migrations anteriores e as policies legadas permanecem como estavam.

`IMP02_PROCESSOS_PRODUCTION.sql` é o conteúdo revisável da migration principal; `IMP02_STORAGE_PRODUCTION.sql` configura o bucket e as policies. Não reutilizar a instalação candidata em produção. A senha do login é provisionada por canal administrativo e não aparece nos fontes. O operador deve conferir `pg_roles`, grants, RLS e ausência de acesso anon/authenticated aos registros privados após aplicar.

Em 15/10/2026, o pooler oficial fornecido pelo usuário foi configurado em produção: `aws-1-sa-east-1.pooler.supabase.com:5432/postgres`, login `setup_import_app.yglcnirbnbwjqpvalqif`. O DSN é segredo exclusivo de Functions/production. A CA oficial Supabase Root 2021 foi configurada com verificação de cadeia e hostname; não basta a trust store padrão nesse pooler. IMPORT_PROCESS_ENABLED=true publicado no deploy 6ad0eb6a9f82940dd35895b5. [Preflight e limites da qualificação](../../IMPLEMENTATION-REPORT-IMP02-HOSTED-2026-10-15.md).

Qualificação descartável de produção (Linux, PostgreSQL 17, usuário de SO sem root):

```sh
node --experimental-strip-types tools/qualify-import-process-postgres.mjs --execute --production --pg-bin /usr/lib/postgresql/17/bin --driver /absolute/path/node_modules/pg --output /fresh/evidence/path
```

A suíte cria seu próprio cluster e aplica o SQL integral de produção. Usuários e respostas de Auth são fixtures declaradas; persistência, RLS, permissões, projetos e revogação usam PostgreSQL real. Não comprova scanner externo ou uma origem Novo GEO ainda não fornecida. Sem os binários apropriados, termina em exit 2 em vez de registrar sucesso.
