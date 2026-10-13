# Revalidação independente — Consulte GEO M05 / I1

Data: 13/10/2026. Fonte revisada `febce83f75c45bb85aa6e22c26325e54b7b0a969`, branch `codex/consultegeo-m02`. Escopo exclusivo: achado I1 da revisão `45c31f0` e correção correspondente; não repetida a revisão integral da branch. Apenas este relatório foi salvo; nenhuma edição de implementação, rede, SQL hospedado, mudança de ambiente ou execução de worker.

## Resultado

**I1 corrigido na revisão de código.** Nenhum Critical, Important ou Minor novo identificado no delta da correção. A aprovação da implementação desta correção não equivale a homologação nativa final: a CI integral de `febce83` ainda estava em andamento, e o reviewer não executou PostgreSQL no Windows.

O resultado complementa `.local/review-consultegeo-m05.md`, que documenta o defeito na fonte anterior. Seu único Important não permanece aberto no código de `febce83`; o aceite da fonte final requer observar a CI/PG17 GREEN.

## Cobertura da correção

- **Admissão dos defaults:** `scripts/consultegeo-upgrade.ts:44–50` / migration `20261013181408_consultegeo_m05_upgrade.sql:16–22` examinam `pg_default_acl` do operador efetivo tanto no escopo global (`defaclnamespace=0`) quanto nos quatro schemas privados. A concessão EXECUTE ao publicador que originou I1 tem grantee diferente do owner e de PUBLIC, portanto provoca `HDU05` antes da criação dos módulos. Os defaults existentes não são modificados. A exceção PUBLIC EXECUTE de funções é compatível com os corpos qualificados, que revogam essa execução explicitamente.
- **Admissão antes do COMMIT:** `scripts/consultegeo-upgrade.ts:83–102` / migration `1752–1771` confere atributos e associação dos dois papéis, propriedade e privilégios de schemas, tabelas/colunas e funções. O publicador deve ter USAGE somente em `helpdesk_auth` e EXECUTE somente nas três assinaturas autorizadas, sem grant option; o worker deve ter zero direitos de domínio. Excesso/falta provoca `HDU06`. O marcador e COMMIT vêm depois desse bloco (`migration:1772–1773`), de modo que a recusa aborta o upgrade inteiro. O marker é um CREATE OR REPLACE de uma função existente e não cria um helper novo depois da validação.
- **Regressão concreta de I1:** `supabase/tests/m05-upgrade-scenarios.ts:26` prepara outro banco novo no cluster próprio, aplica 001–012, concede o default EXECUTE ao publicador e exige `HDU05`. Confere marcador 0.19, ausência de `hdn_cfg_commit` e preservação exata do snapshot de `pg_default_acl`. Não adota nem remove banco existente e usa os mesmos targets validados do runner próprio.
- **Regressão da proteção final:** `supabase/tests/m05-upgrade-scenarios.ts:18` injeta EXECUTE extra em `hdn_cfg_commit` para o publicador após os corpos de instalação, exige `HDU06` e executa ROLLBACK na conexão que recebeu a falha. O snapshot posterior exige marker 0.19, zero tabelas promovidas e a mesma linha histórica, comprovando que o erro não confirma módulos parciais. A injeção ocorre antes do bloco reservado do worker, que não elimina o grant ao publicador, exercitando a admissão final efetivamente.

## Evidência e comandos executados

Foi conferido o RED nativo importado localmente de `4277dba05c1b7ca9cdb8ae94008443be3a1e061a`, CI `38452159544`: `.local/m05-ci-defaults-red/helpdesk-homologation-4277dba05c1b7ca9cdb8ae94008443be3a1e061a-38452159544-1/homologation/runs/dbf8fd0f-1d50-43dd-87c7-f955eab31e53/postgres.log:1354` mostra o caso de default falhando com **M05_BAD_ACCEPT**, em vez de HDU05; o relatório registra **382/384**, duas falhas contando o pai, zero skips/cancelamentos/todo. O diagnóstico é lançado pelo teste após a migration ter sido admitida, confirmando que o negativo não falha por pré-requisito ou conexão. Esta evidência comprova RED da fonte antiga, não GREEN da nova. Nenhuma fonte remota foi acessada nesta revalidação.

No HEAD `febce83`:

- `node --experimental-strip-types --test --test-reporter=tap tests/consultegeo-upgrade.test.ts tests/consultegeo-upgrade-readiness.test.ts`: **24/24 passaram**, zero falhas, skips, cancelamentos ou todo.
- `npm run check:consultegeo-upgrade`: aprovado, SQL compilado confere com receita/corpos e hash, sem execução/reparo.
- `npm run check:migrations`: aprovado, 13 arquivos/schema 0.20.0, sem SQL.
- `npm run typecheck`: aprovado, exit code zero.
- `git -c safe.directory=<workspace absoluto> diff 4277dba febce83 --stat` / `diff --check`: cinco arquivos na correção, nenhum erro de whitespace. O delta é prólogo/epílogo no compiler e migration derivada, hashes nos dois manifests e negativo de excesso tardio.
- `git -c safe.directory=<workspace absoluto> diff --numstat 392fdd2... febce83 -- supabase/candidates supabase/migrations`: somente a nova migration; **seis candidatos e doze migrations anteriores intactos**.
- `Get-Item` e `Get-FileHash -Algorithm SHA256`: **163253 bytes**, hash `23aae798d34cf5c4d6e96478761dfb2e5208dc071fd886f2ab56d78e12d83b1a`.
- `rev-parse HEAD` / `status --short`: HEAD indicado, sem alterações rastreadas; documento `docs/141-CONSULTEGEO-UPGRADE-M05-2026-10-13.md` ainda não rastreado pelo implementador, não revisado nem alterado pelo reviewer.

O implementador deve conferir a CI integral da fonte final e qualificar sua evidência antes de declarar aprovação PostgreSQL. As pendências M06/M08/M11 e a ausência de aplicação hospedada permanecem conforme o escopo original; nenhuma autorização de promoção/merge/deploy foi inferida nesta revalidação.
