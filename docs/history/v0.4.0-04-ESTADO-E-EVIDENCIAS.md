# Help Desk v0.4.0 — Estado e evidências do M1c

**Incremento entregue localmente. M1 permanece aberto; produção não aprovada.** Base: v0.3.0, commit `011bec31f0d2ef5622c9b4f401edc9fc753a65e5`. Branch local `work/helpdesk-m1-v0.4.0`. O commit final está no manifesto externo e no bundle da entrega.

## Resultados e alcance

| Verificação | Resultado | Evidência |
|---|---|---|
| Suíte local de aplicação/HTTP/estado/adaptadores controlados | **325 aprovados, zero falhas/ignorados/cancelados**; 51 além dos 274 de base | `evidence/m1c/final-tests.txt` |
| HTTP real de loopback | **10 verificações aprovadas**, com dados somente em memória | `evidence/m1c/final-ui-attempt.txt` e `final-http-smoke.json` |
| TypeScript com compilador/tipos globais do ambiente | Aprovado nesse ambiente; não equivale às dependências locais instaladas | `evidence/m1c/final-typecheck-environment.txt` |
| OpenAPI estrutural | 15 operações / 12 paths | `evidence/m1c/final-contracts.txt` |
| Sintaxe JS/MJS e AST dos scripts Python | Verificada | `evidence/m1c/final-syntax.txt` |
| Build | Somente frontend estático aprovado; não é bundle de Functions | `evidence/m1c/final-build.txt` |
| Scanner heurístico de segredos | Nenhum padrão reconhecido; não é pentest/auditoria integral | `evidence/m1c/final-secrets.txt` |
| `npm run verify` padrão | **Falhou**: tipos/dependências locais não instalados | `evidence/m1c/final-verify-manifest.txt` |
| Homologação agregada e publicação | **Bloqueadas** por lock ausente; demais etapas dependentes não foram aprovadas | `evidence/homologation/latest.json`, `evidence/m1c/final-release-gate.txt` |

A base foi reproduzida antes das alterações: 274 testes aprovados (`00-baseline-tests.txt`). Os testes de PostgreSQL e Auth externos da suíte local usam respostas controladas. Somar 325 testes locais aos 46 SQL escritos como se ambos tivessem passado seria incorreto.

## Código desenvolvido

Executor transacional com confirmação de command tags, descarte de conexões incertas e ausência de retry automático; envelope de controle na mesma conexão com timeouts locais; validação do retorno de troca M2M; DELETE da própria sessão curta; função privada candidata de revogação por hash; capacidade condicionada ao adaptador; validação de stream vazio; contrato e exemplo server-to-server.

API/interface 0.4.0, schema candidato 0.4.0. Cinco migrations no pacote; as quatro anteriores não foram modificadas. Nenhuma tabela nova, mantendo 23 tabelas candidatas. Não houve migração remota nem mudança de Auth/MFA.

## Falhas reproduzidas e correções

| Grupo | Reprodução anterior | Resultado após correção |
|---|---|---|
| Confirmação transacional / controle | 9 falhas em 11 testes | 11 aprovados |
| Sessões M2M / novo endpoint | 24 falhas em 26 testes | 26 aprovados; depois ampliados na revisão |
| Contrato/migration (sentinelas estruturais) | 2 falhas | 2 aprovados; não validam execução SQL |
| Capacidade sem backend | 1 falha | Recusa anúncio de capacidade não configurada |
| Stream vazio | HTTP devolvia 400 para requisição sem conteúdo; 6 regressões falhavam | Testes corrigidos e HTTP passou antes do bloqueio do navegador |

Os logs red/green em `evidence/m1c/02–17` preservam esses resultados. Fakes antigos de SQL foram atualizados para incluir os command tags reais esperados do driver; o fixture de troca M2M passou a usar UUID e relógio determinístico. Nenhuma expectativa de negação de acesso foi removida.

Revisão local, não independente. Foram revisados o diff, o contrato, os fluxos de erro e os efeitos da função candidata. O comportamento de PostgreSQL real continua a ser verificado, não presumido.

## Bloqueios atuais

**Dependências:** tentativa real `npm run deps:resolve` retornou `EAI_AGAIN registry.npmjs.org` (`18-dependencies-attempt.txt`). Sem lockfile, npm ci/audit ou revisão real da árvore instalada. Os tipos globais usados no typecheck não são os tipos fixados no manifesto.

**PostgreSQL:** Docker e servidor local ausentes; `test:db:local` recusou antes da conexão. **46 casos SQL escritos; zero executados.** Não foi usado o Supabase remoto como fallback e nenhum download de servidor foi concluído.

**Navegador:** o executor conseguiu realizar os 10 checks HTTP; depois Playwright bloqueou em `page.goto` com `ERR_BLOCKED_BY_ADMINISTRATOR`, antes das asserções do navegador. 11 verificações browser escritas, zero aprovadas nesta sessão. Nenhuma certificação visual/mobile/acessível.

**Runtime e operação:** Auth real, pooler/TLS, SQL/RLS/grants/locks/timeouts reais, bundle/execução Netlify Functions, carga, restore, pentest e revisão independente pendentes. Os novos timeouts aumentam round trips e exigem medição real antes de liberação.

## Matriz do M1

| Item | Avanço | Saída ainda necessária |
|---|---|---|
| HD-101 reprodutibilidade | Verificações e relatório atualizados | Registry, lock revisado, npm ci/audit e CI reais |
| HD-102 persistência | Confirmação transacional; 11 cenários SQL adicionais | Executar 46 casos em PostgreSQL 17 e corrigir achados |
| HD-103 runtime/identidade | Retorno M2M validado, self-revocation, controle transacional | Auth/pooler/Functions/revogação reais e impacto de latência |
| HD-104 limites | Timeouts server-side por transação/statement | Concorrência, carga/abuso e calibração |
| HD-105 interface | Stream HTTP vazio corrigido; 10 checks HTTP | Navegador e UI ligados ao backend homologado |

## Efeitos externos

**Nenhum push, PR, merge, deploy, migration remota, mudança de segredo, usuário ou MFA.** Não houve nova inspeção remota nesta rodada; estado antigo do GitHub/Supabase/Netlify não é apresentado como estado atual.

M2 não foi iniciado. Administração, intakes, anexos, SLA, filas/participantes, e-mails/webhooks/worker e suporte incorporado continuam fora desta implementação. Encerrar a própria sessão M2M não equivale ao módulo administrativo de credenciais.
