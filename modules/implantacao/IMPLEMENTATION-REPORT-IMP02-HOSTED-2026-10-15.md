# E06 e IMP-02 — integração de backend, sessão e arquivos

Data:15/10/2026. Autorização do usuário: implementar, fazer commit/merge/publicar sem Claude. Esclarecimento da origem: API e contrato Novo GEO ainda indisponíveis; deixar integração preparada. Instruções dos pacotes foram tratadas como material histórico; não substituíram essa autorização.

## Resultado do código

E06 possui duas rotas GET de audiência fixa, leitura transacional pelo pool restrito existente, resolução de escopo/obra e projeção limitada. O navegador não escolhe público interno nem recebe estado bruto/fila/ledger. O runtime publicado não habilita a capacidade; instalação HDA e origem ainda exigem qualificação própria. SQL candidato permanece fora das migrations oficiais do core. APIs de aprovação/execução no Novo GEO não foram inventadas. Histórico/edição de proposta e worker operacional permanecem pendentes do próximo bloco de E06.

IMP-02 passou a ter Function Netlify, autenticação viva no Supabase, processos/revisões/recibos em PostgreSQL, vínculos persistidos de acesso e listagem. A tela existente conecta Vuex à sessão do backend e conserva os dados após nova autenticação em outro dispositivo porque a persistência é do servidor. A verificação hospedada dessa jornada depende de conta/vínculo reais, ainda não provisionados. Nenhuma obra/conta foi inferida do administrador.

O adaptador de arquivos emite upload privado sem sobrescrita, verifica bytes reais/hash/MIME/versão e chama um gateway externo de inspeção pelo contrato documentado. Scanner ausente ou inconclusivo não torna arquivo pronto. Limite1GiB por caso reserva60MiB para cada pending/rejected; ready usa bytes verificados. Retenção é agendada; purge físico ainda não implementado.

## Problemas corrigidos

1. Principal do core com257–1000 vínculos era recusado pelo limite HDA de256. Fingerprint agora usa o canonicalizador existente do core sem ampliar os limites de propostas.
2. Abertura antiga podia substituir o processo mais recente e apagar edição/marcador. Geração e cancelamento impedem adotar respostas antigas; desmontagem não apaga journal de operação incerta.
3. Declaração de arquivo minúsculo podia subestimar a quota de bytes efetivos. Reserva conservadora cobre o tamanho máximo de cada upload ainda não validado.
4. Confirmação de suporte precisava reler administrador no banco, além da consulta Auth inicial. Helper privado devolve só booleano, com identidade e search_path fixados.
5. Pools de autoridade/repositório separados impedem que a confirmação espere conexão retida pela própria gravação.
6. Prebuild removia o novo serviço de sessão por lista legada; a lista foi atualizada e o build completo repetido.

## Validação e publicação

Código de E06: PR48. Código de IMP-02: PR14. Revisão independente concluída com correções reproduzidas RED→GREEN. Evidência integral Linux está versionada nos diretórios evidence/e06-backend-20261015 e evidence/imp02-hosted-20261015; não confundir testes de Auth/inspeção sintéticos com aceite real dos provedores.

## Configuração ainda necessária

- Fonte Novo GEO: URL, contrato/auth e referências autorizadas; usuário pediu somente preparação.
- IMP-02: conexão do pooler e login restrito configurados; ver o checkpoint de ativação abaixo. Falta o aceite autenticado com conta e vínculos reais.
- Vínculos reais de workspace/conta/solicitante/obra antes de liberar processos aos usuários.
- Gateway qualificado de inspeção e identidade dedicada de leitura, com rotação do JWT. Não existe scanner ativo descoberto nos serviços atuais.
- E06: promoção específica do armazenamento HDA com inventário/ACL/preflight do core e montagem do worker, antes de liberar consulta operacional/edição/análise.

Estado: implementações de backend/storage preparadas com testes reais de protocolo e PostgreSQL; conclusão funcional integral de E06/IMP-02 não é declarada enquanto esses requisitos operacionais faltarem.

## Checkpoint de qualificação e banco

E06 fonte951ba320, merge de prova09499175, CI38719079320:5623 aplicação+675 PostgreSQL+617 interface=6915, zero fail/skip/cancel/todo. Fingerprintd10f0304f74d3168d2bd91356e5ce957bdb047db97dbb9cae661b878c66b6f47 revalidado localmente. HDA38719012398:40 candidato+10 core; limpeza confirmada removed.

IMP-02 fonte019fd238, CI38719466907 aprovado:311 processos,141 integridade,627 smoke,89 contraste,105 laudos,28 Deno,27 intake,21 similaridade,23 implantação,11 PostgreSQL candidato e26 produção/Storage; navegador10 bridge+8 HTTP+16 Vue. Auditoria zero vulnerabilidades. As duas novas verificações de equivalência das migrations oficiais passaram localmente.

Migrações aplicadas pelo fluxo Supabase em yglcnirbnbwjqpvalqif:20261015102342_imp02_processes_hosted_authority (SHA2568be41c8f7f1622827533296e5e0cc4ef7c2892812d7f37d708c6e046bc20b2ca) e20261015102401_imp02_private_artifact_storage (SHA256b12bbfff14df0755beaec8d7425ff7f65c7a34a466732b4b6cce8a3d526844cc). Sete tabelas FORCE RLS, papel sem superuser/bypass/createdb/createrole/inherit, bucket privado60MiB; anon/authenticated sem SELECT em cases e anon sem EXECUTE no helper administrativo. Casos/vínculos novos0. Preservados15 rascunhos,14 submissões,14 chamados,1 projeto e1 associação existentes.

No checkpoint inicial, a configuração Netlify de produção tinha origem/Supabase/chave pública e IMPORT_PROCESS_ENABLED=false. A ativação posterior, com os dados oficiais enviados pelo usuário, está registrada abaixo.

## Merge e produção verificados

PR48 mesclado1596ec7c5053669f314e1d8ad145ac4f76745925; Netlify6ad0ab2146910e26376edcf5 ready. PR14 mesclado5768a05e530217bc459d798932f7bfd934afcb9f; Netlify6ad0ab25de679dbc8384c0e6 ready. HelpDesk89/89 arquivos iguais ao build local. Implantação48 arquivos iguais ao manifesto do deploy e um HTML conferido com a única transformação existente de pretty-link do Netlify;6 estáticos críticos iguais aos blobs Git. netlify.toml protegido404. Total49 estáticos conferidos. A reprodução local do Vite tem timestamp próprio, portanto não é usada como checksum dos bundles do deploy.

HelpDesk capabilities200 com registration_review=false; /me e /tickets401 sem credencial; rotas E06 públicas/internas503 release_gate_closed. Fixtures e SQL privado404. IMP-02 responde503 PROCESS_GATE_CLOSED, comprovando montagem da Function antes da SPA e liberaçãofalse. Sem novo achado do Supabase relativo ao schema/bucket adicionado; avisos herdados do projeto permanecem separados.

Não declarar E06/IMP-02 integralmente concluídos: backend/armazenamento estão implementados e a infraestrutura de implantação foi aplicada, mas a operação exige vínculos reais e inspeção de arquivos qualificada. Origem Novo GEO explicitamente preparada/desabilitada. Não criar dados fictícios para simular aceite hospedado.

## Ativação do pooler — 15/10/2026, 15:05 UTC

O usuário forneceu `aws-1-sa-east-1.pooler.supabase.com:5432`, banco `postgres`, projeto `yglcnirbnbwjqpvalqif`. O runtime usa `setup_import_app.yglcnirbnbwjqpvalqif`, sem reutilizar o login administrativo informado. Senha aleatória provisionada apenas para esse papel existente; DSN salvo como segredo Netlify exclusivo de Functions/production, sem arquivo local ou valor versionado. A senha de postgres e os privilégios do papel não foram alterados.

O primeiro teste recusou a cadeia com SELF_SIGNED_CERT_IN_CHAIN. Foi obtida a CA pela URL pública indicada no [código oficial do painel Supabase](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json), configurada em IMPORT_PROCESS_DATABASE_CA e repetida a conexão com `rejectUnauthorized:true`. TLS 1.3 e hostname foram verificados, fingerprint SHA256 da CA `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`, válida até 26/04/2031. Esta prova cobre cliente→pooler. `pg_stat_ssl` reportou false no trecho interno pooler→PostgreSQL; nenhuma configuração do provedor ou de enforcement foi alterada, e não se declara TLS nos dois trechos.

Preflight conectado como setup_import_app confirmou: sete tabelas ENABLE/FORCE RLS com outro proprietário; sem superuser/bypass/createdb/createrole/inherit; sem USAGE no schema auth nem INSERT em access_grants. SELECT direto em auth.users recusado com código 42501; helper administrativo retorna false sem ator. Sem contexto, cases e access_grants não retornam linhas. Nenhum usuário, vínculo ou processo fictício foi criado.

IMPORT_PROCESS_ENABLED=true em Functions/production. Build Git main `3fe0dbecee448a3caa762e21e4927b04fb43b1e5`, Netlify `6ad0eb6a9f82940dd35895b5`, ready/publicado em [setup.consultegeo.org](https://setup.consultegeo.org). Conferidos 49 estáticos e netlify.toml protegido com 404; todos os 50 itens passaram contra o manifesto, incluindo a transformação de pretty-link já documentada. Scanner de segredos do deploy sem achados.

Sessão/listagem respondem 401 AUTHENTICATION_REQUIRED sem Bearer; Bearer inválido também 401 após consulta ao Auth real. Origem externa recusada com 403 em leitura e escrita; respostas no-store. Isso comprova montagem/configuração e as recusas públicas. A conexão PostgreSQL foi verificada diretamente pelo mesmo driver pg 8.16.3; uma jornada autenticada completa na Function ainda precisa de sessão/vínculo reais. Scanner e JWT do inspector continuam ausentes, portanto arquivos não são aprovados. Novo GEO permanece somente preparado, conforme pedido do usuário.

Evidências sanitizadas: [evidence/imp02-pooler-20261015](evidence/imp02-pooler-20261015/README.md). Esta atualização de configuração não alterou os fontes executáveis nem as migrations já qualificadas.
