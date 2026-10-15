# IMP02 — storage privado e inspeção

`modules/import-process/storage.ts` implementa chamadas REST reais ao Supabase.
O bucket exclusivo é `setup-import-artifacts`. O SQL revisável está em
`sql/IMP02_STORAGE_PRODUCTION.sql`; as migrations de processos e storage foram
aplicadas ao projeto `yglcnirbnbwjqpvalqif` em 15/10/2026. A qualificação local
abaixo não substitui a jornada com usuários e JWTs reais na instalação cloud.
Não reutilizar `exports` nem `step-help-images`.

O host autentica e autoriza o processo, carrega o Artifact pending e solicita
`createSignedUpload(artifact, signal)` usando o access token do próprio usuário.
A policy INSERT reconfirma registro, escopo e concessão viva. A resposta autorizada
contém a URL assinada, método PUT e cabeçalhos; não contém credenciais do usuário.
A URL é uma capacidade bearer com validade Supabase de duas horas. A revogação da
concessão bloqueia novas emissões; não revoga imediatamente uma URL já emitida.
`x-upsert:false` é usado na assinatura e no PUT. Não há UPDATE/DELETE concedido.

O inspector usa uma segunda instância de storage, com JWT de usuário técnico
dedicado e `app_metadata.setup_import_inspector=true`, atribuído somente pelo
administrador. Esse usuário não deve ter concessões de casos ou uso interativo.
Acesso normal recusa tokens cujo papel não seja authenticated e chaves secretas;
a verificação definitiva de JWT permanece no Supabase. Não usar service_role.
O runtime não aceita mais `IMPORT_PROCESS_STORAGE_INSPECTOR_TOKEN`. Configure
`IMPORT_PROCESS_STORAGE_INSPECTOR_EMAIL`, `IMPORT_PROCESS_STORAGE_INSPECTOR_PASSWORD`
e `IMPORT_PROCESS_STORAGE_INSPECTOR_USER_ID` em Functions/production. Senha e
email ficam exclusivamente em secrets protegidos do Netlify, sem contexto de
build, previews ou variáveis `VITE_*`; o UUID fixo também fica no servidor.
Sem essas variáveis somente a inspeção fica indisponível.

`createSupabaseInspectorTokenProvider` autentica por
`POST /auth/v1/token?grant_type=password` com a chave pública. Antes de disponibilizar
o token, exige `role=authenticated`, `sub` igual ao UUID provisionado,
`iss` do projeto, `app_metadata.setup_import_inspector=true`, expiração inteira
futura e TTL de até uma hora. Consulta `/auth/v1/user` para o Supabase verificar
o JWT e reconfirma o UUID e o app_metadata atual. Decodificar o JWT não é prova
de autenticidade. O Storage valida novamente assinatura, expiração e policies
em cada leitura. Claims em user_metadata nunca concedem leitura.

Cada instância quente guarda somente o access token em memória e obtém outro
por senha 60 segundos antes da expiração. Pedidos simultâneos compartilham uma
única autenticação nessa instância. O refresh token retornado é descartado, sem
persistência, cookies ou troca entre instâncias; isso evita corrida de rotação
em Functions concorrentes. Login e validação têm um limite conjunto de cinco
segundos; respostas são limitadas a 64 KiB, redirects são recusados e falhas
ficam em cooldown de 30 segundos por instância. Falhas de renovação não reutilizam
o token anterior nem exibem resposta Auth, email, senha ou tokens nos erros.
Cold starts ainda geram logins independentes e podem atingir o rate limit do
Auth sob escala alta; o cooldown não é uma cota distribuída. Acompanhar os
limites Auth e a criação de sessões antes de ampliar a carga.

### Provisionamento e rotação da identidade

1. Aplique e qualifique antes a migration adicional de restrição descrita abaixo.
   Pelo canal administrativo do Supabase, crie um usuário Auth exclusivo, com
   email confirmado e senha aleatória forte, e atribua apenas
   `app_metadata.setup_import_inspector=true`. Não atribua is_admin, concessões
   de processos, vínculos de projetos ou credenciais PostgreSQL. Não se usa uma
   chave administrativa em requests de aplicação; eventual Admin REST serve
   somente ao provisionamento pelo operador, fora de Functions.
2. Registre o UUID real, email e senha nas variáveis acima e publique a função.
   Não copie JWTs para configuração; confirme o login e a leitura com o JWT real
   emitido pelo Auth. Mantenha a expiração do projeto em até uma hora.
3. Para rotacionar, altere a senha administrativamente, atualize o secret e
   publique novamente. Access tokens já emitidos podem continuar válidos até
   expirar; trocar a senha ou excluir um usuário não revoga imediatamente JWTs.
   Para corte imediato de leitura do bucket, o operador deve retirar a policy
   de leitura do inspector durante a intervenção e validar a revogação.

Um usuário técnico compartilhado entre Functions requer avaliar a configuração
Auth de sessão única por usuário: instâncias podem iniciar sessões simultâneas.
Não habilitar refresh tokens compartilhados como solução. Toda mudança de
expiração, captcha ou política de autenticação exige requalificar esse login.
[Password login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
e [limites de sessão e validade de JWTs](https://supabase.com/docs/guides/auth/sessions).

### Restrição frente às policies existentes

As policies legadas `Users read own exports` e `Users upload exports` permitem
leitura e inserção no bucket `exports` para qualquer `auth.uid()` preenchido.
Uma identidade técnica authenticated também satisfaz esse predicado. Uma
policy permissiva exclusiva para o bucket novo não revoga essa permissão antiga,
porque o PostgreSQL combina permissivas por `OR`.

A migration adicional
`20261015155558_imp02_inspector_storage_restrictions.sql`, com cópia revisável em
`sql/IMP02_STORAGE_INSPECTOR_RESTRICTIONS.sql`, acrescenta oito policies
`AS RESTRICTIVE`. Para `app_metadata.setup_import_inspector=true`, SELECT de
objetos e de metadados fica limitado a `setup-import-artifacts`; INSERT, UPDATE
e DELETE ficam vetados em todos os objetos e buckets. O PostgreSQL combina
essas condições com as permissivas por `AND`. Elas não concedem SELECT por si
só: a policy permissiva original do inspector continua necessária.

Identidades sem o flag verdadeiro passam por essas condições adicionais e
continuam dependendo dos seus grants e policies existentes. A migration não
altera as policies legadas, não concede privilégios, não cria funções ou usuários
e não modifica as duas migrations já aplicadas. Sua preparação local não
comprova aplicação na instalação cloud. Antes de criar ou ativar o usuário
técnico, o operador precisa aplicar a migration e repetir a leitura de exports
e tentativas de escrita com o JWT real desse usuário.
[Composição de policies no PostgreSQL](https://www.postgresql.org/docs/17/sql-createpolicy.html).

O inspector consulta a configuração real do bucket e exige public=false, lê
bytes privados com ETag forte, limita o stream a 60 MiB e calcula SHA-256 dos
bytes efetivos. Content-Type de upload/download não comprova tipo de conteúdo.
A assinatura binária apenas orienta o scanner; ZIP/OLE não são expandidos no host.
O objectVersion persistido combina ETag e SHA-256. A garantia depende também de
ausência de policies amplas que concedam substituição/exclusão de objetos.

## Gateway de inspeção preparado

Não existe scanner configurado ou qualificado nesta entrega. A configuração
ausente falha com INSPECTION_UNAVAILABLE e mantém pending; nunca produz clean.
`createHttpContentScanner({url,token})` é um adaptador de transporte para gateway
HTTPS que deve ser implantado e qualificado pelo operador. Não embute antivirus.

POST com corpo binário exato, `Authorization: Bearer <segredo do gateway>`,
`Content-Type: application/octet-stream`, `X-Inspection-Protocol:
setup-content-inspection/v1`, `X-Content-Sha256`, `X-Content-Bytes` e
`X-Content-Mime-Hint`. Resposta 200 JSON limitada a 16 KiB:

```json
{"protocol":"setup-content-inspection/v1","sha256":"<64 hex dos bytes recebidos>","bytes":123,"mime":"application/pdf","scan":"clean","contentValidated":true}
```

scan aceita clean, infected ou unavailable. O gateway deve vincular todos os
resultados aos bytes recebidos. Timeout, redirecionamento, resposta inesperada,
digest/tamanho divergentes ou unavailable falham fechados. O gateway precisa
verificar malware e estrutura do formato. Só devolver contentValidated=true
após validar parser, criptografia, conteúdo ativo e limites de tamanho expandido,
razão de compressão, profundidade e quantidade de entradas em arquivos compostos.
Um resultado de ClamAV isolado não autoriza contentValidated=true. Tipo não
suportado ou validação inconclusiva permanece bloqueado; não usar fixture como
gateway de produção.

## Evidência local

`node --experimental-strip-types --test tools/tests/import-process/storage-loopback.test.mjs`
usa sockets HTTP reais com serviços de protocolo de teste, explicitamente
sintéticos. Cobre upload, hash dos bytes, scanner infectado/inconclusivo,
timeout, hash divergente, bucket público, ETag ausente/fraco, redirect, tamanho
excessivo, token privilegiado, troca de chave e artefato finalizado. Não demonstra
bucket cloud, engine antivirus real ou validação de arquivos em produção.

`node --experimental-strip-types --test tools/tests/import-process/inspector-auth-loopback.test.mjs`
também usa sockets reais, com Auth e Storage declaradamente sintéticos. Cobre
password grant, confirmação do JWT em `/user`, leitura dos bytes com o bearer
retornado, renovação antecipada, concorrência, cooldown, retomada após falha,
JWT expirado/sem expiração/privilegiado, projeto ou UUID trocado, falta de
app_metadata, user_metadata forjado, redirects e resposta excessiva. Os JWTs
da fixture não são assinados pelo Supabase e não demonstram autenticação cloud.

O qualificador PostgreSQL 17 em modo `--production` aplica separadamente as
fontes canônicas original e adicional. Ele reproduz primeiro o SELECT e INSERT
indevidos do inspector em `exports`, depois exige SELECT vazio e INSERT recusado
após a nova migration, preservando o acesso legado do usuário comum. Policies
amplas adicionais, expressamente sintéticas e removidas ao fim do teste,
exercitam os vetos a escrita e a leitura de metadados de outros buckets mesmo
quando há uma policy permissiva favorável. O relatório inclui
`storageQualification.restrictionDdlSha256`, separado do hash do SQL original.
Essa execução usa PostgreSQL nativo e claims de teste; não equivale a requests
HTTP no Storage cloud. A máquina Windows bloqueia esse qualificador por projeto;
a execução nativa deve ser confirmada no job `Owned PostgreSQL production hosting
and ACL` do workflow de qualidade.

Qualificar RLS com usuários reais distintos, grants revogados, casos de contas
diferentes, tentativa de sobrescrita e corpus de malware/arquivos compostos antes
de habilitar o fluxo. HTTPS é obrigatório; HTTP localhost exige opção explícita
destinada aos testes locais.
