# v0.4.0 — M1c, transações e sessões M2M (local; não publicado)

- Corrige sucesso falso sem command tag COMMIT e descarte após confirmação incerta; não adiciona retry automático.
- Control queries passam a transações na mesma conexão, contextos vazios e timeouts PostgreSQL 17.
- Valida UUID/expiração da troca M2M e só projeta o contrato público.
- Adiciona DELETE /v1/integration-tokens/current, revogação da própria sessão por digest; não afeta pares/credencial/conexão.
- Corrige stream vazio em DELETE sem aceitar payload; leitura limitada e erros seguros.
- Capacidade de revogação depende de adaptador configurado; demo não simula sucesso M2M.
- Migration 005 e schema 0.4.0; quatro migrations anteriores preservadas; 23 tabelas.
- 325 testes locais (51 novos); 46 SQL escritos, não executados; 10 HTTP aprovados. Browser/runtime reais e dependências reproduzíveis pendentes.
- API aditiva: 15 operações / 12 paths. Tickets/conversas preservam os shapes anteriores.

---

# Changelog

## 0.3.0 — Continuidade M1, sem publicação

### Correções
- Consultar o relógio contratual depois da espera pelas coberturas, não antes.
- Validar/projetar explicitamente principal humano e M2M; recusar respostas inválidas do provedor e privilégios incompatíveis.
- Limitar prazo e bytes de entrada; rejeitar UTF-8/comprimento inválidos, compressão não suportada e parâmetros duplicados/vazios.
- Estado puro de envios por contexto/canal/revisão, retry estável e proteção de rascunhos novos; captura consistente do formulário de criação.
- Novo módulo incluído nos assets e no servidor de demonstração, com regressão HTTP.

### Homologação e ferramentas
- `homologate:local` executa lock/ci/audit/application/postgres/interface e distingue falhas de etapas bloqueadas.
- `check:homologation` exige logs e fingerprint das fontes, recusa contagem ausente/skip/término anormal e evidência vencida/adulterada. Registro local não assinado; não é aprovação de plataforma.
- `verify:release` passa a exigir a evidência local; Netlify Functions e aprovação do destino continuam separadas.
- Runner local encerra apenas processos próprios, com timeout e limite de saída; demonstrações frescas por suíte.
- API/interface 0.3.0; schema esperado continua 0.2.0, sem mudança das quatro migrations.

### Evidência e limitações
- 274 testes locais aprovados (88 novos), nove verificações HTTP de memória e checagens estruturais aprovadas.
- Dependências sem lock por falha DNS; `npm run verify` falhou na falta de tipos locais. Checagem global não substitui npm ci.
- PostgreSQL: 35 cenários escritos, zero executados. Browser: 11 verificações escritas, bloqueio na navegação antes das asserções.
- Sem escrita remota, publicação, bundle Functions, homologação real, carga, pentest ou revisão independente.

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
