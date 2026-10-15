# OCR de Laudos de Rompimento · arquitetura e operação

> Versão: **v5.0.22-51 (V15)** · página `/laudos` · Consulte GEO Controle Tecnológico

## 1. O que a página faz

Lê PDFs de **laudos de ensaio de compressão de corpos de prova** (NBR 5739) e de
**prismas de alvenaria** (NBR 16868), extrai um resultado por linha visual, deixa o
operador revisar linha a linha e exporta um Excel técnico com proveniência.

Dois caminhos de leitura:

| Caminho | Onde roda | Quando é usado |
|---|---|---|
| **Determinístico** | 100% no navegador (pdf.js + motores UMD) | páginas com texto — a esmagadora maioria dos laudos |
| **Assistido por IA** | Edge Function `laudo-vision` | só páginas **sem texto aproveitável**, e só com consentimento explícito |

## 2. Peças

```
frontend/public/laudos.html                  shell da página (9 KB; era 940 KB)
frontend/public/assets/laudo-perfis.js       perfis de dialeto (declarativos)
frontend/public/assets/laudo-invariantes.js  normalização, consenso e validações
frontend/public/assets/laudo-parser-core.js  motor determinístico + fachada V1
frontend/public/assets/laudo-app.js          app: pdf.js, visão, revisão, exportação
frontend/public/assets/laudo-app.css         complemento do Design System
frontend/public/assets/xlsx-style-lite.js    writer XLSX do projeto (gerado)
supabase/functions/laudo-vision/index.ts     proxy da leitura assistida
supabase/migrations/20260903_026_*.sql       telemetria + quota (RLS fechada)
schemas/laudo-ocr.v1.schema.json             contrato versionado do JSON técnico
tools/run-laudo-tests.js                     gate Node do motor (105 asserções)
tools/test-laudo-vision.mjs                  gate de integração da Edge Function (28)
tools/corpus-laudos/manifest.json            corpus sintético versionado
tools/corpus-laudos/gerar-corpus.mjs         medição com laudos reais (local)
tools/build-laudo-assets.mjs                 gera xlsx-style-lite.js do TS do projeto
```

**Regra:** o motor tem **fonte versionada**. Até a V12 ele existia só como bundle
compilado colado dentro do HTML — evoluir significava editar build, o que a regra 21
do projeto proíbe.

## 3. Perfis de dialeto (declarativos)

`laudo-perfis.js` guarda, como **dados**, o que antes eram `if` no meio do parser:

| Perfil | Sinais | Regra própria |
|---|---|---|
| `generico` | — | só as regras comuns |
| `polimix` | "POLIMIX", "Evolução Obtida aos" | corta a página a partir do gráfico |
| `concrelab` | "CONCRELAB", "Relatório de ensaio de compressão" | corta a página a partir do gráfico |
| `prisma` | "PRISMA", "NBR 16868" | tabela CP/dimensões/carga/tensão, sem NF |

Detecção por soma de pesos; empate ou zero cai em `generico`. O operador pode forçar
o perfil na tela. Perfil novo = entrada nova na lista, sem tocar no motor.

O corte do gráfico é registrado em `diagnostico.cortesGrafico` — nada é descartado
em silêncio.

## 4. Contrato de saída

`parseDocumentoTexto()` devolve `metadata`, `diagnostico`, `customerInput`,
`contexto`, `resultados[]`, `validation[]` e `audit[]` (schema em
`schemas/laudo-ocr.v1.schema.json`).

Cada campo de cada resultado é um objeto com **estado explícito**:

```jsonc
"nf": { "estado": "valor", "valor": "100417", "raw": "NF: 100.417",
        "motivo": "NF única da página, herdada do cabeçalho do laudo.",
        "origem": "pagina" }
```

- `valor` — lido;
- `ausente` — o laudo não traz o campo;
- `ilegivel` — o campo existe mas não foi lido com segurança (ou as duas passadas
  da IA discordaram).

`ausente` e `ilegivel` são estados **diferentes** de propósito: é a distinção que
importa na revisão. Nenhum resultado é descartado por estar incompleto.

## 5. Nota fiscal — como é resolvida

Ordem de resolução, com a origem gravada no campo:

1. `linha` — rótulo de NF na própria linha do resultado;
2. `secao` — rótulo no cabeçalho da seção acima do bloco;
3. `bloco` — o bloco inteiro tem uma única NF;
4. `pagina` — a página tem **uma única** NF;
5. `documento` — o documento tem **uma única** NF.

Herança acontece **apenas quando não há ambiguidade**. Dois números de NF na mesma
página: nenhum é herdado — preencher seria adivinhar, e adivinhar em silêncio é o
que a regra do `customerInput` proíbe.

Formatos aceitos: `NF 100417`, `NF: 100.417`, `NFe 0100417`, `Nota Fiscal nº 100 417`,
`N.F. 100417`, `DANFE 100417`, `Documento Fiscal 100417`. O valor é normalizado
(pontos, espaços e zeros à esquerda) e o texto original fica em `raw`.

Candidatos "soltos" achados pela janela da coluna passam por guardas: não podem ser
data, ano isolado, fragmento de CNPJ/CEP nem o próprio número do laudo.

**Por que isso mudou:** até a v12 a NF vinha vazia da terceira linha em diante nos
laudos que imprimem a nota só no cabeçalho. O motor procurava a NF apenas nas 12
linhas acima do bloco e, a partir do segundo bloco da página, só depois do bloco
anterior — o cabeçalho ficava fora do alcance. Em um lote real de 533 laudos, 8 318
linhas, a coluna estava quase toda vazia. Regressão travada em
`tools/corpus-laudos/manifest.json` (`nf-cabecalho-multiplos-blocos`).

## 6. Idade

Nunca inferida. `1` ou `2` sem unidade **não** viram 12 horas — o motor registra a
normalização como *sugerida e não aplicada* (`IDADE_1D_12H_NAO_APLICADA`) e mantém o
que está impresso. Idade fora da lista usual (4, 10, 45, 180 dias) é preservada.
Quando a idade diverge do intervalo entre moldagem e rompimento, o motor **avisa**
(`IDADE_DIVERGE_DATAS`) em vez de reescrever.

## 7. Duplicidade

Resultados **não são deduplicados por valor**. Dois corpos de prova com a mesma
idade e a mesma resistência são duas linhas — é o caso normal da NBR 5739. O que
antes era deduplicação silenciosa virou alerta (`RESULTADO_DUPLICADO_SUSPEITO`).

## 8. Leitura assistida (visão)

Ver `supabase/functions/laudo-vision/README.md`. Resumo: duas passadas independentes
com estratégias de varredura diferentes, consenso casado **pela linha visual**,
divergência vira `ilegivel` com candidatos, releitura **só da linha** com campo
crítico pendente (a página em consenso não é descartada), Structured
Outputs estrito, `store:false`, quota por origem e sessão, telemetria sem conteúdo.

Desligada por padrão na tela. Exige dois cliques: habilitar e consentir.

## 9. Revisão humana e exportação

Cada linha pode ser **aceita, corrigida ou rejeitada**. A correção grava o valor
anterior, entra no `audit` do documento e revalida o laudo inteiro. A exportação
definitiva bloqueia enquanto houver linha com erro pendente (opção marcável).

O Excel sai com seis abas: `Resumo`, `Resultados`, `Proveniência`, `Validações`,
`Diagnóstico` e `JSON Técnico`. A aba de proveniência traz, por campo, o estado, o
valor normalizado, o **bruto preservado**, o motivo, a página, a linha e a fonte.

## 10. Medição

- **Gate do motor:** `npm run test:laudos` (corpus sintético, 105 asserções).
- **Gate da Edge Function:** `npm run test:laudo-vision` — sobe a função com `deno run`
  contra um stub que faz o papel do provedor de IA e do PostgREST, e exercita guarda de
  origem, consentimento, imagem inválida, consenso, divergência, releitura cirúrgica,
  quota e confirmação. Sem chave, sem Supabase, sem custo. Pulado com aviso se não
  houver Deno na máquina.
- **Corpus real (local, nunca versionado):**
  `node tools/corpus-laudos/gerar-corpus.mjs <pasta-com-pdfs>` — devolve
  preenchimento por campo, linhas sem NF e origem da NF por arquivo. Só contagens
  saem; nenhum conteúdo de laudo é gravado.

Métrica que manda: **false fill** — campo preenchido com valor errado é pior que
campo vazio, porque o vazio o operador vê.

## 11. Privacidade

Leitura de texto: nada sai do navegador. Leitura assistida: só a imagem das páginas
sem texto, com consentimento, via Edge Function, com `store:false` no provedor. A
telemetria grava métricas e hashes — nunca a imagem, nunca o texto do laudo, nunca o
valor dos campos (a confirmação da revisão é hasheada na Edge Function).

Não existe chave de IA no navegador. O caminho antigo (`window.LAUDOS_CONFIG`,
`sessionStorage`) foi removido.


---

## 12. Revisão geral da V15

A V14 entregou o pipeline; a V15 é a auditoria dele. Vinte e um defeitos foram
encontrados por revisão adversarial linha a linha e por dois gates novos, e todos
foram corrigidos com teste de regressão. Os que mudam comportamento visível:

### Motor e validações

| O que estava errado | Efeito |
|---|---|
| O consenso casava "qualquer sobra com qualquer sobra" | dois corpos de prova distintos viravam **uma** linha inútil, e outros sumiam do laudo |
| `RESISTENCIA_DECRESCENTE_COM_IDADE` agrupava por CP **ou** NF, sem exigir idade crescente | dispersão normal entre gêmeos da mesma nota virava alerta de queda de resistência |
| NF saneada podia virar `{estado:'valor', valor:null}` | a nota sumia da tela **e** o aviso `NF_AUSENTE` deixava de aparecer |
| `CAMPO_ILEGIVEL` era emitido duas vezes para MPa e idade | confiança penalizada em dobro e achado repetido no painel |
| `7.854` era sempre lido como decimal | área/carga corrompidas em silêncio; agora sai `SEPARADOR_AMBIGUO` com as duas leituras |
| Campos vazios "concordando" contavam como acordo | uma página com 11 campos vazios e o MPa divergente exibia confiança **alta** |
| Catálogo de códigos fora de sincronia com a Edge Function | `PASSADA_UNICA_SEM_CONSENSO` (grave) e `RELEITURA_APLICADA` (informativo) apareciam com a mesma severidade |

### Tela

| O que estava errado | Efeito |
|---|---|
| Achados de página não processada eram reanexados a cada revalidação | cada correção de célula somava achados fantasma, sem limite |
| Arquivo solto **durante** o lote ficava preso em "fila" | nunca era processado |
| Cancelamento soltava promessa e liberava o botão cedo | erro no console e laudo ressuscitando numa tabela já limpa |
| `openDetails` usava só o id do resultado | abrir os detalhes de uma linha abria a linha equivalente de **todos** os laudos do lote |
| Editar uma célula e clicar no ✓ da mesma linha | o clique era engolido pela repintura; era preciso clicar duas vezes |
| Repintura durante o lote | a digitação em curso se perdia sem aviso |
| Linha rejeitada | saía de "Resultados", mas continuava na **Proveniência** e no **JSON Técnico** |
| `customerInput` inteiro ia para o Excel | arquivos de megabytes e aba travando no download |
| `indexOf` dentro do laço + repintura por linha aceita | "Aceitar visíveis" com 600 linhas travava a aba |
| Canvas de visão nunca liberado | no Safari/iOS as páginas depois da ~20ª eram enviadas em branco, sem erro |

### Edge Function

| O que estava errado | Efeito |
|---|---|
| `p_status: 'ok'` não existe no CHECK da tabela | **toda** leitura bem-sucedida falhava ao gravar telemetria; `reading_token` voltava nulo e a confirmação da revisão nunca registrava nada |
| `p_paginas_total` podia ser nulo numa coluna NOT NULL | mesmo efeito |
| Consenso estritamente posicional | uma linha a mais numa passada deslocava tudo e transformava a página inteira em divergência |
| Passada única era devolvida como concordante | leitura não conferida ganhava bônus de confiança |
| Releitura substituía a página inteira | nove linhas em consenso eram descartadas por causa da décima |
| "Idade sem unidade" contava como campo crítico | quase toda página ia para releitura cara |
| `blur`/`contrast` lidos com nome diferente do que o cliente envia | telemetria gravava 0 ("imagem péssima") em 100% das leituras |
| `usage` de uma só chamada | custo real por página 2–3× acima do medido |
| Timeout por tentativa maior que o do cliente | servidor seguia gastando provedor e quota depois do cliente desistir |

### O que passou a ser testável

`npm run test:laudo-vision` sobe a Edge Function de verdade (`deno run`) contra um
stub do provedor e do PostgREST. Foi esse gate que encontrou três dos defeitos acima
— incluindo o `p_status` inválido, que nenhuma revisão estática tinha pego.
