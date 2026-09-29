# M1-R5 — integração verificável e recuperação da fonte

## Objetivo e escopo
Executar o primeiro passo pendente do handoff R4: preparar a integração de R2–R4 sem substituir trabalho concorrente ou reaplicar um patch incorreto. O incremento acrescenta uma inspeção local, somente leitura, e uma fonte recuperável. Não altera o núcleo de atendimento, transações, contratos, RLS, API ou schema. Não substitui instalação, PostgreSQL, navegador ou validação hospedada.

## Interfaces
`node scripts/check-integration.mjs --checkout CAMINHO --package PACOTE --variant NOME --stage before|after`

Todos os caminhos referem-se a diretórios locais. O pacote deve conter `manifest.json` no formato `helpdesk.cumulative-increments.v1`. Stage é `before` por padrão. Não existe `--apply`, conexão remota, execução de scripts declarados no manifesto, migração, instalação, push ou deploy. O comando também está registrado como `npm run integration:check -- ...` após a integração.

A função exportada é `inspectIntegration({checkoutRoot, packageRoot, variantName, stage='before'})`. O retorno informa etapa, variante, quantidade de arquivos, SHA256 do patch e fingerprint da fonte. A CLI usa saída JSON e exit 0 apenas para inspeção aprovada; erros usam exit 1 e código fechado, sem conteúdo do arquivo, erro de Git ou stack. O relatório sempre declara `writes_performed:false`, `tests_executed:false`, `homologated:false`, `operational:false`.

## Regras
1. Manifesto limitado a 2 MiB, até oito variantes e 512 arquivos por variante; arquivos/patch limitados a 8 MiB. Variantes e caminhos não podem ser duplicados; conflitos de caixa nos caminhos também são recusados.
2. Caminhos são relativos canônicos. Recusar travessia, caminho absoluto, barra invertida, componentes vazios, .git, nomes reservados do Windows, ADS, percent-encoding e ponto final. Recusar symlinks internos, inclusive em diretórios pais.
3. Conferir SHA256 do patch antes de entregá-lo ao Git. O formato aceito é diff textual UTF-8/LF, adição/modificação de arquivos regulares 100644. Renomeação, remoção, binários, submódulos e alterações de modo precisam de um processo separado e não são aceitos silenciosamente.
4. Confrontar todos os caminhos do diff e de `git apply --numstat -z` com o manifesto. Nunca executar texto ou comandos recebidos no manifesto.
5. Antes: cada arquivo modificado deve coincidir com o hash original; arquivo novo deve estar ausente. Depois: todos os hashes finais devem coincidir. Documentação listada também é conferida, mesmo fora das raízes do fingerprint.
6. Comparar o fingerprint completo de código/configuração/testes do checkout, incluindo arquivos não rastreados nessas raízes. Uma mudança concorrente fora dos arquivos do patch também invalida a base.
7. Antes: executar `git apply --check`, sem aplicar. Depois: verificar bytes finais, sem tentar reaplicar. Uma segunda leitura do fingerprint identifica alterações ordinárias na fonte durante a inspeção.
8. Git recebe argumentos separados, sem shell; GIT_DIR/WORK_TREE/INDEX_FILE e overrides de configuração não são herdados. A saída bruta do Git não é publicada. Falha ou ausência do Git impede aprovação.

## Limites de confiança
Hashes conferem integridade e correspondência, não autoria, segurança semântica ou assinatura digital. O verificador não é um sandbox para executar um pacote de origem desconhecida: revisar sua procedência e código. Manter checkout e pacote sem edições simultâneas. Inspeções de arquivos não criam um lock atômico e não eliminam todas as corridas de substituição entre a checagem e a aplicação posterior. Executar `git apply --check` novamente imediatamente antes da aplicação e conferir `after` em seguida.

O fingerprint não cobre dependências instaladas nem todas as decisões/documentos de negócio. A inspeção também não certifica lint, typecheck, testes, migrações reais, autorização, TLS, plataforma, capacidade ou restauração. O gate de publicação continua independente e fechado nesta entrega.

## Verificações desta implementação
Trinta testes novos executam a CLI em subprocessos e o Git real sobre arquivos sintéticos temporários. Exercitam hashes, base concorrente, documento concorrente, replay, arquivo novo, symlinks, modos, caminhos, limite de manifesto, erro seguro e requisitos do gate. O núcleo transacional permanece byte a byte igual ao R4. Os testes TLS e SQL herdados não são reclassificados como novos testes de integração PostgreSQL.
