# Help Desk M1-R8 — estado e evidências

**29/09/2026. Implementado e testado localmente; não deployado, homologado ou operacional. M1 aberto.**

## Base e proveniência
ZIP R7 verificado: SHA-256 `6ac42cf108f9548991d048bc8f06c552df3230669a6c43f7897e20b6fa2341fd`. Bundle restaurado em pasta nova; base `fd50ccdbb5a152d4089afdc9cb160fef236a7710`; branch local `work/m1-r8-validacao`. Remoto consultado `b9481b9fabde2fd9c442e44099bc17608b59571a`. O bundle conserva a história local recuperada, não a história integral upstream. Commit final/fingerprint/inventário constam no manifesto externo.

## Resultado verificado
Caminhos abaixo relativos a `evidence/r8/`.

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline R7 | 1.192/1.192, sem falhas/skips | 01-baseline.log |
| Instalação offline | Exit 1, ENOTCACHED | 02-install-offline.log |
| PostgreSQL local | Recusa por Docker ausente, zero SQL executado | 03-postgres.log |
| Typecheck padrão da base | Falhou por dependências/tipos ausentes, sem aprovação | 04-typecheck.log |
| Compilador suplementar RED | Exit 2, erro TS2339 na fixture do R7 | 05-typecheck-supplemental.log |
| Toolchain suplementar | TypeScript 5.8.3 global; tipos Node 25.1.0, não os 22.15.30 do lock | 06-supplemental-toolchain.txt |
| Compilador suplementar GREEN | Exit 0 após corrigir fixture | 07-typecheck-supplemental-green.log |
| Regressão focal CI | 15/15 testes existentes, sem novos cenários | 08-ci-regression.log |
| Instalação oficial | Interrompida por limite local de 20 s; SIGKILL/timeout, não aprovada | 09-install-official.log; commands.json |
| Auditoria | Exit 1, EAI_AGAIN no registry oficial | 10-audit.log |
| Suíte final | **1.192/1.192**, zero fail/cancelled/skipped/todo | 11-final-tests.log |
| Interface | 35 HTTP em memória passaram; browser bloqueou em page.goto | 12-interface.log |
| Verify padrão final | Suíte passou; exit 2 nos tipos locais Node/pg ausentes | 13-verify.log |
| Migrations e lock | Onze migrations e lock preservados e conferidos | 14-migrations.log; 15-lock.log; 21-integrity.json |
| Contratos, scan e build | Estrutural aprovado; scan heurístico; build só do frontend estático | 16-contracts.log; 17-secrets.log; 18-build.log |
| Gate atual | Não aprovado | 19-gate.log |
| Suplementar final | Exit 0, sem substituir instalação ou gate | 20-typecheck-supplemental.log |

Os seis testes TLS reais em loopback herdados estão incluídos nos 1.192, não somados. SQL permanece em **209 escritos/0 executados nesta rodada**. Browser permanece em **36 escritos/0 aprovados nesta rodada**, por `ERR_BLOCKED_BY_ADMINISTRATOR`. Provedor Auth dos testes é sintético. Não foi executado CI GitHub, driver pg real ou Function nova.

## Limitações de ambiente e tentativas
Docker e binários `postgres`/`initdb` não foram localizados. `curl` não resolveu registry.npmjs.org/ftp.postgresql.org. A tentativa de download da fonte oficial PostgreSQL 17.6 pelo recurso de download também não concluiu. Não foi instalado ou iniciado servidor; não se usou banco remoto como substituto. Nenhum DNS, registry, proxy, política de rede/navegador ou segredo foi alterado. A tentativa de execução com sessão de terminal não estava disponível e não executou comandos; as verificações seguintes foram feitas sem sessão.

A instalação interrompida pode deixar diretórios locais de dependências incompletos; nenhum `node_modules` entra no pacote. O relatório atual não herda aprovação do CI antigo 1045/201/71. Mesmo após a correção do TS2339, instalação padrão, PostgreSQL e browser seguem pendentes.

## Revisão e efeitos
Revisão pelo próprio executor, sem revisor independente. Alteração de código restrita a `tests/m1-ci-isolation.test.ts`; nenhuma assertion removida, nenhuma flag de liberação alterada. Migrations, lock, runtime, API e workflow preservados. Leitura GitHub, documentação pública e verificações locais; nenhum push/PR/merge/deploy/migration remota, mudança de usuário, dado, MFA, segredo ou infraestrutura.

A validação pós-commit de patches/fonte/bundle é registrada separadamente no manifesto e nos logs externos do pacote para evitar autorreferência do hash.
