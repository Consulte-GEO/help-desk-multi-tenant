# Qualificação PostgreSQL — pendência obrigatória R02

## Situação

O container não possui PostgreSQL/psql, e rede do clone esteve indisponível. O DDL candidato NÃO foi executado, e os 9 testes de transporte SQL usam um double de conexão. Não há evidência de RLS, DDL, locks ou durabilidade real.

## Instalação e fronteira de segurança

Usar PostgreSQL 17 local descartável, nunca a suíte contra a produção. Inventariar estado e schema atual antes de promover. Gerar arquivo oficial pelo fluxo de migration existente após revisar o candidato. O pacote deliberadamente não introduz um timestamp fictício em supabase/migrations.

O papel `setup_import_app` deve existir, ser restrito, não ter propriedade do schema, SUPERUSER, BYPASSRLS ou CREATEROLE e não estar acessível no navegador. A conexão do adaptador deve realmente assumir esse papel, não postgres. Qualificar memberships/admin options herdadas, schema exposure/Data API e default grants — o teste simples de role no adaptador não é uma auditoria completa de privilégios.

O SQL candidato falha sem `setup_import.candidate_install='r02-reviewed'`. Esse marcador apenas reduz aplicação acidental; **não é autorização nem substitui revisão**. O schema deve ser novo no banco descartável. Não há DROP nem limpeza automática de dados. Criar uma nova base descartável para repetição.

## Sequência mínima com evidências

1. Instalar candidato em base vazia e guardar DDL/versão/papel. Executar inspeção de pg_class/pg_policies/pg_proc/ACLs; confirmar schema não exposto e políticas de negação sem contexto.
2. Montar `createPostgresProcessRepository` com driver real e uma conexão compartilhada por transação. Não adaptar o driver abrindo um novo processo/conexão a cada query.
3. Rodar os cenários de serviço substituindo MemoryRepository por esse adaptador; usar resolver/scanner controlados somente como fixtures identificadas. Fechar e reabrir o pool/processo entre salvar e consultar.
4. Testar duas conexões simultâneas com expectedVersion igual: uma confirma e a outra recebe conflito. Repetir create e replay de artifact.verify.
5. Validar tentativa de leitura/escrita em outra conta/processo, role inadequada, identidade de solicitante inconsistente, scope GUC ausente e reutilização de conexão sem vazar SET LOCAL.
6. Recusar UPDATE/DELETE/TRUNCATE nas revisões/eventos/recibos. Recusar alteração de metadados imutáveis de arquivo, revisão sem predecessor e head sem revisão correspondente.
7. Recusar mutação de processo sem evento/recibo no COMMIT. Verificar erro de callback e erro SQL revertendo tudo. Cortar a conexão durante COMMIT: erro deve permanecer incerto até replay por mesma chave, nunca novo cadastro automático.
8. Criar snapshot com arquivo pendente/rejeitado/alheio e verificar recusa; arquivo ready válido é aceito. Snapshot de 800 KB com 500 artefatos deve ser legível; testar retenção/limites reais sem presumir throughput pelos testes unitários.
9. Validar durabilidade após reiniciar aplicação/conexão e recuperação/restauração por procedimento autorizado. Somente então afirmar persistência testada.

## Ainda fora do candidato

Upload/download efetivo, inspeção de bytes/arquivo, anti-malware, purge de retenção, short-lived capability, proxy de IA autorizado, outbox/inbox Help Desk e aprovação de plano. Não existe alteração de aprovação técnica, laudo ou concretagem nessa fatia.

## Referências consultadas

- PostgreSQL 17: Row Security Policies — https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- PostgreSQL 17: Explicit Locking — https://www.postgresql.org/docs/17/explicit-locking.html
- Supabase: Storage Access Control — https://supabase.com/docs/guides/storage/security/access-control

O fetch do índice changelog.md foi recusado pela ferramenta por content-type. Nenhuma feature nova dependente desse changelog foi habilitada; schema/driver/runtime permanecem candidatos a qualificação.
