# Help Desk M1-R3 — estado e evidências

**28/09/2026. Implementado e testado localmente; não publicado, não homologado nem operacional. M1 aberto.**

## Base e rastreabilidade
Branch remota `codex/m1-reproducibilidade`; HEAD consultado `b9481b9fabde2fd9c442e44099bc17608b59571a`. Fonte de código/config/testes recuperada do bundle original e deltas previamente obtidos pelo conector; não foi usado o ZIP antigo como se fosse HEAD. Fingerprint da base remota equivalente: `94e6b61079895d992209ec14ced701199d0622d24fa704b6495f8b62fc25800a`. Fingerprint R2 recuperado: `c8eeda547c16da4fca645e93ae08cfbf49ddf7a6e079f0fa9135cae7dfc47138`. Ambos conferidos por execução. Lock restaurado byte a byte e comparado ao Git blob `8d971935c5eb0af71ebf6bc8d2c74801c1187dad`; não é lock gerado ou alterado nesta rodada.

Fingerprint final de código/config/testes: `7ea5f2ff652f5a26e729e13400b7898a6a417350499cf268aab6d2afbe82196b`. Branch local `work/m1-r3-diagnostic-lifecycle`. Commit local final registrado no manifesto externo; a história local **não equivale** à história remota. README/AGENTS/docs04/05 atuais do GitHub não são substituídos por cópias históricas neste pacote.

## Resultados executados nesta rodada
Os logs `01`–`24` e registros complementares estão em `evidence/r3/` no ZIP.

| Verificação | Resultado / alcance | Evidência |
|---|---|---|
| Baseline M1-R2 | 1.099/1.099 aprovados | 01-baseline-application.log |
| RED de eventos | 6 falhas/2 aprovações, causas conferidas | 04-events-red.log |
| RED de TLS | 2 falhas/4 aprovações; handshake real | 05-tls-red.log |
| GREEN focal | 41/41 aprovados, incluindo regressões R2 | 06-focused-green.log |
| RED/GREEN do gate | Falha esperada; depois 9/9 | 08/09 |
| Transporte TLS real | 6/6 aprovados; subset dos testes Node, não SQL | 10-tls-real.log |
| Suíte final | **1.114/1.114**, zero falha/cancelado/skip/TODO; 15 novos sobre R2 | 18-verify.log e 23-final-application.log |
| Integridade migrations | 11 conferidas; nenhuma nova, alterada ou executada | 02-migrations.log |
| Lock | Verificador aprovou coerência | 11-lock.log |
| Instalação padrão | Tentativa online interrompida pelo limite do executor, sem saída conclusiva; offline falhou ENOTCACHED | 03-install.log / 12-install-offline.log |
| npm audit | Não concluído: EAI_AGAIN no registry | 13-audit.log |
| TypeScript padrão | Falhou, dependências/tipos locais ausentes | 15-typecheck-standard.log |
| TypeScript suplementar | Saída0, compilador/tipos globais; não substitui instalação | 16-typecheck-supplemental.log |
| PostgreSQL desta rodada | **204 escritos; 0 executados**, Docker indisponível | 14-postgres.log |
| HTTP local | **35/35 em memória**, não banco real | 17-browser.log |
| Browser desta rodada | 36 escritos; **0 aprovados**; ERR_BLOCKED_BY_ADMINISTRATOR | 17-browser.log |
| Verify | Aplicação1114 passou; comando terminou2 no typecheck padrão | 18-verify.log |
| Contratos | Estrutura18 operações aprovada, não conformidade integral | 19-contracts.log |
| Build | Frontend estático aprovado; sem novo bundle Functions | 20-build.log |
| Scan heurístico | Sem padrão reconhecido; não auditoria integral | 21-secrets.log |
| Gate agregado | **Reprovado**, evidência anterior não aprova fonte nova | 22-homologation.log |
| Patches/overlay | Dois caminhos verificados em reconstruções limpas; detalhes e hashes no manifesto | package-validation.json |

Ambiente: Node22.16.0, npm10.9.2, TypeScript global5.8.3, OpenSSL3.5.5. Nenhuma política de rede/navegador foi alterada. A obtenção do pacote pg por download também não se concluiu; nenhum driver alternativo foi instalado. A instalação online interrompida não é aprovação nem prova de auditoria.

## Estados que não podem ser fundidos
IMPLEMENTADO: sim para o incremento. TESTADO_LOCALMENTE:1114. TLS_TRANSPORTE_LOCAL_REAL:6, incluídos nos1114. SQL_ESCRITO:204. SQL_EXECUTADO_NESTA_RODADA:0. HTTP_MEMÓRIA:35. BROWSER_EXECUTADO_COM_APROVAÇÃO:0. DEPLOYADO_NESTA_RODADA:não. HOMOLOGADO:não. OPERACIONAL:não.

A base remota preserva evidência histórica de1045/201/71 em CI e configuração do Supabase/Netlify. Não se reclassificou a base como jamais testada, nem se reaproveitou sua aprovação para este código. A consulta desta rodada ao GitHub foi somente leitura; não houve novo smoke hospedado, leitura de secrets ou teste de login real.

## Riscos e efeitos externos
Revisão local pelo próprio executor. Persistem prova de pg/TLS/cleanup, execução SQL204, navegador, dependências/audit, validação dentro da Function e Auth/M2M, capacidade, restore, residência/RPO/RTO e aprovação operacional. Não houve push, PR, merge, deploy, migration remota, alteração de dados/usuários/senhas/MFA/secrets/buckets ou infraestrutura cobrada.
