# Implementation Report · Implantação Consulte GEO v14 (`5.0.22-51`)

Data: 03/09/2026 · Base do pacote: `Implantacao consulte geo source completo v12` (`5.0.22-49`) · aplicado sobre a v13 (`5.0.22-50`, no ar)
Entrada adicional: `Implantacao_Consulte_GEO_OCR_Laudos_v14_FINAL.zip` (entrega do GPT Pro)
Escopo: **OCR / Leitor de Laudos (`/laudos`)** + correção do defeito de Nota Fiscal relatado em produção.

> Numeração: a entrega salta de **v12 → v14** de propósito, para não colidir com o rótulo
> "v14" que o pacote do GPT Pro já carrega. `v13` fica queimado e não será reutilizado.

> **Nota de publicação (ajuste feito na aplicação ao repositório).** O pacote foi montado sobre
> a v12 (`5.0.22-49`) e bumpou para `5.0.22-50` — número que a **v13 já publicou** em `main`
> (PR #10, 20/08/2026). Como `CLAUDE.md` §6 proíbe reaproveitar numeração, a versão desta
> entrega passou a ser **`5.0.22-51`**. A base real é a v13 (`5.0.22-50`), não a v12.

---

## Resumo executivo

A entrega do GPT Pro trouxe **decisões e código bons, mas não integrados**: os módulos novos
não eram carregados por nenhuma página, o motor continuava colado dentro do `laudos.html`, o
"bootstrap" injetado apontava para um caminho que não existe no site publicado e chegou a
partir o `</body>` da página. Três arquivos que o gate de testes exige nem vieram no pacote.
E o defeito que o usuário reportou — **coluna Nota Fiscal vazia** — não estava tratado.

Esta versão faz a integração de verdade, corrige a NF com diagnóstico reproduzido e roda os
gates:

- **NF corrigida e validada**: na fixture que reproduz o laudo do print, o motor da v12
  deixava **6 de 8** linhas sem NF; a V14 deixa **0 de 8**, com a origem da NF gravada em
  cada linha (linha → seção → bloco → página → documento).
- **Motor com fonte versionada** em `frontend/public/assets/`, no padrão UMD + gate Node dos
  outros três motores do projeto. Fim da edição de build compilado.
- **`laudos.html` passou de 940 KB para 9 KB** (motor e SheetJS saíram de dentro do HTML;
  a exportação passou a usar o writer XLSX do próprio projeto).
- **Chave de IA fora do navegador**, de vez. A leitura assistida agora só existe via Edge
  Function, desligada por padrão e com consentimento explícito.
- **Gates**: `test:laudos` 84/0 · `smoke` **616/0** (era 593/0) · `smoke:contrast` 89/0 ·
  `typecheck` limpo · `build` OK · **E2E real em Chromium** com PDF sintético.

---

## Ambiente usado

Sandbox Linux, Node v22.22.2, npm 10.9.7, Chromium 1194 (Playwright) para o E2E.
`npm ci` a partir do `package-lock.json` do projeto. Sem Deno no container — ver "Bloqueios".

---

## Diagnóstico da entrega do GPT Pro (o que estava pronto e o que não estava)

| # | Achado | Evidência | O que foi feito |
|---|---|---|---|
| 1 | `laudos.html` **corrompido**: a injeção partiu a tag `</body>` em `</b` + script + `ody>` | fim do arquivo no pacote | página reescrita do zero como shell |
| 2 | Bootstrap apontando para `../../public/ocr-laudos-v14/integration.mjs` — caminho que **não existe** no site publicado (o Vite publica `frontend/public/` na raiz; `public/` da raiz do repo nunca é deployado) | `frontend/public/laudos.html`, `importa.html` | injeções removidas; página carrega os assets por caminho real |
| 3 | Injeção do mesmo bootstrap em **`index.html` da raiz, `prototype/v06/index.html` e `importa.html`** — páginas que nada têm a ver com laudos; em `importa.html` (que está no ar e funciona) isso adicionaria um `<script>` 404 | 4 arquivos alterados sem necessidade | não aplicadas |
| 4 | `frontend/public/assets/laudo-*.js` entregues, mas **nenhuma página os carregava**; o motor compilado continuava dentro do HTML | diff v12 × pacote | assets religados na página nova |
| 5 | `laudo-parser-core.js` referencia `laudo-perfis.js` — **arquivo ausente** do pacote. Sem ele, detecção de perfil, corte do gráfico da Concrelab e o fallback de prisma ficavam desligados em silêncio | `require('./laudo-perfis.js')` com `catch` mudo | `laudo-perfis.js` escrito (perfis declarativos) |
| 6 | `tools/run-laudo-tests.js` entregue exige `tools/corpus-laudos/manifest.json` e `laudo-app.css` — **ambos ausentes**. O gate não rodava | execução do gate | corpus (11 casos) e CSS escritos |
| 7 | Duas gerações de código **incompatíveis** no mesmo zip: o cliente esperava `{page:{resultados[]}}` e a Edge Function devolvia `{amostras[]}`; o cliente não mandava `Authorization` e a função exigia usuário autenticado | `laudo-app.js` × `laudo-vision/index.ts` | Edge Function reescrita no contrato do cliente e no padrão de chamada da `importa-openai` |
| 8 | Edge Function exigia **usuário Supabase autenticado** — mas `/laudos` é página pública sem login. A leitura assistida nasceria morta | `auth.getUser(token)` obrigatório | trocado por origin allowlist + consentimento + quota por origem/sessão |
| 9 | A função usava `setup_audit_events` para quota, enquanto a migration entregue criava `ocr_laudo_reservar_quota` para exatamente isso | EF × migration 026 | função passou a usar a RPC da migration |
| 10 | **Defeito relatado pelo usuário (NF vazia) não tratado** | nenhuma mudança em `PAL_NF`/`achaColNf`/herança | corrigido nesta versão (seção abaixo) |
| 11 | `package.json` não bumpado, `smoke` sem asserção nova, sem `INSTRUCOES.md`, sem os dois zips | pacote | feitos |

O que veio **bom e foi aproveitado**: fim da deduplicação por valor, fim da conversão
automática de 1/2 dias em 12 horas, whitelist de idades relaxada, `laudo-invariantes.js`
(consenso, estados de campo, validações), `laudo-app.js` (app de revisão), a migration 026 de
telemetria, o schema `laudo-ocr.v1` e o próprio gate — que funcionou como especificação.

---

## O defeito da Nota Fiscal — diagnóstico com reprodução

**Sintoma** (print do usuário, lote real): 533 laudos, 8 318 linhas, coluna **NF** quase toda
vazia. Nas linhas 219–220 a NF aparecia (100417); da 221 em diante, vazia.

**Causa raiz.** O motor resolvia a NF só dentro do bloco de resultados:

1. `achaColNf(regl)` procurava o rótulo apenas em `regl` — as linhas entre `max(0, d0−12,
   fimBlocoAnterior+1)` e o início do bloco. **A partir do segundo bloco da página, o
   cabeçalho do laudo fica fora da janela**, porque `regl` começa depois do bloco anterior.
2. `PAL_NF` continha `"nota"` solto: qualquer "Anotações"/"Nota técnica" no cabeçalho fixava
   a coluna no lugar errado.
3. O regex exigia dígitos colados ao rótulo (`(\d{4,9})\b`): `NF: 100.417`, `NFe 0100417` e
   `Nota Fiscal n 100 417` não casavam.
4. Não havia herança de página nem de documento — **o parser já conhecia a NF** (ela vinha no
   `nfs` do retorno) e ainda assim entregava a linha sem NF.

**Reprodução** (fixture `nf-cabecalho-multiplos-blocos`, idêntica em forma ao laudo do print):

```
motor v12 (em produção):  SEM NF: 6 / 8   ·  nfs detectadas no documento: ['100417']
motor V14:                SEM NF: 0 / 8
```

**Correção.** Cadeia de resolução com proveniência gravada — `linha` → `secao` → `bloco` →
`pagina` → `documento` —, herança **somente quando não há ambiguidade** (duas NFs na página
⇒ nenhuma é herdada), rótulos ampliados (`NF`, `NFe`, `NF-e`, `N.F.`, `DANFE`, `Documento
Fiscal`), normalização de `100.417`/`0100417`, janela de coluna proporcional ao rótulo e
guardas contra data, ano isolado, CNPJ/CEP e o próprio número do laudo. Quem herda ganha
`motivo` visível na tela e não sobe de confiança.

Duas correções vizinhas apareceram no caminho e entraram:

- **False fill de CP**: linhas de dado iniciadas por "CP" viravam referência de coluna e o
  parser preenchia a identificação do corpo de prova com a **idade** da linha. Agora só um
  cabeçalho de tabela de verdade define a coluna, e o rótulo nunca é aceito como valor.
- **Origem perdida em tabela por colunas**: uma linha com duas colunas de idade gerava dois
  resultados, mas a linha era marcada como "usada" e o segundo resultado perdia página, linha
  e CP. Agora a linha inédita só tem preferência no desempate.

---

## Arquivos criados

| Arquivo | Papel |
|---|---|
| `frontend/public/assets/laudo-perfis.js` | perfis de dialeto declarativos (POLIMIX, Concrelab, prisma, genérico) |
| `frontend/public/assets/laudo-parser-core.js` | motor determinístico versionado + fachada do contrato V1 |
| `frontend/public/assets/laudo-invariantes.js` | normalização, consenso, validações determinísticas |
| `frontend/public/assets/laudo-app.js` | app da página: pdf.js, visão, revisão humana, exportação |
| `frontend/public/assets/laudo-app.css` | complemento do Design System (sem cor literal) |
| `frontend/public/assets/xlsx-style-lite.js` | writer XLSX do projeto compilado para a página estática |
| `schemas/laudo-ocr.v1.schema.json` | contrato versionado do JSON técnico |
| `supabase/migrations/20260903_026_ocr_laudo_telemetria.sql` | telemetria por leitura/campo, quota e view de auditoria |
| `supabase/functions/laudo-vision/README.md` | contrato, deploy e limites da função |
| `tools/run-laudo-tests.js` | gate Node do OCR (84 asserções) |
| `tools/corpus-laudos/manifest.json` | corpus sintético (11 casos, inclui a regressão da NF) |
| `tools/corpus-laudos/gerar-corpus.mjs` | medição com laudos reais (saída local, não versionada) |
| `tools/build-laudo-assets.mjs` | gera `xlsx-style-lite.js` a partir de `xlsxStyleLite.ts` |
| `docs/OCR-LAUDOS.md` | documentação da arquitetura e da operação |
| `.gitignore` | o repositório não tinha um (backlog PK §1.1) |
| `IMPLEMENTATION-REPORT-V14.md` | este relatório |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/public/laudos.html` | reescrito: 940 KB → 9 KB, Design System, consentimento, revisão humana, sem chave e sem motor embutido |
| `supabase/functions/laudo-vision/index.ts` | reescrita: duas passadas com consenso, Structured Outputs, `store:false`, quota por RPC, chamada anônima no padrão `importa-openai` |
| `supabase/config.toml` | `[functions.laudo-vision] verify_jwt = false` |
| `.github/workflows/deploy-edge-functions.yml` | `laudo-vision` entrou no CI |
| `netlify.toml` | cache curto para `/assets/laudo-*` e `xlsx-style-lite.js` (não têm hash no nome e herdariam `immutable`) |
| `frontend/package.json` | `5.0.22-50` → `5.0.22-51`; scripts `test:laudos`, `corpus:laudos`, `build:laudo-assets`; `smoke:all` inclui o gate novo |
| `frontend/smoke-pipeline.ts` | +23 asserções do Leitor de Laudos |

## Arquivos removidos

Nenhum. Não foram aplicadas as injeções do pacote do GPT Pro em `index.html`,
`prototype/v06/index.html`, `frontend/public/importa.html` e na cópia dentro de
`Implantacao consulte geo source patches v07/` — nem os diretórios `public/ocr-laudos-v14/` e
`src/lib/laudo-ocr/`, que ficavam fora da árvore publicada e foram substituídos pela
integração real.

---

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm ci` | OK | 40 pacotes |
| `node tools/build-laudo-assets.mjs` | OK | gerou `public/assets/xlsx-style-lite.js` (29 KB) |
| `node tools/run-laudo-tests.js` | **84 OK / 0 FAIL** | corpus + NF + invariantes + EF + migration |
| `npm run smoke` | **616 OK / 0 FAIL** | eram 593 na v12 |
| `npm run smoke:contrast` | **89 OK / 0 FAIL** | WCAG AA nos dois temas |
| `npm run smoke:xlsx` | OK | writer XLSX do projeto |
| `npm run typecheck` | OK | `vue-tsc --noEmit` limpo |
| `npm run build` | OK em 4,5 s | `dist/laudos.html` = 9 190 bytes |
| `grep sk- dist/laudos.html dist/assets/laudo-app.js` | 0 | nenhum segredo no artefato |
| E2E Chromium (Playwright) | OK | PDF sintético → 5 linhas, NF preenchida, XLSX baixado |

## Resultado dos comandos

O E2E carregou `/laudos.html` servido do `dist`, confirmou os três módulos no `window`,
processou um PDF de laudo com NF só no cabeçalho e três séries de resultados, e produziu:

```
linhas extraídas: 5
   nf=100417 | idade=7  dias  | mpa=25.4
   nf=100417 | idade=12 horas | mpa=25.4
   nf=100417 | idade=12 horas | mpa=31
   nf=100417 | idade=63 dias  | mpa=33.1
   nf=100417 | idade=28 dias  | mpa=36.9
stats: 1 laudo · 5 resultados · 3 conf. alta · 5 pendentes
download: ocr_laudos_2026-09-03.xlsx  (abas: Resumo, Resultados, Proveniência,
                                       Validações, Diagnóstico, JSON Técnico)
erros de console: nenhum do aplicativo
```

Única requisição falha: `fonts.googleapis.com`, bloqueada pelo proxy do sandbox. Vem do
`design-system.css` e afeta todas as páginas do projeto igualmente — comportamento
pré-existente, não regressão desta versão.

---

## Implementado com sucesso

- Correção da Nota Fiscal, com reprodução do defeito antes e depois.
- Motor extraído para fonte versionada, com gate Node de 84 asserções.
- `laudo-perfis.js`, `laudo-app.css`, `laudos.html` e corpus — as peças que faltavam.
- Página religada aos módulos, sem SheetJS inline, exportando pelo writer do projeto.
- Revisão humana por linha (aceitar/corrigir/rejeitar) com proveniência e auditoria.
- Edge Function coerente com o cliente, com consenso de duas passadas, Structured Outputs,
  `store:false`, quota e telemetria sem conteúdo.
- Privacidade honesta na tela: o texto antigo dizia "nada é enviado a servidor nenhum"
  enquanto o caminho de IA subia imagens do laudo.
- CI, `config.toml`, headers de cache e `.gitignore`.

## Parcialmente implementado

- **Leitura assistida por IA**: o código está completo dos dois lados, mas a Edge Function
  **não foi publicada** e nunca chamou o provedor. Enquanto não for publicada, a página opera
  só no caminho determinístico (que é o que atende hoje 100% do uso — o print mostra `0 VIA IA`).
- **Telemetria**: a migration está pronta e conferida por leitura, mas **não foi aplicada**.
- **Perfis**: quatro perfis declarativos. Ampliar exige laudos reais de outras usinas.

## Não implementado

- OCR local para laudo escaneado sem IA (fallback offline) — segue fora de escopo.
- Persistência dos resultados no Supabase e vínculo com obra/ticket — decisão de produto
  ainda aberta (pergunta 4 do briefing).
- Entrada de navegação para `/laudos` no menu do app — a página segue acessível por URL.

## Correções importantes aplicadas

1. NF: cadeia de herança com proveniência, rótulos e normalização (defeito relatado).
2. CP preenchido com a idade da linha (false fill silencioso).
3. Origem perdida no segundo resultado de uma mesma linha em tabelas por coluna.
4. `laudos.html` corrompido e bootstrap com caminho inexistente (vindos do pacote).
5. Edge Function que exigia login numa página pública.

## Regressões evitadas

- Nada foi aplicado em `importa.html`, `pre-analise.html`, `index.html` ou no protótipo.
- Os dialetos POLIMIX/Concrelab e o fallback de prisma foram preservados — agora como perfis
  declarativos, com o corte do gráfico registrado no diagnóstico em vez de silencioso.
- `vendor/pdf.mjs` e `vendor/xlsx.full.min.js` continuam locais; nenhuma CDN foi introduzida.
- Sem React/Tailwind/Pinia; Vuex intacto; skeleton .NET intacto.
- O `smoke` ganhou asserções em vez de perder: 593 → 616, sem FAIL.

## Validações realizadas

Tabela de comandos acima, mais: leitura do `dist` gerado, conferência das seis abas do XLSX
exportado pelo navegador, ausência de `sk-`/`OPENAI_API_KEY` no artefato publicado, ausência
de cor hex fora do Design System nos arquivos novos, e comparação lado a lado do motor v12 e
V14 na mesma fixture de NF.

---

## Bloqueios reais

### Bloqueios técnicos
- Sem `deno` no container: a `laudo-vision` **não foi type-checked nem executada**. Foi
  validada por leitura e pelas asserções estáticas do gate. Rode `deno check` antes de publicar.

### Bloqueios por ambiente
- `fonts.googleapis.com` bloqueado pelo proxy do sandbox (afeta o visual no E2E, não a lógica).
- Sem laudos reais nesta sessão: a correção da NF foi validada em fixture sintética que
  **reproduz o defeito do print**, não no lote de 533 laudos. É a validação que falta.

### Bloqueios por dependência externa
- Nenhum.

### Bloqueios por credenciais
- Deploy da Edge Function, `OPENAI_API_KEY` e aplicação da migration dependem de credenciais
  do Thiago. Nada foi publicado nem aplicado em produção nesta sessão.

---

## Pendências que exigem ação manual

1. **Validar a NF com laudos reais** — o teste que fecha o ciclo:
   `node tools/corpus-laudos/gerar-corpus.mjs <pasta-com-os-533-pdfs>`; olhar
   `linhas_sem_nf_pct` e `nfPorOrigem`. Se sobrar caso não coberto, me mande 2–3 PDFs
   representativos (podem ser anonimizados) e eu fecho o perfil.
2. Publicar o frontend (Netlify) — a correção da NF é frontend puro e não depende de banco.
3. Só depois, se quiser a leitura assistida: aplicar a migration 026, publicar a
   `laudo-vision` em preview, configurar `OPENAI_API_KEY` e rodar um canário.
4. `deno check supabase/functions/laudo-vision/index.ts` antes do deploy.

## Como validar localmente

```bash
cd frontend
npm ci
npm run build:laudo-assets     # gera public/assets/xlsx-style-lite.js
npm run typecheck
npm run smoke:all              # smoke + contraste + xlsx + laudos
npm run build
npx serve dist                 # abrir /laudos.html e soltar um PDF
cd ..
node tools/run-laudo-tests.js
```

## Como publicar no Netlify

`git push` na branch conectada (ou upload do source completo). Conferir depois do deploy:
`/laudos.html` abre, os quatro assets `/assets/laudo-*.js|css` respondem 200, um PDF real é
lido e o Excel baixa. O `netlify.toml` já traz o cache curto desses assets — sem isso a
próxima versão ficaria presa no cache `immutable` de `/assets/*`.

## Como configurar Supabase

```bash
supabase link --project-ref yglcnirbnbwjqpvalqif
supabase migration list                      # numerar contra o ledger vivo
# aplicar a 026 (a última registrada é a 025)
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy laudo-vision --no-verify-jwt
```

A ordem importa: a função **falha fechada** sem a RPC de quota da migration.

## Como migrar futuramente para .NET 8 + SQL Server

O contrato de saída é `schemas/laudo-ocr.v1.schema.json` — versionado e sem dependência de
Postgres. O proxy vira `POST /api/laudos/vision` com a mesma requisição e a mesma resposta; a
telemetria vira duas tabelas (`OcrLaudoLeitura`, `OcrLaudoLeituraCampo`) e a quota, um
serviço de rate limit. Os motores (`laudo-perfis`, `laudo-invariantes`, `laudo-parser-core`)
são JavaScript puro sem DOM: continuam no cliente ou viram porta C# um a um, com o corpus
como teste de equivalência.

## Próximo ciclo recomendado

1. Rodar o corpus com os laudos reais e ajustar perfis pelo que aparecer (é onde está o ganho
   restante de qualidade).
2. Publicar a `laudo-vision` em preview e medir false fill nas páginas escaneadas.
3. Decidir a persistência: hoje o leitor é uma ilha; sem telemetria de produção não há como
   medir o motor ao longo do tempo.
4. Entrada de navegação para `/laudos` no app e link a partir do wizard.
