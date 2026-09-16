# Continuidade — v0.2.0 / encerramento do M1

## Estado de partida

Base anterior: `aa9aa9ec359cdd954c2162252c224676d7679275`. Branch de trabalho local: `work/helpdesk-m1-v0.2.0`. Esta entrega não fez push, merge, migrations remotas, deploy ou provisionamento de segredos. Antes de importar o pacote, reinspecionar os três ambientes informados pelo usuário; o GitHub estava vazio na leitura desta rodada.

Leia `04-ESTADO-E-EVIDENCIAS.md`, `06-M1-SEGURANCA-E-LIMITES.md` e o CHANGELOG. Não tratar o incremento como M1 homologado. Os testes SQL existem, mas não foram executados.

## Sequência de trabalho

### 1. Resolver HD-101 sem fabricar evidências

Em ambiente com acesso autorizado ao registry:

```bash
npm run deps:resolve
npm run check:lock
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
```

O primeiro comando resolve o lock real, instala e audita, parando em erro. Revisar o diff do lock e dependências diretas/transitivas antes de versionar. Corrigir versões inexistentes/incompatíveis ou alertas, caso surjam. Não afirmar que as versões candidatas deste pacote foram instaladas. Fixar também versões/digests da infraestrutura após a homologação, sem inventar digests de container. A checagem estrutural do lock não substitui npm ci, audit ou análise de supply chain.

### 2. Executar HD-102 em PostgreSQL 17 descartável

Com Docker local e dependências instaladas:

```bash
npm run test:db:local
```

O script cria e remove apenas seu container rotulado, sem volumes nem dados reais. Alternativamente, usar as URLs locais explícitas exigidas por `scripts/database-target.ts` e `npm run test:db`. Não substituir os hosts locais pelo Supabase de produção. A suíte exige banco novo `helpdesk_test` e não possui DROP SCHEMA para apagar trabalho anterior.

Executar as quatro migrations em ordem. São 35 cenários SQL, incluindo isolamento entre contas/workspaces, cache após revogação, scopes vivos, notas, identidade de autor, transições, FKs, idempotência concorrente, versão concorrente, rollback/contexto reutilizado, limite de sessões, rate limit compartilhado e manutenção restrita. Corrigir a causa de cada falha, acrescentar regressão e repetir em banco novo. Não remover asserts para obter resultado verde.

Os testes unitários dos adaptadores usam respostas controladas. Também é necessário exercitar `assertSafeDatabaseRole`, `assertSchemaCompatibility` e `assertDatabaseSecurity` com o runtime real. O guard do catálogo não substitui inspeção de policies/helpers/grants e owners.

### 3. Fechar HD-103 no destino autorizado

Após os passos anteriores, usar homologação aprovada e sem dados reais. Verificar Supabase Auth, schemas expostos, advisors, login restrito, pooler/TLS e `context.ip` recebido pelo Netlify. Empacotar e executar Functions com o driver pg instalado; o build estático não satisfaz esse passo. Executar expiração/revogação M2M e humana e medir quantidade de conexões, latência, 429/503 e reenvios. Nenhum segredo M2M ou do banco pode chegar ao browser.

A migration 001 propõe remover a execução pública da função `public.rls_auto_enable()`. O alerta continua no ambiente remoto. Verificar seu papel real antes/depois da aplicação autorizada e consultar Advisors novamente; o pacote não a corrigiu remotamente.

### 4. Fechar HD-104/HD-105

Os controles de limite e paginação estão codificados e passaram nos testes locais. Ainda faltam concorrência SQL real, teste de abuso/capacidade e calibração dos limiares. Aprovar retenção técnica e identidade operacional para manutenção, sem apagar mensagens de atendimento. A rotina inicia em dry-run e não possui agendamento ativado.

Para a demonstração local:

```bash
npm run demo
# Em outro terminal, com a demonstração em execução:
node scripts/smoke-local-http.mjs
python tests/browser-smoke.py
```

O smoke HTTP usa fixtures em memória e não prova PostgreSQL nem Netlify. O navegador foi bloqueado nesta sessão; executar onde a política permita normalmente, sem contorná-la. Inspecionar desktop/mobile, foco, teclado, erros, drafts, paginação, troca rápida de identidade/ticket e respostas atrasadas. Acrescentar testes visuais para o botão de carregamento anterior. Nunca misturar nota interna em payload público.

### 5. Decisão de avanço

Atualizar a matriz HD-101–105 com resultados por commit. Só chamar M1 concluído depois das validações reais. M2 vem depois: bootstrap, usuários/vínculos, catálogo, contratos/coberturas e credenciais auditáveis. Não ampliar canais, IA ou dashboards para ocultar as lacunas de isolamento/persistência.

## Revisão orientada aos arquivos

| Área | Arquivos prioritários |
|---|---|
| Cache e reautorização | `src/application/helpdesk.ts`, `src/infrastructure/postgres.ts`, migrations 003/004 |
| Runtime e conexão | `src/infrastructure/runtime.ts`, `postgres.ts`, `sql.ts`, `netlify/functions/api.mts` |
| Rate limit | `src/infrastructure/rate-limit.ts`, migration 004, `tests/rate-limit.test.ts` |
| Paginação | `src/application/pagination.ts`, `src/http/handler.ts`, adaptadores, `docs/openapi.json` |
| Estado da conversa | `web/conversation-state.js`, `web/app.js`, testes de estado e páginas |
| SQL verdadeiro | `supabase/tests/rls.test.ts`, `scripts/test-db-local.mjs`, `scripts/database-target.ts` |
| Reprodutibilidade | `scripts/verify-lock.mjs`, `scripts/prepare-dependencies.mjs`, CI, `package.json` |

Nenhuma revisão independente, pentest, carga, restore ou publicação foi concluída. O relatório separa evidências locais, tentativas bloqueadas e próximos testes necessários.
