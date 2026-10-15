# Handoff Codex — Implantação e Importações R05

**Repo:** Consulte-GEO/setup-implantacao-obras. **Base:** dcf5607652281bb688f366e6a4f05e07eb698d31. **Candidato:** 5.0.22-56. **Branch proposta:** claude/v20-imp02-painel-revisao.

O pacote é cumulativo R01–R05 contra a base original. Não é um clone nem um dist. Não aplicar R01, R02, R03 e R04 antes. Se algum deles já estiver em branch, reconciliar diferenças; não editar hashes para forçar.

## Aplicação local
Ler CLAUDE.md/instruções atuais, planos originais e R05. Extrair fora do checkout. Conferir SHA256SUMS. Nenhum segredo ou biblioteca nova precisa ser adicionado por este aplicador.

```sh
git status --short
git fetch origin main
git switch -c claude/v20-imp02-painel-revisao origin/main
node /caminho/pacote/aplicar-r05.cjs --repo /caminho/setup-implantacao-obras --check
node /caminho/pacote/aplicar-r05.cjs --repo /caminho/setup-implantacao-obras --apply
git diff --check
```

O aplicador valida base/manifesto/blobs/colisões. Preserva todas as transformações anteriores, acrescenta rota lazy `/admin/processos/:caseId?` com meta adminOnly e inclui ImportProcessPanel/ImportProcessView no allow-list do prebuild. Não registra namespace automaticamente, não cria sessão e não abre backend. O normalizador original acompanha a cópia de contexto para testes; sua entrada no manifesto é somente verify.

## Verificações no checkout completo
```sh
cd frontend
npm ci --ignore-scripts
npm run typecheck
npm run build
npm run smoke
npm run smoke:contrast
npm run smoke:xlsx
npm run test:laudos
npm run test:laudo-vision
npm run test:import-integrity
npm run test:import-process
npm run typecheck:import-process
npm run typecheck:import-process-client
npm audit --omit=dev
cd ..
node tools/run-intake-tests.js
node tools/run-similarity-tests.js
node tools/run-implantacao-import-tests.js
python tools/run-import-integrity-browser.py --output /caminho/externo/ponte
python tools/run-import-process-browser.py --output /caminho/externo/http
python tools/run-import-review-offline.py --vue-runtime frontend/node_modules/vue/dist/vue.global.js --output /caminho/externo/painel-offline
```

O último teste é explicitamente offline e usa um store-port e cliente simulados; mesmo com Vue real do lock, não comprova Vuex ou backend reais. Criar/executar também jornada E2E da aplicação completa. As 418 aprovações locais não substituem essa etapa. Se Deno/binários faltarem, SKIP não é aceitação. Os scripts de teste exigem Node compatível com type stripping; qualificar com Node 22.16 sem alterar por acidente NODE_VERSION do produto.

## Montagem autorizada
A rota protege entrada com o login existente, mas adminOnly não é autorização server-side. Construir as portas reais R02/R03 e registrar `registerImportProcessSession` com o Vuex existente apenas após identidade/escopo e capacidade confirmados no servidor. O cliente usa sessionFetch existente e o journal recebe sessionStorage nativo. O caseId da rota nunca concede direitos. A tela fica indisponível sem binding — não inserir fallback em memória no produto para fazê-la aparecer funcional.

Na entrada, o painel tenta recuperar marcador pendente antes de abrir o processo solicitado. Em outro processo já aberto, pede decisão quando há alterações. Guardas da view aguardam confirmação e consulta da nova seleção. O marcador de saveRevision não cobre intents de criação/arquivos, fechamento de aba ou conteúdo não enviado. Logout/troca de identidade chamam endSession no host; desmontar a view não apaga o marcador.

Revisar integração visual com tokens reais/light/dark, navegabilidade teclado, foco nos avisos/confirmadores e mobile. O SFC foi montado com compilador runtime Vue 3.5.13, não pelo Vite/vue-tsc da aplicação completa. Existe tabela com rolagem horizontal no mobile; testar usabilidade com lotes reais antes de aceitar.

## Banco
O SQL candidato está inalterado. Executar somente o qualificador local descartável, não contra Supabase hospedado:
```sh
node --experimental-strip-types tools/qualify-import-process-postgres.mjs --execute --pg-bin /caminho/pg17/bin --driver /caminho/node_modules/pg --output /caminho/externo/pg
```
A sessão R05 retornou blocked/exit2 por usuário root, binários e driver ausentes, zero queries. Não transformar essa saída em verde nem usar banco remoto para substituir o teste.

## Publicação
Sem merge/deploy/migration remota até autorização e qualificação necessárias. Não habilitar gates do Help Desk para disfarçar ausência de fonte real. Primeiro fechar build/legados/PG/Vuex/E2E/armazenamento; depois ligar chamado e Dev Agent. Ao final, atualizar evidências, relatório, backlog e ZIP cumulativo.
