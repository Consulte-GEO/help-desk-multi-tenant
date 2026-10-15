# E06 — armazenamento oficial e worker sem Claude

Estado desta frente: armazenamento oficial e worker ativados em produção pela coordenação root em15/10/2026, no modo `manual_review`. Três ciclos nativos204 e a publicação foram conferidos; evidências sanitizadas em `evidence/e06-storage-worker-20261015/hosted`. A integração Novo GEO e o fluxo de negócio completo continuam sujeitos aos limites abaixo.

## Ativação hospedada

Código integrado em `codex/m1-reproducibilidade`: `e8878675eddf21ed9d0fa4ae3ae89abc90c497a4`, mesma fonte executável qualificada0d56dc8/fingerprint5a0b2eefb1e05502904ec886be4043cf10266d6402dfe8bc40678461549d94b8. Primeiro foi publicado o deploy compatível `6ad0fe63f924d4352db92043` com as flags novas ausentes. Depois a migration oficial20 foi aplicada no projeto HelpDesk `xaelbntjnvztznnpcvtm`, registrada pelo provedor como `20261015162611_registration_storage_worker`. SHA256 exato6b8500844c7d655deb388cac35391af396156aaa44165c590235c3a7e1667d9a; schema0.26.0, storage1.0.0,86 tabelas/229 funções/85 triggers/504 constraints, zero tabelas privadas sem FORCE RLS.

O login exclusivo `helpdesk_registration_worker` foi provisionado sem superuser, BYPASSRLS, INHERIT, criação de banco/papel, memberships próprios ou leitura de auth.users. A senha aleatória não foi incluída na migration, no commit ou em arquivo local. Após autorização específica do usuário para a transferência, URL e CA foram salvas como secrets exclusivamente Functions/production no site HelpDesk. O bloqueio inicial da revisão automática foi resolvido por essa autorização, sem contorno por outro canal.

Deploy ativado `6ad100d4209092d0529240ef`, publicado às16:36:23.815UTC. `HELPDESK_REGISTRATION_ANALYSIS_ENABLED=true`, modo `manual_review`, `HELPDESK_REGISTRATION_REVIEW_ENABLED=true`; liberação, atendimento e configuração Consulte GEO existente preservados. O manifesto publicado foi conferido:89 arquivos públicos idênticos ao SHA1 do provedor e netlify.toml corretamente protegido com404. Capabilities200 informa registration_review=true, tickets=true e support_workflow=true. APIs de consulta sem sessão retornam401; GET/POST públicos do worker retornam403; fixtures/SQL privados não são publicados.

Observabilidade do provedor, filtrada por `FunctionName=registration-worker` e `UserAgent=Netlify Functions Scheduler`, registrou POST204 às16:37,16:38 e16:39UTC após a publicação. O handler só retorna204 depois do preflight real de catálogo completo, ACL efetivo, identidade exclusiva e TLS, repetido a cada ciclo. A fila está vazia: nenhum binding, grant, job, operação, rascunho, snapshot ou inbox foi criado. Esse resultado comprova disponibilidade ociosa, sem simular processamento de negócio. Antes da publicação ativada, flags/credenciais ausentes produziram503 fechado, como previsto.

O worker de emails também registrou três POST204 nos mesmos minutos. Advisors não acrescentaram WARN/ERROR para HDA; o INFO de RLS sem políticas nas tabelas privadas é compatível com acesso somente por helpers. Avisos anteriores da Wiki e proteção de senhas continuam fora desta promoção; não declarar o projeto inteiro livre de avisos de segurança.

## Implementação

A vigésima migration `20261015150000_registration_storage_worker.sql` promove o armazenamento de análise HDA02, o alvo de consulta HDA06 e dois helpers de composição. Exige PG17, owner qualificado dos quatro schemas, defaults privados, core0.25 com o reparo de retorno do cliente e catálogo inicial exato. O compilador offline confere os três componentes por SHA256 e o prefixo imutável das dezenove migrations. A admissão local descartável dos candidatos foi substituída por admissão explícita de promoção. Não se executam candidatos brutos em produção.

O contrato final0.26 exige sete tabelas adicionais FORCE RLS sem leitura/DML direto do app/worker, todos os helpers e seus privilégios exatos, triggers de histórico e admissão diferida, todas as constraints e três papéis reservados distintos. Inventário capturado no PG17 próprio do run38762865884:86 tabelas,229 funções,85 triggers,504 constraints, sendo46 HDA. O ensaio nativo captura o inventário completo para revisão; o contrato do core0.25 e seus compiladores continuam independentes e reproduzíveis.

`registration-worker.mts` possui apenas schedule nativo Netlify a cada minuto. O handler exige contexto nativo `production`; parâmetros/corpo não escolhem identidade ou trabalho. A exclusividade da Function scheduled é a fronteira de transporte, igual ao worker de emails. O bit published é somente observação do provedor e não substitui o contexto nativo. A instância faz uma iteração limitada a25s e usa pool próprio com max1, TLS verificado e login `helpdesk_registration_worker`. Falha no startup fecha o pool. Startup e cada ciclo verificam catálogo completo, ACL efetivo independente, ausência de acesso a auth.users, TLS e versão de armazenamento.

`hda02_worker_target()` devolve somente quatro IDs de uma tarefa persistida elegível. Não cria principal, concessão, binding, snapshot ou job. Cada claim/leitura/liquidação reautoriza via transações reais do core. A seleção exclui produtos CG protegidos, chamados cujo autor é outro principal e operações cujo binding mudou de ticket/target. Essas condições são conferidas antes de LIMIT1; uma tarefa inelegível antiga não bloqueia a seguinte. Sem trabalho elegível o ciclo termina204 idle.

O modo permitido é explicitamente `manual_review`. O engine não chama modelo/origem e não oferece campos sugeridos, aprovação ou execução. A tarefa deve declarar `agentVersionRef=manual-review.v1`; outra versão de engine recebe falha tipada offline. Anexos/documentação não qualificados conservam a indicação de revisão humana já existente. Nenhum resultado clean ou cadastro realizado é fabricado.

## Sequência remota para o coordenador

1. Reinspecionar HEAD remoto, schema0.25/19 migrations, defaults, papéis/ACL e destino HelpDesk `xaelbntjnvztznnpcvtm`. As migrations1–19 não mudam. Conferir CI integral e o artefato HDA com inventário real do novo commit.
2. Publicar primeiro o código compatível simultaneamente com0.24/0.25/0.26, mantendo as flags novasfalse. Preservar atendimento, MFA, emails e configuração local existentes.
3. Aplicar somente a vigésima migration oficial pelo fluxo Supabase e confirmar catálogo final, FORCE RLS e ausência de grants indevidos. O papel novo começa NOLOGIN. Não usar postgres/service_role como credencial de runtime.
4. Provisionar login/senha privada forte no papel dedicado, sem memberships, propriedade ou grants adicionais; exigir TLS. Armazenar URL/CA somente em Functions de produção. Usar hostname/porta reais já qualificados do próprio HelpDesk; não adivinhar destino nem copiar o login do app/email.
5. Configurar `HELPDESK_REGISTRATION_DATABASE_URL`, CA se necessário, `HELPDESK_REGISTRATION_ANALYSIS_MODE=manual_review`, `HELPDESK_REGISTRATION_ANALYSIS_ENABLED=true` e `HELPDESK_REGISTRATION_REVIEW_ENABLED=true`. `HELPDESK_RELEASE_APPROVED` e os gates Consulte GEO existentes precisam continuar qualificados. Atualizar/republicar o deploy para que todos usem a mesma configuração privada.
6. Conferir scheduled registration-worker no deploy publicado; invocar somente pelo provedor nativo em produção. Esperar204 idle enquanto não houver identidade/binding/job qualificados. Testar que preview/branch/public URL não admitem execução; capabilities e GETs E06 devem respeitar autenticação e audiência fixa. Não criar chamados/bindings fictícios para obter um resultado de negócio.
7. Registrar commit/deploy, migration remota, catálogo, resultado do ciclo e verificações públicas sem tokens/senhas. Repetir conferência do worker de emails e atendimento para detectar regressão do novo schema.

## Limites reais

Novo GEO continua preparado/desabilitado por decisão do usuário. Seu contrato/auth/URLs e referências autorizadas não existem nesta frente. Um target HDA exige dados qualificados do Novo GEO; não se convertem cadastros locais em autoridade da origem. Nenhuma identidade, concessão ou fila de negócio foi criada em produção.

Sem origem/qualificação de atores de análise e sem jornadas de preparação/edição/CAS, não há promessa de proposta operacional para os chamados ativos da Consulte GEO. O core também permite ao analisador técnico ler somente seus próprios chamados genéricos; não concede leitura dos chamados humanos nem de obras CG por instalar um worker. A consulta existente é somente leitura; pode devolver404 autorizado quando não há operação, nunca um rascunho fictício. Aprovação, escrita na origem e notificação de execução permanecem fora desta promoção.

## Evidência desta frente

- RED inicial: teste do runtime ausente recusou import; testes históricos de schema/contagem recusaram0.26/20 antes da atualização explícita.
- GREEN focal:18 verificações de runtime/configuração/engine/compilador/compatibilidade; sem falhas/skips.
- Tipos, contratos, build e verificadores de migrations e upgrades passaram localmente antes do commit.
- `npm test` Windows na primeira execução:5632 verificações,5487 aprovadas/145 falhas, zero skips/cancelamentos. Cinco expectativas históricas de schema/contagem foram atualizadas e reexecutadas focalmente. Sockets/links/subprocessos/Python/Git staging têm recusas do ambiente Windows; CI Linux integral continua obrigatório.
- PostgreSQL/WSL indisponíveis neste host. O CI Linux executou PG17 real: run38766649791, fonte0d56dc888c0ac69db5063e703c781415c6618af7,40 candidato+14 core/worker,49 DOM,14 vetores válidos+12 recusados, zero falhas, clusters removidos. Evidência canônica em `evidence/e06-storage-worker-20261015/hda`; inventário SHA256acc83f2b2874c3907fc28d484c670cfdc94eadd4a821f3b5412d5170914dcd08.
- A primeira tentativa nativa reproduziu a falha de descoberta antes de contexto; a revisão independente também identificou risco de starvation por autor/binding divergentes. O fixpass preservou as autorizações do core. O cenário nativo passou com três jobs antigos inelegíveis (autor humano, target alterado e ticket alterado) e um job próprio elegível liquidado em manual_review, sem mudança do chamado/outbox.
- TLS/credenciais, promoção remota e scheduler hospedados foram conferidos na ativação acima, com evidência própria. O aceite de negócio continua pendente; CI nativo e disponibilidade ociosa não criam autorização da origem ou dados de produção.

## Checkpoint integral da fonte final

CI38766649902 aprovado:5639 aplicação+680 PostgreSQL+617 interface=6936 verificações, zero fail/skip/cancel/todo. Lock, instalação, audit, tipos, contratos, segredos e build passaram no mesmo run. Fonte0d56dc888c0ac69db5063e703c781415c6618af7; fingerprint5a0b2eefb1e05502904ec886be4043cf10266d6402dfe8bc40678461549d94b8. O relatório canônico e seus logs estão em `evidence/homologation`, execução5ec4d499-fdbb-4faa-b2b5-d9484b9e334b; `npm run check:homologation` conferiu o fingerprint e os hashes localmente. O commit documental posterior preserva a mesma fonte qualificada.

A falha anterior do CI integral era a admissão do harness histórico0.24 que ainda recusava bundles com a vigésima migration; o prefixo/contrato usados por aquela suíte continuaram congelados. O ajuste foi reexecutado com sucesso no CI final. Nenhuma migration histórica foi alterada.
