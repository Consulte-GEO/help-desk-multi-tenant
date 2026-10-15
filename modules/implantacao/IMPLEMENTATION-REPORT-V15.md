# Implementation Report · Implantação Consulte GEO v15 (`5.0.22-51`)

Data: 03/09/2026 · Base: entrega V14 (`5.0.22-50`, não publicada)
Escopo: **revisão adversarial completa do OCR de laudos**, correção dos defeitos encontrados
e novos gates. Nenhum outro módulo do produto foi tocado.

> **Nota de publicação (ajuste feito na aplicação ao repositório).** A V14 e a V15 saem juntas
> no mesmo PR, como uma única versão **`5.0.22-51`**. O pacote da V14 pedia `5.0.22-50`, número
> que a **v13 já publicou** em `main` (PR #10, 20/08/2026) — e `CLAUDE.md` §6 proíbe reaproveitar
> numeração. Os carimbos de versão de `laudos.html`, `laudo-app.js`, `netlify.toml`,
> `supabase/config.toml` e da Edge Function, que vieram do pacote ainda em `5.0.22-50`, foram
> alinhados com o `package.json` em `5.0.22-51`.


---

## Resumo executivo

A V14 entregou o pipeline funcionando; a V15 é a auditoria dele — a mesma disciplina que a
V9 aplicou na entrega da V8. Duas revisões adversariais linha a linha (uma sobre a camada de
aplicação, outra sobre invariantes + Edge Function + migration) e dois gates novos
encontraram **21 defeitos reais**, todos corrigidos com teste de regressão.

Três coisas mudaram de patamar:

1. **A Edge Function agora é testada de verdade.** `npm run test:laudo-vision` sobe a função
   com `deno run` contra um stub que faz o papel do provedor de IA e do PostgREST, e
   exercita 28 cenários. Foi esse gate que pegou o defeito mais grave desta rodada.
2. **`deno check` passa.** O bloqueio declarado na V14 ("sem Deno no ambiente") deixou de
   existir: a função é type-checked e executada nos gates.
3. **A telemetria estava 100% quebrada e ninguém veria.** A função gravava
   `p_status: 'ok'`, valor que não existe no CHECK da tabela: **toda** leitura bem-sucedida
   falhava no insert, dentro de um `catch` mudo. O `reading_token` voltava nulo e o registro
   da revisão humana — a razão de ser da migration 026 — nunca gravaria nada.

Gates: **motor 105/0** · **Edge Function 28/0** · **smoke 627/0** (eram 616) · contraste 89/0 ·
typecheck e build limpos · **E2E real no Chromium 11/11**.

---

## Ambiente usado

Sandbox Linux, Node v22.22.2, npm 10.9.7, **Deno 2.1.4** (via `npm i deno`), Chromium 1194
(Playwright). Todos os gates rodados nesta sessão; nada aplicado em produção.

---

## Defeitos encontrados e corrigidos

### Bloqueadores

| # | Onde | Defeito | Efeito real |
|---|---|---|---|
| 1 | `laudo-vision` | `p_status: 'ok'` viola o CHECK da tabela; `p_paginas_total` podia ir nulo numa coluna NOT NULL; o erro do RPC era engolido | **toda** telemetria falhava; `reading_token` nulo; a confirmação da revisão humana nunca registraria |
| 2 | `laudo-invariantes` | `casarResultados` casava "qualquer sobra com qualquer sobra" | dois CPs distintos viravam **uma** linha ilegível e outros sumiam do laudo — viola a regra de nunca perder linha |
| 3 | `laudo-vision` | Consenso estritamente posicional | uma linha a mais numa passada deslocava tudo: página inteira virava divergência e ia para releitura cara |
| 4 | `laudo-vision` | Releitura substituía a **página inteira**; "idade sem unidade" contava como campo crítico | nove linhas em consenso descartadas por causa da décima, e quase toda página disparava releitura |
| 5 | `laudo-vision` | Passada única era devolvida como concordante | leitura não conferida ganhava bônus de confiança e aparecia como "alta" |
| 6 | `laudo-app` | Achados de página não processada reanexados a cada revalidação | cada correção de célula somava achados fantasma, sem limite, inflando painel e Excel |
| 7 | `laudo-app` | Arquivo solto **durante** o lote ficava preso em "fila" | nunca era processado |
| 8 | `laudo-app` | Cancelamento: promessa solta, `busy` liberado cedo, documento comitado depois | erro no console e laudo ressuscitando numa tabela já limpa pelo usuário |
| 9 | `laudo-app` | `openDetails` chaveado só pelo id do resultado (ids colidem entre arquivos) | abrir detalhes de uma linha abria a linha equivalente de **todos** os laudos do lote |
| 10 | `laudo-invariantes` | `RESISTENCIA_DECRESCENTE_COM_IDADE` agrupava por CP **ou** NF e não exigia idade crescente | dispersão normal entre gêmeos da mesma nota virava alerta de queda de resistência |

### Importantes

| # | Onde | Defeito | Correção |
|---|---|---|---|
| 11 | `laudo-app` | Editar uma célula e clicar no ✓ da mesma linha: o clique era engolido pela repintura | update adiado; o clique chega no primeiro toque |
| 12 | `laudo-app` | Repintura durante o lote destruía o campo em edição | não repinta enquanto o foco está na tabela |
| 13 | `laudo-app` | Linha **rejeitada** continuava na aba Proveniência e no JSON Técnico | as duas passaram a respeitar a rejeição |
| 14 | `laudo-app` | `customerInput` inteiro ia para o Excel | removido do JSON técnico (o bruto por campo segue na Proveniência) |
| 15 | `laudo-app` | `indexOf` O(n²) + uma repintura por linha aceita | Map de índices e repintura única |
| 16 | `laudo-app` | Canvas de visão nunca liberado; `loadPdf` não destruía a task em erro | libera canvas, chama `page.cleanup()`, destrói a task |
| 17 | `laudo-invariantes` | NF saneada podia virar `{estado:'valor', valor:null}` | vira `ilegivel` com motivo; `NF_AUSENTE` volta a aparecer |
| 18 | `laudo-invariantes` | `CAMPO_ILEGIVEL` emitido em dobro para MPa e idade | confiança deixou de ser penalizada duas vezes |
| 19 | `laudo-invariantes` | `7.854` sempre lido como decimal | `SEPARADOR_AMBIGUO` com as duas leituras, sem escolher em silêncio |
| 20 | `laudo-vision` | `blur`/`contrast` lidos com nome diferente do enviado; `Number('')` virava 0 | telemetria deixou de gravar "imagem péssima" em 100% das leituras |
| 21 | `laudo-vision` | `usage` de uma só chamada; timeout por tentativa maior que o do cliente | tokens somados das três chamadas; orçamento global de 58 s |

### Menores, também corrigidos

Campos vazios "concordando" inflavam o score do consenso · catálogo de códigos fora de
sincronia com a Edge Function (severidade agora por código) · `data-state` sem escape ·
`ALIAS_GENERICO_DETECTADO` apontando sempre para `mpa` · tolerância de idade em horas com
ternário morto · reescolher o mesmo arquivo não disparava `change` · duplicata descartada
sem aviso · `styleSheet` assumindo formato de `!ref` · quota sem TTL na migration ·
`action:'confirm'` aceitando 4000 campos (custo de hash) · corpo lido antes de checar
`content-length`.

---

## Correções no motor de texto (achadas ao escrever os testes)

Além da lista acima, dois defeitos do caminho determinístico apareceram durante a V15 e
foram corrigidos com caso de corpus:

- **Identificação do CP preenchida com a idade da linha.** Qualquer linha de dado iniciada
  por "CP" virava referência de coluna; o parser preenchia o CP com o número da idade. Agora
  só um cabeçalho de tabela de verdade define a coluna, e o rótulo nunca é aceito como valor.
- **Origem perdida em tabela por colunas.** Uma linha com duas colunas de idade gera dois
  resultados; a linha era marcada como "usada" e o segundo resultado perdia página, linha e
  CP. A linha inédita agora só tem preferência no desempate.

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/public/assets/laudo-app.js` | 13 correções (fila, cancelamento, revalidação, detalhes, exportação, memória, desempenho, edição) |
| `frontend/public/assets/laudo-invariantes.js` | 7 correções (consenso, agrupamento, NF, códigos, número ambíguo) + `severidadeDoCodigo`, `numeroPtBrDetalhado` |
| `frontend/public/assets/laudo-parser-core.js` | CP não preenchido com a idade; origem preservada em tabela por colunas |
| `supabase/functions/laudo-vision/index.ts` | 8 correções + `LAUDO_VISION_OPENAI_URL` (testabilidade) e orçamento global de tempo |
| `supabase/migrations/20260903_026_ocr_laudo_telemetria.sql` | purga oportunista da tabela de quota; teto de campos documentado |
| `frontend/smoke-pipeline.ts` | +11 asserções da V15 |
| `tools/run-laudo-tests.js` | +21 asserções de regressão; saída em `.laudo-validation/` |
| `frontend/package.json` | `5.0.22-50` → **`5.0.22-51`**; `test:laudo-vision`; `smoke:all` inclui os dois gates novos |
| `docs/OCR-LAUDOS.md` | seção 12 com a revisão da V15 |
| `.gitignore` | `.laudo-validation/` |

## Arquivos criados

| Arquivo | Papel |
|---|---|
| `tools/test-laudo-vision.mjs` | gate de integração da Edge Function (28 cenários, sem chave e sem Supabase) |
| `IMPLEMENTATION-REPORT-V15.md` | este relatório |

Nada foi removido.

---

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm ci` | OK | 40 pacotes |
| `deno check supabase/functions/laudo-vision/index.ts` | **OK** | bloqueio da V14 resolvido; pegou um erro real (parâmetro faltando) durante a correção |
| `node tools/run-laudo-tests.js` | **105 OK / 0 FAIL** | eram 84 na V14 |
| `node tools/test-laudo-vision.mjs` | **28 OK / 0 FAIL** | gate novo, com a função rodando |
| `npm run smoke` | **627 OK / 0 FAIL** | eram 616 |
| `npm run smoke:contrast` | 89 OK / 0 FAIL | WCAG AA nos dois temas |
| `npm run smoke:xlsx` | OK | writer XLSX do projeto |
| `npm run typecheck` | OK | `vue-tsc --noEmit` limpo |
| `npm run build` | OK em 4,6 s | `dist/laudos.html` = 9 190 bytes |
| `node tools/run-intake-tests.js` | 27/27 | módulos vizinhos intactos |
| `node tools/run-similarity-tests.js` | 21/21 | idem |
| `node tools/run-implantacao-import-tests.js` | 23/23 | idem |
| E2E Chromium (11 cenários) | **11 OK / 0 FAIL** | ver abaixo |

### E2E no navegador

Três PDFs de uma vez (dois válidos + um corrompido), sobre a página servida do `dist`:

```
✓ processa vários PDFs no mesmo lote
✓ todas as linhas trazem NF
✓ PDF corrompido vira erro do arquivo, sem derrubar o lote
✓ gráfico do laudo Concrelab foi cortado (3 resultados)
✓ detalhes abrem apenas na linha clicada          ← defeito #9
✓ editar e aceitar na mesma linha funciona no primeiro clique  ← defeito #11
✓ valor editado é preservado                       ← defeito #12
✓ exporta Excel com linha rejeitada no lote
✓ filtro por situação funciona
✓ tema escuro alterna
✓ limpar zera a tabela
erros de console/página: nenhum
```

Excel exportado conferido: `Resultados` com 7 linhas (a rejeitada fora), `Proveniência` com
7 × 12 campos (defeito #13 confirmado corrigido), `JSON Técnico` em um único bloco e
arquivo de 119 KB — antes o texto integral das páginas o levaria a megabytes (#14).

---

## Implementado com sucesso

Os 21 defeitos, os dois do motor de texto e os menores listados acima, cada um com
regressão amarrada em `tools/run-laudo-tests.js` ou `tools/test-laudo-vision.mjs`.

## Parcialmente implementado

- **Estorno de quota.** Quando o provedor falha depois da reserva, as unidades não voltam.
  Mitigado pelo orçamento global de tempo (o servidor não gasta mais depois que o cliente
  desiste), mas o estorno em si exigiria uma RPC nova — fica para o ciclo que aplicar a
  migration.
- **Leitura assistida por IA.** Continua **não publicada**. O código dos dois lados está
  completo e agora testado ponta a ponta contra um stub, mas nunca chamou o provedor real.

## Não implementado

- Persistência dos resultados no Supabase e vínculo com obra/ticket (decisão de produto).
- Entrada de navegação para `/laudos` no menu do app.
- OCR local para laudo escaneado sem IA.

## Regressões evitadas

- Nenhum arquivo fora do escopo do OCR foi tocado (`importa.html`, `pre-analise.html`,
  wizard, admin, protótipo — todos intactos).
- Os três gates vizinhos seguem verdes (27/27, 21/21, 23/23).
- O smoke ganhou asserções em vez de perder: 616 → 627, sem FAIL.
- Sem React/Tailwind/Pinia; Vuex e o skeleton .NET intactos; nenhuma CDN introduzida.

---

## Bloqueios reais

### Bloqueios técnicos
- Nenhum. O bloqueio da V14 (sem Deno) foi resolvido: `deno check` e o gate de integração
  rodam nesta sessão.

### Bloqueios por ambiente
- `fonts.googleapis.com` bloqueado pelo proxy do sandbox — afeta só a fonte no E2E, é
  comportamento pré-existente de todas as páginas do projeto.
- **Sem laudos reais.** As correções da NF e do parser foram validadas em corpus sintético
  que reproduz os defeitos observados, e no E2E — não no lote de 533 laudos.

### Bloqueios por dependência externa
- Nenhum.

### Bloqueios por credenciais
- Deploy da Edge Function, `OPENAI_API_KEY` e aplicação da migration 026 dependem de
  credenciais do Thiago. Nada foi publicado nem aplicado.

---

## Pendências que exigem ação manual

1. **Publicar o frontend.** A correção da NF e todas as correções de tela são frontend puro
   e não dependem de banco.
2. **Rodar o corpus com os laudos reais** — `node tools/corpus-laudos/gerar-corpus.mjs
   <pasta>` — e olhar `linhas_sem_nf_pct` e `nfPorOrigem`.
3. Só depois, se quiser a leitura assistida: aplicar a migration 026, publicar a
   `laudo-vision` em preview com `OPENAI_API_KEY` e rodar um canário.

## Como validar localmente

```bash
cd frontend
npm ci
npm run build:laudo-assets
npm run typecheck
npm run smoke:all          # smoke + contraste + xlsx + laudos + laudo-vision
npm run build
cd ..
node tools/run-laudo-tests.js        # 105 OK
node tools/test-laudo-vision.mjs     # 28 OK (precisa de Deno; sem ele, pula com aviso)
```

Para o gate da Edge Function: `npm i -g deno` (ou https://deno.land). Sem Deno o gate é
**pulado com aviso**, não falha.

## Como publicar no Netlify

Igual à V14: publicar o source e conferir `/laudos.html` + os seis assets em `/assets/`.
O `netlify.toml` já traz cache curto para `/assets/laudo-*`.

## Como configurar Supabase

```bash
supabase link --project-ref yglcnirbnbwjqpvalqif
supabase migration list          # a 026 continua NÃO aplicada
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy laudo-vision --no-verify-jwt
```

A função **falha fechada** sem a RPC de quota da migration — a ordem importa.

## Como migrar futuramente para .NET 8 + SQL Server

Sem mudança em relação à V14: o contrato é `schemas/laudo-ocr.v1.schema.json`, o proxy vira
`POST /api/laudos/vision` com a mesma requisição e resposta, e os motores são JavaScript sem
DOM — o corpus serve de teste de equivalência para uma porta C#.

## Próximo ciclo recomendado

1. Corpus real e ajuste de perfis — é onde está o ganho restante de qualidade.
2. Publicar a `laudo-vision` em preview e medir false fill nas páginas escaneadas.
3. RPC de estorno de quota, se a leitura assistida entrar em uso.
4. Decidir a persistência dos resultados (hoje o leitor ainda é uma ilha).
