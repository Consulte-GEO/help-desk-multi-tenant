# CG-03c — revisão de identidade e admissão transacional

Checkpoint pré-CI, 09/10/2026. Base remota885e1f6a77ed0c5caf33d075de206c27826423cc, PR26, review/cg01-cg02-20261009. A branch principal consultada no PR permanece796face60367e2573d112b7ae42d570055474348. Esta fatia continua a preparação de CG-03; não encerra sua persistência/ACL nem os CG-01/02.

## Fonte e decisão de escopo

Base normativa do trabalho: plano de implantação fornecido pelo usuário, CG-03 (identidades/bindings, revalidação antes da transação, ACL antes de LIMIT/replay e testes SQL/upgrade). A especificação complementar e o contrato real da origem continuam sem qualificação nesta entrega. O plano permite motores locais enquanto o contrato impede adaptadores reais.

A revisão encontrou uma fronteira anterior à persistência por obra: o runner transacional lia o objeto de identidade somente depois de aguardar o pool e BEGIN. Corrigir isso e integrar a validade local do escopo ao runner existente reduz o risco de aplicar a futura ACL ao contexto errado. Não foi criada uma tabela/end-point fictício para aparentar conclusão do CG-03.

## Achado reproduzido no runner existente

`runTransaction(pool, identity, work)` recebia um objeto mutável. Se `identity.workspaceId` ou `identity.id` mudasse durante `pool.connect()` ou BEGIN, o set_config recebia o valor novo, não o contexto da chamada inicial. Uma mudança durante o callback também não era detectada antes do COMMIT.

A correção captura os dois campos próprios de dados antes do primeiro await e compara-os nos pontos de admissão. Getters não são invocados para obter identidade. A mudança observada causa403 `transaction_identity_changed`, não inicia trabalho sob outro contexto e não envia COMMIT. A captura mantém os identificadores exatamente como recebidos; validação UUID e autorização seguem nas fronteiras existentes. Campos adicionais de Principal não são descartados/modificados por este helper.

A reprodução modifica um objeto no servidor e usa pool sintético. Não demonstra que um cliente HTTP pudesse alterar esse objeto nem que produção tenha sido comprometida. O runner é real e também atende operações existentes; seu CI completo precisa passar, não apenas os novos testes.

## Admissão síncrona no runner

`runTransaction` admite um quarto argumento opcional `TransactionAdmission`, exclusivamente do servidor. A assinatura antiga continua válida. A função é checada antes de adquirir conexão, após aquisição, após BEGIN/configuração, antes e depois dos statements do cliente emprestado e imediatamente antes do COMMIT.

Falha observada fica retida naquela transação. Mesmo que o callback capture a exceção e restaure os dados/relógio, não ocorre novo despacho nem COMMIT; ROLLBACK e release não passam pelo guard recusado. Se a recusa ocorre após adquirir conexão mas antes de BEGIN, libera a conexão sem iniciar transação. Um guard async ou que retorne valor não é aceito como autorização; erro arbitrário do guard é sanitizado.

COMMIT confirmado continua confirmado, ainda que o prazo expire durante a confirmação. Se a confirmação é perdida, conserva `transaction_outcome_unknown` e não repete o negócio. O guard não redefine resultado de transação já enviada. Preservados erro de conexão, timeout SQL, isolamento de app.*, command tags, listener estável e sem retry de release.

O contrato do store continua exigindo aguardar todas as consultas no callback; não disparar trabalho SQL em fire-and-forget. A checagem local não substitui constraints/RLS/locks, limites de driver nem análise de concorrência do store.

## Lease do resolvedor e ponte de transação

O callback de `withResourceScope` recebe agora `(context, lease)`. Callbacks que recebem somente context permanecem compatíveis. `ActiveResourceScope` é opaco, pertence à fábrica e existe somente enquanto o callback aguardado executa. O contexto continua sendo dado imutável, não credencial persistente.

`assertResourceScopeCurrent(principal, context, lease)` verifica instância do principal, contexto exato, campos normalizados da pessoa, cancelamento, relógio não regressivo e validade/idade dos dois snapshots já consultados. Falha observada invalida definitivamente a lease. Fim normal ou excepcional do callback também a invalida. JSON/cópia/boolean/prova anterior/outra fábrica não são leases válidas. A checagem não faz nova rede e não possui timer que retenha dados depois do callback.

`src/infrastructure/resource-transaction.ts` exporta `runResourceTransaction`, conectando o resolvedor ao runner existente e ao guard. A segunda consulta da autoridade continua ocorrendo antes de abrir a transação. Depois, filas do pool/BEGIN/configuração e statements são cobertos pela validade LOCAL da lease. A aplicação recebe o mesmo cliente emprestado e contexto, sem propriedade sobre a conexão física.

**Fronteira explícita:** mudanças na autoridade externa durante a espera que ainda não constem nos snapshots não podem ser detectadas apenas pelo relógio local. O futuro store precisa validar revisions/ACL por recurso no ponto de serialização e manter locks/isolamento adequados. A ponte NÃO implementa resource-access-store.ts, tabelas, identities, bindings, emissão de sessão externa ou ACL SQL. Ela não está ligada aos handlers/runtime; nenhum acesso Novo GEO foi ativado. A autorização de ticket, produto/contrato, notes-only e MFA continua obrigatória.

## TDD e revisão local

- Baseline do recorte:139/139 (82resource-access+57external-resource).
- Suite de transação:15casos; RED3pass/12fail. Cinco casos reproduzem a identidade mutável; os demais introduzem/revalidam admissão, erros e compatibilidade de COMMIT.
- Suite lease/ponte:19casos; RED19falhas por interfaces ausentes, depois GREEN.
- Conjunto final:173/173, zero falhas/skips/cancelamentos/TODO.34testes novos,139preservados.
- Quatro mutantes detectados: identidade viva no lugar da cópia4falhas; omitir guard pré-COMMIT4; permitir restaurar guard após recusa1; reter lease encerrada2. Código restaurado e conjunto173/173 repetido.
- Typecheck focal: TypeScript5.8.3, targetES2022/libES2023/NodeNext/strict passou. Tipos Node25.1.0 do ambiente são só harness; não comprovam lock do projeto. package.json original conferido pelo blobd71a4016a097692674d11df426a4aca25d5af9a1, não alterado.

Comando focal:
`node --experimental-strip-types --test --test-reporter=tap tests/resource-access.test.ts tests/external-resource.test.ts tests/resource-transaction.test.ts tests/transaction-admission.test.ts`

Fonte local é recorte dos pacotes anteriores e arquivos lidos no GitHub, não clone completo. Git direto continuou indisponível por DNS. Supabase CLI não estava disponível; não inventado nome de migration e não criado schema remoto para contornar. Exportação de fonte por workflow bloqueada anteriormente não foi repetida. Dependências auxiliares errors/input-values/canonical/scopes/model/sql/package tiveram blobs conferidos e não entram no diff.

## Gates e sequência

Este checkpoint precede o CI. Após o push, validar o attempt da fonte nova e seu ZIP/digest/fingerprint/logs, sem somar resultados anteriores. O CI SQL existente é regressão do backend, não prova da futura ACL por obra. Browser/CodeQL/preview precisam ter seus estados próprios registrados.

Revisão realizada pelo próprio implementador; revisão independente permanece pendente. Importação canônica e preview não são considerados resolvidos por alterar código. Instabilidade histórica de notes-retry também não foi declarada corrigida. API0.27.0/schema0.19.0,12migrations/lock, grants/fatores/providers e release flags preservados. Scopes de Thiago permanecem contexts:resolve/tickets:read.

Próxima fatia: qualificar a autoridade e implementar store/migration CLI com FKs compostas, ACL antes de LIMIT/cursor/aggregate/replay, upgrade e SQL direto negando C ao gestor/dono sem C. Integrar a ponte somente após essa prova; usuários antigos devem permanecer compatíveis. Nenhum total de testes substitui esse trabalho ou o aceite operacional.

Decisões desta fatia: (1) recusar identidade alterada, em vez de silenciosamente fixar a cópia e permitir callback com outro contexto; custo: consumidores internos devem manter a identidade estável durante a transação. (2) não usar recusa após COMMIT como rollback fictício; custo: permanece janela em voo, que deve ser documentada/mitigada pelo store. (3) concluir a admissão local sem afirmar ACL SQL pronta; custo: handlers novos não podem ser ativados ainda.

Referência técnica externa consultada: PostgreSQL17, Row Security Policies e Explicit Locking, em https://www.postgresql.org/docs/17/ddl-rowsecurity.html e https://www.postgresql.org/docs/17/explicit-locking.html. Sustentam a necessidade de RLS e serialização; não comprovam implementação neste produto.
