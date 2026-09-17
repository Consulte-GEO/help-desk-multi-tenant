# 0.11.0 — revisão consolidada e filtros de responsabilidade (não publicado)

- UUIDs estritos nos limites Auth/principal e seletores PostgreSQL; principal local e usuário Supabase continuam distintos.
- Recusa de NUL/surrogate isolado em textos sem substituição silenciosa; conteúdo Unicode válido preservado.
- Revalidação do parent e de cada linha de mensagem/nota/evento antes da serialização; coleção inconsistente falha integralmente.
- GET tickets aceita assignment=mine|unassigned somente para operador por conta, antes de LIMIT, vinculado ao cursor. UI preserva detalhe/rascunho e limpa no logout.
- Fixtures SQL com colunas explícitas e seis cenários SQL adicionais escritos; duas regressões browser escritas.
- Revisão acumulada e matriz de diferenças entre pesquisa, código, homologação e publicação. README/AGENTS/plano atualizados sem apagar histórico.
- API/interface0.11.0; schema0.9.0 e oito migrations preservados. 710 locais/32 HTTP aprovados;125 SQL/27 browser pendentes. Sem publicação.

---

# 0.10.0 — prontidão e integridade do banco (não publicado)

- Guard de catálogo ampliado: permissões efetivas por tabela/coluna/função, inventário, policies, triggers diferidos, constraints e índices. Sem leitura de dados de atendimento e sem auto-repair.
- Manifesto SHA-256 das oito migrations e loader limitado/estrito; mesmos bytes verificados são usados nas suítes SQL.
- Upgrade 001–007→008 escrito em banco local separado, preservação de fixtures/contrato/cache/privacidade e atribuição após atualização.
- Onze cenários SQL de drift e oito de upgrade; execução serial dos arquivos nos runners e CI.
- API/interface 0.10.0; schema permanece 0.9.0. Nenhuma migration nova ou endpoint adicional.
- M1 permanece aberto; código preparado para homologação, não autorização de publicação.

---

# v0.8.0 — Prioridade auditável e histórico autorizado

## 0.9.0 — responsabilidade pelo atendimento (não publicado)
- POST assignments: self-claim e release próprio/admin com motivo interno, ETag e idempotência.
- Disputa entre agentes, no-op e reenvio original; assigned_to não concede acesso.
- DTO interno resume estado, histórico privado sem IDs na projeção e sem outbox.
- Interface com controles, rascunho próprio e refresh explícito; lista/histórico reconhecem responsabilidade.
- Migration008 candidata; cache e guards preservados. Oito migrations/23 tabelas; schema0.9.0.
- Compatibilidade de snapshots antigos, validação fechada de evento e tipagem JS corrigidas.
- 635 testes locais e28 HTTP; SQL100/browser25 escritos, ainda não aprovados. M1 aberto.


- PATCH restrito, motivo interno, versão exata, replay reautorizado e no-op explícito.
- Evento de prioridade público minimizado; motivo somente para operador; outbox sem razão.
- Formulário de equipe e seção de histórico sob demanda, paginação e proteção de rascunhos/geração.
- Migration007 candidata e schema0.8.0, sem novas tabelas nem alteração das seis anteriores.
- 569 locais/22 HTTP aprovados; 82 SQL/22 browser escritos não aprovados. Sem publicação.
- Ampliação delimitada HD-301/105; M1/M2/M3 não encerrados.

# v0.7.0 — busca no servidor e caixa de chamados

- GET /v1/tickets aceita q/situação pública/prioridade, combinados antes de LIMIT; consulta parametrizada sem novos grants, helpers ou tabelas.
- Busca literal por assunto/identificador completo, equivalência ASCII/Latin-1, acentos significativos. Não pesquisa descrição, mensagens ou notas; substitui o filtro local limitado à página carregada.
- Cursores incluem filtros normalizados, mantendo compatibilidade do contexto sem filtros.
- Interface com aplicar/limpar, estado por sessão/consulta, descarte de respostas antigas, retry, contagens carregadas e limite de 500 na tela; preserva detalhe/rascunho.
- Capability ticket_search, OpenAPI atualizada (16 operações/13 caminhos), novo asset copiado e servido na demonstração.
- 486 testes locais aprovados (35 novos) e 17 checks HTTP; 68 casos SQL/17 browser escritos mas não aprovados.
- API 0.7.0/schema 0.5.0; seis migrations preservadas. Sem publicação. M1 aberto; parte HD-302 antecipada, não M2/M3 completos.

---

# v0.6.0 — diagnóstico HTTP seguro e PostgreSQL nativo

- Projeção fechada de logs: rota/código/fase/duração/release/correlação, sem dados de atendimento ou credenciais.
- Identificador de correlação inválido (inclusive somente hífens) é substituído; UUID aceito é normalizado.
- Fábrica de runtime compartilhada, diagnóstico de bootstrap/dispatch e recuperação após inicialização rejeitada; sem duplicar sucesso HTTP.
- Observer síncrono/assíncrono falho não modifica resposta. `rate_limit_exceeded` real e `Retry-After` preservados.
- CLI offline com contagens/histogramas limitados; rejeita metadados extras e objetos malformados sem coerção perigosa. Sem percentis exatos ou armazenamento de IDs.
- Executor nativo PostgreSQL 17 explícito, com cluster temporário/SCRAM/loopback, ambiente isolado, cleanup comprovado ou preservação. Sem instalador ou fallback; Docker padrão preservado.
- Cancelamento de subprocessos próprios por AbortSignal, sem procurar PID pela porta.
- 451 testes locais, 44 novos; cinco testes HTTP/CLI estão incluídos nesse total. 13 checks HTTP antigos passaram novamente. SQL e browser continuam não homologados.
- API/interface 0.6.0; schema 0.5.0; nenhuma migration nova, seis anteriores intactas. Não publicado, M1 aberto.

---

# v0.4.0 — M1c, transações e sessões M2M (local; não publicado)

## 0.5.0 — 2026-09-16

- Descoberta GET `/v1/support-contexts`: conta/instância/serviço autorizados, nomes públicos, paginação composta, scope existente e validação de projeção.
- Formulário guiado substitui UUIDs manuais; seleção única condicionada à lista completa, opções múltiplas explícitas, erro/retry, paginação e estado isolado por geração.
- Contextos deduplicados não escolhem contratos; resolução mantém ambiguidade, e criação revalida cobertura/suspensão. Seleção inicial de cobertura ambígua vazia.
- Helper SQL e índice privados na migration 006; schema candidato 0.5.0, cinco migrations anteriores preservadas, sem novas tabelas ou execução remota.
- 407 testes locais e 13 checks HTTP aprovados. 60 cenários PostgreSQL/14 browser escritos, ainda não homologados. OpenAPI 16 operações/13 caminhos.
- M1 permanece aberto. Lock/instalação/audit, banco, runtime, navegador e gates de produção não aprovados. Sem push, deploy, segredo/MFA ou alterações remotas.

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
