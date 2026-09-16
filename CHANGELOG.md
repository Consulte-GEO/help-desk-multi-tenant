# Changelog

## 0.2.0 — M1 em andamento, sem publicação

### Segurança e confiabilidade
- Reautorizar o chamado antes de responder a replay de criação; proteger cache por ticket/conta e privilégios atuais.
- SQL candidato com scopes restritivos, validação de autoria e transições de estado.
- Login e sessão PostgreSQL restritos; recusa ownership, memberships e parâmetros de conexão; TLS obrigatório.
- Guard de versão/schema/RLS/exposição no startup e observação segura de falhas de pool.
- Rate limit compartilhado preparado por IP confiável/principal/workspace, 429/Retry-After e falha fechada.
- Quotas de sessões/reenvios; tombstones e rotina técnica com dry-run e papel separado.

### API e interface — mudança da pré-versão
- Mensagens/notas/timeline deixam de retornar coleções ilimitadas: páginas de 50 por padrão, máximo 100, `next_cursor`, ordem decrescente.
- Cursores vinculados ao escopo; UI carrega páginas anteriores em ordem cronológica.
- Estado descarta respostas antigas e limpa conversa/notas ao mudar contexto.
- UUIDs canônicos sem alterar identificadores opacos; falhas transitórias retornam mensagem segura.

### Plataforma e configuração
- Nova variável privada obrigatória `HELPDESK_RATE_LIMIT_HMAC_KEY`.
- Runtime exige schema 0.2.0, após migrations 003/004; não misturar API nova com banco antigo.
- CI usa npm ci e ações fixadas, exige lock verdadeiro e audit. Lock ainda ausente por falha DNS.
- Executor de PostgreSQL local descartável, guards de destino e suíte SQL ampliada de 15 para 35 cenários.
- 186 testes locais aprovados; seis verificações HTTP em demo de memória; SQL real e browser não homologados.

### Não realizado
Sem alteração remota, publicação, migration aplicada, driver real instalado, audit concluído, bundle Functions, teste de carga, pentest ou homologação de produção.

## 0.1.0
Fundação local com arquitetura, domínio, API, migrations candidatas, demo e 90 testes locais. Evidências históricas em `docs/history/04-ESTADO-E-EVIDENCIAS-v0.1.0.md` e no commit base.
