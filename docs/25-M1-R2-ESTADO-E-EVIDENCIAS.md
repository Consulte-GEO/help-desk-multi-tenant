# Estado e evidências — Help Desk M1-R2

**Data:** 28/09/2026. **Estado:** implementado/testado localmente; não publicado, não homologado nem operacional. M1 aberto.

## Base rastreável

Repositório `Consulte-GEO/help-desk-multi-tenant`; branch remota `codex/m1-reproducibilidade`; HEAD reinspecionado `b9481b9fabde2fd9c442e44099bc17608b59571a`. Código da base validado historicamente em `c7aa0aff9d33bd05f0248ac904ecbc834204f986` (CI 36477734874).

O ambiente não conseguiu clonar o remoto pela rede. A fonte executável foi recuperada do bundle original e dos deltas lidos pelo conector GitHub. O fingerprint canônico completo de código/config/testes coincide com o da base: `94e6b61079895d992209ec14ced701199d0622d24fa704b6495f8b62fc25800a`. Não se afirma equivalência de todo o histórico Git, dos documentos ou de todos os artefatos remotos.

Snapshot local de recuperação: `9f2e21c1c39c11eb9aceb32349954b84fb9ef830`. Branch local: `work/m1-runtime-preflight`. O commit final local está no manifesto externo do pacote. **Não é um commit remoto.** O pacote é incremental para não substituir documentação/evidências remotas mais recentes por cópias históricas.

Fingerprint final do código: `c8eeda547c16da4fca645e93ae08cfbf49ddf7a6e079f0fa9135cae7dfc47138`.

## Resultados desta rodada

| Verificação | Resultado | Evidência no pacote |
|---|---|---|
| Baseline de aplicação | 1.045/1.045 aprovados | 02-baseline-application.log |
| Configuração RED/GREEN | Falhas reproduzidas; corrigidas e regressões aprovadas | 05–07 |
| Probe RED/GREEN | Casos negativos e positivos controlados aprovados | 08–10,17–18 |
| CLI RED/GREEN | 9 casos aprovados | 11–13 |
| Gate RED/GREEN | Mínimos novos exigidos | 21–22 |
| Aplicação final | **1.099/1.099; zero falha/cancelado/skip/TODO; 54 novos** | 33-final-application.log |
| Migrations | 11 verificadas, nenhuma alterada/executada | 25-final-migrations.log |
| Lock | Estrutura coerente; arquivo original preservado | 26-lock.log |
| npm ci | Não concluído; tentativa offline ENOTCACHED | 14-npm-ci-offline.log |
| Auditoria de dependências | Não concluída; EAI_AGAIN registry.npmjs.org | 31-audit-attempt.log |
| Typecheck padrão | Falhou; dependências/tipos locais ausentes | 19-typecheck-standard.log |
| Typecheck suplementar | Exit 0 com compilador/tipos globais; não substitui npm ci | 34-typecheck-supplemental.log |
| OpenAPI/contratos | Verificação estrutural: 18 operações; não conformidade integral | 27-contracts.log |
| Build | Apenas frontend estático aprovado; sem novo bundle de Functions | 28-static-build.log |
| Scan de segredos | Sem padrão reconhecido; heurístico, não pentest | 29-secret-scan.log |
| Diff | Sem erros de whitespace | 30-diff-check.log |
| PostgreSQL desta rodada | 204 escritos; **zero executados**; Docker indisponível antes da conexão | 15-postgres-attempt.log |
| HTTP desta rodada | 35 checks em memória aprovados | 16-browser-attempt.log |
| Navegador desta rodada | 36 escritos; **zero aprovados**; ERR_BLOCKED_BY_ADMINISTRATOR | 16-browser-attempt.log |
| CLI executada | Modo offline com configuração sintética; exit 0 | 35-offline-synthetic-report.json e scope |
| Gate agregado | Reprovado; evidência da base não aprova código novo | 32-gate-check.log |

A primeira tentativa online de instalação foi interrompida pelo limite do executor, sem log conclusivo. Não a apresentamos como instalação nem auditoria executada. A checagem TypeScript suplementar inicial encontrou erro no construtor TLSSocket de teste; ele foi corrigido e a checagem repetida com exit 0. A revisão final melhorou o cleanup do fixture SQL, inclusive se adquirir/liberar conexão falhar.

Os 54 testes locais novos são 18 de configuração/handler, 27 de probe e 9 de CLI. Metadados do driver/socket em testes são controlados: **não são handshake TLS, PostgreSQL ou Auth reais**. Os três novos testes SQL são escritos para o runner descartável: probe sem mutação/rollback, recusa de login administrativo e detecção de grant inseguro. Total SQL: 188 principais +16 upgrade.

## Evidência histórica preservada

O handoff remoto registra 1.045 aplicação, 201 PostgreSQL real descartável e 71 HTTP/browser aprovados anteriormente no CI. Também registra schema/configuração no Supabase e conexão restrita validada fora da Function. Esses resultados não foram apagados e não são tratados como inexistentes. Tampouco são transferidos para este incremento.

A consulta Netlify desta rodada encontrou o site `helpdesk-consultegeo` com deploy corrente `6abade9c0e22640008db5072` em ready. Não foi uma publicação desta entrega. O handoff b948 registra gate de runtime fechado, sem teste de conexão dentro da Function e sem login real ponta a ponta. Não foi executado novo smoke HTTP hospedado nesta rodada.

## Revisão e riscos restantes

Revisão local pelo mesmo executor, sem revisor independente. Não houve pentest, carga, restore, aprovação de residência ou RPO/RTO. A inspeção do socket depende do pg fixado e precisa de teste com TLS real. A gramática de configuração foi endurecida e exige regressão da configuração do destino sem expor valores. Um probe aprovado não comprova Auth, memberships efetivos no navegador, M2M real ou atendimento.

Nenhum push, PR, merge, deploy, migration remota, alteração de dados, usuários, senhas, MFA, secrets, bucket ou infraestrutura cobrada foi realizado. As operações remotas desta rodada foram de leitura.
