# Contexto atual do Help Desk e do ecossistema

Fotografia de 15/10/2026. Evidências anteriores estão identificadas como registros; verificações novas de código e GitHub estão separadas. A intenção do produto é atender a Consulte GEO, especialmente solicitações de cadastro/acesso, dúvidas, problemas, implantação/alteração de estruturas e encerramento/backup de obras.

## 1. Fontes canônicas e diferenças entre cópias

| Produto | Fonte GitHub e branch | Fonte observada | Leitura correta |
|---|---|---|---|
| Help Desk | [help-desk-multi-tenant](https://github.com/Consulte-GEO/help-desk-multi-tenant), `codex/m1-reproducibilidade` | Local `306dd5c`; remoto `d036fccededcba31a0cd1a9be30963c1d34ddc69` | PR49 está integrado e precisa estar na base do próximo desenvolvimento |
| Wiki | [wiki_consultegeo](https://github.com/Consulte-GEO/wiki_consultegeo), `main` | Remoto `2f71a0240e81e04e5576d83ef531fa9ce499b79e`; local `8b63f098fdd1670dd2d5782b84779f156f455208` | Há trabalho posterior de mídia/UX local; integração/publicação desse delta não confirmada na coleta |
| Implantação | [setup-implantacao-obras](https://github.com/Consulte-GEO/setup-implantacao-obras), `main` | Local/remoto `3fe0dbecee448a3caa762e21e4927b04fb43b1e5` | Inclui backend/storage IMP-02 pós-PR14, com operação desabilitada |
| Financeiro | [financeiro-multi-tenant](https://github.com/Consulte-GEO/financeiro-multi-tenant), remoto `main` | Local `7c234f1` em branch de plano de 06/10; remoto `fe81b443277a82b1025f78d5d5d13c4b16799e13` | Local é contexto histórico; não usar sua matriz como inventário integral da produção financeira de hoje |

Os diretórios `helpdesk-r19-integration`, `helpdesk-e06-review`, `r19-package`, bundles e ZIPs cumulativos são referências históricas. A pasta pai tem outro `.git`. Nunca fazer integração pelo Git da pasta pai nem sobrepor um ZIP cumulativo ao checkout corrente.

## 2. O que já existe e o que isso significa

| Frente | Estado encontrado | Limite restante |
|---|---|---|
| Portal direto e login | Operação humana comprovada no piloto | Recuperação completa de senha, contingências e alguns casos de sessão ainda exigem aceite/fechamento específico |
| Chamados | Listagem, abertura, protocolo, snapshots, recibos, conversa, notas, prioridade, atribuição e workflow | Melhoria da operação diária, totais completos, relatórios e recursos opcionais |
| Cadastros e acessos | Publicados e confirmados pelo usuário: usuário, traço, usina, laboratório, bloco, cerâmica, cabos e fornecedor | Formulários mínimos; execução pela equipe no GEO. Não é automação cadastral concluída |
| Cinco ações de acesso | Incluir, alterar, desativar, reenviar acesso e liberar em obra | As quatro últimas são ações de usuário; não equivalem a CRUD de todos os oito tipos |
| Catálogo/configuração | Versões e publicação conjunta de formulário/workflow/checklist/SLA | Administração geral ainda parcial; políticas não aparecem automaticamente como relógios operacionais |
| Primeira onda de e-mails | Três entregas reais no CG-10001, resolvido na versão 5 | Manutenção e observação operacional; não repetir esse aceite alterando o chamado histórico |
| Segunda onda | Nove novos avisos públicos/equipe em piloto; oito e-mails reais CG-10002 registrados | Faltam solução, encerramento, reabertura e cancelamento; observar dois dias úteis antes de ampliar |
| Aprovação/revisão de formulário | Código e quatro modelos 21–24 preparados | Audiência `none`, política/capacidades não ativadas; MFA adiado |
| Wiki | Leitor integrado em `/wiki/`; colaboração v1.3 registrada como publicada | Aceite autenticado da equipe, revisão factual e qualificação de conteúdos/públicos; mídia/UX posterior em trabalho concorrente |
| HDA/E06 | GETs de consulta autorizada e infraestrutura candidata | `registration_review=false`; SQL HDA não promovido ao core; histórico/edição/worker/executor ainda incompletos |
| IMP-02 | Backend PostgreSQL, vínculos, sessão, revisões, recibos, upload privado e inspeção preparados; migrations/storage publicados segundo relatório | `IMPORT_PROCESS_ENABLED=false`; faltam conexão restrita própria, vínculos reais, scanner e aceite |
| IMP-03 | Planejado | Associação idempotente processo↔chamado; processo atual segue `awaiting_ticket` |
| SLA | Política, calendário e funções puras | Relógios operacionais, prazos visíveis, persistência/projeção, scheduler/escalonamento |
| Anexos Help Desk | Contratos, componentes, TUS/scan candidatos | Bucket/store/filas/scanner/runtime/retention e aceite integrados |
| Membros/SSO/portal avançado | Serviços, handlers e telas preparados | Composição real, stores, fonte/IdP e aceites por módulo |
| Conhecimento/macros/CSAT/pacotes | Componentes e contratos preparados | Curadoria, publicação por público, produtores/consumidores, integração e operação |
| Legado | Inspeção e mapeamento dry-run | V2 futura, sem importação operacional ampla aprovada |

## 3. Arquitetura em linguagem de produto

O cliente entra no portal e opera somente sobre as contas e obras autorizadas pelo servidor. A configuração publicada define formulário, fluxo e checklist. Ao confirmar uma abertura, protocolo, snapshot do pedido, evento, intenção de notificação e recibo são gravados atomicamente. Uma resposta perdida não autoriza criar outro chamado.

O analista atende o chamado, solicita complemento, transfere quando permitido e registra a evidência do trabalho. Notas internas e mensagens ao cliente têm armazenamento e projeções separados. A conclusão de um ticket não constitui, sozinha, prova de que um cadastro foi criado, uma estrutura importada ou um backup gerado no GEO.

Os e-mails são notificações mínimas com protocolo e acesso ao portal autorizado. O worker admite o envio com autoridade atual e guarda sua cadeia de evidência. A confirmação do Resend, o callback de entrega, a chegada à caixa e o acesso correto ao portal são provas distintas.

O Setup deve realizar o trabalho especializado de implantação/importação. A Wiki orienta pessoas e, futuramente, assistentes com fontes revisadas. O Financeiro conserva sua própria autoridade sobre valores e efeitos financeiros. Nenhum desses produtos deve virar banco auxiliar de tickets por conveniência.

```text
Portal Help Desk (HTML/CSS/ES modules)
  -> Supabase Auth (identidade humana)
  -> Netlify Function /v1/* (autorização e regras)
  -> TypeScript aplicação/domínio
  -> PostgreSQL restrito / schemas privados / RLS / recibos

Eventos -> ledger/outbox -> worker Netlify -> Resend -> webhook assinado
Wiki /wiki/ -> aplicação independente e audiência editorial própria
Setup -> processo e arquivos privados -> vínculo IMP-03 ao ticket (pendente)
Novo GEO -> API/IdP qualificados (preparados, adiados)
HDA -> proposta -> decisão humana -> executor determinístico (cadeia incompleta)
```

## 4. Contratos técnicos que o colega precisa preservar

O frontend do Help Desk usa JavaScript modular nativo; não é React. O backend usa TypeScript e Request/Response nativos. A dependência de runtime principal é `pg 8.16.3`. O package aceita Node `>=22.16 <25`; CI/Netlify usam Node 22. O Setup é Vue 3 Options API/Vuex 4/Vite/Bootstrap, com a estrutura inicial .NET 8 preservada; o Financeiro é um produto React separado.

API/interface Help Desk: **0.31.0**. Contrato/schema: **0.25.0**. Na fonte remota pós-PR49: **19 migrations**, mantendo 79 tabelas e 201 funções no contrato do Help Desk e 13 RPCs do worker. Isso não é inventário de todos os objetos do projeto Supabase, onde a Wiki também possui seu domínio.

Schemas privados: `helpdesk_auth`, `helpdesk_core`, `helpdesk_integration`, `helpdesk_audit`. Separar workspace, conta, produto/instância, contrato/versão, cobertura, identidade, obra e referência externa. Cabeçalhos, UUIDs, e-mail declarado e metadata de JWT não concedem autorização.

Entradas úteis no repo Help Desk:

- `netlify/functions/api.mts`, `src/infrastructure/runtime.ts` e `src/infrastructure/consultegeo-runtime.ts`: o que é montado de fato.
- `src/http/handler.ts`, `docs/openapi.json`: superfície HTTP/capabilities.
- `src/application/consultegeo-registration-operation.ts`: cadastro publicado real.
- `src/infrastructure/transaction.ts`: unidade transacional e resultados incertos.
- `netlify/functions/notification-worker.mts`, `src/infrastructure/notification-runtime.ts`: envio.
- `src/infrastructure/database-security-contract.ts`, `supabase/migrations.manifest.json`: inventário e cadeia de migrações.
- `web/app.js`: jornada, composição e contagens da página carregada.
- `docs/integrations/hda/`, `workers/dev-agent-bridge/`: candidatos de automação.

## 5. Configuração e acessos a transferir sem transferir segredos

| Serviço | Destino conhecido | Necessidade do novo responsável |
|---|---|---|
| GitHub | Organização Consulte-GEO, repos acima | Conta individual com acesso apropriado; confirmar branch/default e proteção antes de publicar |
| Netlify Help Desk | Projeto `helpdesk-consultegeo`; domínio `helpdesk.consultegeo.org` | Permissão de leitura de deploy/logs; escrita somente conforme responsabilidade de implantação |
| Supabase Help Desk | Projeto `xaelbntjnvztznnpcvtm` | Entender Auth/banco e papéis; jamais copiar uma conexão administrativa para requests |
| Supabase Implantação | Projeto `yglcnirbnbwjqpvalqif` | Pooler/login restrito e vínculos próprios; host/porta ainda pendentes no chat |
| Resend | Domínio `consultegeo.org`, remetente `helpdesk@consultegeo.org` | Acesso autorizado à operação, eventos/callback e entregabilidade |
| Claude | Conta própria do colega | Ler contexto e código; não herdar sessões/MCP/tokens do autor anterior |

As variáveis documentadas de e-mail incluem `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `HELPDESK_CONSULTEGEO_ORIGIN`, `HELPDESK_NOTIFICATION_DATABASE_URL` e `HELPDESK_NOTIFICATION_DATABASE_CA`. Esta lista não é um `.env` completo nem contém valores secretos. Consulte os loaders do código da fonte exata para descobrir os demais nomes, escopos e obrigatoriedades. Não renomear nem expor configurações existentes em projetos irmãos.

## 6. Estado de e-mail que prevalece sobre os relatos antigos

O pedido inicial “configurar Resend” foi atendido progressivamente por SMTP/Auth, worker, callback e aceites. Não reiniciar essa implantação com base no primeiro relatório que dizia “envio inativo”. O problema de retorno do cliente comparava representações pública e privada do instante; a migration 19 corrige o projetor preservando hash exato, histórico e intenção original. Não “resolver” arredondando timestamps ou criando novo envio.

[Documento 157 recuperado](FONTES/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md) e [PR49](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/49) registram 8 entregas CG-10002. O CI 38725040437 foi consultado e retornou `success`, fonte `cb61a5852ea0cbe443195dd96cd3296497d912bf`. As contagens reportadas são 5.625 verificações de aplicação + 680 de PostgreSQL + 617 de interface = 6.922; a auditoria não reexecutou essa suíte nem recebeu novamente esses e-mails.

A coorte registrada tem somente solicitante Claude/MRV e Thiago/equipe. Validade: **15/11/2026 às 00h de São Paulo** (`03:00 UTC`). Antes de ampliar ou renovar, reconciliar estado e observar os dois dias úteis previstos. Não criar monitor agendado por inferência.

## 7. Lacunas e riscos de contexto

Há documentos antigos contraditórios: atendimento fechado, falta de lock, ausência de backend IMP-02 e deploy estático do Setup. São fotografias anteriores; alguns cuidados nelas continuam válidos. A ordem é: decisão humana mais recente → fonte atual e configuração comprovada → checkpoint específico mais recente → arquitetura/invariantes → histórico.

Semântica a esclarecer: o core ainda anuncia algumas capabilities falsas, inclusive `email:false`, enquanto o módulo Consulte GEO tem notificações reais por worker separado. Isso exige precisão do contrato; não prova por si que e-mails estão desligados.

Há testes numerosos e controles fortes. Eles não substituem testes de restore, capacidade com carga representativa, operação de scanner, jornada real de recuperação de senha ou treinamento de outra pessoa. Nenhum percentual global de conclusão foi calculado, pois a granularidade e os critérios das capacidades são diferentes.
