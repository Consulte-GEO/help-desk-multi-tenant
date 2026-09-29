# Tarefa executável — integrar R2–R8 e validar a toolchain real

## Objetivo
Integrar o pacote sem perder alterações concorrentes, comprovar a correção de tipagem do R7 e executar os gates reais. Não desenvolver M2, alterar migrations antigas nem habilitar atendimento.

## Fonte e limite
Último remoto observado: branch `codex/m1-reproducibilidade`, commit `b9481b9fabde2fd9c442e44099bc17608b59571a`. Último local anterior: R7 `fd50ccdbb5a152d4089afdc9cb160fef236a7710`. Reinspecionar antes de aplicar. O bundle é recuperação local, não história upstream. Ler PROJECT_HELP_DESK.md e docs54–58.

## Integração verificável
No shell POSIX, definir caminhos absolutos para o pacote extraído e checkout. Não executar sobre arquivos abertos em edição concorrente.

```bash
set -e
PACKAGE=/caminho/HelpDesk_M1_R8
CHECKOUT=/caminho/help-desk-multi-tenant
# Escolher UMA variante; usar helpdesk-m1-r8-only apenas no R7 exato.
VARIANT=helpdesk-m1-r2-r8
node "$PACKAGE/source/scripts/check-integration.mjs" \
  --checkout "$CHECKOUT" --package "$PACKAGE" --variant "$VARIANT" --stage before
# Prosseguir SOMENTE se a inspeção anterior sair com código zero e ok:true.
git -C "$CHECKOUT" apply --check "$PACKAGE/patches/$VARIANT.patch" && \
git -C "$CHECKOUT" apply "$PACKAGE/patches/$VARIANT.patch" && \
node "$PACKAGE/source/scripts/check-integration.mjs" \
  --checkout "$CHECKOUT" --package "$PACKAGE" --variant "$VARIANT" --stage after
```

Se houver divergência, preservar os arquivos e conciliar o diff. Não atualizar hashes do manifesto para aceitar mudanças. Não copiar a pasta source sobre o repositório.

## Executar e revisar
```bash
set -e
cd "$CHECKOUT"
npm ci --ignore-scripts
npm run typecheck
npm run check:migrations
npm run homologate:local
npm run check:homologation
```
Cada comando só conta se tiver sido realmente executado e aprovado. `homologate:local` inclui instalação, auditoria, verify, PostgreSQL e interface. Não dispensar etapa por duplicação de comando anterior. Docker/PostgreSQL devem ser locais e descartáveis; nunca apontar a suíte de fixtures para Supabase remoto. Não usar bypass de rede/browser.

A correção R8 deve eliminar TS2339 na propriedade `options`. Manter `strict`, o escopo completo de arquivos do tsconfig, a tipagem explícita de CiFixture e a leitura atualizada de f.commit. Não usar tipos globais como substituto do lock oficial.

Esperado no conjunto: 1192 aplicação,209PostgreSQL,71HTTP/browser sem skips. Caso de contagem diferente: revisar o que realmente executou; nunca completar manualmente o relatório. Fonte isolada deve começar sem evidência histórica. Preservar falhas e atribuir resultados a commit,run,attempt,fingerprint.

## Saída
Relatório com ambiente, comandos, exit codes, testes e falhas, evidências por hash, arquivos alterados, revisão independente quando disponível e estado de instalação/PostgreSQL/browser/deploy/homologação/operação. Não considerar M1 completo sem Function/Auth/M2M, capacidade, restore e aprovação operacional.

Push, workflow remoto, deploy, secrets, usuários, dados e migrations remotas exigem autorização atual específica. Este documento não concede essa autorização. Não ativar HELPDESK_RELEASE_APPROVED para contornar bloqueio.
