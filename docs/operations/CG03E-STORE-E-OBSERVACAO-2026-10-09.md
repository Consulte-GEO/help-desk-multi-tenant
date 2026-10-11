# CG-03e — composição local do store com observação persistida

**09/10/2026 — implementação local, não integrada no GitHub.** Base remota conferida: `f60baed8022b28e067a702b3dd51031e86983017`, PR26. A gravação do complemento SQL pela ferramenta GitHub foi bloqueada. Não foi criado commit, atualizado ref ou executado CI desta fatia; dois blobs TypeScript sem referência foram criados antes do bloqueio. O código completo acompanha a entrega local, não o HEAD remoto.

## Contrato executado

Plano original, CG-03, especialmente identidade/recursos revalidados antes da transação e ACL/revisões no banco. O contrato real Novo GEO e a especificação complementar continuam não recuperados. A implementação não os substitui por dados inventados.

`src/infrastructure/resource-access-store.ts` acrescenta `runResourceTicketTransaction(pool, resolver, principal, ticketId, refs, operation, proof, work, signal?)`. Ele compõe a ponte CG03c existente, recebe somente o handle opaco que o resolvedor emitiu, consulta `helpdesk_auth.cg_lock_ticket_scope(ticketId, operation)` na conexão da mesma transação e compara o estado persistido com o contexto da lease antes de chamar o trabalho de negócio.

A comparação inclui ticket, pessoa, workspace, conta, binding, revisões do binding e do acesso, fingerprint, operação, instantes e conjunto exato de recursos. A prova de A não admite um chamado A+B, mesmo quando a cobertura geral da pessoa inclui B. A ordem dos recursos não muda o conjunto. Instantes canônicos equivalentes de três/seis casas são aceitos; uma diferença real de microssegundo é recusada. Identificadores externos não passam por conversão numérica.

A resposta SQL deve ter command SELECT, rowCount numérico 1, uma linha e o envelope explícito. `scope: null` resulta em 403 `resource_scope_database_mismatch`. Resposta malformada ou erro bruto de SQL resulta em 503 `resource_scope_database_unavailable`, sem propagar texto privado. Getters, campos ocultos e envelopes adicionais não são executados/adotados como autorização. Erros legítimos da lease/transação permanecem com a semântica anterior.

O callback continua sendo código do servidor, não sandbox para SQL arbitrário. Deve operar sobre o ticket admitido e manter RLS, ownership, scopes, produto/contrato, validação e idempotência. Uma consulta a outro chamado não é automaticamente proibida pelo objeto SqlClient: cabe aos comandos tipados e às políticas de linha. Não expor callbacks nem consultas livres ao cliente.

## Complemento SQL redigido — ainda NÃO executado em PostgreSQL

`supabase/candidates/cg_resource_observation.sql` acrescenta uma tabela privada `cg_resource_observations`, um trigger de integridade/imutabilidade e o helper de leitura/lock. A observação associa a revisão local do grant a bindingRevision/accessRevision/fingerprint, instantes e quantidade de referências. Registra autoria/horário do banco. Não é assinatura de provedor nem qualificação automática do manifesto.

A chave contém workspace/conta/binding/pessoa/operação/revisão do grant. O FK aponta para a identidade do conjunto, não para uma revisão mutável: assim o histórico da observação pode sobreviver à próxima revisão sem impedir a atualização do grant. Na leitura, só a observação da revisão atual, com metadata correspondente, é elegível. A inserção proposta confere snapshot completo/ativo e sua contagem; UPDATE e DELETE são recusados pelo trigger.

O helper usa os checks e políticas de CG03d, consulta somente o ator atual, não devolve dados para ticket não autorizado e mantém locks compartilhados de conexão, binding, conjunto do ticket, grant e observação até a transação terminar. O JSON retornado é dado privado, não credencial exportável. Datas são formatadas em UTC com seis casas antes de atravessar o driver.

**Estado:** SQL escrito e revisado por leitura, não analisado por parser PostgreSQL e não executado. Seus efeitos, locks, privilégios, sintaxe e concorrência devem ser comprovados no runner oficial. O fato de o TypeScript funcionar com transporte simulado não prova esse SQL.

## Origem confiável e limites

A nova tabela não autentica quem obteve uma observação. O produtor de observações precisa ser código autorizado do servidor, depois de qualificar CG01, validar a identidade e as permissões atuais e controlar publicação/CAS/revogação. Nesta entrega, somente a fixture propõe INSERT por administrador descartável; não há publisher de produção, setter público ou grant direto à aplicação.

bindingRevision e fingerprint são os valores da observação registrada pelo publisher; sua correspondência entre banco e lease comprova consistência entre os dois, não veracidade de uma origem externa por si só. Não considerar a coincidência de um hash como aprovação comercial, assinatura ou vínculo de pessoa. Não há live adapter ou associação por e-mail.

Continua necessário promover os candidatos por migration gerada na CLI, atualizar schema/manifest/readiness e testar upgrade integral. As 12 migrations antigas e seus hashes permanecem intactos. O complemento preserva o guard de banco descartável e não é instalador hosted. Não remover o guard e aplicar diretamente em produção.

Nenhum handler chama o novo store. A abertura estruturada continua pendente; o INSERT genérico de produto protegido segue bloqueado pelo candidato anterior. Fluxos globais/zero referências/obra não criada não ganham uma autorização implícita. Não há promessa de revogação distribuída instantânea nem alteração de COMMIT confirmado para falha após sua confirmação.

## Testes e evidência local

Baseline local: 173 testes disponíveis da referência/resolvedor/ponte/admissão passaram. Foram escritos 31 novos casos; primeiro 31 falhas por interface ausente. Um scaffold que apenas delegava à ponte CG03c existente produziu 4 passes/27 falhas: prova local da ausência da conferência persistida, não 27 incidentes independentes.

Implementação: 31/31 novos e 204/204 no conjunto focal, sem skips. Quatro mutações funcionais foram detectadas: omitir conferência do snapshot (24 falhas), omitir metadata (9), omitir conjunto de recursos (3), truncar micros com Date.parse (2). Código restaurado e os 204 testes foram repetidos com sucesso.

Typecheck focal TS5.8.3/ES2022/libES2023 passou com os tipos Node25.1.0 instalados globalmente; isso não é validação do lock do projeto. A primeira tentativa não encontrou os tipos Node no diretório usado; corrigido somente o caminho do harness, sem mudar dependências. A sintaxe TypeScript do cenário novo também foi conferida.

`supabase/tests/resource-scope-store-scenarios.ts` contém 15 subcenários dirigidos, além do grupo. Estão escritos, NÃO executados. A chamada é acrescentada ao registrador transitivo existente, após CG03d, usando o mesmo guard/cluster descartável. Não há skips condicionais ou fallback que finja negação. Fixture, SQL e store precisam passar juntos no CI da fonte completa.

Não foram executados CI, suíte completa Node, novo SQL17, novo upgrade, browser, build/audit/lock ou hosted nesta fatia. O CI1971/258/129 é somente histórico da base f60baed, não aprova os novos arquivos.

## Rulings e continuidade

Ruling: observação append-only associada à revisão local do grant, sem alterar o candidato anterior. Permite comparação exata e história consistente; exige publisher seguro, revisão de retenção e CAS antes de operação.

Ruling: adicionar store específico de ticket sem mudar a ponte genérica de CG03c. Evita impor metadados de ticket a contexts.resolve ou outros recursos; comandos e handlers ainda precisam ser integrados explicitamente.

Ruling: não repetir a gravação SQL bloqueada por outra codificação, ferramenta ou caminho. A branch remota é preservada; entrega local distinguida do PR. A próxima execução autorizada deve reinspecionar o HEAD, revisar os seis arquivos e validar a fonte completa antes de qualquer integração.

Referências externas consultadas: PostgreSQL17, Explicit Locking e Row Security Policies. Elas descrevem locks/políticas, não são evidência de execução deste candidato. A leitura de changelog.md do Supabase retornou tipo de conteúdo não suportado; nenhuma atualização de dependência foi inferida ou executada.
