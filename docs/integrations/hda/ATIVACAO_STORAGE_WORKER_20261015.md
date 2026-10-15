# E06 — armazenamento oficial e worker sem Claude

Estado desta frente: código preparado; promoção/credenciais/publicação remotas pertencem à coordenação root. Não declarar ativação hospedada com base neste documento.

## Implementação

A vigésima migration `20261015150000_registration_storage_worker.sql` promove o armazenamento de análise HDA02, o alvo de consulta HDA06 e dois helpers de composição. Exige PG17, owner qualificado dos quatro schemas, defaults privados, core0.25 com o reparo de retorno do cliente e catálogo inicial exato. O compilador offline confere os três componentes por SHA256 e o prefixo imutável das dezenove migrations. A admissão local descartável dos candidatos foi substituída por admissão explícita de promoção. Não se executam candidatos brutos em produção.

O contrato final0.26 exige sete tabelas adicionais FORCE RLS sem leitura/DML direto do app/worker, todos os helpers e seus privilégios exatos, triggers de histórico e admissão diferida, PKs/FKs nomeadas e três papéis reservados distintos. O ensaio nativo captura o inventário completo para revisão; o contrato do core0.25 e seus compiladores continuam independentes e reproduzíveis.

`registration-worker.mts` possui apenas schedule nativo Netlify a cada minuto. O handler exige contexto nativo `production`; parâmetros/corpo não escolhem identidade ou trabalho. A exclusividade da Function scheduled é a fronteira de transporte, igual ao worker de emails. O bit published é somente observação do provedor e não substitui o contexto nativo. A instância faz uma iteração limitada a25s e usa pool próprio com max1, TLS verificado e login `helpdesk_registration_worker`. Falha no startup fecha o pool. Startup e cada ciclo verificam catálogo completo, ACL efetivo independente, ausência de acesso a auth.users, TLS e versão de armazenamento.

`hda02_worker_target()` devolve somente quatro IDs de uma tarefa persistida elegível. Não cria principal, concessão, binding, snapshot ou job. Cada claim/leitura/liquidação reautoriza via transações reais do core. A seleção exclui produtos CG protegidos porque a autorização existente recusa atores técnicos para esses recursos; essa fronteira foi preservada. Sem trabalho elegível o ciclo termina204 idle.

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

Novo GEO continua preparado/desabilitado por decisão do usuário. Seu contrato/auth/URLs e referências autorizadas não existem nesta frente. Um target HDA exige dados qualificados do Novo GEO; não se convertem cadastros locais em autoridade da origem. Nenhuma identidade, concessão ou fila de produção foi criada.

Sem origem/qualificação de atores de análise e sem jornadas de preparação/edição/CAS, não há promessa de proposta operacional para os chamados ativos da Consulte GEO. A consulta existente é somente leitura; pode devolver404 autorizado quando não há operação, nunca um rascunho fictício. Aprovação, escrita na origem e notificação de execução permanecem fora desta promoção.

## Evidência desta frente

- RED inicial: teste do runtime ausente recusou import; testes históricos de schema/contagem recusaram0.26/20 antes da atualização explícita.
- GREEN focal:18 verificações de runtime/configuração/engine/compilador/compatibilidade; sem falhas/skips.
- Tipos, contratos, build e verificadores de migrations e upgrades passaram localmente antes do commit.
- `npm test` Windows na primeira execução:5632 verificações,5487 aprovadas/145 falhas, zero skips/cancelamentos. Cinco expectativas históricas de schema/contagem foram atualizadas e reexecutadas focalmente. Sockets/links/subprocessos/Python/Git staging têm recusas do ambiente Windows; CI Linux integral continua obrigatório.
- PostgreSQL/WSL indisponíveis neste host. Suíte nativa completa foi estendida com catálogo/ACL, seleção vazia, exclusividade do worker, liquidação manual transacional e revogação. Execução nativa e aceite hospedado ainda não são declarados.
