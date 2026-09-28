# Help Desk v0.19.0 — estado e evidências, 28/09/2026

**M1 aberto, M2 não iniciado; nenhuma publicação.** Base `94d827654d0ca19144b857e014acef1494f924b3`; branch `codex/m1-reproducibilidade`. Commit final na entrega e manifesto externo. Documento anterior preservado em `history/v019-04-before-m1-20260928.md`.

## Base e concorrência

Workspace inicial: somente .git, master sem commits/remoto. O bundle do ZIP v0.19.0 fornecido foi validado (histórico completo) e clonado em helpdesk/, preservando o repositório inicial. HEAD coincide com o handoff externo. Nenhuma versão posterior encontrada entre os arquivos HelpDesk de Downloads.

Git HTTPS falhou SEC_E_NO_CREDENTIALS. Leitura pelo conector GitHub confirmou Consulte-GEO/help-desk-multi-tenant com tamanho zero e branches vazias em 28/09. Não houve integração. Supabase/Netlify não reinspecionados; seus estados históricos não são evidência atual. Reinspecionar antes de integração autorizada.

## Mudanças e compatibilidade

- PROJECT_HELP_DESK.md incorporado do documento mestre fornecido.
- Lock real gerado pelo registry npm oficial. Instalação limpa e audit executados.
- SDK @netlify/functions 4.2.5 → 6.0.0, após audit detectar quatro alertas altos e um baixo. A árvore antiga de ferramentas de desenvolvimento foi removida pela atualização. O projeto não importa /dev (removido na v5); requisito Node >=22.12 da v6 cabe no engine >=22.16 <25 existente. Referência: https://github.com/netlify/primitives/blob/main/packages/functions/prod/CHANGELOG.md. Sem audit fix --force ou overrides.
- prepare-dependencies.mjs e local-process.mjs lançam o entry point JS informado pelo npm usando Node, argumentos separados, sem shell. Três testes de regressão: sucesso, interrupção em falha e argumentos/código de saída preservados.
- .gitattributes impede conversão EOL das migrations. core.autocrlf global havia convertido o checkout para CRLF. Restaurados bytes dos blobs HEAD após verificar SHA-256 contra manifesto. Onze migrations e manifesto idênticos à base; nenhuma migration nova, SQL ou grant alterado.

API/interface0.19.0, schema candidato0.18.0, 25 tabelas, 18 operações/14 caminhos. Nenhuma funcionalidade de domínio, endpoint ou UI modificada. Node24.20.0/npm11.19.0 em Windows nesta rodada; Node22 e runtime Netlify não homologados. Build continua estático; bundle Functions/pg pendente.

## Resultados reais

Logs relativos a evidence/m1-20260928/; relatórios agregados em evidence/homologation/.

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline | 1.040 executados, 1.028 aprovados, 12 falhas | 02-baseline.txt |
| Migrations | Falha CRLF inicial; 11 aprovadas após restauração exata | 01 e 06 |
| TDD npm | 2 vermelhos → 2 verdes; terceiro vermelho → 3 verdes | 04/05 e 24/25 |
| Resolução inicial | spawn EINVAL; depois cache padrão EPERM; cache temporário funcionou | 03/07/08 |
| Audit inicial | 4 high, 1 low | 10-audit-before.json |
| Lock/ci/audit final | Aprovados, zero vulnerabilidades reportadas | 13/14; homologation/latest.json |
| Árvore/licenças | 20 pacotes, HTTPS npm oficial e SHA-512; MIT/ISC/Apache-2.0 | 15 e 29-lock-review.json |
| Suíte final | **1.043 executados, 1.035 aprovados, oito falhas, zero skips** | homologation/runs/e0babfc5-9869-44e7-a520-c2356226eb00/application.log |
| Typecheck com deps locais | Aprovado | 28-typecheck.txt |
| Contratos/scan/build | Aprovados; scan heurístico e build somente estático | 19/20/21 |
| HTTP memória | 35 aprovados | 17-ui.txt |
| PostgreSQL | Docker indisponível; runner recusou antes de conexão | 09; relatório agregado |
| Browser | Playwright ausente no Python; zero checks DOM executados | 17-ui.txt |
| Agregador | lock/install/audit passed; application/postgres failed; interface blocked | 26-homologate-final.txt |
| Gate | Reprovado; publicação bloqueada | 27-gate-final.txt |

pg-native é peer opcional ausente; driver JS pg instalado. Inventário de licenças não é parecer jurídico, audit não é pentest. Primeira tentativa do agregador falhou ao lançar npm: logs22/23 e run f2ddaf7e preservados; nova tentativa usa executor corrigido.

## Oito falhas remanescentes, sem remover asserts ou criar skips

Seis testes falham EPERM na criação de symlink:

1. fingerprint refuses symlinked source trees;
2. migration loader rejects symbolic-file;
3. migration loader rejects symbolic-directory;
4. migration bytes reject manifest-symlink;
5. migration bytes reject supabase-symlink;
6. CLI refuses symlink without printing file content.

O teste symbolic-link substitution of data directory blocks automatic cleanup and preserves foreign files também não consegue criar o symlink. O runner remove seu diretório próprio e falha a expectativa preserved. Não é prova de remoção de alvo estrangeiro nem teste aprovado.

native environment cannot inherit production, PG service overrides or Node preload hooks espera /owned/home, enquanto path.join no Windows produz barras invertidas. O runner nativo real já recusa Windows. Não foram alteradas permissões, políticas do sistema, asserts ou timeouts para aprovar esses casos.

## Bloqueios e continuidade

201 SQL (185 principais+16 upgrade) continuam escritos e não executados. Docker ausente; runner native não suporta Windows. Nenhum servidor instalado ou fallback remoto utilizado. Os 36 checks browser permanecem escritos: Python do runtime existe, mas não contém Playwright.

O agregador exige TAP; Node24 neste terminal emitiu spec. A suíte já reprova por oito causas concretas. Antes de aprovar em ambiente apto, garantir reporter TAP de forma testada, sem relaxar contagens. Lock/ci/audit verdes não fecham HD-101 inteiro: regressão integral e bundle Functions ainda faltam.

Próximos gates: ambiente apto para regressão integral → PostgreSQL17/upgrade → RLS/grants → Auth/M2M/runtime → navegador → carga → restore/revisão/governança. Nenhum push/merge/PR/deploy/migration remota, alteração de usuário/MFA/secrets/bucket/dado externo. Sem carga, restore, revisão independente ou pentest nesta rodada.
