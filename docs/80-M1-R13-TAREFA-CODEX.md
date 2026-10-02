# Tarefa Codex — integrar e validar Help Desk M1-R13

## Resultado esperado
Integrar a correção do runner de prontidão PostgreSQL e os incrementos R10–R12 ainda não integrados, sem regressões. Comprovar instalação, testes e estado; não ativar produção. Esta tarefa não autoriza push, PR, merge, deploy ou alterações em banco/usuários/segredos remotos.

## Contexto obrigatório
Ler PROJECT_HELP_DESK.md, README, AGENTS, documentos 64, 75 e 77–80, além do manifesto deste ZIP. Reinspecionar o remoto: última observação `78bbb00112331531168ae24600604cb7f3148770` no R9. Não presumir que continua igual. Histórico upstream não pode ser substituído por bundle de recuperação. Help Desk permanece genérico, multiproduto/multicontrato.

## 1. Conferir base e preservar alterações concorrentes
No checkout real:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

Não apagar ou guardar automaticamente trabalho alheio. Usar branch local de integração apropriada. Selecionar UMA variante: `helpdesk-m1-r10-r13.patch` para R9 sem incrementos; `helpdesk-m1-r13-only.patch` para R12 exato. Outro estado exige reconciliar diffs, sem force/reset ou aplicação parcial presumida.

Conferir antes da aplicação todos os hashes `before_sha256` (e ausência dos adicionados) no manifesto; depois conferir `after_sha256` e `result_source_sha256`. SHA do patch e do ZIP também estão disponíveis. Usar caminho real do patch selecionado:

```bash
git apply --check /caminho/do/patch-selecionado.patch
git apply /caminho/do/patch-selecionado.patch
git diff --check
```

Não aplicar as duas variantes e não copiar `changes/` por cima do checkout.

## 2. Executar a toolchain travada

```bash
npm ci --ignore-scripts
npm run check:lock
npm run check:migrations
npm run verify
npm audit --audit-level=high
```

Critérios: 1.333 testes de aplicação aprovados, typecheck padrão aprovado, 11 migrations históricas byte a byte preservadas, nenhuma dependency nova. Não substituir por tipos globais, remover asserções ou aumentar timeouts para aprovar. `npm ci` offline/suplementos anteriores não são evidência da instalação padrão.

## 3. PostgreSQL e interface
Usar o runner Linux apto e banco PostgreSQL 17 novo/descartável de propriedade da execução. O executor Docker verifica daemon local e porta de loopback. Nunca usar Supabase compartilhado para a suíte destrutiva; não executar reset, repair ou DROP de banco preexistente.

```bash
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Critério: **209 SQL reais e 71 HTTP/browser**, sem skips/cancelados/TODO; evidências do mesmo fingerprint e execução. Falha de ambiente bloqueia, não vira aprovação. Guardar logs também das tentativas malsucedidas. O workflow já existente prepara fonte isolada e não deve receber atalhos para arquivos históricos.

## 4. Conferir a correção R13
Executar também a regressão focal (15 testes, 13 novos):

```bash
node --experimental-strip-types --test --test-reporter=tap tests/m1-postgres-readiness.test.ts tests/m1-postgres-readiness-validation.test.ts
```

Verificar que opções inválidas não chamam o probe; versão ausente/NaN/string não concede prontidão; erros externos não são retornados brutos; metadata inválida interrompe imediatamente; última tentativa válida é aceita; defaults 40 tentativas/500 ms preservados. Os callbacks dessa regressão são sintéticos e NÃO contam como cenários PostgreSQL.

## 5. Aceitação hospedada é uma etapa separada e autorizada
Depois dos gates locais/CI, preparar execução R11/R10/R12 somente no destino previamente autorizado e isolado. A execução hospedada exige permissões de sessão/dados descritas nos documentos de cada cliente; este pacote não as concede. Manter HELPDESK_RELEASE_APPROVED fechado no ambiente de produção.

R11 encerra sessões; não reutilizar suas sessões revogadas para R10/R12. R12 precisa do mesmo executionId/chaves para recuperação deliberada e não autoriza cleanup automático de domínio. Outbox/intenção não prova entrega. Não executar perda de conexão deliberada contra banco compartilhado.

## Entregar
Estado/evidências e handoff atualizados com base/branch/commit, arquivos, migrations, contagens efetivas, gates não executados, riscos e efeitos remotos. Diferenciar IMPLEMENTADO, TESTADO_LOCALMENTE, SQL_EXECUTADO, BROWSER_EXECUTADO, DEPLOYADO, HOMOLOGADO e OPERACIONAL. M1 não se encerra por esses testes de helper; M2 somente após os critérios operacionais existentes.
