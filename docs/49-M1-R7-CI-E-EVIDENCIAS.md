# M1-R7 — CI independente do preparo de navegador e evidência isolada

## Objetivo e alcance
Dar continuidade ao P0 do R6: executar os gates existentes em ambiente apto, sem introduzir funcionalidades M2 ou outra camada de diagnóstico de runtime. Alteração limitada ao executor de homologação, preparação de fonte e workflow. API/interface 0.19.0, schema 0.18.0, núcleo transacional R6, lock e onze migrations preservados.

## Achados da revisão
O workflow anterior preparava Playwright antes de invocar `homologate:local`. Uma falha dessa etapa encerrava a sequência antes de executar instalação, aplicação e PostgreSQL, mesmo quando essas verificações não dependiam do navegador. O upload `always()` apontava para `evidence/` do checkout, que já continha logs, relatórios e imagens versionados. Isso permitia reempacotar históricos numa tentativa que nem chegou a testar. Não foi constatada aprovação indevida de produção: o gate de fingerprint/contagens já recusava código incompatível.

## Implementação
### Fonte de CI sem histórico de evidência
`scripts/stage-ci-source.mjs` usa Git e GNU tar no runner Linux, sem rede ou instalação. Valida SHA, IDs da tentativa, raiz do checkout e diretório temporário. Confirma HEAD e enumera entradas Git; recusa links de fonte, submódulos e caminhos incompatíveis. Cria uma pasta nova fora do checkout, extrai o commit sem `evidence/`, compara o fingerprint executável com o checkout antes/depois e só então informa a raiz ao GitHub via `GITHUB_OUTPUT`.

O histórico no checkout original não é apagado. A evidência da pasta nova começa apenas com `evidence/ci/source.json`, um recibo de preparação: commit, run ID, tentativa e fingerprint. Ele declara `tests_executed:false` e `platform_approved:false`. Não é assinatura nem prova de execução GitHub; IDs em um ensaio local são sintéticos.

Arquivo temporário do archive fica fora da raiz de código extraída, para não colidir com um eventual arquivo versionado de mesmo nome. Diretórios resolvidos contendo quebra de linha são recusados antes de escrever outputs. Um erro remove somente a pasta recém-criada por esta invocação, nunca uma pasta preexistente do usuário.

### Etapas independentes sem ignorar falhas
A etapa de homologação passa a usar `!cancelled()` e exigir somente que a fonte tenha sido preparada. Falha no preparo de navegador permanece falha do job; não há `continue-on-error:true`.

A variável não secreta `HELPDESK_CI_BROWSER_READY` leva o resultado de preparo ao executor. Ausente, conserva o comportamento local normal; presente, só `1` permite executar interface. `runChecks` mantém aplicação/PostgreSQL independentes e marca interface como `blocked/browser_tooling_not_ready` quando o preparo não foi aprovado. Dependências de instalação e aplicação continuam obrigatórias. O gate exige todos os resultados aprovados, sem skips; não há fallback para navegador global em caso de preparo recusado.

### Artefato da tentativa
O workflow executa os gates na fonte isolada e envia somente o `evidence/` dessa pasta. O nome contém SHA, run ID e tentativa. Não inclui os antigos logs do checkout. Em falha precoce, pode conter apenas o recibo de preparação; isso NÃO é homologação. A retenção configurada de 14 dias permanece inalterada.

## Aceite verificado nesta rodada
Quinze testes locais abrangem exclusão/preservação de históricos, duas extrações independentes, fonte divergente, identificadores inválidos, links, export-ignore, destino dentro do checkout, indisponibilidade de browser sem bloquear PostgreSQL no orquestrador, rejeição pelo gate, configuração do workflow, colisão do archive e quebra de linha no destino resolvido. Git/archive/tar são executados realmente em fixtures locais. O executor SQL dentro dos testes de orquestração é sintético e não é contado como teste de PostgreSQL.

## Correção revelada pela extração da fonte inteira
A primeira execução real da suíte na pasta extraída passou1189/1191 e falhou nos dois sentinelas que liam os manifests-base em `evidence/v015` e `evidence/v016`. Esses arquivos são entradas imutáveis de teste, não resultados de execução. Foram copiados byte a byte para `tests/fixtures/migration-baselines/v015.json` e `v016.json`, com regra -text em .gitattributes e hashes originais fixados no teste. Os históricos originais continuam preservados. Os dois sentinelas só mudaram o caminho lido; nenhuma comparação ou verificação de migration foi removida. A suíte posterior passou1192/1192 no checkout.

## Limites que permanecem
Workflow atualizado não executado no GitHub nesta sessão; interpretação das expressões foi revisada e o YAML foi inspecionado, não homologado pela plataforma. Sem pg instalado, PostgreSQL local, Auth real ou nova Function. A camada de autorização, isolamento e descarte de conexões não foi modificada nem re-homologada. Interrupção do job pode impedir o upload; ausência de artefato nunca significa aprovação. O pacote continua exigindo integração, execução real e revisão independente.

## Referências externas consultadas
A documentação de GitHub fundamenta `steps.outcome`, outputs, condições e artefatos, não comprova resultados do projeto:
- https://docs.github.com/en/actions/reference/workflows-and-actions/contexts
- https://docs.github.com/en/actions/tutorials/store-and-share-data
