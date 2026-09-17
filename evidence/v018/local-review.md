# Revisão local do incremento v0.18.0

Revisão do próprio diff, não de revisor independente/subagente. Base:07dc51f263fbf2dcd49f4605bec0c1a43d57e2ca.

## R18-01: nota-only
- A leitura inicial muda somente no comando addNote. Os quatro caminhos que alteram o chamado preservam FOR UPDATE.
- A aplicação verifica canReadTicket e canWriteInternalNote antes da idempotência. RLS/validações do INSERT continuam presentes no SQL candidato.
- O trigger após INSERT obtém o lock do pai com seu owner privado, registra noteId/version e a verificação de efeitos segue diferida. Nota não altera version/updated_at e seu evento não leva uma versão lida antes do lock.
- Ordem de locks: note usa o advisory de idempotência antes do lock interno do pai; o namespace de outras operações é distinto. Não foi alegado teste de deadlock PostgreSQL real.
- NO KEY UPDATE continua conflitante com escritores e compatível com KEY SHARE. Nenhum índice, ACL ou policy de negócio foi ampliado.
- A comparação da migration011 com a função010 confirma que apenas o modo de bloqueio, comentários e schema_version mudaram. Os dez arquivos históricos são idênticos por bytes/hashes.

## R18-02: confirmações DML
- Todos os seis tipos de INSERT do Store compartilham o guard; os três UPDATEs chamam o mesmo guard.
- Rows vazio é adequado a statements sem RETURNING. Não confundir contagem1 com durabilidade: runTransaction continua exigindo COMMIT confirmado.
- Resposta incompatível antes de COMMIT tenta ROLLBACK, não retorna sucesso, não deleta cache nem repete callback.
- UPDATE0 válido preserva412; command errado, número em texto, rows inesperado e INSERT0 geram503. Erro e observação não incluem o retorno bruto do driver.
- O comportamento incerto após COMMIT não foi alterado. Há testes existentes da transação, além das regressões do novo guard.

## Correções de testes durante a revisão
- Sete assertions antigas falharam inicialmente apenas por versão/count do schema; atualizadas para0.18.0/11. Hashes históricos permaneceram iguais.
- Um teste HTTP novo usou inicialmente o nome inexistente add_message. Corrigido para o campo real reply; o contrato público não foi alterado.
- Dois cenários SQL antigos esperavam42501 em filtros USING. Agora exigem UPDATE0 com registro intacto ou recurso404 com nenhuma mensagem nova. PostgreSQL ainda precisa executar esses cenários.
- O helper tests/helpers/v018-driver.ts é rotulado como double. Não executa SQL/RLS/locks e usa uma conexão por teste, sem pretender validar concorrência real.

## Critérios ainda abertos
Registry/lock/npm ci/audit, execução PG17 com11migrations/196casos, proprietário real do helper, upgrade, Auth/pooler/TLS/Functions, browser, capacidade/restore. Nenhuma revisão independente, pentest ou ensaio de produção foi realizado.
