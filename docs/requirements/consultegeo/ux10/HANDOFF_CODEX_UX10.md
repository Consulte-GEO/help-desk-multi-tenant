# Handoff CODEX — UX10 compatibilizado

## Missão

Integrar o cumulativo visual UX01–UX10 à operação Consulte GEO, preservando as correções de M04–M09b. A fonte qualificada de referência é `b4a6c9012463d3709e51a9b17efe68997a7b2d7a`, com head documental posterior `ca40dfcef5a372e40f5cc1c58053c68d06b77b50`; sua CI264 passou, mas NÃO cobre este delta. Nenhum merge, push, deploy ou alteração de banco foi feito por esta entrega.

Leia `AUDITORIA_COMPATIBILIDADE_UX10.md`, `PLANO_DESENVOLVIMENTO_REVISADO_UX10.md`, o relatório e as instruções atuais do repositório. O ZIP não é checkout completo e não contém os writers backend de M09c.

## Não aplicar o pacote antigo sobre a operação

Há colisões reais em dynamic-form, support-intake, seus tipos, build e timeline. Este pacote resolve essas colisões. Ele requer contratos da operação atual; não é instalável na base 604478e isoladamente. Os ZIPs UX01–UX09 não precisam ser aplicados antes.

`changes/` contém 133 arquivos cumulativos; `integration/web/app.js` contém o app integral. A receita mantém as 24 alterações UX09. `reference-only/` é apenas reprodução/evidência, nunca uma pasta para copiar por cima do projeto. Não instalar seus package/tsconfig/manifest. O aplicador só escreve o delta autorizado de web/scripts/tests/docs e app.

## Aplicação

1. Identificar a branch corrente e preservar trabalho concorrente. Não resetar para um SHA antigo. Criar branch isolada de integração baseada na operação aprovada; o aplicador recusa as branches principais/operacionais conhecidas, detached HEAD e worktree suja antes de alterar.
2. Extrair o ZIP fora da raiz do repo. Conferir `SHA256SUMS.txt` e ler o manifesto.
3. Executar a verificação sem escrita, depois aplicar apenas se o estágio for reconhecido:

```sh
python "$PACOTE/tools/apply_ux10.py" --checkout "$REPO"
python "$PACOTE/tools/apply_ux10.py" --checkout "$REPO" --apply
python "$PACOTE/tools/apply_ux10.py" --checkout "$REPO"
```

`$PACOTE` é o diretório extraído que contém MANIFEST.json; `$REPO` é a raiz Git real. O último comando deve indicar estágio ux10 sem alterações pendentes. Nenhum `--force` existe.

Os dois checkpoints de entrada são: operacional íntegro com hashes conhecidos, ou overlay UX09 completo já sobre contratos operacionais atuais. Um arquivo intermediário arbitrário não é aceito. Se houver recusa, examinar e portar as mudanças; não recalcular a whitelist para “passar”. O avanço documental ca40dfc foi conferido sem alteração nas árvores de código. Para novos avanços, revisar a deriva explicitamente.

4. Revisar o diff. Conferir que auth/flags/SQL/lock/backend não foram alterados, timeline com transfer foi preservada e os seis assets operacionais coexistem com os assets visuais.

## Verificação mínima local e integral

```sh
npm test
npm run typecheck
npm run verify
npm run integration:check
npm run build
node scripts/visual-integration/check-assets.mjs
python scripts/visual-consultegeo/browser-check.py --output /caminho/fora/do/repo/evidence/ux10
python scripts/visual-integration/browser-check.py --output /caminho/fora/do/repo/evidence/app
python "$PACOTE/tools/test_apply_ux10.py"
```

A bancada Python precisa de Playwright e Chromium no ambiente de verificação. Aceita `CHROMIUM_EXECUTABLE` para o executável disponível. Não adicionar uma dependência de produto apenas para executar a bancada. Os testes offline não validam HTTP/CSP; executar também a pipeline/browser original do projeto e smoke hospedado com fonte exata.

Rodar os gates originais de homologação e PostgreSQL no runner descartável previsto no repo. Não retirar verificadores, não transformar falhas em skips, não renomear evidências históricas e não aplicar migração no banco real como parte da adaptação visual.

## Casos de regressão obrigatórios

Conferir callbacks operacional e visual, lock do seletor durante salvar, resultado de lookup após bloquear/ocultar campo, primeira recusa e replay recusado, mesmo corpo/chave em todas as conciliações, confirmação de descarte e falha de construção do adaptador sem apagar dados.

Conferir resumo de publicação de configuração, motivo, edição após cancelamento, resultado incerto e recebimento de resposta após encerrar. Não publicar uma prévia não salva, não admitir propriedades extras como autoridade e não montar recursos só porque o asset foi copiado.

Conferir caminho do adaptador: `createSessionFetch` acrescenta `/v1` uma vez; o intake usa caminhos sem esse prefixo. As fixtures usam esse transporte real, mas o servidor fictício NÃO deve entrar no produto.

## Limites e próxima etapa

M09b qualifica catálogo e GET/PUT de rascunho. M09c é a prévia/abertura durável; existência dos métodos `preview/create` no adaptador não prova um writer nativo operacional. A integração do host deve seguir capabilities do backend, não constantes de fixture.

Depois da CI da composição final, conferir HTTP, CSP, tipos MIME, logo/CSS/JS no preview e estados de login/readonly. Qualificar M09c e a origem real antes de liberar atendimento. O plano separa publicação técnica de ativação operacional.

## Reversão

Antes da integração, o aplicador não grava por padrão. Durante aplicação, mantém bytes anteriores e tenta rollback dos próprios arquivos em caso de erro, sem sobrescrever uma alteração concorrente. Depois de integrar por commit, reverter o commit visual revisado; não restaurar o pacote UX09 antigo nem reverter as correções de banco M09b. Não há rollback de dados exigido por este pacote, pois ele não executa SQL.

## Resultado esperado do Codex

Devolver SHA integrado, estado do PR, comandos e contagens reais da fonte completa, evidência canônica, eventuais pendências e URL de preview/deploy quando efetivamente gerados. Informar separadamente “publicado” e “operacional”. Se não houver homologação real, registrar exatamente qual etapa ficou pendente.
