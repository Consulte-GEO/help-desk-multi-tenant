# Implementation Report · Implantação Consulte GEO v5.22.47 (entrega V10)

Data: 10/08/2026 · Base: commit `4e5596e` (v5.0.22-46, publicado e no ar)

## Resumo executivo

Ciclo V10 — quatro pedidos do produto, todos implementados e validados:

1. **Modelo único de preenchimento.** O switch "Modelo Simplificado /
   Modelo Completo com Projetista" foi removido da Etapa 1. O sistema
   agora trabalha só com o modelo completo (Tipo de Estrutura, Número
   da Estrutura, Projetista) e **não menciona modelo nenhum na
   interface**. Rascunhos/exemplos antigos salvos como `comum` são
   normalizados ao carregar; submissões antigas em revisão (/r/, /s/)
   continuam renderizando no layout original.
2. **Projetista claramente opcional na Etapa 2** (Blocos e torres):
   "(opcional)" no cabeçalho da coluna, placeholder "Opcional — digite
   livremente" e texto na descrição da etapa: "O campo Projetista é
   opcional — pode ficar em branco e não impede salvar nem enviar".
3. **Novo modelo padrão de implantação R02** (tabular, com dropdowns),
   corrigindo as lacunas do modelo antigo: agora tem **Projetista** e
   **Concreto aplicado por peça** (dropdown alimentado pela aba
   Concretos). Distribuído em `public/modelos/` com botão "Baixar
   modelo padrão (.xlsx)" na Etapa 1. Gerador determinístico versionado
   em `tools/`.
4. **Importação de planilha preenchida** na Etapa 1: aceita o modelo
   novo R02 **e o modelo antigo R00/R01** (best-effort com avisos) e
   monta o cadastro inteiro — obra, estruturas, peças, concretos,
   usuários e fornecedores. Validado end-to-end no browser com a
   planilha real preenchida enviada pelo produto (obra ALT): 4
   estruturas, 23 peças, 5 concretos, 10 usuários, 2 fornecedores, com
   3 avisos corretos (modelo antigo, 4 volumes arredondados, 1 seção-
   template duplicada descartada).

## Ambiente usado

Sandbox cloud (Node v22.22.2, npm ci ok, Chromium/Playwright para
validação browser, openpyxl 3.1.5 para o gerador do modelo). Supabase e
Netlify não foram tocados neste ciclo (sem mudança de banco/deploy
config). Push ao GitHub segue bloqueado pelo proxy da sessão — entrega
via zips.

## Arquivos criados

| Arquivo | Papel |
|---|---|
| `frontend/public/assets/implantacao-import-core.js` | Parser UMD determinístico dos 2 formatos (novo R02 + legado R00/R01), sem DOM, recebe XLSX por parâmetro — mesmo padrão do intake-auditor/similarity-engine |
| `frontend/src/services/implantacaoImportService.ts` | Ponte browser: injeta vendor XLSX + core (lazy, fora do bundle), converte a saída do core pelas factories reais do wizard (ids `cryptoUid`, `padroesMoldagem` seedados do FCK, remapeamento de `concretoId`) |
| `frontend/public/modelos/Modelo-Implantacao-Consulte-GEO-R02.xlsx` | Modelo padrão novo — 7 abas (Instruções, Obra, Estruturas, Concretos, Peças, Usuários, Fornecedores), dropdowns, comentários de ajuda, Design System nos cabeçalhos |
| `tools/gerar-modelo-implantacao-r02.py` | Gerador determinístico do R02 (openpyxl) |
| `tools/run-implantacao-import-tests.js` | Gate Node I1–I21 com fixtures 100% sintéticas (nenhum dado real de cliente versionado) |
| `tools/browser-validate-v10.py` | Validação browser end-to-end (16 checks) contra vite preview |
| `docs/IMPORTACAO-PLANILHA-IMPLANTACAO.md` | Documentação técnica da importação (formatos, arquitetura, regras de dado, gates) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/Step1DadosBasicos.vue` | Removidos o radio-pill de modelo e o emit `update-modelo-preenchimento`; `modeloProjetoFields` sem `v-if` (sempre visível); novo card "Importar planilha de implantação" (download do R02 + input de arquivo + resumo/avisos/erro) |
| `frontend/src/components/Step3GruposEditor.vue` | "Projetista **(opcional)**" no cabeçalho (estilo `.th-optional`), placeholder "Opcional — digite livremente", descrição da etapa explicita que não bloqueia salvar/enviar |
| `frontend/src/components/AppShell.vue` | Um único botão "Carregar exemplo completo" (o botão/emit do exemplo simplificado saiu) |
| `frontend/src/views/SetupPage.vue` | `isModeloProjeto` sempre `true`; removidos handlers/wiring do modelo; novo `onImportPlanilha` (confirmação → service → commit → audit → estado do card); import do `exampleCommon` removido |
| `frontend/src/views/ReviewView.vue` · `ClientStatusView.vue` | Removidos listeners mortos (`change-modelo`, `load-example-common`) e handlers `onUpdateModelo`; renderização de submissões antigas `comum` preservada |
| `frontend/src/store/modules/setup.ts` | Normalização `comum → modelo_projeto` em `replaceSnapshot` e `loadExampleSnapshot` (antes do hash de baseline); nova mutation `applyImportedData` (metadata só sobrescreve campos não-vazios; coleções substituem apenas se vieram ≥1 item; limpa baseline de exemplo; `isDirty`) |
| `frontend/scripts/cleanup-legacy.cjs` | `implantacaoImportService.ts` no allow-list (sem isso o prebuild apagaria o service) |
| `frontend/smoke-pipeline.ts` | Checks v5.22.18 invertidos para v5.22.47 (switch DEVE estar ausente) + 12 checks novos (card, R02, core, service, allow-list, mutation, normalização, 1 botão de exemplo, Projetista opcional) |
| `frontend/package.json` | 5.0.22-46 → **5.0.22-47** |

## Arquivos removidos

| Arquivo | Motivo |
|---|---|
| `frontend/src/services/setupSubmissionService.ts` | Órfão legado (substituído pelo ticketService desde v5.20). Tinha sido ressuscitado pelo upload web no GitHub (que nunca deleta); o prebuild guard já o removia a cada build. Remoção agora registrada em git |

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm ci` | OK | 66 pacotes |
| `npm run build` | OK (~4,7s) | R02 e core presentes em `dist/` |
| `npm run typecheck` | OK | 0 erros |
| `npm run smoke` | **589 OK, 1 FAIL** | o 1 FAIL é o pré-existente deliberado (workflow edge-functions ausente — exige secrets) |
| `npm run smoke:contrast` | 89 OK, 0 FAIL | WCAG AA nos 2 temas |
| `npm run smoke:xlsx` | OK | exit 0 |
| `node tools/run-intake-tests.js` | **27/27** | sem regressão na Pré-análise |
| `node tools/run-similarity-tests.js` | **21/21** | sem regressão no SimilarityEngine |
| `node tools/run-implantacao-import-tests.js` | **21/21** | NOVO gate (I1–I21) |
| `python3 tools/browser-validate-v10.py` | **16/16** | inclui importação real end-to-end |
| `npm audit --omit=dev` | 0 vulnerabilidades | |

## Implementado com sucesso

- Modelo único sem citação na interface (Etapa 1 limpa, 1 botão de exemplo).
- Projetista explicitamente opcional na Etapa 2 (cabeçalho + placeholder + descrição).
- Modelo R02 com Projetista e Concreto aplicado por peça, dropdowns e instruções.
- Importação dos 2 formatos hidratando o wizard inteiro, com avisos e confirmação
  de substituição quando já há conteúdo digitado.
- Dedupe de seções-template do modelo antigo (duplicata vazia de seção preenchida
  é descartada com aviso; vazia sem par é mantida).
- Auditoria: `planilha_importada` / `planilha_importacao_falhou` no audit local.
- Compatibilidade preservada: submissões antigas `comum` continuam renderizando
  em /r/ e /s/; snapshot/JSON técnico mantêm o campo `modeloPreenchimento`.

## Parcialmente implementado

- Nada.

## Não implementado (fora de escopo deste ciclo)

- Pendências carregadas da V9, aguardando decisão: migration 009 / 3 RPCs
  de devolução-reenvio (`return_submission_with_comment`,
  `resubmit_by_client_token`, `update_technical_json_by_client_token`);
  workflow de deploy de edge functions (exige secrets); reavaliação
  xlsx-js-style vs writer próprio; RLS de `external_cache`.

## Correções importantes aplicadas

- Parser do modelo antigo: seção-template em branco duplicada (layout de
  2 colunas do R00/R01) não vira mais estrutura fantasma na importação.
- Baseline de exemplo é limpo ao importar — sem isso, importar depois de
  "Carregar exemplo" poderia deixar o envio bloqueado por "exemplo intocado".

## Regressões evitadas

- Normalização `comum → modelo_projeto` acontece ANTES do hash de baseline
  (`isExampleUnchanged` segue funcionando).
- `implantacaoImportService.ts` adicionado ao allow-list do cleanup-legacy
  ANTES do primeiro build (o prebuild guard teria apagado o arquivo).
- R02 gerado com cabeçalho na linha 1 das abas tabulares — título mesclado
  acima venceria a detecção de cabeçalho (mesma classe de bug corrigida na
  Pré-análise V6).
- Fixtures do gate 100% sintéticas — nenhum dado da planilha real de
  cliente foi versionado no repositório.

## Validações realizadas

- Todos os gates da tabela acima.
- Browser (Chromium, build de produção via vite preview): Etapa 1 sem
  citação de modelos; card de importação; link do R02 respondendo 200;
  importação da planilha REAL preenchida → resumo "4 estruturas, 23 peças,
  5 concretos, 10 usuários, 2 fornecedores" + 3 avisos; obra "LIVE ALTINO -
  ALT" preenchida; Etapa 2 com "(opcional)" e 4 linhas; concretos/usuários/
  fornecedores populados; zero erros de JS.
- Modelo R02 em branco reaberto com openpyxl e parseado pelo próprio
  importador (gate I19).

## Bloqueios reais

### Bloqueios técnicos
- Nenhum novo.

### Bloqueios por ambiente
- Push ao GitHub bloqueado pelo proxy da sessão (repositório fora das
  sources) — entrega via zips, como nos ciclos anteriores.
- Supabase inacessível do sandbox para teste de rede real (salvar rascunho
  remoto não foi exercitado; nenhuma mudança de schema/serviço remoto neste
  ciclo — a mutation nova é 100% local ao store).

### Bloqueios por dependência externa
- Nenhum.

### Bloqueios por credenciais
- Workflow de edge functions segue aguardando `SUPABASE_ACCESS_TOKEN`
  (pendência V7/V8/V9, deliberada).

## Pendências que exigem ação manual

1. Publicar o conteúdo do zip completo v10 no GitHub (de preferência via
   git, para registrar também a REMOÇÃO de `setupSubmissionService.ts` —
   upload web não deleta arquivo).
2. Confirmar o deploy Netlify após o push (config inalterada; `dist/` já
   sai com `modelos/` e o core).
3. Decidir o destino da migration 009 (pendência V9).

## Como validar localmente

```bash
cd frontend
npm ci && npm run build && npm run preview   # http://localhost:4173
# Etapa 1 → Baixar modelo padrão → preencher → Importar planilha preenchida
node ../tools/run-implantacao-import-tests.js
python3 ../tools/browser-validate-v10.py     # com o preview rodando
```

## Como publicar no Netlify

Sem mudança: `netlify.toml` com `base=frontend`, `command=npm run build`,
`publish=dist`. Basta o push no GitHub.

## Como configurar Supabase

Sem mudança neste ciclo (nenhuma migration nova).

## Como migrar futuramente para .NET 8 + SQL Server

O payload de importação usa os mesmos shapes do snapshot
(`Grupo/Peca/Concreto/UsuarioObra/Fornecedor`) — o contrato do JSON
técnico não mudou. No backend oficial, a importação vira um endpoint
(`POST /api/implantacao-estrutura/drafts/import`) reusando o mesmo core
determinístico (portável para .NET ou executado no cliente).

## Próximo ciclo recomendado

1. Publicar V10 + validar em produção (importar planilha real no domínio).
2. Resolver a migration 009 / 3 RPCs (decisão pendente desde a V9).
3. Coletar feedback de cliente piloto sobre o R02 (nomes de colunas/abas).
4. Avaliar botão "Exportar planilha R02 preenchida" (ida-e-volta completa:
   o wizard exporta no mesmo formato que importa).
