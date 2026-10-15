# Handoff Codex — Implantação e Importações R03

**Alvo:** Consulte-GEO/setup-implantacao-obras. **Base:** dcf5607652281bb688f366e6a4f05e07eb698d31. **Candidato:** 5.0.22-54. **Branch proposta:** claude/v18-imp02-transporte. Pacote incremental cumulativo R01+R02+R03, não repositório completo e não dist.

## Aplicação protegida

Ler instruções atuais, plano original, relatório/plano R03 e docs/implantacao/R03-HTTP-CONTRATO.md. Extrair o ZIP fora do checkout. Conferir SHA256SUMS. Atualizar main pelo fluxo normal e verificar trabalhos concorrentes.

```sh
git status --short
git fetch origin main
git switch -c claude/v18-imp02-transporte origin/main
node /caminho/pacote/aplicar-r03.cjs --repo /caminho/setup-implantacao-obras --check
node /caminho/pacote/aplicar-r03.cjs --repo /caminho/setup-implantacao-obras --apply
git diff --check
```

Aplicar **somente R03**. Se a R01/R02 já foi integrada, reconciliar diferenças; o aplicador recusa arquivos existentes/divergentes intencionalmente. Não editar hashes, versão do manifesto ou guards para forçar. O aplicador não instala pacotes, não faz commit/push/merge/deploy e não executa SQL. Os aplicadores históricos agora recusam manifesto de outra versão.

O DDL da R02 permanece candidato fora de migrations. Esta entrega não altera o schema, Supabase, storage ou Auth. Versionar comandos e dependências pelo lock; não reconstruir npm lock para mascarar falha.

## Verificações obrigatórias no checkout completo

Node 22.16 ou versão compatível validada para strip-types. Frontend continua com a stack atual; nenhum servidor novo foi publicado. O typecheck desta sessão usou TS global 5.8.3; repetir pelo lock do projeto.

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
python tools/run-import-integrity-browser.py --output /caminho/externo/evidence-r03-ponte
python tools/run-import-process-browser.py --output /caminho/externo/evidence-r03-http
```

SKIP não é aprovação. O segundo browser usa compilação com rewriteRelativeImportExtensions (TS>=5.7). Usar compilador de teste qualificado sem alterar dependências do produto só para passar. A R03 conseguiu compilar, mas o Chromium local negou navegação com ERR_BLOCKED_BY_ADMINISTRATOR; o log foi preservado. Quatro jornadas HTTP reais em Node passaram com fixtures de banco/identidade/scanner. Nenhum desses testes substitui o app Vue+XLSX.

## PostgreSQL

Ler QUALIFICACAO_POSTGRESQL_R03.md e executar como usuário de SO não-root, com binários PG17 e driver pg local já instalado pelo processo aprovado. A ferramenta exige --execute e cria seu próprio banco descartável; não recebe URL/host de produção.

```sh
node --experimental-strip-types tools/qualify-import-process-postgres.mjs \
  --execute --pg-bin /caminho/postgresql/17/bin \
  --driver /caminho/local/node_modules/pg \
  --output /caminho/externo/evidence-r03-pg
```

Status atual: blocked/exit2, zero queries. Não aplicar o DDL no Supabase hospedado para substituir esse teste. Completar privilégios, queda ambígua de COMMIT, reinício físico e restore; o runner cobre onze cenários iniciais, não homologação integral.

## Montagem real, depois dos gates

1. Construir createImportProcessService com pool restrito, autoridade e inspeção reais; nenhuma fixture em runtime.
2. Montar createImportProcessHttpHandler no host existente, origem explícita, autenticação validada, diretório autorizado e quotas. enabled permanece false até qualificação.
3. Conectar createImportProcessClient ao fetch de sessão existente e createImportProcessController ao Vuex. Não importar service/postgres no browser. Só canonical.ts é runtime puro compartilhável.
4. Implementar upload/download privado e recuperação da intenção pendente depois de hard reload. O controlador atual só preserva a intenção na memória da sessão.
5. Testar usuário/obra/conta, escopo revogado, concorrência, ACK perdido, arquivo adulterado, retomada entre dispositivos e salvamento confirmado.

APIs de metadados não são upload. Casos draft/awaiting_ticket não são chamados abertos nem dados importados. A integração Help Desk/Dev Agent, outbox, aprovação e executor ainda não estão montados.

## Entrega e autorização

Gerar relatório com códigos, logs e limitações reais, plano atualizado e ZIP cumulativo. Não declarar operacional só por biblioteca testada. Sem autorização específica, não fazer merge/publicação, migrations remotas, alterações de usuários/MFA/secrets ou envio de mensagens e dados reais.
