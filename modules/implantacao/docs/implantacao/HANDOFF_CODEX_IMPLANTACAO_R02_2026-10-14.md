# Handoff Codex — Implantação e Importações R02

## Objetivo

Integrar a R02 cumulativa no Setup e qualificar a montagem real. Não liberar atendimento ou importação automática. Este pacote contém R01 + R02 contra `dcf5607652281bb688f366e6a4f05e07eb698d31`; não é ZIP do repositório inteiro nem dist de deploy.

**Alvo:** `Consulte-GEO/setup-implantacao-obras`. Branch de trabalho proposta: `claude/v17-imp02-processos`.

## Leitura

Instruções atuais do repositório, plano original, relatório R02, plano revisado, `modules/import-process/README.md` e `docs/implantacao/QUALIFICACAO_POSTGRESQL_R02.md`. Documentos R01 são históricos; regras R02 prevalecem nos componentes alterados.

## Aplicação local protegida

Extrair fora do checkout. Atualizar a base e confirmar mudanças concorrentes. No checkout completo, limpo e em branch isolada:

```sh
git status --short
git fetch origin main
git switch -c claude/v17-imp02-processos origin/main
node /caminho/pacote/aplicar-r02.cjs --repo /caminho/setup-implantacao-obras --check
node /caminho/pacote/aplicar-r02.cjs --repo /caminho/setup-implantacao-obras --apply
git diff --check
```

**Não aplicar R01 antes:** R02 já inclui suas alterações. Se a R01 já estiver integrada no checkout, ou houver alterações concorrentes, o aplicador recusa intencionalmente. Comparar/reconciliar os arquivos, preservar regressões e registrar a nova base; não alterar hashes para forçar a passagem. O aplicador não faz commit, push, merge, deploy, SQL ou instalação de pacote.

Verificar o SHA256 do ZIP entregue e `SHA256SUMS` antes da aplicação. Checksums detectam corrupção; não substituem assinatura de software. O manifest fixa os blobs-base existentes. Arquivos novos colidentes e links simbólicos são recusados.

## Gates

Use Node **22.16.x** ou versão compatível validada, pois os novos testes TS utilizam `--experimental-strip-types`. O Node20 de build Netlify não foi alterado; o módulo server-side novo não está montado no deploy.

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
npm audit --omit=dev
cd ..
node tools/run-intake-tests.js
node tools/run-similarity-tests.js
node tools/run-implantacao-import-tests.js
python tools/run-import-integrity-browser.py --output /caminho/externo/evidence/r02-browser
```

Não converter SKIP em aprovação. A sessão GPT usou TS global 5.8.3; repetir pelo lock. O Chromium entregue usa DOM em memória e colaboradores sintéticos. Ainda é obrigatório abrir `/importa` real, carregar XLSX, confirmar mapeamento/unidade, revisar, exportar/reabrir o arquivo e conferir as abas/proveniência. Verificar arquivo de ponte antigo/ausente e cache misto.

## Módulo novo

`modules/import-process/` tem contratos, validação, serviço de aplicação e adaptador PostgreSQL sem dependência de driver. Requer montagem com repositório real, autoridade da origem e inspeção privada do storage. Não expor diretamente esses argumentos de servidor via HTTP/JWT ou JSON de configuração do cliente. A capability permanece `operational:false`.

O DDL em `docs/implantacao/sql/IMP02_PROCESSOS_CANDIDATO.sql` **não foi executado** e não é uma migration aprovada. Não cria o papel, buckets, policies do storage ou endpoint. Não executar no Supabase hospedado como parte da aplicação do ZIP. A revisão do esquema e o bootstrap precisam ser compatíveis com os privilégios reais do provedor.

Não interpretar a fixture `MemoryRepository` ou o transporte SQL simulado como persistência PostgreSQL. Não substituir o banco real por esses doubles na aplicação.

## Próxima entrega esperada

Relatório dos gates completos; integração/qualificação da origem e storage; testes PG reais; tela de retomada vinculada a processo persistido; novo ZIP cumulativo e handoff. A integração de Help Desk/Dev Agent continua posterior: proposta, aprovação e execução são responsabilidades separadas.

Sem aprovação específica da entrega, não fazer merge/publicação, alterações remotas de banco, credenciais, usuários/MFA, e-mails reais ou registros no sistema de destino.
