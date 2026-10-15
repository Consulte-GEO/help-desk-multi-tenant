# IMPLEMENTATION REPORT · v13 — primeira release git-first

**Branch:** `claude/v13-fechar-publicacao-v12` · **Base:** `175f43a` (main) ·
**Versão:** `5.0.22-49` → **`5.0.22-50`** · **Data:** 20/08/2026

---

## 1. Resumo executivo

Primeira entrega deste repositório publicada **por git**, e não por upload web. O objetivo era
fechar os três rastros que o upload web deixou (não deleta arquivo, não sobe caminho que começa
com ponto, sobe o `INSTRUCOES.md` do zip) e dar contexto próprio ao repositório.

Entraram os dois dotfiles que faltavam (`.gitignore` da raiz, `frontend/.env.example`), o workflow
de deploy das Edge Functions e o `CLAUDE.md`; saíram 27 arquivos de resíduo (o serviço órfão, o
`INSTRUCOES.md` da raiz e 25 dos 26 arquivos da árvore duplicada do zip v07).

**Nenhuma linha de código de aplicação foi alterada.** Todos os gates executáveis neste ambiente
passaram. O smoke saiu de **588 OK / 2 FAIL** para **593 OK / 0 FAIL** (medido em conteúdo LF,
como no Linux/Netlify — ver §6).

## 2. Ambiente

| Item | Valor |
|---|---|
| Sistema | Windows 11, Git Bash, `core.autocrlf=true` (config de sistema) |
| Node / npm | v26.1.0 / 11.13.0 |
| Python | **ausente** neste ambiente |
| Repositório | `Consulte-GEO/setup-implantacao-obras` |
| `main` no início | `175f43a`, `frontend/package.json` = `5.0.22-49` — **confirmado** antes de agir |

## 3. Arquivos

### Criados (4)

| Arquivo | Conteúdo |
|---|---|
| `.github/workflows/deploy-edge-functions.yml` | Conteúdo literal da tarefa, 70 linhas. Seis `supabase functions deploy` explícitos, um por linha (o smoke confere cada função nominalmente). No-op verde enquanto não existir o secret `SUPABASE_ACCESS_TOKEN` |
| `frontend/.env.example` | Conteúdo literal da tarefa. Só placeholders — verificado: zero ocorrências de `eyJ`, `sbp_` ou `service_role` |
| `.gitignore` (raiz) | Conteúdo literal da tarefa. O repositório não tinha `.gitignore` nenhum |
| `CLAUDE.md` | 113 linhas: stack e proibições, vocabulário, invariantes, tabela de gates, fluxo de entrega, armadilhas. Marcado no topo como sujeito a revisão do mantenedor |

### Alterados (1)

| Arquivo | Mudança |
|---|---|
| `frontend/package.json` | `"version"`: `5.0.22-49` → `5.0.22-50`. Única linha alterada |

### Removidos (27)

| Arquivo | Motivo |
|---|---|
| `frontend/src/services/setupSubmissionService.ts` | Órfão desde a v5.20. Confirmado **zero importadores** em `frontend/src` antes de remover; o guard de `prebuild` já o apagava a cada build, agora a remoção fica registrada em git |
| `INSTRUCOES.md` (raiz) | Documento de entrega de zip, não código |

E 25 dos 26 arquivos rastreados em `Implantacao consulte geo source patches v07/`:

```
Implantacao consulte geo source patches v07/AUDITORIA-V7.md
Implantacao consulte geo source patches v07/IMPLEMENTATION-REPORT-V522-44.md
Implantacao consulte geo source patches v07/INSTRUCOES.md
Implantacao consulte geo source patches v07/SEGURANCA-RLS-PROPOSTA.md
Implantacao consulte geo source patches v07/arquivos/AUDITORIA-V7.md
Implantacao consulte geo source patches v07/arquivos/IMPLEMENTATION-REPORT-V522-43.md
Implantacao consulte geo source patches v07/arquivos/IMPLEMENTATION-REPORT-V522-44.md
Implantacao consulte geo source patches v07/arquivos/README.md
Implantacao consulte geo source patches v07/arquivos/assets/intake-auditor.js
Implantacao consulte geo source patches v07/arquivos/assets/intake-selftest.js
Implantacao consulte geo source patches v07/arquivos/docs/SEGURANCA-RLS-PROPOSTA.md
Implantacao consulte geo source patches v07/arquivos/frontend/package-lock.json
Implantacao consulte geo source patches v07/arquivos/frontend/package.json
Implantacao consulte geo source patches v07/arquivos/frontend/public/assets/design-system.css
Implantacao consulte geo source patches v07/arquivos/frontend/public/assets/geo-symbol.png
Implantacao consulte geo source patches v07/arquivos/frontend/public/assets/intake-auditor.js
Implantacao consulte geo source patches v07/arquivos/frontend/public/assets/intake-selftest.js
Implantacao consulte geo source patches v07/arquivos/frontend/public/assets/pre-analise.js
Implantacao consulte geo source patches v07/arquivos/frontend/public/importa.html
Implantacao consulte geo source patches v07/arquivos/frontend/public/pre-analise.html
Implantacao consulte geo source patches v07/arquivos/frontend/src/components/Step3GruposEditor.vue
Implantacao consulte geo source patches v07/arquivos/frontend/src/components/Step5PecasEditor.vue
Implantacao consulte geo source patches v07/arquivos/netlify.toml
Implantacao consulte geo source patches v07/arquivos/pre-analise.html
Implantacao consulte geo source patches v07/arquivos/tools/run-intake-tests.js
```

**Verificações feitas antes de remover:** nenhum arquivo de configuração, script ou código fora do
diretório referencia esse caminho (busca em `*.toml`, `*.json`, `*.cjs`, `*.js`, `*.ts`, `*.yml` e
no repositório inteiro: **zero ocorrências**). Cada um dos 25 tem contraparte na árvore real — 9
byte a byte idênticos e 16 em versão mais antiga (a cópia duplicada de `frontend/` está na
`5.0.22-44`, contra `5.0.22-49` da árvore real).

**Não removido — decisão do mantenedor:**
`Implantacao consulte geo source patches v07/v5.22.43-e-v5.22.44.patch` (4.727 linhas) é o único
arquivo do diretório **sem cópia em nenhum outro caminho**. A tarefa manda não remover e reportar,
então ele ficou. Pelo cabeçalho, é o `format-patch` das v5.22.43/44 (build do Netlify a partir de
`frontend/` + Pré-análise de planilha) — conteúdo já aplicado na árvore atual, ou seja,
provavelmente descartável, mas a chamada é sua. Para concluir a limpeza:

```bash
git rm "Implantacao consulte geo source patches v07/v5.22.43-e-v5.22.44.patch"
```

## 4. Comandos executados

| Comando | Resultado |
|---|---|
| `git log -1` / `cat frontend/package.json` | `175f43a` · `5.0.22-49` — precondição confere |
| `grep -rn "setupSubmissionService" frontend/src` | **0 hits** → seguro remover |
| `git ls-files "Implantacao consulte geo source patches v07"` | 26 arquivos |
| `git ls-files` filtrado por `node_modules` e `dist` | **0** antes e **0** depois |
| `git check-ignore` + `git ls-files frontend/.env.example` | rastreado — a negação `!.env.example` funciona |
| `npm ci` | ok |
| `npm run typecheck` | **0 erros** (exit 0) |
| `npm run build` | **exit 0** · `built in 4.27s` |
| `npm run smoke` (antes das mudanças) | **588 OK, 2 FAIL** |
| `npm run smoke` (depois) | **592 OK, 1 FAIL** no checkout Windows/CRLF · **593 OK, 0 FAIL** em LF |
| `npm run smoke:contrast` | **89 OK, 0 FAIL** |
| `npm run smoke:xlsx` | self-test OOXML gerou as abas Estilos + Dados |
| `node tools/run-intake-tests.js` | **27/27 verdes** |
| `node tools/run-similarity-tests.js` | **21/21 verdes** |
| `node tools/run-implantacao-import-tests.js` | **23/23 verdes** |
| `npm audit --omit=dev` | **0 vulnerabilidades** |
| `python3 tools/browser-validate-v10.py` | **não executado** — Python ausente no ambiente |

### A prova do item 1

O smoke tinha **2 FAIL** antes: o do workflow ausente e um segundo, pré-existente. Criar o
workflow não só apagou o FAIL dele como habilitou 3 asserções que antes nem rodavam — o total de
asserções foi de 590 para 593. Daí **588 OK / 2 FAIL → 592 OK / 1 FAIL**, e **593 OK / 0 FAIL**
com o conteúdo em LF.

## 5. Situação de cada item da tarefa

| Item | Situação |
|---|---|
| 1. Workflow das Edge Functions | **Implementado** (conteúdo literal, não reescrito) |
| 2. `frontend/.env.example` | **Implementado** |
| 3. `.gitignore` da raiz | **Implementado** |
| 4. Remover `setupSubmissionService.ts` | **Implementado** (zero importadores confirmados) |
| 5. Remover `INSTRUCOES.md` | **Implementado** |
| 6. Remover a árvore órfã v07 | **Parcial, por regra da própria tarefa** — 25 de 26; o `.patch` sem contraparte ficou, conforme instrução |
| 7. `CLAUDE.md` | **Implementado** |
| 8. Bump + relatório | **Implementado** |
| Merge do PR | **Não feito, por decisão de processo** — é do mantenedor |

## 6. Bloqueios reais

**1. `python3 tools/browser-validate-v10.py` não rodou.** Python não está instalado nesta máquina
(o alias do Windows responde com a sugestão da Microsoft Store). Gate **não executado** — não há
resultado a declarar. Como esta entrega não altera nenhuma linha de aplicação, o risco de
regressão visual é baixo, mas a validação segue pendente.

**2. O FAIL restante do smoke é artefato de CRLF no Windows, não bug.** O gate
`SetupPage · beforeUnmount limpa linkCopiedTimer` (linha 2233 de `smoke-pipeline.ts`) casa
`/beforeUnmount[\s\S]{0,500}clearTimeout\(this\.linkCopiedTimer\)/`. Medição:

| Conteúdo | Distância entre `beforeUnmount` e o `clearTimeout` | Limite | Gate |
|---|---|---|---|
| Checkout Windows (CRLF) | **505** caracteres | 500 | **FAIL** |
| Normalizado em LF (Linux/CI/Netlify) | **495** caracteres | 500 | **OK** |

O `beforeUnmount` de `SetupPage.vue` (linha 597) **limpa o timer corretamente** desde a v5.22.24 —
não existe leak. São os 9 `\r` das 9 linhas de comentário entre o hook e a chamada que estouram o
limite, por 5 caracteres. Rodei o smoke com o arquivo normalizado em LF, sem alterar conteúdo, e o
resultado foi **593 OK, 0 FAIL**; depois restaurei o arquivo (`git status` limpo).

Não toquei no gate nem no arquivo — a tarefa proíbe as duas coisas. **Nada a corrigir para esta
entrega.** Se quiser eliminar a fragilidade num ciclo futuro, há duas saídas e a escolha é sua:
subir o limite do regex para ~800, ou mover as 3 linhas de comentário para fora do hook. Um
`.gitattributes` com `* text=auto eol=lf` também tornaria o checkout local igual ao do CI.

## 7. Pendências manuais (para o mantenedor)

1. **Revisar e mergear o PR** — o merge é seu. O Netlify publica no merge.
2. **Decidir o destino do `v5.22.43-e-v5.22.44.patch`** (§3). Comando pronto acima.
3. **Criar o secret `SUPABASE_ACCESS_TOKEN`** se quiser o deploy automático das Edge Functions:
   *Settings → Secrets and variables → Actions*. Sem ele o workflow termina verde sem deployar.
4. **PRs #6, #7 e #8 do Dependabot** apontam para a árvore duplicada que este PR remove — depois
   do merge eles ficam sem alvo e podem ser fechados.
5. **`frontend/package-lock.json` tem `"version": "5.0.22-45"`** na raiz, contra `5.0.22-50` do
   `package.json`. É divergência anterior a esta entrega, o `npm ci` não reclama, e ficou fora do
   escopo de propósito. Vale sincronizar num ciclo futuro.
6. **`.v8-validation/`** é criado pelo gate `smoke:xlsx` e não está coberto pelo `.gitignore`
   desta entrega (o conteúdo do arquivo foi seguido à risca). Fica como diretório não rastreado
   depois de rodar os gates; não foi commitado. Candidato a uma linha no `.gitignore` no próximo
   ciclo.

## 8. Como validar

```bash
git fetch origin && git checkout claude/v13-fechar-publicacao-v12
cd frontend && npm ci
npm run typecheck && npm run build
npm run smoke && npm run smoke:contrast && npm run smoke:xlsx
cd .. && node tools/run-intake-tests.js && node tools/run-similarity-tests.js && node tools/run-implantacao-import-tests.js
cd frontend && npm audit --omit=dev
```

Em Linux/macOS o smoke fecha em `593 OK, 0 FAIL`. No Windows com `core.autocrlf=true`, espere
`592 OK, 1 FAIL` — o FAIL é o de §6, e não é bug.

O que conferir na revisão: o workflow bate literalmente com o que o smoke espera (seis `functions
deploy`, um por linha); o `.env.example` não tem chave real; nenhum dos 25 arquivos removidos era
cópia única; e o `CLAUDE.md` descreve o projeto como ele é — esse é o arquivo que mais merece o
seu olhar, porque vira contexto das próximas sessões.

## 9. Próximo ciclo

- Instalar o **Claude GitHub App** na org com acesso a este repositório, para as próximas sessões
  já nascerem com credencial de push.
- Resolver a fragilidade do gate de CRLF (§6) — de preferência com `.gitattributes` `eol=lf`.
- Sincronizar a versão do `package-lock.json`.
- Decidir o destino de `laudo-vision` e `admin-bootstrap`: são Edge Functions sem chamador no
  frontend e por isso ficaram fora do workflow de CI.
