# Consulte GEO M06 — montagem e conversa pública

Continuidade autorizada nesta conversa após M05, mantendo as decisões delegadas e o foco Consulte GEO. Base `a930874ff0440d781eab9f88088f0e9549925af9`, mesmo worktree/branch do PR31. Incremento arquitetural executado inline: montagem dos módulos SQL homologados e leitura pública do workflow. Instalação/ativação hospedadas e origem real M08 não são simuladas.

## Resultado

A composição do runtime liga administração M04, comandos M02/M03 e checklist interno às suas factories reais. Nova rota POST `/v1/tickets/{ticket_id}/workflow-commands` usa comando nomeado, If-Match e Idempotency-Key; resposta é o recibo confirmado, sem retry automático. Configuração/admin exige MFA e capability. O origin é configurado no servidor. Flags novas são false por padrão e não são aceitas de body/headers.

Portas qualificadas de origem (resolver + directory) entram exclusivamente pela construção no servidor. Sem elas, workflow/checklist recusam com 503; não substituem a origem por memória, wildcard ou simples grants locais. M08 conecta a autoridade real. O código de produção registra a montagem; configuração pode ser preparada sob flag administrativa mesmo com atendimento fechado. Ticket/coleção/intake da jornada completa continuam dependentes de seus próximos blocos; rotas novas nunca fazem fallback ao handler antigo em recusa.

Devolutiva, retorno do cliente e resolução com mudança de estado têm texto público no ledger M02, hoje ausente de ticket_messages. A leitura une mensagens antigas e esses textos por ID do evento, sem backfill nem segunda publicação. Timeline conserva o evento core original e acrescenta somente a interação pública correlacionada, sem criar uma segunda linha. Motivos privados de encaminhamento/cancelamento/reabertura, atribuição, dados de checklist e notas não viram mensagem pública.

## SQL e autorização

Migration criada pela CLI adiciona três helpers privados: diretório de recursos do ticket (relação base + cobertura CG atual, somente metadata interna), mensagens públicas paginadas e eventos paginados com projeção pública. Schema 0.20→0.21, quatorze migrations; preservar os treze arquivos anteriores e os seis candidatos. Sem novas tabelas ou dados automáticos. Contrato estático passa de 94 para 97 funções; permissões do publicador/worker permanecem iguais.

Helpers de leitura exigem workspace/ator/scope/conta/produto/ticket e escopo CG atuais, antes de ordenar/LIMIT. include_internal só vale para operador com notes.read e escopo completo de notas. Ledger nunca recebe SELECT para o app/cliente/publicador/worker. Resultados são mínimos e não são dumps de audit/command/result. Helpers são SECURITY DEFINER somente para esta projeção privada, search_path vazio e execução exclusiva do app. Admissão de migration conserva o operador/version/defaults qualificados e confere permissões antes do marcador.

Mensagem semanticamente projetada usa event_id, corpo de public_event e timestamp/actor originais. É elegível somente quando o evento core é público, corresponde à mesma conta/workspace/ticket/ID/tipo/timestamp e o ledger registra a revisão/ação compatível. Se já há ticket_messages para esse ID, não duplica. Não inventa mensagem a partir de audit.reason ou resolução corrente. Cursor usa timestamp nativo com microssegundos e UUID, ordenação descendente e contexto já implementado. Modelo/serializer validam os campos públicos adicionais da timeline.

## Transações e montagem

Factories de workflow/checklist mantêm resolver, leased scope, reautorização SQL e um cliente emprestado até COMMIT. Novo comando HTTP propaga admissão sticky (flag/sinal) à transação; fechamento durante espera cancela antes do COMMIT, e reabrir a flag não ressuscita aquela requisição. Confirmação já recebida não é reclassificada por limpeza/fechamento posterior. Administração M04 recebe a mesma admissão por requisição, sem substituir MFA/capability.

Diretório tem limite de tempo, sinal e formato exato; não retorna refs escolhidas pelo cliente. Adapter emprestado do HelpdeskService para DTOs existentes não abre pool/transação aninhada e prende a identidade. O runtime mantém Auth, limiter distribuído, TLS/role/schema/security, bootstrap lazy e observabilidade. Capabilities descrevem configuração disponível e dependências realmente montadas; não concedem acesso.

## Aceite e limites

TDD dos leitores/serializers, malformed ACK, cursor, dedupe, privacidade, rota/config/flag/admissão/cancelamento, ausência de origem e montagem. PG17 real comprova texto público de request_customer/customer_reply/resolve, legado, ID/revisão, ACL/revogação, notas/reasons fora da projeção, cursor e nenhuma concessão a clientes/publicador/worker. HTTP composto com stores reais no cluster próprio e navegador com fixture explicitamente sintética; provar handler/montagem sem afirmar origem/produção reais.

API/interface 0.28.0 para as rotas novas e schema esperado0.21.0; OpenAPI/capabilities/fixtures acompanhados. Verificação M05 continua protegendo seu prefixo de treze migrations dentro da cadeia estendida, sem reescrever 013. CI original Linux/Node22/PG17, revisão independente final e evidências da fonte exata. Relatório142/pacote M06/PR31 atualizado. Sem e-mail, gravação no GEO, grant a pessoas, aplicação remota, merge ou deploy de produção nesta etapa. Jornada M09/M10, origem M08, operação SLA/Storage/e-mail M11 e piloto M12 permanecem seguintes.

Decisão após revisão: directory exige também cg_ticket_resource_allowed antes de retornar IDs. Refresh M08 ocorre por publicação privada anterior ao lookup; snapshot vencido não fornece metadata para ampliar a seleção.
