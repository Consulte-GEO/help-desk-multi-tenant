# Help Desk — diagnóstico e requisitos para desenvolvimento

**Inspeção:** 06/10/2026, America/Sao_Paulo. **Escopo:** Help Desk genérico, multiworkspace, multiconta, multiproduto e multicontrato. **Destino:** `Consulte-GEO/help-desk-multi-tenant`. O Financeiro pode ser um consumidor por API; não é o repositório deste núcleo.

## 1. Estado atual conferido

| Camada | Evidência atual | Interpretação |
|---|---|---|
| GitHub | Branch padrão `codex/m1-reproducibilidade`, HEAD `b4dd00040605bd11f22d97636b5a973075e7cef2` | Não presumir `main`; no checkout local `github` é o remoto GitHub e `origin` aponta para um bundle histórico. |
| Integração | [PR #3](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/3) mesclado em 05/10/2026 22:41:35 UTC | R24 integrado. PRs #1/#2 também mesclados; não reaplicar R10–R23. |
| Pendências GitHub | Nenhum PR ou issue aberto observado | Ausência de issues não significa ausência de backlog: os requisitos estão nos documentos. |
| CI do HEAD | [run 37384076809](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37384076809), `homologation` success | Artefato baixado e inspecionado, vinculado ao SHA atual; não é somente registro antigo. |
| Suítes no artefato | 1.436/1.436 aplicação, 215/215 PostgreSQL, 71/71 interface; zero falhas/skips | Os 71 agregam HTTP em memória e navegador, inclusive Auth sintético; não são 71 cenários hospedados. |
| Instalação/lock/audit | Todos passed no mesmo artefato | Não regenerar lock por instruções históricas sobre sua ausência. |
| Limite do relatório | `scope: local-m1`, `platform_approved: false` | O nome do job “homologation” não certifica Supabase/Netlify/Auth em operação. |
| Fingerprint | `659e9ad6d69d822888486a59b2c9c6bf5d39c7a3ec1391ee29fd048c0e9a6a82` | Fonte executável preservada por R24 documental; não alterar evidências antigas para um código futuro. |
| CodeQL | Actions, Python e JavaScript/TypeScript success, [run 37384072634](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37384072634) | Análise estática não substitui pentest nem autorização real. |
| API/schema | API/interface `0.19.0`; schema esperado `0.18.0`; 18 operações HTTP | Versão de pacote sozinha não identifica rodada; acompanhar SHA/árvore. |
| Netlify atual | Site `helpdesk-consultegeo`, ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`; deploy ready `6ac427a3d1cf2d0008b257c8` | O site histórico `help-desk-multi-tenant`, ID `ee32e955-42e5-4417-bf4f-39cbef2366cc`, é outro recurso. |
| Smoke público atual | GET sem credenciais ao [public-config do permalink](https://6ac427a3d1cf2d0008b257c8--helpdesk-consultegeo.netlify.app/v1/public-config) → 503, `release_gate_closed` | Confirma bloqueio da Function; não prova conexão com banco ou login. |
| Supabase | Projeto `xaelbntjnvztznnpcvtm`; onze entradas no ledger de migrations | Os IDs de aplicação hospedada diferem dos prefixos locais; registrar mapa por nome/conteúdo, não reaplicar. |
| Catálogo de banco | `helpdesk_core`: 12 tabelas; `helpdesk_auth`: 9; `helpdesk_audit`: 2; `helpdesk_integration`: 2 | Total 25, todas ENABLE/FORCE RLS, confirmado por metadados nesta rodada. Não foram lidos tickets/credenciais. |
| Modelo de persistência | Schemas privados e login de request restrito, driver pg, contexto transacional | Semântica de grants/pool/TLS/Function deve ser comprovada no destino; contagem de RLS não basta. |

As onze entradas hospedadas foram aplicadas com versões `20260928204720` a `20260928204900`, nomes correspondentes às onze migrations do Git `20260915000100` a `20260917001100`. A conferência de conteúdo/checksum faz parte do aceite; não afirmar identidade byte a byte apenas pelo nome do ledger.

Security Advisor: 14 avisos INFO de RLS sem policy e um WARN de proteção contra senha vazada desabilitada. Tabelas privadas acessadas por helpers podem legitimamente não ter policy direta; não abrir acesso para silenciar o aviso. Revisar concessões e testar negativas. A proteção de senha deve ser avaliada com a política de Auth e disponibilidade do ambiente. Fontes oficiais: [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Limites desta auditoria:** leitura de código, documentação, testes, metadados e resultado de CI já executado. Não reexecutou toda a suíte Windows, não criou fixtures hospedadas nem testou usuários reais. A rodada R24 local documentou 23 falhas de requisitos POSIX/OpenSSL/symlinks no Windows; o CI Linux atual passou integralmente. Esses fatos não justificam remover asserts, adicionar skips ou declarar homologação do runtime publicado.

## 2. Capacidades implementadas versus produto completo

| Área | Implementação identificada | Lacuna real | Entrega |
|---|---|---|---|
| Pessoas/sessão | Login/refresh/logout no frontend, identidade validada no servidor, vínculos vivos | Primeiro acesso, convites, administração, MFA e recuperação do Help Desk; Auth real | HD-P03/05/06 |
| Escopos | Cinco capacidades de atendimento persistidas por pessoa/workspace; setter privado e CLI de plano | Gestão administrativa autorizada, política de novos escopos e auditoria | HD-P05/11 |
| Integração M2M | Chave longa → sessão curta opaca, expiração/quota e revogação da sessão atual | UI/CRUD de conexão/credencial, rotação e revogação administrativa de alcance definido | HD-P11 |
| Contexto/catálogo | Lista autorizada de contextos e resolução com zero/uma/múltiplas coberturas | CRUD de produtos/instâncias/serviços/contas/contratos e simulador administrativo | HD-P07/08/09/10 |
| Tickets | Abrir/listar/detalhar/transicionar, DTOs públicos, versão e idempotência | Fluxos administrativos/operacionais ampliados e aceite hospedado | HD-P02/03/12–14 |
| Busca | Assunto literal/UUID, filtros e cursor escopado | Busca textual em conversas, filtros gerenciais adicionais, volume e UX | HD-P14/28/32 |
| Prioridade | Alteração manual com versão/motivo/autorização | Impacto/urgência/severidade e matriz configurável | HD-P14 |
| Responsabilidade | Assumir/liberar a si próprio e filtro de atribuição | Atribuir terceiro, equipes/filas, transferência e participantes | HD-P12/13 |
| Conversas/notas | Endpoints/tabelas/DTOs separados, paginação, timeline projetada | Participação explícita, anexos e notificações, sem vazamento interno | HD-P13/17/23/24 |
| Concorrência | If-Match, idempotência persistente, snapshots reautorizados, DML exato | Composição de retomada da criação a confirmar; provar tudo no host | HD-P02/03 |
| Outbox | Intenção pública atômica com ticket/evento; notas/atribuições privadas sem outbox | Claim/lease, ledger por destino, worker, retries, DLQ e processamento real | HD-P15/16/17 |
| Calendário/SLA | `addBusinessMinutes`, snapshot contratual; calendário puro com horizonte | Calendários/políticas versionados, clocks, scheduler, alertas e recomputação | HD-P19/20/21 |
| Roteamento | Requisito e fronteiras arquiteturais | Regras, prioridades, conflitos, simulação, publicação e vínculo a filas | HD-P22 |
| Arquivos | Capacidade false; nenhum fluxo seguro completo | Quarentena/inspeção/antimalware, vínculo, download, retenção e restore | HD-P23/24 |
| Conectores | Fixtures de laboratório/escola e API genérica | GeoLab real e segundo sistema real com identidade individual e mappings | HD-P25/26/27 |
| Observabilidade | Request ID, códigos seguros, logs HTTP e sumarização | Métricas/SLO/alertas, trilha administrativa, volume/custos e runbooks | HD-P04/18/28/29 |
| Retenção | Rotina privada limitada para dados efêmeros, papel próprio, dry-run | Scheduler/privilégios/limites operacionais e política de dados de negócio | HD-P18 |
| Conhecimento/canais/IA | Requisitos posteriores; não integram fluxo atual | Macros, KB, CSAT, inbound, links/merge, automações e IA opcional | HD-P31/32/33 |

O anúncio em `src/http/handler.ts` é coerente ao manter `attachments`, `webhook_delivery`, `sla_clocks`, `support_sessions`, `contract_admin` e `email` como false. Não ativar capabilities com base em tabela criada, protótipo ou teste de memória.

## 3. Achado prioritário para confirmar por regressão

**Abertura de ticket após confirmação perdida pode ser bloqueada ou mudar de payload na UI.** A leitura de `web/app.js:276–299` mostra que cada submit chama `/contexts/resolve` antes de `POST /tickets`. A chave é preservada após erro se não houver edição/fechamento, mas o payload e a cobertura não são congelados como intenção completa.

Se o primeiro POST confirmou no banco e sua resposta se perdeu, uma cobertura agora vencida produz `no_coverage` e a UI interrompe antes de alcançar o replay idempotente do backend. Se o contexto era ambíguo e passa a único, a composição pode retirar `coverage_id` mantendo a mesma chave, causando conflito de idempotência. `HelpdeskService.create()` já faz replay antes de recalcular cobertura; `tests/v019-contract-http.test.ts` contém o caso de replay contratual no backend. `web/mutation-state.js` protege outros comandos, mas não essa criação.

**Classificação:** achado por inspeção estática, não falha reproduzida em navegador nesta rodada. **Prioridade:** HD-P02, teste browser que perde a resposta após efeito e muda cobertura antes de reenviar. Resultado esperado: mesma chave e mesmos bytes recuperam o resultado original autorizado, sem nova criação nem nova seleção automática. Revogação de acesso continua bloqueando replay; cobertura vencida não deve ser confundida com revogação do ator.

## 4. O que não precisa ser reconstruído

- CI, lock, migrations, guardas de runtime e clientes read/Auth/write já existem; é necessário utilizá-los e fechar aceites.
- Busca/paginação, prioridade e assumir/liberar foram antecipados de M3. Não declarar HD-301/302 inteiros ausentes.
- Catálogo de leitura e resolução de cobertura existem; `contract_admin:false` descreve a falta de gestão, não a falta de resolução.
- A sessão M2M atual pode ser revogada. Rotação/revogação administrativa de credenciais/conexões é outra entrega.
- Outbox transacional já existe; o trabalhador que entrega ao destinatário ainda não existe.
- Eventos/recibos privados e `write_effects` são evidência transacional, não ledger de entrega externa.
- Limite distribuído e manutenção efêmera estão codificados. Falta medir/homologar/agendar, não inventar outro limitador por memória local.

Os documentos mestres preservam parágrafos antigos sobre lock ausente, banco vazio, 14 operações e SQL não executado. São histórico superado em partes; HD-P01 deve atualizar as referências correntes sem apagar a origem. Esta fotografia prevalece para os fatos conferidos em 06/10, não substitui decisões arquiteturais ainda válidas.

## 5. Requisitos estáveis para todas as entregas

1. Núcleo independente em `Consulte-GEO/help-desk-multi-tenant`. Não armazenar tickets no banco do Financeiro/GeoLab nem pôr `laboratorio_id`, `obra_id` ou `aluno_id` obrigatório no core.
2. Workspace, conta, produto/instância, serviço, contrato/versão e cobertura distintos. Suporte Consulte→laboratório não é automaticamente laboratório→construtora.
3. Pessoa, conexão M2M e usuário externo incorporado têm identidades distintas. Sessão M2M não impersona cada usuário de um widget.
4. Autorização no servidor e no banco. UUID/header/JWT metadata/capability/UI não concedem acesso. Filas e atribuição não promovem acesso a uma conta.
5. Notas internas em estruturas próprias, sem conteúdo/metadata privados em DTO/evento/webhook/busca/arquivo/IA públicos. `notes:read` e `notes:write` independentes.
6. Idempotência transacional por workspace/principal/operação/chave, reautorizada. Mesma chave/payload retorna snapshot histórico; payload diferente conflita. Resultado perdido não gera chave nova automaticamente.
7. Concorrência com versão, confirmação de DML e locks; contexto do pool somente transacional, rollback falho descarta conexão. Nunca usar service_role/postgres/BYPASSRLS no request normal.
8. Instantes/cursor preservam microssegundos e desempate por ID; vigência `[início,fim)` com timezone explícito. Não truncar timestamps PostgreSQL via Date antes de comparar/paginar.
9. Versões publicadas/snapshots imutáveis; correção por nova versão/evento. Calendário e SLA futuro referenciam a versão aplicável ao ticket.
10. Capacidade false até implementação e composição reais. Demo só loopback, sem fallback em produção; tokens de pessoa em memória conforme contrato atual.
11. Segredos somente servidor, sem logs/URLs/Git. Exportações e evidências privadas fora dos pacotes públicos. Trilha não significa armazenar corpo sensível indiscriminadamente.
12. Manter migrations aplicadas; alterações aditivas com manifest atualizado conforme processo. Nenhuma alteração de hash para disfarçar SQL antigo reescrito.
13. Aceite por camada: código, testes locais/CI, ambiente real, publicação e operação. Gate não é atalho para atendimento real nem substituto de evidência.
14. Não reescrever frontend em React ou introduzir filas/serviços novos só por preferência. HTML/CSS/JS e TypeScript atuais são a base; extrair módulos quando a entrega exigir.

## 6. Decisões necessárias antes das etapas dependentes

| Decisão | Entrega | Trabalho que pode continuar sem a decisão |
|---|---|---|
| Homologação na mesma base/site definida pelo usuário; preparar pessoas/contas/fixtures e efeitos de teste | HD-P03 | Preflight e clientes existentes; sem exigir outro ambiente ou inventar IDs reais |
| Região/residência, RPO/RTO, retenção, volumes e custos | HD-P04/24/29/30 | Medir baseline e preparar ensaio; não prometer números |
| MFA admin, recuperação e revogação de sessão | HD-P05/06 | Matriz de ações e interface revisável; sem alterar Auth real |
| Catálogo, contas, contratos e política sem cobertura | HD-P07–10 | CRUD/validação com fixtures; sem criar cobertura fictícia |
| Equipes, filas, alçadas de atribuição e participantes | HD-P12/13 | Modelo e testes de isolamento |
| Tipos de solicitação, impacto/urgência/prioridade | HD-P14 | Modelo versionado e prévia, sem impor fórmula arbitrária |
| Destinatários/canais/provedor e conteúdo de eventos | HD-P15–17 | Worker/ledger com destinos sintéticos, sem envio real |
| Horários/feriados/SLA/pausas/reabertura/escalonamento | HD-P19–22 | Engine e simulador; não vender meta derivada de fixture |
| Tipos/tamanho/antimalware/retenção de arquivos | HD-P23/24 | Quarentena fechada e testes; sem liberar arquivo não inspecionado |
| Identidade externa, origens embed e segundo produto | HD-P25–27 | Contrato de API/SDK e dublês; Financeiro é opção, não decisão tomada nesta rodada |
| Base de conhecimento, automações, IA e canais adicionais | HD-P31–33 | Discovery e critérios; não condicionar abertura humana a IA |

## 7. Critério do primeiro release completo

Um sistema real autentica pessoa/conexão adequada, resolve conta/cobertura, abre ticket idempotente e confirma ticket/evento/outbox atomicamente. O atendimento é atribuído sem ampliar acesso, SLA é instanciado pela política correta, agente/cliente conversam, arquivo passa pela inspeção, worker entrega notificação autenticável e retry não duplica efeito lógico. Revogação/isolamento continuam funcionando. Banco e objetos são restaurados em ensaio. Repetir com segundo produto semanticamente diferente sem alteração estrutural específica no core.

M1 encerra a fundação homologada; não equivale a esse release M7. M2–M6 entregam as capacidades restantes. M8 preserva evolução posterior ao atendimento funcional. Não há percentual global nem prazo de calendário confiável baseado apenas na quantidade de testes ou documentos.
