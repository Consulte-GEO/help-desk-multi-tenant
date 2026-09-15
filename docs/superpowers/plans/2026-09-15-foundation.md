# HelpDesk Foundation Implementation Plan

> Execução nesta sessão, em diretório/repositório local isolado. Sem publicação remota.

**Goal:** entregar o primeiro corte vertical verificável do HelpDesk genérico.
**Architecture:** domínio independente de transporte e persistência; unidade de trabalho transacional; Postgres com RLS e schemas privados.
**Tech Stack:** TypeScript, Node.js 22, Web Request/Response, PostgreSQL 17, Netlify Functions.
**Spec:** ../specs/2026-09-15-helpdesk-design.md

## Restrições globais
Preservar workspace/conta/contrato distintos. Não copiar regras laboratoriais. Não usar service_role. Não aplicar migration remota. Toda demonstração explicitamente identificada e somente em loopback. Funcionalidade indisponível não deve fingir sucesso.

## Tarefa 1 — Políticas puras
Arquivos: src/domain/{model,errors,policy,contracts,workflow,canonical,calendar}.ts; tests/domain.test.ts.
- [x] Escrever testes de permissão por workspace e conta, ambiguidade, vigência, estado, canonicalização e calendário.
- [x] Executar `npm test` e observar falhas antes da implementação.
- [x] Implementar funções puras consumindo Principal, Coverage e Ticket.
- [x] Validar caminhos positivos/negativos e fronteiras de tempo.

## Tarefa 2 — Unidade de trabalho e casos de uso
Arquivos: src/application/{ports,helpdesk}.ts; src/infrastructure/memory.ts; tests/application.test.ts.
- [x] Testar dois tenants, contas irmãs, concorrência de criação, conflito de hash, If-Match, notas internas e rollback de outbox.
- [x] Implementar HelpdeskService usando UnitOfWork.run(principal, callback).
- [x] Serializar memória somente como double de teste; nunca fallback de produção.
- [x] Garantir snapshot e outbox no mesmo commit.

## Tarefa 3 — Persistência privada
Arquivos: supabase/migrations/*.sql; src/infrastructure/{postgres,authentication}.ts; supabase/tests/rls.test.ts.
- [x] Escrever cenários SQL de allow/deny com login real helpdesk_app.
- [x] Implementar chaves compostas, imutabilidade, RLS e grants mínimos.
- [x] Implementar adaptador pg com BEGIN/SET LOCAL/COMMIT/ROLLBACK e locks.
- [ ] Executar integração em PostgreSQL real. Bloqueio registrado: sem banco local/driver; guard impediu execução.

## Tarefa 4 — HTTP e interface
Arquivos: src/http/{handler,validation,serialization}.ts; netlify/functions/api.mts; web/*; tests/http.test.ts.
- [x] Testar ausência de auth, validação, erro seguro, paginação, 409, 412 e nota interna.
- [x] Implementar Request/Response; reaproveitar serviço transacional.
- [x] Interface sem segredo M2M no browser; não persistir tokens em localStorage.
- [ ] Validar interface com Playwright e capturas desktop/mobile. Navegação bloqueada pela política do navegador; sem capturas aprovadas.

## Tarefa 5 — Entrega e evidência
Arquivos: docs/*; .github/workflows/ci.yml; scripts/*.
- [x] Publicar matriz implementado/testado/pendente no pacote, não no ambiente remoto.
- [x] Executar testes, typecheck, validação estática SQL/OpenAPI e checagem de segredos.
- [x] Gerar ZIP, relatório, manifesto e instruções de revisão/continuidade.
