# Relatório de desenvolvimento e verificação — UX10

## Entrega e limites

Cumulativo visual UX01–UX10 compatibilizado com a operação Consulte GEO M04/M09a/M09b. Foram integradas localmente as correções de contratos compartilhados e adaptadas as telas nativas de solicitação e configuração. Nenhum merge, push, deploy, escrita no banco, ativação de flag ou envio real foi realizado.

A inspeção inicial usou 1c6aa7e; a referência de código final é b4a6c90. O head documental ca40dfc foi conferido ao final e preserva as árvores de código. O PR31 permanece aberto/em rascunho. A CI operacional verde não inclui as alterações visuais deste pacote.

## Compatibilização realizada

| Arquivo/área | Decisão e resultado |
|---|---|
| dynamic-form.js e tipos | Preservados os recursos visuais de UX03/UX04; adicionados os contratos operacionais onChange/canEdit e descarte de respostas de geração anterior. |
| support-intake.js | Fases notificam a jornada externa; edição fica bloqueada nas fases não editáveis; a recusa a um replay não libera uma nova intenção. |
| support-intake.d.ts | Separadas as duas assinaturas onChange com Omit; snapshot de estado não é confundido com respostas. |
| timeline-state.js | A fonte operacional com transfer foi preservada como requisito somente leitura; não há substituição pela versão UX09 antiga. |
| scripts/build.mjs | União dos assets nativos M04/M09 com o cumulativo visual. Nenhum recurso foi auto-montado. |
| index.html | Links de estilo das duas telas nativas e retirada de duas etiquetas fixas de API0.27. O HTML não inventa a versão efetiva do backend. |
| consultegeo-request.js/.css | Tema Consulte GEO, descarte próximo do seletor, classes do host preservadas e preparação do adaptador antes de descartar dados anteriores. |
| consultegeo-configuration.js/.css | Tema claro/escuro, rótulos associados, resumo de operação, confirmação separada, cancelamento secundário e proteção da intenção quando o replay é recusado. |
| aplicador | Requisitos atuais e checkpoints coerentes, default sem escrita, sem force, sem rede e sem alteração de banco. |

As mudanças são de compatibilização e apresentação, com correções de estado de interface. A validação autoritativa e os writers de domínio não foram substituídos. O app integral é o mesmo UX09 com 24 alterações reversíveis; não foram acrescentadas novas ligações ao app nesta rodada.

## Testes executados

| Verificação | Resultado | Evidência |
|---|---:|---|
| Baseline frontend recuperado | 173/173 aprovados | Registro do ledger |
| npm test final no subconjunto recuperado | 190/190; zero fail/cancel/skip/todo | evidence/node-final.log |
| npm test sobre cópia exportada aplicada | 190/190; zero fail/cancel/skip/todo | evidence/export-node.log |
| Nova jornada composta em Chromium | 190 checks, zero falhas; 10 combinações de largura/tema | evidence/export-journey/results.json |
| App principal integral em Chromium | 134 checks, zero falhas; 23 cenários | evidence/export-app/results.json |
| Build exportado | Aprovado | evidence/export-build.log |
| Inspeção da saída | 81 arquivos, 102 referências, zero issues | evidence/export-assets.json |
| Typecheck focal UX10 | Aprovado | evidence/focal-types-final.log e comando abaixo |
| Sintaxe JavaScript/MJS | 73 arquivos, zero falhas | evidence/structural-final.json |
| IDs/atributos estáticos | 189 preservados em relação à UX09 | evidence/structural-final.json |
| Contraste de tokens selecionados | 47 pares aprovados | evidence/tokens-final.log |
| Aplicador em Git sintético | 26 testes aprovados | evidence/installer-green.log |
| Aplicação exportada sobre UX09 + contratos atuais | Verify 16 pendências/0 escritas; apply 16 escritas; nova aplicação 0 | evidence/export-overlay-apply.json |

Os 17 testes novos de compatibilização estão em `tests/ux10-compatibility.test.ts`. O total190 inclui testes anteriores presentes na árvore recuperada; não é a suíte global do repositório. As 190 verificações de navegador repetem critérios em cinco larguras (320/390/768/1024/1440) e dois temas; não são190 cenários independentes de negócio.

A aplicação exportada usa bytes reais dos arquivos frontend e dos contratos de referência, com um envelope Git sintético de teste. Não é a clonagem do backend completo nem prova de integração do PR remoto. A seleção de 16 arquivos alterados é relativa ao overlay UX09 já aplicado; o pacote inteiro continua cumulativo.

### Typecheck focal

Executado com as opções strict do projeto, declarações públicas recuperadas e tipos Node disponíveis no ambiente. O comando não desliga strict, mas também não valida a árvore backend ausente:

```sh
tsc --noEmit --strict --noUncheckedIndexedAccess --verbatimModuleSyntax --skipLibCheck \
  --module NodeNext --moduleResolution NodeNext --target ES2022 --allowImportingTsExtensions \
  --typeRoots /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/@types \
  tests/ux10-compatibility.test.ts
```

Em um checkout completo, usar `npm ci` e o comando original `npm run typecheck`; o caminho de typeRoots acima é da bancada, não uma configuração a introduzir no produto. `skipLibCheck` já é utilizado no projeto; importações de backend ausentes não são qualificadas pelo typecheck focal.

## Regressões reproduzidas antes das correções

Os logs RED preservam as falhas dos testes novos sobre as versões anteriores. Foram exercitados callbacks distintos, trava da jornada ao salvar, escolha tardia após bloqueio/ocultação, recusa de conciliação e nova intenção indevida, ausência de resumo, descarte antes de construir o adaptador e perda da classe do host.

A primeira bancada de apresentação encontrou rótulos com herança escura no tema escuro e cancelamento visualmente equivalente à ação primária. A rodada contrast-red contém170 checks aprovados e20 falhos; depois da correção190 passaram. O erro de tipo do callback de estado também foi observado antes de corrigir a interseção das opções. Não foram removidas as asserções para obter aprovação.

O teste histórico UX04 que fixava o hash do estado de intake foi atualizado explicitamente para o estado operacional M09a revisado. A asserção continua existindo; não foi usada para bloquear a correção necessária nem removida silenciosamente.

## Verificações que NÃO passaram localmente

| Comando | Resultado observado nesta árvore seletiva |
|---|---|
| npm run verify | Exit1: falta scripts/check-migrations.ts antes de prosseguir pelos gates globais. |
| npm run typecheck | Exit2: importações/tipos de arquivos não recuperados e diagnósticos de tipos restantes. |
| npm run integration:check | Exit1: falta scripts/check-integration.mjs. |

Os logs integrais são `evidence/npm_run_verify.log`, `evidence/npm_run_typecheck.log` e `evidence/npm_run_integration_check.log`. Há diagnósticos TS2307/TS2580 e outros como TS2339/TS2345/TS7006; não se afirma que todos desapareceriam apenas com instalação. Precisam ser reproduzidos e resolvidos na fonte completa. Nenhum deles foi convertido em skip ou adotado como aprovação.

O clone Git falhou por DNS neste ambiente. Foram utilizadas fontes recuperadas e verificadas por hash. O navegador não foi usado para autenticar ou gravar em um sistema hospedado: as bancadas offline carregam código real, mas usam identidade e respostas de rede fictícias. Na jornada, createHumanSession/createSessionFetch/createConsulteGeoIntakeApi são reais; isso prova a compatibilidade de composição testada, não a autorização da origem ou a persistência de PostgreSQL.

Não foram reexecutadas todas as bancadas completas UX01–UX08 nesta rodada. A regressão do app integral e a nova jornada foram executadas; os outros testes locais presentes participam do total190. As imagens contêm exemplos de prazos/configuração e não constituem política de atendimento aprovada.

## CI da outra frente — status atualizado

O run262 na fonte1c6aa7e falhou em PostgreSQL (394/403), com aplicação4487/4487 e interface206/206 aprovadas. A branch avançou para b4a6c90 e o run264 foi consultado completed/success. O head documental ca40dfc registra qualificação M09b e informa5096 testes da fonte b4a6c90 no CI original38493917973:4487 aplicação,403 PostgreSQL17,206 interface.

A falha anterior não é mais tratada como bloqueio corrente da fonte operacional corrigida. O bloqueio atual desta entrega é a falta de CI da composição UX10 ainda não integrada. `evidence/upstream-ci-summary.json` separa as revisões, a metadata consultada e as contagens atribuídas ao documento144. Não houve reprodução da correção de banco nesta frente visual.

## Revisão e continuidade

O mesmo implementador revisou diff, contratos, hashes, envio único, limpeza de contexto e composição. Não houve revisão independente nesta sessão; ela permanece no handoff para a integração. O UX10 não é aceite de acessibilidade integral, leitor de tela, PostgreSQL, HTTP/CSP, scanners, SMTP/Resend ou identidade real do Novo GEO.

Próxima prioridade: UX11/G0 no checkout integral, regressão da fonte final e qualificação HTTP/CI; depois consumo autorizado M09b e abertura M09c, começando por Incluir usuário. Lookup/arquivos exigem M08/M11 e não são liberados com fixtures. Ativação de atendimento e publicação técnica são estados diferentes.
