# M1-R19 — Estado e evidências / 01-10-2026

## Entrega e base
Esta rodada é **revalidação e consolidação para integração**, não implementação de nova funcionalidade. O código R18 foi recuperado do pacote cujo SHA-256 é `d08512182b80f835d0326b516c09246e0c8fab9bc62e3b2b554e0498dfa5113b`; o fingerprint executável `66b19776e652a210ebc819e49dac7650bb27eae00c269b8c186ab55e90d84491` foi conferido antes e após a revisão documental.

Remoto observado: `78bbb00112331531168ae24600604cb7f3148770`, nas branches `codex/m1-reproducibilidade` e `codex/m1-r9-integracao`. A fonte recuperada não representa o histórico Git remoto. API/interface 0.19.0, schema 0.18.0, 11 migrations, dependências e testes preservados. **Zero novas funcionalidades e zero novos testes.**

## Evidências executadas nesta sessão
| Verificação | Resultado e limite |
|---|---|
| Baseline R18 / Node 22.16.0 | 1.417/1.417, sem falhas, skips, cancelamentos ou TODO; `01-baseline-r18.log` |
| npm ci --ignore-scripts --offline | Reprovado: ENOTCACHED; `02-install-offline.log` |
| npm audit | Reprovado: EAI_AGAIN; `03-audit.log`; timeout de requisição 8s, sem retries |
| TypeScript padrão | Reprovado: tipos locais ausentes; `04-typecheck.log`; não reclassificar erros derivados como defeitos confirmados |
| Migrations / lock | 11 migrations preservadas; lock coerente, não regenerado; `05-migrations.log`, `06-lock.log` |
| Contratos | 18 operações na verificação estrutural; não conformance externa; `07-contracts.log` |
| Scanner de segredos | Heurística aprovada, não pentest; `08-secrets.log` |
| Build | Frontend estático, não bundle de Functions; `09-build.log` |
| PostgreSQL | Runner recusou Docker indisponível; **215 escritos e 0 executados**; `10-postgres.log` |
| Interface | 35 HTTP em memória passaram; navegador bloqueado por ERR_BLOCKED_BY_ADMINISTRATOR; `11-interface.log` |
| Gate | Reprovado por evidência completa ausente; `12-gate.log` |
| Regressão após consolidação | Resultado e comando em `16-verify-final.log` e `17-application-final.log` |
| Integridade do pacote | Inspeções before/after, preservação de código e restauração da fonte em `18-package-verification.json` |

Os logs desta rodada estão no pacote em `evidence/m1-r19/`. `checks.json` registra comandos, horários e códigos de saída. Não há `latest.json` de homologação aprovado fabricado. A checagem suplementar global de tipos **não foi repetida**; a aprovação histórica de outra rodada não é resultado atual.

## Estado remoto observado em leitura
**GitHub:** R9 permanece no remoto. **Netlify:** site `helpdesk-consultegeo`, deploy `6abbdecfeefd99000864e661`, estado `ready`, commit igual ao remoto, Function `api` Node 22. Publicado em 29/09/2026 às 15:53:14.996Z. O retorno não comprova login, resposta HTTP atual ou operação. O gate fechado é um registro do handoff R9; não foi possível consultar novamente o valor da variável ou executar smoke HTTP nesta sessão.

**Supabase:** projeto `xaelbntjnvztznnpcvtm`, `ACTIVE_HEALTHY`, PostgreSQL 17 (`17.6.1.166`), região `ca-central-1`. Foram listados 25 tabelas com RLS habilitada e 11 registros de migrations. Os metadados retornaram zero linhas para contas, produtos, contratos, integrações e chamados. Isso não substitui contagem SQL auditada, mas não fornece evidência de fixtures prontas para os clientes R10–R16.

As oito tabelas usadas pelo observador do R17 existem e possuem `workspace_id` UUID nos metadados inspecionados. Também estão presentes os campos de recibos, eventos, outbox e `write_effects` usados no comparador. **Essa conferência de colunas não executa, explica ou aprova o SELECT.** Não foi verificado FORCE RLS, grants, constraints em execução ou o uso do login restrito. `query_logs` consulta logs ClickHouse, não PostgreSQL; não foi utilizado como substituto de `execute_sql`, ação ausente no conector desta sessão.

O resumo dos retornos está em `14-connected-observations.json`. Não é uma atestação assinada nem um dump de dados do banco.

## Correção documental
O README e o handoff de entrada ainda continham orientações locais históricas como ausência de lock, `deps:resolve`, base v0.19 e apenas 201 testes SQL. Seus preâmbulos os qualificavam como históricos, mas os passos executáveis continuavam sendo os antigos. Agora os pontos de entrada encaminham para **npm ci com lock existente, 1.417 Node, 215 PostgreSQL e 71 HTTP/browser**, preservando os arquivos anteriores no histórico.

O corpo arquitetural do documento mestre foi preservado literalmente. Os hashes e destinos dos trechos arquivados constam de `13-document-preservation.json`. Não foi necessário modificar código para obter novamente as aprovações Node.

## Matriz de maturidade
| Estado | R10–R18 acumulado / situação no R19 |
|---|---|
| Implementado | Código herdado do R18; R19 muda documentação e integração apenas |
| Testado localmente | 1.417 Node e 35 HTTP em memória |
| Testado em PostgreSQL real | Não nesta rodada; 215 cenários pendentes para este acumulado |
| Testado em navegador | Não nesta rodada |
| Deployado | Somente R9 remoto confirmado; acumulado R10–R18 não deployado |
| Homologado | Não |
| Operacional | Não |

Sem revisão independente, carga, restauração, autenticação real ou liberação de atendimento. As aprovações históricas de CI R9 não substituem as do acumulado.
