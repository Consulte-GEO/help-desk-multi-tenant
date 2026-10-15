# HDA-06 — consulta somente leitura do rascunho (E06)

## Fronteira

A consulta apresenta a análise atual. Ela não aprova, não cria, não altera status do chamado, não envia notificações e não escreve no banco. O mecanismo de edição/CAS e a aprovação continuam em entregas próprias. Não duplicar `form-draft.ts`: aquele rascunho é anterior à abertura; este apresenta a proposta cadastral posterior.

## Contratos entregues

`projectRegistrationDraftReview(state, exposure)` recebe um RegistrationState válido e um envelope com `audience`, contexto (workspaceId/accountId/ticketId/operationId), `observedAt` e `expiresAt`. Devolve RegistrationReviewView. Exposição interna/cliente é decisão do servidor, nunca parâmetro livre aceito do solicitante.

`parseRegistrationReviewContext` e `parseRegistrationReviewView` rejeitam propriedades extras, getters, valores/identidades divergentes e capacidades de escrita. `capabilities` deve ser exatamente `{edit:false, approve:false, execute:false}`. Janela de validade > 0 e <= 60.000 ms. Datas UTC canônicas com milissegundos; UUIDs canônicos. Campos textuais até 1.024 unidades UTF-16, até 128 campos por seção; abreviação preserva pares Unicode e é sinalizada. Não confundir limite de apresentação com schema de cadastro.

`createRegistrationReviewState({context, read, sessionSignal, onChange})` oferece `snapshot()`, `refresh()` e `clear()`. Construção não consulta. `read(context, signal)` é uma porta fornecida pelo host, sem transporte HTTP padrão. Cada clique limpa o conteúdo anterior; consultas simultâneas compartilham a mesma espera. Timeout de 15s; nova leitura somente explícita. Expiração usa o tempo restante informado pelo servidor menos o tempo local decorrido, sem depender de ajuste de relógio do navegador.

`mountRegistrationAutomation(root, options)` compõe o controller com `operationsUI`. O host monta após autorização, fornece sinal de sessão e chama `destroy()` ao abandonar o contexto. `clear()` é terminal: para uma nova identidade, construir outra instância. O botão de consulta é a única ação.

## Conteúdo por público

Equipe: dados solicitados, referência de instância/contrato/obra/usuário, sugestão da ação piloto, efeitos fixos do contrato, bloqueadores, número da revisão atual e hash do rascunho. Não mostra transcrições do agente ou ledger privado.

Cliente: andamento, revisão e aviso de que a análise não confirma criação. `detail` sempre nulo. Um estado `draft_ready` é apresentado ao cliente como “Em conferência”. Não transmitir dados internos para depois escondê-los em CSS.

## Montagem futura obrigatória

1. Qualificar HDA-02 no banco e criar leitura autorizada e consistente na mesma transação. Autorizar o acesso ao chamado, vínculo da operação e público interno separadamente. Concessão `read` de solicitante não equivale a operador interno.
2. Revalidar a identidade e a atualidade da concessão por requisição. Só então construir a exposição; usar relógio do servidor, no-store e prazo restrito. Receber contexto do cliente não o torna confiável.
3. Compor o fetch de sessão já existente, sem persistir bearer em localStorage. AbortSignal deve acompanhar logout, troca de conta/chamado e revogação conhecida. Não traduzir falha de consulta em sucesso vazio.
4. Incluir os novos assets no build/fingerprint conforme o pipeline atual. Preservar `operations-ui.js`, tokens, CSP, rotas da wiki e workflow existentes.
5. Executar HTTP, Auth/escopo, navegador desktop/celular/temas, acessibilidade e testes de negação com dados autorizados. Somente então montar na aplicação publicada.

## Ainda não entregues

Edição, comparação entre duas versões, lista detalhada de campos faltantes, histórico paginado, prévia real da origem, aprovação, escrita no GEO e callback/notificação. “Revisões e rastreabilidade” mostra apenas a revisão atual e informa essa limitação. Valores opacos continuam como IDs até haver catálogo autorizado de nomes; não inventar nomes de obra/contrato para uso real.
