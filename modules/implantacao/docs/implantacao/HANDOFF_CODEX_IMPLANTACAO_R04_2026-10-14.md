# Handoff Codex — Implantação e Importações R04

**Repositório:** Consulte-GEO/setup-implantacao-obras. **Base:** dcf5607652281bb688f366e6a4f05e07eb698d31. **Candidato:** 5.0.22-55. **Branch proposta:** claude/v19-imp02-recuperacao. R04 cumulativa sobre a base original, não delta para aplicar depois de R01/R02/R03.

## Aplicar
Ler instruções atuais do repositório, planos originais e R04-CONTRATO-RECUPERACAO.md. Extrair fora do checkout. Conferir SHA256SUMS. Não executar sobre main nem árvore suja. Se pacotes anteriores já estiverem em algum branch, reconciliar o delta; não alterar hashes para forçar.

```sh
git status --short
git fetch origin main
git switch -c claude/v19-imp02-recuperacao origin/main
node /caminho/pacote/aplicar-r04.cjs --repo /caminho/setup-implantacao-obras --check
node /caminho/pacote/aplicar-r04.cjs --repo /caminho/setup-implantacao-obras --apply
git diff --check
```
Somente o aplicador R04 aceita o manifesto R04. Ele confere blobs das fontes alteradas e hashes dos payloads, não instala, faz commit, publica ou executa banco.

## Gates no checkout completo
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
python tools/run-import-integrity-browser.py --output /caminho/externo/evidencias-ponte
python tools/run-import-process-browser.py --output /caminho/externo/evidencias-http-r03
```
O último runner ainda cobre a jornada R03, não journal nativo/hard reload da R04. Não o renomear como evidência do recurso novo. Typecheck local nesta entrega usou TS global 5.8.3; repetir pelo lock. SKIP é bloqueio, não aprovação. A R04 preserva NODE_VERSION e dependências anteriores: qualificar a compatibilidade dos scripts de teste com Node 22.16 sem impor migração de runtime por acidente.

## Banco
O SQL candidato da R02 não mudou. Ler QUALIFICACAO_POSTGRESQL_R03.md e executar só em cluster local descartável, usuário não-root, PG17 e driver pg disponíveis. O qualificador não aceita host remoto ou URL de produção. A sessão R04 terminou blocked/exit2 e zero queries.

```sh
node --experimental-strip-types tools/qualify-import-process-postgres.mjs  --execute --pg-bin /caminho/pg17/bin --driver /caminho/node_modules/pg  --output /caminho/externo/evidencias-pg
```
Não aplicar DDL remoto para substituir o teste local. Confirmar também durabilidade, papel/memberships, RLS, restore e perda de confirmação do COMMIT.

## Montagem do recurso novo
1. Construir serviço e handler com repositório, sessão, localizador, admissão e inspeção reais. O novo GET `/v1/import-processes/{caseId}/operations/{operationId}` usa as mesmas portas e permanece fechado por padrão.
2. No host autenticado, construir o cliente com sessionFetch existente e journal com sessionStorage. Capturar indisponibilidade do storage antes de permitir salvar. Identidade e capability precisam vir do servidor, não URL/JSON/planilha.
3. Chamar registerImportProcessSession sobre o Vuex existente. Não substituir setup/validation/export. Não importar serviço/repositório/credenciais no frontend. Namespace `importProcess`; ações e getters no contrato R04.
4. Após restaurar identidade, disparar restorePending. Isso consulta recibo por GET; não reenvia conteúdo. Sem recibo, continuar pendente, não liberar uma nova operação automaticamente.
5. Na desmontagem da tela, binding.dispose preserva marcador. No logout/troca de escopo, binding.endSession limpa. Nunca usar clearSession em beforeunload. Conectar `shouldWarnBeforeUnload` ao host e não prometer preservação de rascunho ainda não enviado.
6. Montar a visualização com duas versões explícitas: consultada no processo e confirmada no recibo. Apresentar conflito, consulta pendente, cleanup_required e erro de storage sem falso sucesso.

## Cenários reais antes de liberar
Salvar e recuperar após hard reload com sessionStorage nativo; repetir com socket cortado depois do commit e antes de qualquer commit; confirmar que só GET ocorreu na recuperação; testar sessão expirada/renovada, outro ator/conta, duas abas, storage bloqueado/sem quota, desmontagem/reentrada, logout, retorno tardio, versão posterior e marcador adulterado. Validar o Vuex real, não só o harness estrutural incluído. Sem recibo não existe prova de rollback nem autorização para reenviar com UUID novo.

Fechar a aba e rascunhos não enviados não são cobertos pelo marcador. Upload/download, retenção/purge, prova de persistência entre dispositivos e receptor real continuam requisitos próprios.

## Entrega/autorização
Fornecer evidências do mesmo código, backlog e ZIP cumulativo. Não confundir biblioteca/HTTP testados com aplicação publicada. Sem autorização específica, não realizar merge/deploy/migrations remotas ou enviar mensagens/dados reais. Não abrir flags do Help Desk para disfarçar pendências.
