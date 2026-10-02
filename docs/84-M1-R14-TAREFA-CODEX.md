# Tarefa Codex — integrar e validar Help Desk M1-R14

## Objetivo
Integrar o cancelamento de corpos HTTP rejeitados na autenticação humana e preservar R10–R13. A tarefa não autoriza push, PR, merge, deploy, dados/usuários/segredos remotos ou abertura do gate de produção.

## Leitura e base
Ler PROJECT_HELP_DESK.md, README, AGENTS, handoff remoto 64 e documentos 81–84. Última observação remota: R9 `78bbb00112331531168ae24600604cb7f3148770`; reinspecionar antes de integrar. Não substituir a história upstream pela recuperação local.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

Preservar alterações concorrentes. Não executar reset/clean/stash automaticamente.

## Aplicação
Escolher UM patch: `helpdesk-m1-r10-r14.patch` sobre R9 sem incrementos ou `helpdesk-m1-r14-only.patch` sobre R13 exato. Outra situação exige reconciliar diffs. Conferir hashes originais, ausência dos novos arquivos e SHA-256 do patch no manifesto.

```bash
git apply --check /caminho/real/do/patch-escolhido.patch
git apply /caminho/real/do/patch-escolhido.patch
git diff --check
```

Conferir `after_sha256` e `result_source_sha256`. Não usar `changes/` para sobrescrever diretórios indiscriminadamente.

## Toolchain e testes
```bash
npm ci --ignore-scripts
npm run check:lock
npm run check:migrations
node --experimental-strip-types --test --test-reporter=tap tests/m1-auth-response-cleanup.test.ts
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Aceite: 14 regressões focais incluídas nos 1.347 testes Node; 209 PostgreSQL17 e 71 HTTP/browser executados sem falhas/cancelados/skips/TODO. Não ampliar timeouts ou usar tipos globais para aprovar a etapa padrão. Migrations históricas e lockfile byte a byte preservados. Fonte isolada e logs da mesma execução/fingerprint; preservar falhas.

Os três sockets da regressão devem usar apenas `127.0.0.1`, servidor criado pelo próprio teste e dados sintéticos. O SQL da suíte de banco exige PostgreSQL17 local novo/descartável com login restrito. Não usar o Supabase compartilhado para simular indisponibilidade ou suíte destrutiva.

## Revisão funcional
- Recusas 400/401/403 do provedor continuam 401/unauthorized no Help Desk.
- 429/500/503 continuam 503/auth_unavailable.
- Uma tentativa de cancelamento do corpo, sem ler erro do provedor e sem aguardar cleanup.
- Cancelamento que falha, rejeita ou não conclui não muda a resposta, não faz SQL e não deixa rejeição sem tratamento.
- Sucesso permanece no leitor de 64 KiB/5 segundos e na resolução privada por workspace.
- Não modificar endpoints, scopes, JWT metadata, senha/MFA ou sessões M2M.

## Após os gates
Com autorização específica e ambiente isolado, executar os clientes R11/R10/R12 existentes. Sessões encerradas no R11 não podem ser reutilizadas nos demais. Gravações R12 exigem mesmo executionId/chaves na recuperação deliberada. Não gerar chave nova após resultado incerto. Correlacionar efeitos e outbox no banco; intenção não comprova entrega.

## Entrega
Atualizar estado/handoff com branch/commit/fingerprint, CI, logs, falhas, riscos e efeitos externos. Diferenciar IMPLEMENTADO, TESTADO_LOCALMENTE, SQL_EXECUTADO, BROWSER_EXECUTADO, DEPLOYADO, HOMOLOGADO e OPERACIONAL. M1 aberto até o aceite real; M2 não iniciado por esta correção.
