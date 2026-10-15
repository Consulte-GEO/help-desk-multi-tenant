# Fontes e rastreabilidade E05

## Privadas, leitura conectada

- Repositório `Consulte-GEO/help-desk-multi-tenant`, branch `codex/m1-reproducibilidade`, HEAD `ea7a4454f30c45f35dece6e4a702591c55c79cd5` em duas leituras nesta execução. PR43: preservar recibos canônicos de versão no transporte hospedado.
- `src/infrastructure/transaction.ts`, blob `6c5e328edbac0ed1e6a99fa8f7791e797ce95eb2`, lido integralmente no HEAD e conferido após recuperação local.
- `shared/form-rules.js`, blob `9d71a7148a81d275fea5041b1a9216c2521fd4e4`; confirmação no HEAD, corpo recuperado da leitura integral disponível no histórico e hash conferido.
- `shared/form-rules.d.ts`, blob `e406feee0a96e29731bb5eb0e8812fafec9b260d` e `shared/cnpj.js`, blob `4fa772faae2a11cc0f0b02027a8f478f1d8c1eb6`: recuperados do histórico disponível e hashes conferidos; não houve nova leitura integral desses dois arquivos no HEAD nesta rodada. Reinspecionar na árvore completa.
- ZIP E04 montado nesta conversa; todos os 82 arquivos do overlay preservados. Plano V2 e documentos E04 lidos integralmente para o recorte. Memória contextual consultada apenas para continuidade; não foi usada como prova de código/banco.

## Documentação pública consultada para avaliar os pré-requisitos

`https://www.postgresql.org/docs/17/install-make.html`

`https://ftp.postgresql.org/pub/source/v17.6/postgresql-17.6.tar.bz2.sha256`

Consultas para avaliar uma instalação local de teste; não houve download bem-sucedido, compilação ou instalação. PostgreSQL 17.6 não foi tratado como versão atual recomendada, apenas como arquivo fixado possível. O executável nativo não foi obtido e não há arquivo binário no pacote.

## Evidência executada

Logs e hashes em `evidencias/E05`. Não usar as contagens ou hashes dos ciclos anteriores como homologação desta fonte. Leitura de repositório não verifica o estado efetivo de Netlify/Supabase. Não houve leitura ou mutação desses provedores nesta etapa.
