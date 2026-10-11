# Ciclos 03/04 — contratos para a integração ainda pendente

## Ordem que não pode ser omitida

1. Checkout completo autorizado da base remota; aplicar apenas um dos patches correspondentes. Instalar pelo lock verdadeiro, não pelo package do harness (não incluído no pacote).
2. Executar a composição SQL E/G no runner PG17 já existente, corrigir achados e preservar as 12 migrations anteriores. A passagem do diagnóstico C01 é somente pré-requisito, nunca aceite SQL.
3. Qualificar identidade e fonte Novo GEO; gerar migration pela CLI e testar upgrade dos usuários antigos e constraints diferidas sem UUID Supabase fictício.
4. Implementar os adaptadores concretos abaixo, integrar handler/runtime/OpenAPI/assets com capabilities honestas, executar SQL/HTTP/browser, gerar CI e submeter a revisão independente.
5. Somente integrar/publicar no fluxo autorizado depois dos gates. Não alterar produção para servir de banco descartável.

## Diretório e executor de ticket — C03

O montador não substitui o bootstrap do runtime: usar o pool já conferido por TLS/CA, papel restrito, compatibilidade de schema, segurança e quotas. Nunca obter DSN, role ou gate de um corpo/header do cliente. Preservar o modo authenticationOnly e a liberação server-side existentes.

`TicketResourceDirectory.readTicketResources(principal,ticketId,signal)` retorna `null` ou `{ticketId,workspaceId,accountId,refs}`. Deve respeitar vínculo base da pessoa antes de devolver metadados, retornar a seleção completa do ticket e não modificar o principal. Não usar refs/header/email do chamador para construir autorização. Uma falha não se transforma em ticket legado.

`ScopedTicketHttpOptions.execute(client,principal,request)` deve adaptar os comandos/DTOs do HelpdeskService à conexão emprestada. Preservar validação, eventos, outbox, idempotência e notas separadas. É proibido criar outro pool, BEGIN/COMMIT interno ou retornar stream que ainda consulta o banco depois da transação. A ponte desta entrega confere escopo/revisões antes de chamá-lo, mas não fornece esse adaptador de negócio completo.

A montagem em produção precisa separar explicitamente os produtos/instâncias aceitos e não abrir a coleção antiga como alternativa ao `scoped_collection_not_ready`. Não filtrar somente uma página já obtida como se isso implementasse ACL antes de LIMIT/cursor/aggregate. Não desligar a proteção por falta de metadados.

## Store administrativo — C04

`MemberAdminStore.transaction(p,admission,work)` tem de prover uma única transação; executar admission após esperas e imediatamente antes do COMMIT; nunca depois de COMMIT confirmado. Falha de query ou trabalho não aguardado aborta. Não repetir mutation e não afirmar rollback após confirmação perdida.

`readWorkspace()` retorna todo o snapshot no contrato exato do domínio. Lock/versionamento deve serializar mudanças de membros E concessões administrativas no workspace. Ausência de grant significa nenhuma capacidade, não wildcard. Limite excedido é erro explícito, não array truncado. O estado inclui somente pessoas humanas registradas; autenticação e aprovação de concessões têm origens próprias.

`findPerson(id)` consulta pessoa existente e deve proteger a estabilidade do vínculo/estado enquanto o convite é gravado. Não cria por e-mail e não transforma identidade externa em usuário Supabase fictício.

`getReceipt(key)` confere pessoa/workspace/chave e devolve o envelope exato. `commitChange(expectedRevision,member,audit,receipt)` deve fazer CAS, histórico e recibo imutável de forma atômica. Um registro pending NÃO pode virar membership ativa por efeito colateral. Revogar ou alterar perfil não muda as cinco scopes ou grants de contas/obras.

A aplicação implementada não é um publicador de AdministrativeCapabilityGrant. Falta a configuração autorizada dessas concessões, com responsáveis/política, sem autoelevar Thiago. Não reutilizar o bootstrap do primeiro administrador. Aceitação do convite, canal de entrega e integração de nome/busca de pessoas precisam de fluxo próprio; `notification: not_requested` é deliberado.

Na implementação SQL real, testar: duas alterações na mesma revisão; revogação concorrente; expiração antes da confirmação; último administrador; sucessor sem gestão vigente; grants na conta/workspace vizinhos; perda da confirmação; replay depois de revogação; recibo de outro membro; auditoria ausente; erro do driver capturado; query pendente; upgrade dos humanos antigos. Não substituir esses testes pelos modelos em memória.

## Montagem da interface

A interface exporta `mountAdminMembers(root,{request,audience})`. `request` é o cliente autenticado, com cancelamento/deadline e sessão em memória. `audience` apenas permite limpar a tela; não concede acesso. Chamar `setAudience`/`destroy` nos pontos reais de troca de workspace e logout, preservando a distinção entre descarte local e mutação já enviada.

Adicionar os três assets à whitelist do build somente junto da montagem revisada. Não incluir `tests/admin-members-server.ts` em Functions/produção. A suíte `browser-admin-members.py` é chamada pelo runner existente, mas ainda precisa executar em ambiente com navegação loopback permitida. Validar desktop/mobile, teclado/foco, contraste, UI de confirmação desconhecida e limpeza ao trocar audiência. Os estilos são candidatos, não tokens aprovados da marca.

## Evidências e base

Os manifests congelados de entrada I/C01 não devem ser regenerados automaticamente para silenciar divergências. O arquivo `scripts/test-ui-local.mjs` mudou legitimamente nesta entrega para registrar a suíte; após revisão do diff, definir a nova fonte de evidência pelo fluxo canônico. As evidências antigas do PR/D continuam históricas.

O repositório remoto não recebeu estes arquivos. O pacote cumulativo contém somente arquivos novos/alterados em relação à base histórica, não todo o projeto. Aplicar patch com `git apply --check` antes de `git apply`, conferir diff/HEAD e executar todos os validadores originais no checkout integral.
