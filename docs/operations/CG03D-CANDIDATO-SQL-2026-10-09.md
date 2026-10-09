# CG-03d — candidato SQL de escopo por recurso

## Estado e contrato da fatia

Continuidade do plano de implantação do usuário, CG-03, sobre PR26/1a0235a. Este documento é checkpoint de implementação; resultados por execução ficam no relatório de entrega e no PR.

**Não é migration nem ativação.** `supabase/candidates/cg_resource_scope.sql` será executado exclusivamente pelo cenário PostgreSQL17 descartável registrado a partir de `rls.test.ts`. As 12 migrations antigas, seus hashes, manifest e schema 0.19.0 permanecem intactos. A CLI Supabase não está instalada neste container e o download oficial consultado não foi recuperado; não foi fabricado um nome de migration. A promoção requer CLI, revisão de schema/manifest/readiness e um upgrade próprio. Não aplicar este candidato à produção.

A fatia anterior preparou referência de recursos, autoridade, lease e admissão transacional; esta fatia prepara a persistência e exerce RLS real. A qualificação OIDC, identidade externa sem UUID Supabase fictício, adapter da autoridade, carregamento no runtime e comandos de publicação de snapshots continuam pendentes. As pessoas do teste são fixtures do modelo Supabase humano já existente; não são cadastros de origem real.

## Estrutura candidata

Seis tabelas privadas:

- `helpdesk_auth.cg_resource_connections`: conexão local e instância de produto. A presença da conexão identifica um produto protegido; inativá-la não transforma os tickets em legados sem escopo.
- `helpdesk_auth.cg_resource_bindings`: conta/conexão/tenant da origem, com FKs compostas e identidade imutável.
- `helpdesk_auth.cg_resource_grant_sets` e `cg_resource_grant_refs`: cobertura por pessoa/binding/operação, revisão de origem, validade e contagem esperada. Dados de staging são privados; modificar um item invalida o conjunto inteiro e serializa no pai.
- `helpdesk_core.cg_ticket_resource_sets` e `cg_ticket_resource_refs`: conjunto explícito de recursos de um ticket, fixado após fechamento do conjunto. Remover C de A+C não pode ampliar acesso silenciosamente.

Tabelas com ENABLE/FORCE RLS, sem acesso direto da aplicação. O helper privado só retorna autorização booleana e verifica ator, vínculo, scopes e ticket. Como os helpers existentes do projeto, a leitura de tabelas de configuração sem privilégios do app exige um SECURITY DEFINER restrito, com search_path vazio, sem SQL arbitrário e EXECUTE revogado de PUBLIC. Não é um setter público.

Referências externas mantêm conexão, tenant, tipo e ID. Comparação textual exata, sem números ou labels; tipo de recurso genérico, sem campo de obra obrigatório no core. Limites 100 recursos de ticket e 1000 recursos por conjunto de cobertura são limites técnicos candidatos, não quotas comerciais aprovadas.

## Decisões de autorização

Ticket de produto sem conexão de recursos continua sujeito aos controles anteriores. Ticket de produto protegido sem conjunto, com conjunto vazio/incompleto, binding inativo, cobertura inválida/expirada ou somente cobertura parcial é recusado. Recurso global ou obra ainda não criada NÃO é inferido de uma lista vazia: permanece negado até política própria.

Gestor, administrador e criador do chamado não ignoram a cobertura. A+B com cobertura A/B passa; A+C com a mesma cobertura é recusado integralmente. Recursos com o mesmo ID em tenants diferentes não se confundem. '0001' é diferente de '1'.

A política de recurso é adicional (restritiva), não substitui ownership, conta, produto, scopes, MFA, contratos e regras de eventos. Leituras e mutações têm operações distintas. Escrever notas não exige leitura da coleção de notas; o recibo da própria nota mantém o contrato anterior. O helper de idempotência também precisa conferir o recurso antes de devolver o snapshot antigo.

Um produto protegido não aceita abertura genérica sem os metadados de recurso. Nesta fatia não existe comando seguro para a abertura estruturada: ele deve ser implementado antes de ativar esse produto. Não liberar o endpoint antigo por ausência do comando novo.

## Concorrência e validade

Uma consulta autorizada retém locks compartilhados nas linhas locais da conexão/binding/conjunto de ticket/cobertura. Uma mudança nos itens da cobertura invalida e bloqueia o pai; revogar o pai aguarda uma consulta já serializada. Após a revogação confirmada, outra consulta é recusada. Isso NÃO cancela bytes já lidos nem observa sozinho uma revogação que ainda não chegou da origem.

O predicado SQL consulta a cobertura persistida atual, mas ainda não compara as revisões locais com o binding/accessRevision da lease de CG-03c. Não há `resource-access-store.ts` de produção nem publicador autorizado/CAS de snapshots nesta fatia. O adapter deverá qualificar a origem e vincular essas revisões na mesma transação antes de conectar os handlers. Os dados do scenario são publicados somente pelo administrador do banco descartável.

A habilitação inicial de proteção de um produto, publicação de cobertura e ligação da fonte real precisam de procedimento de corte/versão/autoridade com atendimento fechado. Este candidato não prova segurança de habilitar proteção pela primeira vez enquanto existem leituras legadas em voo.

## Testes e registro

Os cenários usam o `HelpdeskService`, `PostgresUnitOfWork`, `runTransaction` e driver pg reais sobre o banco próprio do runner. Incluem SELECT direto, cliente dono/gestor/admin, tenant repetido, multi-recurso, ausência de metadados, aggregate/LIMIT, mensagens/notas/eventos, recibo de reenvio, GET da aplicação, privacidade das tabelas, FORCE RLS/PUBLIC, expiração, revogação, notes-only e bloqueio de revogação concorrente.

RED é observado sem implementação SQL, permitindo executar o comportamento anterior e mostrar linhas indevidamente visíveis. A existência do schema não é usada como aprovação e não há fallback que finja negação. Nenhum teste é pulado para aprovar o CI. A ausência de setup/schema é relatada distintamente.

Por limitação de checkout parcial, o registro novo é transitivo pelo módulo já invocado em `rls.test.ts`: `capacity-scenarios.ts` é um registrador pequeno; o código de capacidade anterior foi movido byte a byte para `capacity-workload-scenarios.ts`, sem modificar cenários, timeouts ou limites. A nova fixture é independente. Na promoção da migration, mover a chamada para o registrador principal e atualizar os testes de upgrade/readiness em checkout integral.

A suíte de upgrade existente usa outro banco descartável e não é alterada. Verificação de snapshots antigos nesta fixture é evidência de instalação do candidato sobre dados existentes; não equivale ao aceite completo de uma migration nova, ainda não gerada.

## Evidência desta rodada

RED real no CI `37928962688/1`: 1971 Node e129 interface passaram; o PostgreSQL registrou244 testes,232 aprovados e12 falhas (dez negativas comportamentais, uma asserção de instalação e seu grupo). A fixture conectou e executou normalmente. Não confundir esse resultado com falha de setup.

A implementação inicial em `2bb0e89` passou no CI `37929942706/1`:1971 Node,252 PostgreSQL e129 interface. O cenário novo contém20 subtestes SQL aprovados; a contagem inclui seu grupo. O artefato/digest/fingerprint serão mantidos no relatório com sua própria fonte. Acrescentadas seis verificações dirigidas sobre zeros, abertura genérica, separação read/write, conexão inativa, staging incompleto e FKs/produto; elas ainda exigem CI da fonte final.

Autorrevisão: o candidato não é política pronta para adoção remota. Não prova migração de identidades externas, lease/revisões da autoridade, HTTP, corte de rollout ou desempenho em grande volume. Não foi alegada correção da ocorrência histórica de notas. Nenhum teste ou gate antigo foi removido para aprovar a fatia.

## Referências e próximos gates

Fonte vinculante: plano de implantação, CG-03 e constraints 15–27; critério de ausência de migration fabricada e de SQL real. A spec complementar e os contratos da origem ainda não foram recuperados.

Referência técnica externa consultada: documentação PostgreSQL17, Row Security Policies (`https://www.postgresql.org/docs/17/ddl-rowsecurity.html`), especialmente combinação restritiva AND e concorrência de consultas a tabelas de autorização. Referência de CLI: `https://supabase.com/docs/reference/cli/supabase-migration-new`. Leitura de changelog.md não completou por tipo de conteúdo não suportado.

Próximos passos: revisão independente; gerar migration via CLI; atualizar schema/manifest/readiness e testar upgrade integral; implementar identities/bindings qualificados e store que publica cobertura com revisão/CAS/proveniência; integrar runResourceTransaction aos handlers; testar HTTP direto/paginação/export; importar evidências canônicas compatíveis; resolver preview. Nenhum total de testes abre o piloto, aprova o provedor ou altera scopes de Thiago.
