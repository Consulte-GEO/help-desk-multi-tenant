# Consolidação e revisão R1 — 11/10/2026

Este checkpoint prevalece sobre os estados históricos de CG03 e dos 18 ciclos. A consolidação técnica passou pela homologação integral; merge e publicação estão na etapa final. O atendimento operacional permanece fechado. API/interface 0.27.0 e schema 0.19.0. Os módulos novos são candidatos cuja existência e testes não equivalem a integração operacional.

## Pedido, autorização e fontes

O usuário solicitou análise minuciosa, correção, compatibilização e melhorias, autorizando commit, merge e publicação sem Claude. Os quatro arquivos de Downloads foram tratados como contexto e evidência do trabalho anterior. Suas restrições históricas de publicação não revogam essa autorização; contratos de negócio, fornecedores e aceites ausentes não foram presumidos.

Repositório: `Consulte-GEO/help-desk-multi-tenant`. Base de produção e do PR26: `796face60367e2573d112b7ae42d570055474348`; head recebido do PR26: `f60baed8022b28e067a702b3dd51031e86983017`. O trabalho local anterior `b4c99b7`, na branch `codex/consultegeo-rollout-plan-20261008`, foi preservado. Consolidação na branch `codex/consolidacao-r1-20261011`; não reaplicados cumulativos dos PRs23–25 já presentes no PR26.

O ZIP R1 original tem SHA-256 `d6292f50fdb02b65920ea0a5f9229b330547b76df019e57d54ac368fb5c1242e`. Foram conferidos 337 hashes internos e 298 arquivos do manifesto de fonte. O patch `01_PR26_f60baed_para_Cumulativo_R1.patch` passou por `git apply --check` na base exata e foi aplicado uma vez. Não houve aplicação forçada. O manifesto histórico de 60 arquivos e o manifesto R1 original permanecem históricos; correções posteriores têm seus próprios commits e fingerprint integral.

## Situação encontrada

- Produção publicava `796face`, com autenticação/interface existentes e gate global de atendimento fechado.
- PRs23–26 estavam abertos e draft. PR26 agregava os anteriores; a evidência canônica salva correspondia à fonte de 1.679 testes, anterior ao cumulativo.
- O recorte R1 continha 18 ciclos com interfaces, componentes, SQL candidato e testes, mas não todos os adapters duráveis nem montagem no runtime.
- O Windows local tinha Node24 compatível com o package, mas não qualificado para os testes que exigem Node22, nem PostgreSQL17/Docker/WSL. Algumas suítes dependem de Unix, symlinks privilegiados e OpenSSL no PATH. Isso foi separado de defeitos do produto.
- Leitura do Supabase HelpDesk `xaelbntjnvztznnpcvtm`: 12 migrations; 25 tabelas privadas com ENABLE/FORCE RLS; `helpdesk_app` restrito; nenhum publicador de recursos instalado. Nenhuma migration ou alteração de Auth foi aplicada nessa base.
- Advisors: 14 avisos informativos de RLS sem policy em tabelas deliberadamente privadas, mantendo negação por padrão. Aviso existente de proteção contra senhas vazadas desativada permanece pendente de decisão de Auth; não foi mascarado ampliando acesso ou mudando MFA. [Orientação de correção](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Problemas corrigidos

| Achado | Consequência anterior | Correção e verificação |
|---|---|---|
| Prazo da autoridade de recursos baseado apenas no timer | Fonte tardia podia ser aceita quando o event loop atrasava o timer | Relógio monotônico antes/depois da espera; abort e recusa da fonte vencida; teste reproduziu a falha |
| Prazo da fonte do publicador com a mesma lacuna | Persistência podia começar depois do timeout | Checagem monotônica e abort antes do store; regressão exige zero transações |
| Leitura do callback de entrega com a mesma lacuna | Corpo atrasado era aceito e chegava ao verificador | Deadline monotônico ao ler cada parte; HTTP408 e zero chamadas ao consumidor; bytes assinados preservados |
| Gate do papel publicador incompleto | REPLICATION ou propriedade de schemas/funções privadas não eram examinados | Adapter e helper SQL verificam replication, schemas e funções, além dos controles existentes; criação explícita NOREPLICATION; negativos do driver e PostgreSQL real |
| CASE sem parênteses no IF do candidato G | Instalação SQL falhava com 42601, impedindo executar os cenários G | Expressão CASE parenthesizada; preservadas as regras de timestamps e microsegundos |
| Variável e alias `j` no publicador PL/pgSQL | Execução real falhava com 42702, antes de publicar o snapshot | Variável do loop renomeada `v_ref`, sem alterar consultas ou validação dos recursos |
| Teste M1c esperava confirmação desconhecida após erro SQL capturado | Divergia do runner fortalecido, que agora recusa antes de enviar COMMIT | Expectativa `transaction_statement_failed`, mantendo asserção de ausência da gravação no PostgreSQL |
| Wrapper descartava retorno de `additionalAdmission` | Guard assíncrono ou não-void podia contornar a recusa do runner | Retorno transmitido ao runner; três negativos comprovam zero conexão, trabalho ou SQL |

Commits de implementação: `553e9e1` (cumulativo), `f5f5cf4` (deadlines, SQL e papel), `cd9f94a` (admissão adicional), `801c4fe` (ambiguidade SQL e isolamento da fixture). O teste negativo de propriedade de schema usa namespace privado separado, sem alterar/restaurar a ACL de `helpdesk_auth`. Os dez planos dos ciclos foram incorporados ao histórico documental. Não foram criados defaults de produção ou removidos testes para produzir aprovação.

## Verificações e limites

Instalação pelo lock existente; lock, hashes das migrations, tipos, contratos, secrets, build e auditoria executados. Auditoria do produto: zero vulnerabilidades. O primeiro CI oficial Linux, [38145504482/1](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38145504482), na fonte `553e9e1`, registrou aplicação 3566/3566, PostgreSQL 273/275 e interface 139/139. As duas falhas PostgreSQL são descritas acima; o grupo G falhou no setup, portanto seus cenários não foram contabilizados como aprovados.

No Windows, a execução integral inicial teve 3566 testes, 3531 aprovados e 35 falhas ligadas aos pré-requisitos de plataforma. A tentativa `test:db:native` recusou configuração indisponível antes de criar banco. Os resultados finais aprovados são da fonte exata no CI Linux22/PostgreSQL17/Chromium, sem skips ou cancelamentos, pelo workflow original.

O CI [38146397721/1](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38146397721), fonte `cd9f94a`, passou 3574/3574 aplicação e 139/139 interface; PostgreSQL 282/294. O grupo G executou os 19 cenários, revelando a ambiguidade PL/pgSQL e a interferência de ACL do teste de schema. Foram corrigidas as causas demonstradas; a negativa de REPLICATION já passou no banco real. Essa execução vermelha não foi importada como evidência canônica aprovada.

Revisão independente somente leitura: 545 testes em 20 suítes disjuntas; revalidação das correções em 308 testes e da admissão em 75 testes. Encontrou os achados P2 de prazos, papel e retorno de admissão, agora corrigidos. Não identificou Critical/P1 dentro da cobertura. Não substitui a homologação SQL/browser nem o aceite hospedado.

O log completo do preview antigo `6ac8df53ee38ca000856c73b` foi recuperado via API de logs: 110 mensagens. Ele passou `check:lock` e falhou em `check:homologation`, antes de `verify`, com a mensagem de evidência ausente/incompleta/alterada/vencida. Assim a falha concreta foi o gate canônico de evidência. O código2 isolado não foi usado como diagnóstico. O gate e `npm run verify:release` foram preservados.

## Matriz atual dos 18 ciclos

| Ciclo | Entrega consolidada | Limite e próximo requisito operacional |
|---|---|---|
| 01 Consolidação | Checkout integral, hashes, composição, revisão e CI oficial | Aceite operacional permanece separado da publicação técnica |
| 02 Identidades | issuer/subject, diretório e correspondência sem associação por email | Diretório durável, contrato Novo GEO e migração legítima das identidades existentes |
| 03 Recursos | Resolver, lease, admissão, stores/publicador e SQL D/E/G candidatos | Promover migration aditiva com upgrade/readiness próprios; fonte/diretório qualificados e montagem real; nenhum SQL candidato hospedado |
| 04 Membros | Capacidades administrativas, MFA, convites e recibos; browser candidato | MemberAdminStore durável, concessões aprovadas, audiência e endpoints integrados |
| 05 Configuração | Contas, catálogo, contratos, CAS e versões imutáveis | Store e migrations, configuração aprovada e interface integrada |
| 06 SSO | RS256/PKCE, sessões opacas, rotação/revogação e AEAD | IdP qualificado, stores de fluxo/sessão, custódia de chaves e Auth real |
| 07 Formulários | DSL limitada, CNPJ, regras compartilhadas e componentes | Taxonomia/evidências da origem, catálogo persistido e integração de acessibilidade |
| 08 Workflow/SLA | Transições, pausas, calendários e relógios exatos | Persistência/eventos atômicos, políticas aprovadas, scheduler e rotas |
| 09 Anexos | Reserva, streaming, TUS e protocolo ClamD | Storage/antivírus reais, fila, quotas, recibos, cleanup e custos |
| 10 Abertura | Draft, prévia sem efeitos, revalidação e replay | Bundle durável, participantes/beneficiário, endpoint protegido e jornada E2E |
| 11 Aprovação | Revisão vinculada a pessoa/recursos e histórico | Roster/capacidades reais, auditoria transacional e integração da UX |
| 12 Notificações | Outbox, leases, conciliação e callback assinado | Ledger/worker duráveis, destinatários/canais reais, DNS/SMTP e operação |
| 13 Portal | SQL candidato, cursor cifrado e exportação CSV | Executar/compor consultas reais, persistir metadados, Storage/export e browser; XLSX não entregue |
| 14 Opcionais | Pacotes, conhecimento, macros, CSAT e eventos externos | Adapters/fornecedores, emissão CSAT, linkagem GTC e aceite por trilha |
| 15 Recuperação | Manifestos/atestados e plano de backup/ledger | Restore completo, volume/segurança hospedados, control plane, responsáveis e SLO |
| 16 Piloto | Máquina de estados, coorte e geração de recuperação | Locks/store, atestados reais, coorte aprovada, treinamento e aceite humano |
| 17 Expansão | Preflight vinculado a proposta/taxonomia/manifesto | V1 aceita e estável; reader/publicador real e novo aceite de escopo |
| 18 Legado | Mapeamento, streaming e inspeção dry-run | Contrato/login/consumidor, decisão específica de importação e staging/applicador/SQL |

As linhas 02–18 descrevem componentes consolidados, não ciclos operacionalmente encerrados. O runtime publicado continua montando o serviço/handler existente. Assets opcionais copiados no build não anunciam capabilities; seis assets administrativos/login ainda exigem integração conjunta de autorização e endpoints. O gate global evita que os caminhos genéricos antigos contornem o fluxo novo ainda não montado. As 12 migrations originais e seus hashes não foram reescritos.

## Evidência final, merge e publicação

Homologação GREEN: [38146833123/1](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38146833123), fonte `801c4feca53939b8b7c35885d80cb812ebc26aaa`, árvore `1166231bd2b07a08f86b88146eb5ed51c8443783`.

- Aplicação: **3574/3574**; PostgreSQL: **294/294**; interface/Chromium: **139/139**. Zero falhas, cancelamentos, skips ou todo. Lock, instalação, audit, tipos, contratos, secrets e build aprovados pelo workflow original.
- D executado; E **15/15** e G **19/19**, incluindo os 16 G originais e três novos negativos. As famílias foram registradas e executadas de fato. Upgrade da base existente aprovado; isso não equivale a upgrade de uma futura migration D/E/G.
- Artefato `11705053288`, `helpdesk-homologation-801c4feca53939b8b7c35885d80cb812ebc26aaa-38146833123-1`, ZIP de 549326 bytes. SHA-256 oficial e calculado: `690fed811754fd98ff9fe7f0de3a717c874266f4ade892f9b2d5ad3baca961ef`.
- Fingerprint integral executável: `555ee128db53787afebf320928fc12e883e15bfa79e16c16c9408c635b096b00`.
- `evidence/homologation/latest.json` e seus seis logs da mesma execução `e686e75a-db24-46e5-b910-1a29fe42ecb3` importados sem edição; hashes e contagens conferidos. `evidence/ci/source.json` original e recibo `evidence/consolidacao-r1/ci-receipt.json` preservam a origem. `npm run check:homologation` passou no checkout atual.

Revisão final independente das correções: sem pendências acionáveis dentro da cobertura. SQL e fixture revistos após o segundo RED. Merge do PR26 e verificação do deploy serão registrados no encerramento. O relatório mantém `platform_approved:false`; sucesso técnico não declara treinamento, restore, SLO ou aceite humano.

Destino autorizado: site Netlify `helpdesk-consultegeo`, ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`, e projeto Supabase HelpDesk já existente. Publicação por Git/CD com `verify:release`; sem bypass por upload de dist, ambiente paralelo ou ampliação de permissões.
