# M1-R24 — revisão, compatibilidade e estado verificado

Data: 05/10/2026 (America/Sao_Paulo). Base remota conferida: `072287f934b5f7620d14531181a7cb4f01fadc6b`, branch padrão `codex/m1-reproducibilidade`. M1 operacional aberto; M2 não iniciado.

## Pedido atual e documentos recebidos

O usuário pediu avaliação do repositório, revisão/correções do trabalho GPT e autorizou os atos necessários para commit, merge e publicação, dispensando revisão do Claude. Essa autorização direta prevalece sobre os textos históricos que vedam publicação sem autorização. Os documentos anexados fornecem contexto, evidências e recomendações; não são um novo pedido para provisionar infraestrutura cobrada, escolher fixtures remotas ou liberar atendimento real.

O ZIP R23 recebido confere com o manifesto SHA-256: `59ac1ad1429c0b066c0b7d54a4d65ce33b4ce52d2980e643ec0a0b6657f7479d`. Os checkouts locais estavam no R19. Foi buscado o histórico GitHub e criada a branch `codex/m1-r24-revisao-publicacao` sobre o HEAD remoto, sem reset, exclusão de arquivos ou reaplicação de patches. O PR #2 já estava fechado/mesclado em `129a434ccb6c5fe035eb67e6384f5801a9a7114f`.

## Revisão e correção de compatibilidade documental

O diff R19 → R23 foi conferido. R20 acrescentou seleção explícita do site nos clientes existentes; o destino exige HTTPS e permalink literal de deploy, sem aliases, domínios livres, porta ou normalização. A compatibilidade legada permanece quando o campo opcional não é fornecido. Read/Auth/write continuam exigindo suas confirmações; modo plano não usa rede ou segredos. O runtime, as migrations e o lock não foram modificados por R20–R23.

O problema confirmado nesta rodada foi a divergência dos documentos de entrada: README, documento mestre, estado e handoff ainda direcionavam para R19/R22 e pediam integração já concluída. Foram reconciliados com R23 e com as observações atuais; os textos anteriores foram arquivados em `docs/history/r23-*`. O corpo arquitetural mestre foi preservado literalmente. Nenhuma mudança funcional, SQL, redução de gate ou nova suíte sintética foi necessária nesta revisão.

Um subagente revisor independente conferiu o diff R20–R23 e depois a reconciliação documental, sem achados bloqueantes. Executou 19 testes focais (todos aprovados, zero skips), conferiu fingerprint/logs e os 13 hashes da proveniência R22. Confirmou os históricos e corpo mestre por comparação literal, e os links locais. É revisão automatizada local, não APPROVE humano, pentest ou aceite operacional.

Fingerprint executável: `659e9ad6d69d822888486a59b2c9c6bf5d39c7a3ec1391ee29fd048c0e9a6a82`. A correção documental não modifica seus inputs. As evidências históricas permanecem intactas; não foram renovados timestamps nem editado `latest.json` para simular execução nova.

## Verificação local e limitações

| Verificação em Windows / Node 24.20.0 | Resultado |
|---|---|
| `npm ci --ignore-scripts` | Aprovado: 20 pacotes instalados, 21 auditados |
| `npm audit --audit-level=high` | Aprovado: zero vulnerabilidades reportadas |
| Lock, migrations, typecheck, contratos, scan heurístico e build | Aprovados; 18 operações HTTP |
| `npm run verify` | Falhou no Node: 1.413/1.436 passaram; 23 falhas, zero skips/cancelamentos/TODO |
| Conferência do relatório e hashes existentes | Aprovada para o mesmo fingerprint e dentro da validade |
| `test:db:local` | Não aprovado: Docker indisponível; nenhum fallback remoto |
| `test:ui:local` | 35 HTTP em memória passaram; navegador não aprovado, Python/Chromium não preparados |
| Planos isolados read/Auth/write | Gerados sem rede, estado `planned`, sem aceite operacional |

A repetição com acesso normal do usuário apresentou as mesmas 23 falhas. Elas envolvem staging explicitamente Linux, nomes de arquivo proibidos no Windows, criação de links simbólicos recusada com EPERM, OpenSSL ausente no PATH e expectativas POSIX no executor PostgreSQL nativo. A falha de substituição do diretório de dados não comprova exclusão de arquivos externos: o fixture falhou ao criar o link, e o cleanup removeu somente a raiz própria. Não alterar políticas do computador nem remover asserções/skips para fabricar aprovação. Os logs de ambas as tentativas acompanham o pacote local da rodada.

O CI Linux pós-merge R23 `37031997081` comprovou 1.436 Node, 215 PostgreSQL 17 e 71 HTTP/browser. Os 71 são 35 HTTP em memória, 31 Chromium de interface e cinco de sessão com provedor sintético. CI e falhas locais são evidências diferentes; nenhum dos dois é aceitação hospedada. Nova execução CI R24 deve ser conferida antes do merge desta rodada.

## Inspeção atual dos destinos — somente leitura

O site efetivo é `helpdesk-consultegeo`, ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`. Deploy R23 `6abfd87c481f1a0008b7cf22`, production/ready, commit `072287f934b5f7620d14531181a7cb4f01fadc6b`, Function `api` em Node 22 presente. O outro site `help-desk-multi-tenant`, ID `ee32e955-42e5-4417-bf4f-39cbef2366cc`, é um recurso histórico separado e não o destino desta publicação.

GET sem credenciais ao frontend atual retornou HTTP 200. GET ao `/v1/public-config` no permalink R23 retornou HTTP 503 com `release_gate_closed`. Isso observa o gate efetivo daquela Function; não é login, leitura de segredo, sucesso de conexão com banco ou prova de que todos os endpoints estão homologados.

Supabase HelpDesk `xaelbntjnvztznnpcvtm`, PostgreSQL 17, região `ca-central-1`: ledger com onze migrations. Introspecção dos quatro schemas privados confirmou 25 tabelas, todas com ENABLE/FORCE RLS: core 12, auth nove, audit duas, integration duas. `helpdesk_app` tem LOGIN, sem superuser/BYPASSRLS; `helpdesk_maintenance` não tem LOGIN, superuser ou BYPASSRLS. Não foram consultados corpos de tickets, usuários, credenciais ou dados de negócio. Não foram aplicadas migrations, alterados grants, criados usuários ou modificadas configurações remotas nesta inspeção.

Essas observações substituem a antiga descrição de banco vazio, mas não validam semântica das policies, grants completos, TLS/pooler dentro da Function ou isolamento de homologação. A região do banco e a Function (`us-east-2` nos metadados R23) devem entrar na avaliação de residência/latência; nada foi migrado de região.

## Estados e próxima prioridade

Implementado: núcleo R20/R23 acumulado, API/interface 0.19.0 e schema 0.18.0. Local: instalação/toolchain parcial aprovada, suíte Windows com falhas documentadas. PostgreSQL real e navegador: aprovados no CI Linux descartável R23. Deployado: publicação técnica R23 comprovada. Homologado e operacional: não; gate fechado observado. M2 não iniciado.

Antes de fechar M1, identificar e autorizar o destino isolado efetivo (site, banco/Auth, canais e fixtures), adaptar os exemplos existentes e executar os clientes sem inventar IDs. Correlacionar efeitos/recibos/outbox e demonstrar TLS, papel/grants/RLS, login/refresh/logout, sessões M2M, privacidade, concorrência e recuperação. Capacidade, restore, residência/RPO/RTO e aceite operacional continuam pendentes. Não abrir o gate nem reconstruir funcionalidades como substituto dessas evidências.

## Referências

- [PR #2 já integrado](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/2)
- [CI Linux R23](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37031997081)
- [Deploy R23 verificado](https://app.netlify.com/projects/helpdesk-consultegeo/deploys/6abfd87c481f1a0008b7cf22)
- [Handoff R23](112-M1-R23-REVISAO-MERGE-HANDOFF.md)
