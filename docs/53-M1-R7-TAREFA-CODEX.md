# Codex — integrar M1-R7 e executar os gates reais

## Fonte e limites
Ler PROJECT_HELP_DESK.md, README/AGENTS e estado/handoff reais do checkout; depois docs49–53 do pacote. Remoto observado b9481b9fabde2fd9c442e44099bc17608b59571a. R2–R7 estão locais. Reinspecionar branch, HEAD e alterações concorrentes; não assumir autorização de push/deploy a partir deste documento.

## Integração local
Uma variante somente: `helpdesk-m1-r2-r7` se não há R2–R6; `helpdesk-m1-r7-only` somente para R6 exato. As duas não são cumulativas entre si. Ajustar os caminhos absolutos e o nome da variante, não os hashes.

```bash
git status --short
git branch --show-current
git rev-parse HEAD
node /caminho/PACOTE/source/scripts/check-integration.mjs --checkout /caminho/REPOSITORIO --package /caminho/PACOTE --variant helpdesk-m1-r2-r7 --stage before
cd /caminho/REPOSITORIO
git apply --check /caminho/PACOTE/patches/helpdesk-m1-r2-r7.patch
git apply /caminho/PACOTE/patches/helpdesk-m1-r2-r7.patch
node /caminho/PACOTE/source/scripts/check-integration.mjs --checkout /caminho/REPOSITORIO --package /caminho/PACOTE --variant helpdesk-m1-r2-r7 --stage after
```

Exigir exit0/ok:true before e after. Parar a integração em conflito e revisar a causa. Nada de limpeza do checkout, unsafe-paths, migration repair ou force-push. No Windows, usar cada comando em uma linha e caminhos locais próprios; o estágio de CI roda em Linux, não é instalador para Windows.

## Gates locais em ambiente apto
```bash
openssl version
npm ci --ignore-scripts
npm run check:lock
npm run check:migrations
npm run verify
npm audit --audit-level=high
npm run test:tls:local
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Exigir1192Node (inclui6TLS),209SQL e71HTTP/browser efetivamente aprovados, sem skips. PostgreSQL sempre novo/descartável com login restrito; nunca executar fixtures no Supabase remoto. Nenhuma execução native automática, nenhum registry alternativo e nenhum relaxamento de TLS/segurança para aprovar.

## GitHub Actions após autorização atual para publicação
Publicar a branch revisável somente após autorização. O workflow segue cobrindo codex/**, work/**, main e pull requests. Não exige segredos de Supabase/Netlify: usa banco descartável do runner. `stage-ci-source.mjs` obtém contexto do runner automaticamente; não chamar manualmente com IDs inventados como se fossem uma execução GitHub.

Confirmar o job referente ao novo SHA. Falha do preparo de Playwright não deve cancelar aplicação/PostgreSQL; a interface e o job devem continuar reprovados. Verificar os relatórios reais, não apenas o nome do artefato. O nome esperado é `helpdesk-homologation-<SHA>-<RUN_ID>-<RUN_ATTEMPT>`.

Ao recuperar o ZIP do artefato, seu conteúdo representa `evidence/` da fonte isolada. Conferir `ci/source.json`, o commit, a tentativa e `homologation/latest.json`. Se existir somente o recibo de preparação, não houve homologação. Confirmar sucesso do job na plataforma e integridade/fingerprint dos logs antes de integrar evidência. Não inventar logs ausentes. Repetir check:homologation no checkout correspondente, preservando históricos fora do latest atual. Publicação Netlify continua com verify:release; não remover o gate para permitir deploy.

## Após gates reais
Revisão independente; depois, com autorização específica, Function/pg/TLS/Auth/M2M, revogação e isolamentoA/B. Não usar flag de liberação global para testar. Fechar capacidade, restore e governança antes de declarar M1 aprovado; M2 permanece posterior.

Atualizar docs04/05 e backlog do checkout real preservando o histórico, registrar SHA/run/attempt/deploy separadamente e distinguir implementação, testes locais, PostgreSQL, browser, deploy, homologação e operação.

As duas referências-base de migrations agora ficam em tests/fixtures/migration-baselines, com os mesmos hashes originais; não restaurar sua leitura de evidence/ nem regenerar os arquivos para acomodar divergências.
