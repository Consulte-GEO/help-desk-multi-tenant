# IMPLEMENTATION REPORT — v05-22-42

**Feature:** página `/importa` — Importação de Planilhas de Obras (Copilot V3.1)
**Base:** v05-22-41 (integra o Copilot V3 entregue pelo GPT, com melhorias)
**Deploy alvo:** Netlify `setup.consultegeo.org` + Supabase `yglcnirbnbwjqpvalqif`

---

## 1. Origem e escopo

O GPT entregou `consulte_geo_copilot_v3_robusto.html` (single-file, SheetJS,
pipeline de ETL assistido) + `HANDOFF_CLAUDE_CONSULTE_GEO_V3.md`. Esta versão:

1. audita o código entregue (sintaxe validada com `node --check`; arquitetura
   conferida módulo a módulo contra o handoff);
2. corrige defeitos reais encontrados no motor;
3. adiciona os modelos GPT mais novos + modelo customizado (pedido de produto);
4. move a IA para um proxy server-side (Supabase Edge Function), cumprindo a
   prioridade crítica nº 2 do handoff ("Migrar OpenAI para backend");
5. integra a página ao produto no mesmo padrão consolidado do `/laudos`
   (estático em `public/` + redirect Netlify + rota Vue opcional via iframe).

## 2. Auditoria do Copilot V3 do GPT — resultado

**Confirmado como sólido:** separação dado original/normalizado/sugestão/decisão;
nenhum cadastro inventado (CatalogEngine só aceita match exato/≥0,9; Structure/Trace
exigem score ≥92 com folga ≥7 para auto-match); leitura limitada ao conteúdo real
(maxScanRows/Cols + emptyStreak — resolve as linhas-fantasma de 1.047.441 linhas);
expansão de mesclas pela âncora; cabeçalho 1–3 níveis com desambiguação de rótulos
repetidos; rótulos duplicados de rompimento preservados na exportação; travas de
exportação em modo estrito; sem API key embutida.

**Defeitos corrigidos na V3.1:**

| # | Defeito | Correção |
|---|---|---|
| 1 | `normalizeNumberDetailed('abc')` retornava `0` (texto sem dígito virava número) — Volume/Resultado falsos | retorna vazio + motivo "não numérico" |
| 2 | `similarity('Torre 1','Torre 19') ≈ 0,89` (substring) — risco de auto-match errado em obras com torres numeradas | penalidade ×0,45 quando ambos os lados têm números e nenhum coincide |
| 3 | Política "Revisar" (canteiro / material ≠ concreto) incluía a linha sem qualquer marca visível | gera ALERTA `revisão_de_política` na Central de Problemas (retido no `validateAll`) |
| 4 | Correção de "idade embutida realocada" era registrada mesmo quando o valor era descartado (idade não oficial) | ordem invertida: só registra quando a idade é oficial |
| 5 | Seletores de modelo hardcoded em 3 pontos (topbar, modal, fallbacks) | fonte única `AVAILABLE_MODELS`/`MODEL_LABELS` + render dinâmico |
| 6 | **Modal de IA com botões mortos**: `onclick="event.stopPropagation()"` no `.modal` impedia o event delegation do `document` de receber Salvar/Testar/✕ (nenhum clique interno funcionava) | backdrop com ação própria (`close-modal-backdrop`, fecha só quando o clique é no próprio backdrop); `stopPropagation` removido |
| 7 | Dependência do CDN externo `cdn.sheetjs.com` (ponto único de falha; bloqueável por firewall corporativo) | SheetJS **self-hosted** em `frontend/public/vendor/xlsx.full.min.js` (build oficial 0.18.5 full via npm); a página funciona 100% offline |
| 8 | `similarity('TORRE 04','Torre 4') ≈ 0,31` (zero à esquerda quebrava o match) | tokens numéricos canonizados (04→4); igualdade canônica retorna 0,97 |

## 3. Modelos de IA (pedido de produto: "modelos mais novos do GPT")

Seletor atualizado para o line-up OpenAI vigente (jul/2026):

- `gpt-5.6` (Sol — flagship, default), `gpt-5.6-terra`, `gpt-5.6-luna`
- `gpt-5.5`
- `gpt-5.4`, `gpt-5.4-mini` (mantidos)

E **“Outro modelo (digitar ID)”**: aceita qualquer ID válido (`isValidModelId`),
persistido em localStorage/configuração — modelos futuros não exigem novo deploy.
O handoff restringia a gpt-5.4/-mini "salvo decisão explícita de produto"; esta
versão registra a decisão explícita do produto (solicitação de 23/07/2026).

## 4. IA via servidor (proxy) — novo padrão

- `supabase/functions/importa-openai/index.ts`: passthrough controlado do
  `/v1/chat/completions` — allowlist + regex de modelo (IDs `gpt-*` novos passam;
  `EXTRA_MODELS` via env), sanitização de messages, teto de payload/tokens,
  CORS restrito a `setup.consultegeo.org` + localhost.
- O cliente (`importa.html`) tem dois modos: **proxy** (default; sem chave no
  navegador) e **chave local** (comportamento V3 preservado). `refineSuggestions`
  continua enviando apenas grupos ambíguos + IDs de candidatos, nunca a planilha.
- Segredo: `supabase secrets set OPENAI_API_KEY=sk-...` (não commitado).

## 5. Integração no produto (padrão /laudos)

- `frontend/public/importa.html` → `dist/importa.html` (build-safe).
- `netlify.toml`: redirect `/importa → /importa.html` antes do catch-all SPA.
- `ImportaView.vue` + rota `/importa` (lazy) para navegação in-app.
- `cleanup-legacy.cjs`: `ImportaView.vue` na allowlist de views.
- `package.json`: `5.0.22-42`.

## 6. Gates executados

1. `node --check` no JS extraído de `importa.html` — OK.
2. `npm run build` (prebuild cleanup + `vue-tsc --noEmit` + `vite build`) — OK;
   `dist/importa.html` e `dist/laudos.html` presentes.
3. Self-test da página (`importa.html?selftest=1`) em Chromium headless — 16/16 OK.
3b. E2E com planilha real de cliente (FORM-32 Belém Boulevard, 3.110 linhas):
   aba/cabeçalho detectados, Data/NF/Volume/Usina/Slump/horários/resultados 7 e 28
   dias mapeados corretamente, 3.110 linhas convertidas (~3 s), numeração por
   (Data+Bloco+Unidade), pendências críticas corretamente exigindo confirmação
   humana de Bloco/Unidade/Concreto (nenhum cadastro inventado).
4. Edge Function publicada no projeto `yglcnirbnbwjqpvalqif` (versão inicial).

## 7. Pendências para o operador

1. `supabase secrets set OPENAI_API_KEY=sk-...` (sem isso a IA via proxy responde
   erro claro; o motor local segue funcionando).
2. Revogar qualquer chave OpenAI que tenha circulado em arquivos anteriores.
3. `git push` → Netlify publica o site; workflow publica/atualiza as functions.
4. Avaliar RLS de `public.external_cache` (aviso do advisor do Supabase; tabela
   fora do escopo desta feature).

## 8. Evoluções recomendadas (herdadas do handoff, ainda abertas)

Fixtures C1–C9 automatizadas com teste de ouro Sapphire; perfis por cliente;
combinação de múltiplas abas no mesmo job; editor visual de estrutura/traços;
Web Worker para arquivos muito grandes; diff original × final.
