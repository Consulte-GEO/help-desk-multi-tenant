# Consulte GEO M09a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execução inline autorizada nesta conversa; uma revisão fresh-context ao final.

**Goal:** Entregar escolha de formulários publicados Consulte GEO e transporte de rascunho/revisão/abertura com correlação e conciliação.

**Architecture:** Projeção privada para descriptor público exato; painel sobre dynamic-form/support-intake existentes; adapter HTTP sem credenciais próprias. Montagem operacional aguarda catálogo/origem/stores reais.

**Tech Stack:** TypeScript/ES modules Node22, Web Request/Response, DOM e Chromium/Playwright existentes. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-10-13-consultegeo-m09a-design.md`.

## Global Constraints

- Base f3cb786fd522fce436f1f4ad2e06844db4902b4e; mesmo worktree/PR31. API/interface0.28.0/schema0.21.0,14 migrations preservadas.
- Projeção não autoriza leitura; nenhum novo endpoint/capability de catálogo ou seed de origem.
- Sem retry automático; resposta desconhecida preserva a mesma intenção.
- Dados pessoais só em memória; limpar controles antigos e ignorar retorno tardio.
- Operação/sessão/Storage/providers das fixtures explicitamente sintéticos; nenhuma escrita na origem/produção.

## Review Focus

- Resposta válida de outro draft/ator/conta/versão não confirma uma solicitação.
- Troca de ação enquanto há intenção pendente não perde a conciliação.
- Escolha assíncrona e controles substituídos não reintroduzem dados descartados.
- Formulário público não divulga checklist, autoria administrativa ou condicionais internos.
- Ausência de origem/lookup não pode parecer acesso autorizado ou jornada hospedada disponível.

### Task 1: Projeção de configuração publicada

**Files:** `src/application/consultegeo-customer-configuration.ts`, `shared/consultegeo-request.js` e `.d.ts`, `tests/consultegeo-customer-configuration.test.ts`.

**Interfaces:** produz descriptor exato `{schema,product,id,version,contentHash,service,title,entries}`; entry `{action,priority,label,form,serviceWindow}`. Consome registro privado validado M04. Task2 consome só descriptor público.

- [ ] Escrever testes de publicação real M04 em fixture, draft/mismatch/privacy/cópia/unknown fields.
- [ ] Executar teste focal. Expected: nova função ausente, falha de assertion.
- [ ] Implementar projeção e parser compartilhado; executar testes. Expected: todos verdes.
- [ ] Commit e registrar resultado no ledger.

### Task 2: Painel e transporte

**Files:** `web/consultegeo-request.js` e `.d.ts`, `web/consultegeo-intake-api.js` e `.d.ts`, CSS próprio, `tests/consultegeo-request.test.ts`, `tests/consultegeo-intake-api.test.ts`, build.

**Interfaces:** painel consome descriptor Task1, draft/identidade contextual fixados pelo servidor e closure autenticada. Transporte produz API de `mountSupportIntake`, confirma somente recibos correlacionados. Nenhum adapter de memória no produto.

- [ ] Escrever negativos de troca/descarte/clear/late; recibo emprestado, HTTP/body/ETag contraditórios, erro desconhecido, chave/replay.
- [ ] Executar novos testes. Expected: assertions de módulo ausente.
- [ ] Implementar painel e transporte, reutilizando componentes atuais e limits compartilhados. Expected: todos verdes; typecheck/build verdes.
- [ ] Commit e registrar resultado no ledger.

### Task 3: Qualificação e prova integrada

**Files:** fixture loopback e browser próprios, registrar suíte em `scripts/test-ui-local.mjs`; `docs/integrations/NOVO-GEO-WIKI-M08-2026-10-13.md`, relatório143/evidências/checkpoints.

**Interfaces:** browser consome Task1/Task2 e os handlers atuais; dados/persistência sintéticos declarados. CI integral qualifica a fonte, sem chamar origem real.

- [ ] Provar desktop/mobile, cinco ações, ausência de criação em seleção/revisão, confirmação/unknown/replay e descarte. Expected: layout sem overflow, zero vazamento/XSS e nenhuma segunda abertura.
- [ ] Registrar matriz documental do wiki com paths/linhas/hash e lacunas reais de M08, sem reproduzir corpos/segredos.
- [ ] Executar gates locais apropriados e CI original Linux/Node22/PG17. Expected: zero fail/skip/cancel/todo, fingerprint atual.
- [ ] Revisão fresh-context do delta, fix pass TDD se necessário; relatório/pacote/PR31 draft e hashes.
