# Help Desk M1-R13 — Estado e evidências

**01/10/2026. Entrega local. M1 aberto. Não deployada, não homologada e não operacional.**

## Base e recuperação
Remoto lido nesta rodada: `78bbb00112331531168ae24600604cb7f3148770`, R9 integrado, nas branches `codex/m1-reproducibilidade` e `codex/m1-r9-integracao`. O handoff remoto registra CI anterior de 1.202 aplicação / 209 PostgreSQL / 71 HTTP+browser; não foi reexecutado nesta rodada e não aprova R10–R13.

Base local R12 informada no pacote: `f22673b8206b5e5aa80669ce786a2fddf7e3c73d`. A fonte foi recuperada a partir do bundle R8, dos deltas R9 disponíveis no conector/contexto e dos arquivos cumulativos R12. O fingerprint de código/configuração/testes coincidiu **exatamente** com `ab83259af4f177e6de77e982c7d184f2a3ea6a9d1ae4d783555e297d8fda0f38`; o baseline passou em 1.320 testes. Commit da recuperação nesta pasta: `f8cc2e11649804cf4d16ab3f383ffc3fddfaddfc`. Isso não é a história Git/documentação remota completa; não fazer force-push ou substituir o checkout upstream por esta recuperação.

## Alteração realizada
Correção limitada a `scripts/postgres-readiness.mjs`, regressões no novo arquivo de testes e atualização do piso de aplicação no gate existente. O helper agora valida opções antes de qualquer consulta; exige metadados numéricos inteiros de PostgreSQL 17 e nome exato do banco descartável; interrompe imediatamente diante de metadados incompatíveis; não confia em uma marca `wrongServer` trazida por exceções externas; e retorna mensagens fixas para falhas do probe ou da espera. Os metadados são amostrados uma vez.

Os callbacks dos testes são sintéticos. Nenhum servidor incompatível, incidente de produção ou vazamento real foi constatado. A falsa prontidão do helper anterior não demonstra bypass das validações posteriores da suíte SQL.

## Verificações efetivamente executadas
Caminhos relativos a `evidence/r13/` no pacote.

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline R12 | **1.320/1.320** aprovados, sem skips/cancelamentos/TODO | `01-baseline.log` |
| Regressões antes da correção | 12 casos: **9 falharam**, 3 controles passaram | `02-readiness-red.log` |
| Correção inicial e controles herdados | **14/14** passaram | `03-readiness-green.log` |
| Suíte após primeira correção | **1.332/1.332** passaram | `04-full-tests.log` |
| Revisão de leitura única | Uma nova regressão falhou com leituras repetidas de version | `17-review-red.log` |
| Regressores finais e testes herdados | **15/15** passaram, dos quais 13 são novos | `18-review-green.log` |
| **Suíte completa final** | **1.333/1.333**; zero falhas, cancelados, skips ou TODO | `20-full-final.log` |
| Instalação offline | **Falhou**: cache insuficiente para dependências do lock (`ENOTCACHED`) | `05-install-offline.log` |
| Auditoria oficial | **Falhou**: `EAI_AGAIN registry.npmjs.org`; nenhuma auditoria aprovada | `06-audit.log` |
| TypeScript padrão | **Falhou** com dependências/tipos locais ausentes; não resumir como aprovado | `07-typecheck-standard.log` |
| TypeScript suplementar | Saída **0**, TypeScript 5.8.3 e tipos Node **25.1.0** globais | `19-typecheck-supplemental.log`, `.exit` e `19-supplemental-node-types.txt` |
| PostgreSQL | Runner recusou Docker ausente; **0** dos **209** cenários executados | `08-postgres.log` |
| HTTP de demonstração | **35** checks aprovados, memória | `09-interface.log` |
| Navegador | `ERR_BLOCKED_BY_ADMINISTRATOR`; **0** checks aprovados | `09-interface.log` |
| Migrations/lock | **11** migrations e lock preservados/conferidos | `10-migrations.log`, `11-lock.log` |
| Contrato HTTP | **18** operações na verificação estrutural; não conformidade integral | `12-contracts.log` |
| Scan de segredos | Heurístico sem achados; não auditoria integral/pentest | `13-secret-scan.log` |
| Build | Somente frontend estático aprovado; Function não empacotada aqui | `14-build.log` |
| Gate | **Não aprovado** | `15-gate.log` |
| Diff | Sem erros de whitespace | `16-diff.log` |
| Integração e pacote | Duas variantes aplicadas em cópias limpas, arquivos finais/fingerprint idênticos; **1.333** testes repetidos na cópia cumulativa. Hashes e revalidação final no manifesto e `package-verification.json` | `22-*`, `23-*`, `24-*` |

A suíte completa inclui os seis testes TLS de loopback herdados. Os treze testes novos são de validação do runner, não de PostgreSQL nem novas funcionalidades do Help Desk. As três suítes de aceitação R10/R11/R12 foram preservadas; não foram executadas em HTTPS autenticado nesta rodada.

## Compatibilidade e limites
API/interface **0.19.0**, schema **0.18.0**, **11** migrations e lock inalterados. Sem nova dependência, endpoint, permissão, comando, tabela ou campo específico de produto. Default de **40** tentativas / **500 ms** entre falhas preservado, sem aumento dos timeouts do driver. Essa política limita tentativas; não promete um deadline global para callbacks arbitrários que não terminam.

A checagem suplementar não substitui `npm ci`/`npm run typecheck` com `@types/node` 22.15.30 e dependências oficiais do lock. Não houve instalação de PostgreSQL nativo, uso de banco remoto como fallback ou alteração de política de rede/browser.

Fingerprint final: `0b90a9bc12d397e2d7607307a8287bec447f056bafe83419660df6e7dac32c66`. Commit final do pacote no manifesto externo, para evitar autorreferência.

## Revisão e risco residual
Revisão pelo próprio executor, **sem revisor independente/subagente/pentest**. Verificados: interrupção antes de consultas com opções inválidas, ausência de coerção de versão, sanitização de exceções, preservação das retentativas transitórias e invariantes dos testes anteriores. A revisão encontrou avaliação repetida de propriedades; adicionada regressão antes do ajuste.

RLS, TLS com pg, locks, aplicação/upgrade, Auth/M2M e execução hospedada continuam dependendo de evidência real do destino. Não inventar autorização para abrir o gate de produção. M2 permanece posterior ao M1.

**Nenhum push, PR, merge, deploy, migration remota, alteração de usuários, grants, dados, MFA, segredos, buckets ou configuração de produção foi executado.**
