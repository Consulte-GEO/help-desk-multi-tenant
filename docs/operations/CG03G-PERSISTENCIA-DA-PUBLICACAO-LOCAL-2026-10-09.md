# CG-03g — adaptador privado de publicação de cobertura (LOCAL)

**09/10/2026. Base: CG-03f LOCAL. Último HEAD remoto consultado: f60baed8022b28e067a702b3dd51031e86983017, PR26 draft.** Esta etapa não foi gravada no GitHub, não disparou CI e não aplicou SQL em ambiente hospedado. CG-03 continua aberto.

## Objetivo e vínculo com o plano

Dar implementação à porta `ResourceGrantPublicationStore` da CG-03f: mesma transação para conferir o estado, comparar revisão, substituir cobertura inteira, registrar observação e gravar o recibo/auditoria. O plano original exige grants atuais, recusa de respostas tardias e ACL também no PostgreSQL; arquivo/teste escrito não encerra esses critérios.

O escopo não inclui conexão à API do Novo GEO, identidade OIDC real, nova migration, abertura de categorias, handlers ou credenciais. O contrato complementar da origem continua não recuperado. O nome do login proposto e os nomes de helpers abaixo são contratos internos candidatos, não configurações aprovadas ou recursos já provisionados.

## Arquivos e composição

`src/infrastructure/resource-grant-publication-store.ts` implementa `createPostgresResourceGrantPublicationStore(pool)`. Reutiliza `runTransaction`; não cria outro framework transacional, conexão global, retry, dependência ou DSN. O pool é fornecido pelo servidor, não por um pedido do browser.

A composição é: publicador F → adaptador G → executor transacional existente → helpers SQL privados. O complemento G consome os candidatos D/E. É registrado depois de E pelo mesmo cenário de banco descartável; a chamada transitiva em `capacity-scenarios.ts` deverá migrar para o registrador principal quando houver checkout completo e promoção revisada.

O adaptador admite exclusivamente o login dedicado proposto `helpdesk_resource_publisher`, sem superuser/BYPASSRLS/CREATEROLE/CREATEDB/herança/membership de outro papel ou ownership de tabelas privadas. Também exige `session_user=current_user`. A normal `helpdesk_app` não é reutilizada para publicar permissões. Isso é defesa adicional: os helpers SQL verificam novamente o login e uma configuração ativa da conexão/fingerprint, mantida fora do acesso normal.

Essa configuração NÃO qualifica a fonte por si só. Um responsável ainda precisa aprovar a origem, custódia e provisionamento do publicador. O adaptador não possui integração de produção que construa esse pool nem é chamado pelo runtime.

## Protocolo do adaptador

A entrada de alvo é normalizada e copiada antes de qualquer espera. Dados variáveis são parâmetros SQL, não interpolação de comandos ou nomes de tabelas. UUIDs, IDs com zeros iniciais, revisões bigint como texto e instantes com microssegundos são preservados.

Dentro de uma única conexão:

1. BEGIN, contexto vazio/limites pelo runner existente e conferência do login privado.
2. `cg_publication_open` valida a configuração, serializa o alvo inclusive quando o grant não existe e fornece recibo anterior OU estado atual.
3. `findReceipt` pode devolver histórico; nesse caminho não são executadas substituição nem nova gravação de recibo.
4. `readState` fornece uma cópia normalizada do estado bloqueado. Estado malformado não é convertido em revisão zero.
5. `replaceGrant` valida alvo/revisão/hash, chama o helper e exige reconhecimento compatível. Não confunde reconhecimento de statement com COMMIT.
6. `appendReceipt` aceita somente o recibo correspondente à substituição. O resultado precisa ser literalmente `true`.
7. O callback só pode concluir em estado `done` ou `replay`; o runner confirma COMMIT e libera sua conexão.

Chamadas fora de ordem, repetidas ou concorrentes sobre o mesmo objeto transacional recusam a transação. Uma recusa observada permanece ativa mesmo quando capturada pelo callback. O objeto transacional deixa de funcionar ao fim de seu callback. Uma consulta iniciada sem await é aguardada antes de rollback/liberação; não é feita confirmação de trabalho incompleto.

COMMIT confirmado continua confirmado. Se o reconhecimento do COMMIT se perde, o runner mantém `transaction_outcome_unknown`; o adaptador não repete publicação e não inventa rollback de uma gravação já confirmada. Códigos SQL conhecidos de conflito/negação são mapeados para mensagens locais; a mensagem livre do banco não é retornada.

## Complemento SQL candidato

`supabase/candidates/cg_resource_publication.sql` acrescenta três tabelas privadas com ENABLE/FORCE RLS:

- `cg_resource_publishers`: vínculo explicitamente provisionado de conexão e fingerprint. Começa inativo; nenhuma conta é liberada pelo simples CREATE TABLE.
- `cg_resource_publication_states`: estado completo, revisão real do grant, hash, intenção e transação da publicação.
- `cg_resource_publication_ledger`: recibo imutável e auditoria de publicação, com `recorded_by`, `recorded_at` e xid atribuídos pelo banco. Não é outbox de notificações.

Os helpers `cg_publication_open`, `cg_publication_replace` e `cg_publication_append` são SECURITY DEFINER privados por necessidade de acessar tabelas sem conceder DML direto ao publicador. Têm search_path vazio e validação independente do login/target/configuração. PUBLIC, clientes Supabase e `helpdesk_app` não recebem EXECUTE; o login proposto recebe somente usage e os três helpers. Nenhum segredo é passado por parâmetro de negócio.

O helper de abertura usa lock transacional derivado dos campos JSONB validados, não do hash livre enviado pelo caller. Isso representa a estratégia para serializar a criação de um alvo ausente; colisão de hash apenas pode serializar alvos adicionais, não mistura suas linhas. O comportamento real do lock ainda depende dos testes PG17.

A substituição confere revisão esperada e integridade da observação. Recusa regressão temporal, mudança inconsistente de conteúdo sob a mesma revisão e origem/fingerprint incompatíveis. Substitui a lista inteira; a revisão devolvida é a efetivamente produzida, incluindo os avanços dos triggers existentes, não um `old+1` imposto pelo adaptador.

Uma publicação revogada mantém histórico, mas deixa o grant inativo e sem recursos. Não insere observação ativa E para uma revogação. Uma publicação ativa gera observação vinculada à revisão real. O estado completo pode ser relido para futuras comparações; grants alterados por fora do protocolo não são adotados automaticamente como revisão zero.

O recibo e a substituição devem compartilhar transação. Um constraint trigger diferido exige o recibo correspondente antes de confirmar o estado. A tentativa de atualização/exclusão do ledger é recusada. A fonte JSON é transmitida na representação canônica interna da aplicação e o SQL verifica os bytes/hash; isso não é uma implementação geral de RFC8785, nem autentica a fonte.

**Limite de validação:** o SQL G foi escrito e revisado, mas NÃO foi parseado/executado por PostgreSQL nesta rodada. O SQL E também continua sem execução real. A ausência de erro na verificação TypeScript não é validação de SQL. Não aplicar o candidato removendo seu guard.

## Testes realmente executados

Baseline F: 289/289. Nova suíte G: RED inicial com 45 falhas pela ausência do adaptador; GREEN 45/45. A revisão acrescentou 12 verificações, totalizando 57/57 novas. Conjunto final repetido após revisão/mutações: **346/346**, zero falhas, skips, cancelamentos ou TODO.

Os testes chamam o publicador e o runner reais com um transporte SQL simulado que registra comandos e injeta falhas. Provam sequência, parâmetros, validação de respostas, negação de login, encerramento, drenagem, erros e tratamento do COMMIT; não provam sintaxe SQL, privilégios efetivos, durabilidade ou locks PostgreSQL.

Mutações detectadas: retirar proteção do login → 9 falhas; permitir concluir sem recibo → 2; aceitar recibo alterado → 1; ignorar hash no reconhecimento → 1. Código correto restaurado e conjunto completo repetido. Os 12 casos adicionais são cobertura de revisão, não 12 falhas históricas descobertas.

Typecheck focal TS5.8.3/ES2022/libES2023/NodeNext/strict: aprovado com @types/node25.1.0 global. As primeiras verificações apontaram tipos faltantes, narrowing de estado de callback e mutação de fixture readonly; corrigidos sem alterar limites/lock/dependências do produto. Os logs iniciais e finais foram preservados. Não foi executado `npm ci`, audit, build ou CI integral desta fonte.

## Cenários PostgreSQL escritos e ainda não executados

`supabase/tests/resource-publication-scenarios.ts`: 15 subcenários para publicação completa, reenvio histórico, concorrência com a mesma revisão, criação concorrente ausente, mesma intenção concorrente, rollback antes do recibo, COMMIT real seguido de falha de transporte simulada, recusa da aplicação normal, tabelas privadas, revogação, mapeamento inativo, tenant errado, confirmação sem recibo, ledger imutável e grant alterado fora do protocolo.

O cenário se registra no runner existente, exige o banco `helpdesk_test` com os guards originais e depende da instalação bem-sucedida de D/E. Cria somente fixtures no cluster descartável quando executado. Senha aleatória do login de teste é gerada em memória, nunca anexada ao artefato. Essas 15 verificações NÃO foram contadas nos 346 testes executados.

## Revisão e sequência obrigatória

Autorrevisão realizada; revisão independente pendente. Primeiro executar E e G em PostgreSQL17 no checkout completo, analisar qualquer erro de setup/sintaxe/comportamento e corrigir com evidência, sem editar gate para obter aprovação. Não usar os totais de D para aprovar E/F/G.

Depois revisar a qualificação/provisionamento do publicador, os limites/tamanhos e o plano de locks com medição; gerar migration pela CLI, preservar as 12 antigas, atualizar schema/readiness/manifest e executar upgrade integral. Conectar handlers somente com identidade/fonte qualificadas e testes HTTP/ACL/replay. Não considerar erro conservador `unknown` uma licença para reenviar com outra intenção.

O bloqueio anterior de gravação SQL no GitHub não foi contornado. PR e produção permanecem sem este código. Nesta rodada não houve reinspeção Netlify nem alteração de grants/fatores/segredos/providers/gates. A falha histórica de notas, preview, evidência canônica, contrato da origem e aceites operacionais continuam separados.

Referências técnicas consultadas (não evidência de execução): PostgreSQL17 Explicit Locking, https://www.postgresql.org/docs/17/explicit-locking.html; node-postgres Transactions, https://node-postgres.com/features/transactions. Changelog Supabase não pôde ser lido pelo leitor web devido ao tipo de conteúdo; nenhuma versão de biblioteca foi atualizada.
