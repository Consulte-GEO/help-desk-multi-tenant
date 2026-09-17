# v0.18.0 — Notas sem escrita pública e confirmação das gravações

**Implementação local. PostgreSQL/upgrade e runtime remotos não homologados.** Esta entrega corrige duas incompatibilidades da base v0.17.0; não acrescenta módulos do produto nem anuncia M1 concluído.

## 1. R18-01 — A nota exigia UPDATE no chamado

### Evidência de código e causa
`HelpdeskService.addNote` consultava o chamado por `accessible(..., true)`. O adaptador PostgreSQL traduz esse parâmetro para `SELECT ... FOR UPDATE`. A policy `ticket_scope_update`, criada na migration 003, exige `tickets:write`. O contrato de escrita de nota, por sua vez, exige leitura do chamado, condição de operador e `notes:write`, não escrita pública.

A documentação PostgreSQL 17 confirma que policies UPDATE participam de SELECT FOR UPDATE/SHARE e que uma condição USING falsa normalmente filtra a linha, sem lançar erro. Portanto, a implementação podia anunciar `available_actions.add_note=true` para um perfil que depois não encontraria o chamado no bloqueio inicial.

Referência oficial: https://www.postgresql.org/docs/17/sql-createpolicy.html

A reprodução local usa um double que modela explicitamente essa interseção de policies. **Não é execução de RLS.** Os casos de servidor real foram escritos separadamente.

### Correção na aplicação
Somente o caminho de notas deixa de solicitar o bloqueio de atualização na leitura inicial. Continua autorizando o chamado e a escrita da nota antes do cache e da gravação. Nenhuma permissão é concedida por esse ajuste. Criar nota não aumenta a versão do chamado; mensagens públicas, prioridade, atribuição e transições preservam seus bloqueios e verificações.

Não foi adicionado INSERT RETURNING na coleção privada. O próprio recibo do comando continua separado do direito de consultar todas as notas.

### Correção candidata no banco
A migration 011 substitui `helpdesk_audit.record_conversation_effect()` para usar `FOR NO KEY UPDATE` no pai, no lugar de `FOR UPDATE`. O trigger continua privado, SECURITY DEFINER, com search_path vazio, registro de efeito e validação de ator/workspace preservados. O executor deve ser o proprietário aprovado das migrations anteriores. A API não recebe EXECUTE do helper.

O bloqueio interno mantém a serialização dos escritores, mas é compatível com KEY SHARE utilizado na proteção das chaves referenciadas. Solicitar FOR UPDATE após a inserção do filho pode criar uma escalada de bloqueio conflitante entre escritores. A troca reduz esse conflito específico; não elimina todos os deadlocks nem oferece uma promessa de desempenho.

Referência oficial: https://www.postgresql.org/docs/17/explicit-locking.html

Não se deve resolver a falha concedendo `tickets:write` ao perfil de nota, ampliando a policy UPDATE ou removendo o registro de efeitos. A escrita e o evento permanecem atômicos.

## 2. R18-02 — DML sem confirmação de uma linha

### Lacuna encontrada
O helper INSERT aguardava o driver, mas ignorava `command` e `rowCount`. Os três UPDATEs verificavam apenas a quantidade, sem validar o tipo do comando/resposta. Uma resposta incompatível ou um INSERT suprimido podia ser tratado como sucesso. A falha é particularmente relevante no cache de idempotência: sem o recibo persistido, um futuro reenvio poderia parecer uma primeira execução.

O PostgreSQL permite a um trigger BEFORE ignorar uma escrita retornando NULL; o driver expõe o comando e o número de linhas afetadas. Essa possibilidade fundamenta o cenário, sem afirmar que um trigger desse tipo existia remotamente.

Referências oficiais: https://www.postgresql.org/docs/17/sql-createtrigger.html e https://node-postgres.com/apis/result

### Contrato implementado
`assertSingleWrite(result, 'INSERT' | 'UPDATE')` é aplicado a todos os INSERTs do Store (chamado, mensagem, nota, evento, outbox, cache) e aos UPDATEs de estado, prioridade e responsável.

| Resposta do driver | Tratamento |
|---|---|
| Comando correto, rows vazio, rowCount numérico inteiro 1 | O statement foi confirmado; ainda é obrigatório confirmar COMMIT. |
| UPDATE correto, rows vazio, rowCount 0 | Mantém 412/version_conflict, incluindo recurso ocultado pela policy. |
| INSERT com rowCount 0; comando errado; contagem ausente/nula/textual/maior que 1; linhas retornadas inesperadas | 503/invalid_database_write_result; a unidade de trabalho tenta ROLLBACK e não solicita COMMIT. |
| Falha ao confirmar COMMIT | Mantém transaction_outcome_unknown e descarte da conexão, sem retry automático. |

As consultas não usam RETURNING; exigir rows vazio não afeta triggers que escrevem eventos em outras tabelas. A contagem reconhecida é a do statement principal, não uma soma de seus efeitos internos.

Não há limpeza automática de cache, mudança de chave ou execução repetida em caso de confirmação incompatível. Após revisão da falha, o consumidor deve reenviar explicitamente a mesma operação/chave. Nenhum texto SQL, payload privado ou detalhe do driver é incluído no erro ou no vocabulário fechado dos logs.

## 3. Provas locais

20 testes novos: 5 sobre o caminho de nota e a migration candidata, 12 sobre confirmações DML e 3 sobre HTTP real de loopback utilizando driver/identidade controlados. Esses 3 testes estão incluídos na suíte local, não somados como PostgreSQL real.

O teste HTTP de recibo suprimido executa nota e evento no double, recebe INSERT/0 para o cache, verifica 503, ROLLBACK, ausência de COMMIT e estado vazio. Depois remove a falha, reenvia a mesma chave, observa uma única nota e verifica replay sem duplicação. Isso prova a orquestração da aplicação, não triggers/RLS do servidor.

## 4. Testes SQL preparados

Foram acrescentados sete cenários principais: SELECT versus FOR UPDATE para perfil de nota; convivência com KEY SHARE retido; duas notas concorrentes; quatro reenvios concorrentes da mesma nota; trigger de teste suprimindo o recibo com rollback integral; UPDATE zero linhas mantendo conflito; metadados/ACL do helper substituído. O trigger de falha é criado apenas no banco descartável, restrito à chave do teste e removido em finally. Nenhuma proteção original é desativada para semear dados.

Dois casos de upgrade verificam preservação dos dados, owner/ACL/configuração e escrita/reenvio de nota com perfil restrito sobre chamado legado. A aplicação sequencial 001–007 → 008 → 009 → 010 → 011 foi preparada no banco separado `helpdesk_upgrade_test`.

Dois testes SQL antigos tinham expectativa incorreta: esperavam exceção em um UPDATE filtrado por USING, ou em um SELECT FOR UPDATE que devolve zero linhas. Foram alinhados a zero linhas/nenhuma mutação e 404 seguro, mantendo asserts de estado inalterado. Isso é correção do cenário esperado à documentação, **não demonstração de execução bem-sucedida**.

Total escrito: 196 cenários (180 principais + 16 de upgrade), não executados nesta sessão.

## 5. Compatibilidade e limites

API/interface/schema candidato 0.18.0; 11 migrations; 25 tabelas; 18 operações em 14 caminhos. Nenhum endpoint, dependência, tela, grant ampliado ou policy nova. Os dez arquivos anteriores estão preservados byte a byte e por manifesto; a nova migration tem hash próprio.

Não publicar backend 0.18.0 contra schema 0.16.0. O verificador de versão recusa essa combinação. Essa atualização exige homologação conjunta da aplicação, migration e proprietário real do helper. A alteração não reescreve recibos, timestamps, contratos ou conteúdo histórico.

Não foi comprovada execução SQL, Auth, pooler/TLS, Functions, navegador, capacidade ou restauração. A defesa depende do papel restrito e do proprietário aprovado. Não é proteção contra um banco/driver comprometido. Revisão local, sem auditor independente. M1 permanece aberto.
