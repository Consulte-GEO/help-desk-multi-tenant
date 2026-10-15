# Implementation Report · Implantação Consulte GEO v5.22.44 (V7)

## Resumo executivo

Ciclo de **auditoria técnica** do sistema completo, com correção dos achados de
risco baixo e médio, e documentação formal dos que exigem decisão humana. O
relatório completo da auditoria está em `AUDITORIA-V7.md`; a análise do achado
crítico de RLS está em `docs/SEGURANCA-RLS-PROPOSTA.md`.

Resultado: **0 vulnerabilidades** de dependência (era 1 HIGH), **2 violações
WCAG nível A corrigidas**, versões unificadas, headers de segurança em produção,
`.env.example` criado e um gate de CI que estava quebrado voltando a rodar.

## Ambiente usado

Node 22 (local) / Node 20 (Netlify), npm 10, Vite 5, vue-tsc 2, Chromium via
Playwright sobre `frontend/dist`.

## Arquivos criados

```
AUDITORIA-V7.md                    relatório completo da auditoria
docs/SEGURANCA-RLS-PROPOSTA.md     achado crítico de RLS + correção em 3 fases
.env.example                       contrato das variáveis VITE_* (não existia)
IMPLEMENTATION-REPORT-V522-44.md   este relatório
```

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `netlify.toml` | headers de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) + cache longo para `/assets/*` |
| `frontend/src/components/Step3GruposEditor.vue` | a11y: handle de reordenar operável por teclado (`role`/`tabindex`/`aria-label`/setas ↑↓) + `aria-label` em 4 controles + método `moveGrupoTeclado` |
| `frontend/src/components/Step5PecasEditor.vue` | a11y: idem + `aria-label` em 6 controles + método `movePecaTeclado` |
| `frontend/public/assets/intake-auditor.js` · `intake-selftest.js` | wrapper UMD passa a usar `globalThis` (funciona em ESM, CJS e browser) |
| `assets/intake-auditor.js` · `assets/intake-selftest.js` | idem (cópias da raiz, sincronizadas) |
| `tools/run-intake-tests.js` | resolve `xlsx` **ou** `xlsx-js-style`; tolera carga ESM; aponta para `frontend/public/assets` |
| `frontend/package.json` | `5.0.22-43` → `5.0.22-44` |
| `frontend/package-lock.json` | `npm audit fix` — postcss (HIGH) |
| `frontend/public/importa.html` | `APP_VERSION` 3.2.0 → 3.3.0 |
| `frontend/public/pre-analise.html`, `pre-analise.html` | `app-version` → 5.22.44 |
| `README.md` | reescrito — estava contraditório com o deploy real |

## Arquivos removidos

Nenhum. Backend .NET, schemas, supabase, docs e relatórios anteriores preservados.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm audit --omit=dev` | 1 HIGH → **0** | postcss ≤8.5.22, path traversal |
| `npm audit fix` + `npm install` | OK | só `package-lock.json` mudou (9 linhas) |
| `npm run typecheck` | OK | vue-tsc limpo |
| `npm run build` | OK | ~7s |
| `npm run smoke:contrast` | **89 OK, 0 FAIL** | WCAG AA nos dois temas |
| `npm run smoke` | **578 OK, 1 FAIL** | FAIL pré-existente (workflow ausente) |
| `node tools/run-intake-tests.js` | **27/27** | gate estava quebrado; agora roda |
| `node --check` × 4 | OK | JS inline do importa.html + módulos |
| Playwright sobre `dist` | OK | 0 erros de página |

## Resultado dos comandos

Validação em browser após todas as alterações: Pré-análise analisa a planilha de
exemplo (10 registros), self-test embutido 27/27, `importa.html` com os 3 cards
(`mode-intake`, `mode-pre`, `mode-post`), Copilot em 3.3.0, app Vue carregando em
`/`. Nenhum erro de página.

## Implementado com sucesso

- Vulnerabilidade HIGH eliminada.
- Acessibilidade: reordenação por teclado (WCAG 2.1.1) e rótulos programáticos em
  10 controles de tabela (WCAG 1.3.1/3.3.2), reusando as ações de reordenação já
  existentes no store — nenhuma lógica nova de negócio.
- Headers de segurança efetivamente aplicados (a documentação já os prometia).
- `.env.example` — critério de aceite do projeto que não estava cumprido.
- Versões unificadas (circulavam quatro simultâneas).
- README alinhado ao deploy real.
- Gate de CI da Pré-análise consertado: `frontend/package.json` declara
  `"type": "module"`, o que fazia o Node tratar os UMD como ESM e quebrar o
  runner. Corrigido no wrapper (`globalThis`) e no runner.

## Correções importantes aplicadas

O bug do `"type": "module"` merece registro: o self-test **passava no browser e
falhava no Node**, então a suíte que eu havia documentado como gate de CI nunca
teria rodado em pipeline. Encontrado por executar o gate de fato, não por leitura.

## Regressões evitadas

Pré-importação, Pós-importação e o app Vue foram reexercitados sobre o `dist`
após cada bloco de alteração. O motor do Copilot não foi tocado. As mudanças de
a11y são aditivas (atributos + dois métodos), sem alterar fluxo de dados.

## Bloqueios reais

### Técnicos / por dependência externa
- **RLS aberta para `anon`** em `setup_drafts`, `setup_submissions`,
  `setup_audit_events`, `setup_exports`. Não corrigido automaticamente porque
  `setupDraftService.ts` depende hoje desse acesso — endurecer sem migrar o
  frontend quebraria o salvamento em produção. Plano em 3 fases, com SQL e
  roteiro de validação, em `docs/SEGURANCA-RLS-PROPOSTA.md`.
- **1 FAIL no `smoke`** (`.github/workflows/deploy-edge-functions.yml` ausente):
  pré-existente, exige `SUPABASE_ACCESS_TOKEN` em secrets.

### Por credenciais
Sem chaves do Supabase nesta sessão, não foi possível validar as policies contra
o banco real nem exercitar fluxos autenticados.

### Por ambiente
O push para o GitHub segue bloqueado pelo proxy da sessão (repositório não está
nas *sources*). Os artefatos são entregues como zips e patch.

## Pendências que exigem ação manual

1. Decidir e aplicar as fases de RLS (`docs/SEGURANCA-RLS-PROPOSTA.md`).
2. Workflow de Edge Functions.
3. Extrair pdf.js de `laudos.html` (2,5 MB inline) para `public/vendor/`.
4. Limpeza dos resíduos do protótipo na raiz (dois `importa.html` com o mesmo nome).
5. Revisar `docs/EXPORTACAO_TECNICA_EXCEL.md` (7 abas documentadas × 13 no código)
   e `docs/NETLIFY.md`.

## Como validar localmente

```bash
cd frontend && npm ci && npm run build && npm run smoke:all
cd .. && node tools/run-intake-tests.js       # 27/27
python3 -m http.server -d frontend/dist 8080  # /importa.html, /pre-analise.html, /
```

## Próximo ciclo recomendado

RLS Fase 1 (risco baixo) → Fase 2 (auditoria append-only) → Fase 3 (rascunho por
token). Em paralelo: limpeza dos resíduos e extração do pdf.js.
