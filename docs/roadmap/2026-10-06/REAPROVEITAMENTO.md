# Help Desk — reaproveitamento e fronteiras

**Base inspecionada:** `b4dd00040605bd11f22d97636b5a973075e7cef2`, 06/10/2026. Todo caminho abaixo é relativo a `Consulte-GEO/help-desk-multi-tenant`. O principal ativo a aproveitar é o próprio núcleo atual do Help Desk. Os documentos/ZIPs R23 são contexto histórico: R24 já foi integrado; não importar novamente pacotes sobre o checkout.

## Mapa do código existente

| Base existente | O que aproveitar | Como evoluir e qual cuidado preservar | Entregas |
|---|---|---|---|
| `src/domain/model.ts`, `policy.ts`, `scopes.ts` | Entidades, atores, acesso e capacidades granulares | Acrescentar modelos administrativos/operacionais separados; papel e scope não bastam para acessar conta alheia | HD-P05–14 |
| `src/application/ports.ts` | Portas de persistência e unidade de trabalho | Novas operações explícitas com contrato de versão/efeito; não espalhar SQL na UI/handler | Todas |
| `src/application/helpdesk.ts` | Abertura, consultas, conversa, transições e replay | Extrair módulos quando necessário, mantendo autorização antes da projeção; confirmar retomada de criação na UI | HD-P02/13/14 |
| `src/domain/contracts.ts`, `src/application/coverage-result.ts` | Validação e seleção contratual | Construir administração e simulador ao redor desse contrato, sem recalcular snapshot de ticket antigo | HD-P09/10 |
| `src/application/support-catalog.ts`, `web/support-catalog-state.js` | Contextos autorizados e abertura guiada | Criar CRUD sem reconstruir o caminho de leitura; conta/instância/serviço continuam distintos | HD-P07/08 |
| `src/application/ticket-search.ts`, `pagination.ts`, `web/ticket-list-state.js` | Busca literal, filtros e cursor escopado | Novos filtros no servidor antes da paginação; agregação global separada dos itens carregados | HD-P14/28/32 |
| `src/application/ticket-priority.ts`, `ticket-assignment.ts`, `ticket-actions.ts` | Prioridade manual e assumir/liberar com versão e ações disponíveis | Atribuição a terceiros é operação nova; fila e responsável nunca concedem acesso | HD-P12–14 |
| `src/domain/workflow.ts` | Estados internos e transições autorizadas | Estender por decisão explícita; preservar projeção pública e testar reabertura/pausa de SLA | HD-P13/21/32 |
| `src/application/conversation-result.ts`, `web/conversation-state.js`, `web/timeline-state.js` | Conversas/timeline paginadas e projeções | Participantes/anexos devem obedecer visibilidade do pai; notas não entram em DTO público | HD-P13/23/24 |
| `src/application/replay-result.ts`, `src/infrastructure/idempotency-lookup.ts` | Snapshot histórico validado e reautorizado | Não substituir por GET atual; cache inválido não vira primeira gravação | Todas as escritas |
| `web/mutation-state.js`, `web/session-fetch.js`, `web/app.js` | Estado de mutação e sessão | Estender congelamento de intenção à abertura; falha após despacho não autoriza repetir com nova chave | HD-P02/05/13 |
| `src/infrastructure/authentication.ts`, `principal-validation.ts`, `auth-response.ts` | Identidade humana e M2M validada | Acrescentar ciclo administrativo/step-up sem aceitar metadata como grant nem compartilhar token M2M no browser | HD-P03/05/06/11/25 |
| `web/human-auth.js`, `web/human-session.js` | Login, refresh coordenado e logout local | Convites, recuperação e seleção de workspace com autorização; nunca persistir segredo em storage por conveniência | HD-P05/06 |
| `src/application/human-scope-change.ts`, `scripts/plan-human-scopes.ts` | Modelo de revisão de escopos e plano offline | Usar como referência para backoffice, não expor setter privado irrestrito ao request normal | HD-P05/11 |
| `src/infrastructure/transaction.ts`, `postgres.ts`, `sql.ts`, `write-result.ts` | Contexto transacional, persistência e confirmação de DML | Novas escritas participam de transação; falha de rollback descarta conexão; UPDATE 0 não vira sucesso | Todas as escritas |
| `src/domain/transaction-effects.ts`, migrations `010`/`011` | Evidência atômica e serialização da conversa | Worker usa ledger próprio de entrega; não reutilizar `write_effects` como recibo do destinatário | HD-P15/18/21 |
| `supabase/migrations/`, `supabase/migrations.manifest.json`, `supabase/tests/` | Onze migrations imutáveis e testes de RLS/upgrade | Novas migrations aditivas e testes fresh/upgrade; jamais modificar hash para ocultar reescrita | Todas com banco |
| `src/infrastructure/rate-limit.ts`, `session-lifecycle.ts` | Limites distribuídos, expiração e manutenção técnica | Operacionalizar agendamento/lotes/dry-run e medir vizinho ruidoso; política de negócio separada | HD-P04/18/29 |
| `src/domain/calendar.ts`, `shared/instant.js` | Calendário puro e precisão de instantes | Versionar calendários e otimizar cálculo; função atual não é clock de SLA nem scheduler | HD-P19–21 |
| `src/http/handler.ts`, `validation.ts`, `serialization.ts` | Rotas, contrato de entrada/saída e capabilities | Ampliar contratos em conjunto com implementação; false até fluxo composto e aceito | Todas com API |
| `src/infrastructure/runtime*.ts`, `hosted-handler.ts`, `netlify/functions/api.mts`, `netlify.toml` | Runtime restrito, preflight, gate e empacotamento | Homologar o destino real; preservar identidade restrita e bloqueio de demo fora de loopback | HD-P03/04/29/30 |
| `scripts/hosted-acceptance*.ts`, `hosted-auth-acceptance*.ts`, `hosted-write-acceptance*.ts` | Clientes reais já preparados | Utilizar com fixture/destino autorizados; não desenvolver outro framework para adiar o aceite | HD-P03 |
| `.github/workflows/ci.yml`, `scripts/homologate-local.mjs`, `check-homologation.mjs` | Pipeline e evidência coerente | Novo código exige nova evidência; relatório de CI não é homologação do host | Todas |
| `src/observability/`, `scripts/summarize-http-logs.ts` | Request ID, códigos e sumarização segura | Acrescentar SLO/alertas/relatórios sem corpos ou credenciais nos logs | HD-P04/18/28/29 |
| `web/index.html`, `web/styles.css`, módulos de estado | Interface atual leve e funcional | Separar telas/componentes conforme crescerem; testar teclado, foco, contraste, mobile e erros nas jornadas | HD-P05–14/28/30 |

Os nomes `policy.ts` e similares abreviados em uma célula usam o mesmo diretório do primeiro arquivo da célula. Prefixos `runtime*`, `hosted-*` e migrations `010`/`011` indicam famílias existentes, não arquivos literais a criar.

## Limites de reaproveitamento entre produtos

| Origem | Reutilização apropriada | O que precisa continuar separado |
|---|---|---|
| Help Desk R23/R24 | Código integrado, invariantes, testes e contratos atuais | Evidências históricas não podem receber um SHA novo manualmente |
| GeoLab | Conhecimento da identidade externa, conta, instância e contexto mínimo de suporte | Banco/domínio do GeoLab, autenticação própria e instalação do conector no consumidor |
| Financeiro multi-tenant | Potencial segundo consumidor; padrões de UX e aprendizado de isolamento após revisão | Títulos, pagamentos, lançamentos e tabelas financeiras ficam em `financeiro-multi-tenant` |
| Financeiro legado | Eventual referência de experiência de suporte se uma função concreta for identificada futuramente | Nenhum transplante genérico de backend financeiro/tenant legado para o Help Desk |

Esta rodada não identificou um módulo de Help Desk legado que deva ser migrado. A análise do Financeiro é outro pacote. A prova de genericidade exige dois consumidores reais, mas a escolha do segundo continua pendente; escola é fixture e não integração homologada. Se o Financeiro for escolhido, o núcleo/contrato ficam neste repositório e a instalação do cliente pertence ao repositório do Financeiro, em tarefa própria.

## Evitar retrabalho

1. Não reimplementar busca/paginação, prioridade, assumir/liberar ou logout da sessão M2M como se estivessem ausentes.
2. Não confundir tabelas de contrato com gestão contratual, outbox com entrega, calendário puro com SLA, ou fixture com conector real.
3. Não reescrever onze migrations nem reenviar R23 ao GitHub. Conferir a branch padrão atual antes de iniciar.
4. Não ativar e-mail, anexos, webhooks, SLA ou embed somente ao criar tabela/rota. Testar a jornada, isolamento, recuperação e operação.
5. Não adotar novo framework/serviço de fila por preferência. Definir custo, execução, recovery e observabilidade antes de escolher infraestrutura adicional.
