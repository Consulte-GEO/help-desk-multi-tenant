# Help Desk v0.6.0 — Estado e evidências | M1e

**Entrega local, sem publicação. M1 não encerrado.** Base v0.5.0 `cc13eb6a57aba4c6436324c24b3a3b88d55fbadd`; branch `work/helpdesk-m1-v0.6.0`. Verificações em 16/09/2026; logs em UTC. O commit final consta no manifesto externo e no bundle, evitando identificador circular no próprio commit.

## 1. Resultados executados

| Verificação | Resultado / alcance | Evidência |
|---|---|---|
| Base recuperada | 407 testes passaram antes das alterações | `evidence/m1e/00-baseline-tests.txt` |
| Suíte local final | **451 aprovados; 0 falhas, cancelados, ignorados ou TODO. 44 novos.** | `evidence/m1e/final-tests.txt` |
| Novos testes HTTP/CLI | **Cinco aprovados, JÁ INCLUÍDOS nos 451**. HTTP real de loopback, identidades fictícias e CLI local | `evidence/m1e/final-new-http-cli.txt` |
| Smoke HTTP anterior | **13 verificações aprovadas**, com dados fictícios em memória | `evidence/m1e/final-ui-http-browser.txt` |
| Exemplo de diagnóstico | Quatro respostas locais (200/403/429/503) produziram quatro registros; resumo aceitou os quatro | `loopback-observations-checks.json`, `loopback-observations.jsonl`, `loopback-observations-summary.json`, dentro de `evidence/m1e/` |
| TypeScript do ambiente | Saída 0 com compilador/tipos globais, NÃO instalação limpa | `evidence/m1e/final-typecheck-environment.txt` |
| OpenAPI estrutural | 16 operações / 13 caminhos | `evidence/m1e/final-contracts.txt` |
| Build estático | Saída 0, NÃO bundle Netlify Functions | `evidence/m1e/final-build.txt` |
| Sintaxe JS/MJS/Python | Verificação sintática dos arquivos atuais | `evidence/m1e/final-syntax.json` |
| Scanner heurístico | Sem padrão reconhecido de segredo; NÃO auditoria completa | `evidence/m1e/final-secrets.txt` |
| Integridade SQL | Seis migrations byte a byte iguais à v0.5.0 | `evidence/m1e/final-migration-integrity.json` |
| `npm run verify` padrão | **Falhou, saída 2** por tipos/dependências locais ausentes | `evidence/m1e/final-verify-manifest.txt` |
| Homologação/publicação | **Recusadas**; lock falhou e etapas dependentes ficaram bloqueadas | `evidence/homologation/latest.json`, `evidence/m1e/final-homologation*.txt`, `final-release-gate.txt` |

As quatro chamadas do exemplo não constituem volume real do serviço e não são teste de carga. Os cinco novos testes HTTP/CLI não devem ser somados outra vez aos 451. Tampouco devem ser somados os 60 casos SQL escritos como se tivessem passado.

Comandos, horários e códigos de saída: `evidence/m1e/final-verification.json`. Ambiente: Node 22.16.0, npm 10.9.2, TypeScript global 5.8.3, tipos Node globais 25.1.0. O manifesto fixa tipos 22.15.30 ainda não instalados. A aprovação com tipos globais não substitui npm ci/verify/audit.

## 2. Código entregue

Diagnóstico HTTP fechado, código de erro permitido, rota normalizada, correlação UUID, duração monotônica e fases `http`/`bootstrap`/`dispatch`; fábrica hospedada compartilhada com recuperação após erro; sink best-effort que não muda resposta/transação; CLI offline com leitura limitada e contagens/histograma sem IDs; executor local PostgreSQL 17 nativo explicitamente selecionado, ambiente isolado, senhas temporárias/SCRAM, ownership e limpeza confirmada; cancelamento de subprocessos próprios.

A API/interface é 0.6.0, mas o schema continua **0.5.0**. Sem tabela, endpoint público, migration, policy ou grant novo. O caminho Docker foi preservado em `scripts/test-db-docker.mjs`; a entrada escolhe o engine explicitamente e não faz fallback.

## 3. Regressões e revisão

| Grupo | Evidência de falha antes / durante o desenvolvimento | Resultado após correção |
|---|---|---|
| Diagnóstico HTTP e host | 15 regressões falharam na fase inicial | Grupo ampliado a 17, todos aprovados |
| Resumo offline | Oito regressões iniciais; depois um caso de coerção de objeto malformado reproduzido | Nove aprovados |
| Runner nativo e processos | Dez testes inicialmente falharam; erro novo de sombreamento de variável no cancelamento foi identificado e corrigido | Grupo ampliado a 13, aprovados com doubles PostgreSQL |
| Revisão de códigos/tempos | Limitador real era classificado como desconhecido; duração fora da janela produzia evento rejeitável | Duas regressões passaram após correção |
| HTTP real + CLI | Cinco integrações de loopback/CLI com a implementação | Cinco aprovadas |

Logs red/green e erros intermediários foram preservados em `evidence/m1e/01`–`20`. Não ocultam que houve falhas durante o desenvolvimento. A checagem de tipos também encontrou nulabilidade no cálculo do histograma, corrigida antes da execução final. A revisão foi local; não houve revisor independente, pentest ou teste de capacidade.

O ciclo nativo foi validado com comandos simulados, além de diretórios e subprocessos Node reais. Casos cobertos: configuração inválida/root/Windows, ambientes contaminados, versão incompatível, ausência de driver, falha de criação/parada, marcador alterado, substituição de diretório por symlink, cancelamento e engine desconhecido. **Não comprova initdb, pg_ctl, SQL, RLS, grants, locks ou limpeza de um servidor PostgreSQL real.**

## 4. Bloqueios atuais

**Dependências:** tentativa real `npm run deps:resolve` retornou `EAI_AGAIN registry.npmjs.org`. Sem lockfile, instalação limpa ou audit. Não houve proxy alternativo nem alteração de política de rede. Não foi usada uma versão sintética de lock como evidência.

**PostgreSQL Docker:** comando indisponível/falhou antes da conexão. **Nativo:** recusou na etapa `configuration`, processo com UID 0, sem cluster criado (`cleanup: not_created`). Não há binários/driver disponíveis para homologação; não foram instalados pelo runner. Permanecem **60 casos SQL escritos, zero executados**, e seis migrations não homologadas em servidor real. O Supabase remoto não foi usado como alternativa.

**Navegador:** 13 checks HTTP passaram antes de `Page.goto` falhar com `ERR_BLOCKED_BY_ADMINISTRATOR` no Playwright. **14 checks browser escritos, zero aprovados nesta execução.** Não há validação visual/mobile/acessibilidade/DOM. Nenhuma política foi contornada.

**Runtime/observabilidade real:** Supabase Auth, pooler/TLS, bundle/execução Netlify Functions e diagnósticos dentro do provedor não homologados. Sem exportador/retentor externo, alertas, OpenTelemetry completo, garantia de captura, análise de custo de logs ou tráfego real. Os eventos do exemplo são locais e sintéticos.

**Operação:** carga, limites calibrados, residência/retenção/RPO/RTO aprovados, restauração e revisão independente continuam pendentes. Não há novo avanço administrativo M2.

## 5. Matriz M1

| Item | Avanço nesta entrega | Ainda aberto |
|---|---|---|
| HD-101 dependências/CI | Versão/contrato e contagem mínima coerentes | Lock real, npm ci/audit e CI real |
| HD-102 persistência | Alternativa nativa explícita para ambientes sem Docker | Executar os 60 casos e seis migrations em PostgreSQL 17 real; fresh install/upgrade e correção de achados |
| HD-103 runtime | Falhas de inicialização/despacho correlacionadas e fábrica compartilhada | Auth, pooler, Functions e coleta de logs no destino |
| HD-104 diagnóstico/limites | Logs controlados e resumo offline | Capacidade, custo/volume, retenção, alertas e monitoramento operacional |
| HD-105 interface | Funcionalidades anteriores preservadas; transporte HTTP revisto | Browser/DOM/acessibilidade e ligação ao backend homologado |

## 6. Efeito nos ambientes

Nenhum push, PR, merge, deploy, migration remota, alteração de dados, segredo, usuário ou MFA. Não houve reinspeção remota nesta rodada; observações antigas sobre GitHub/Supabase/Netlify continuam históricas. O pacote contém código e evidências locais para revisão, não autorização de produção.

O teste de recuperação do bundle, executado após o commit, é incluído no ZIP em `evidence/recovered-bundle-tests.txt`; seu resultado e o hash do commit são registrados no manifesto do pacote.
