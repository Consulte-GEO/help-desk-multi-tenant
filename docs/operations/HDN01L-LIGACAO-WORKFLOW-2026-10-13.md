# HDN-01l — leitor PostgreSQL do checklist ligado ao workflow

Data: 13/10/2026. Base remota lida: PR30 `a5b23a9143ecc367444a28e9b71d561fd325611c`, principal `6e069005beaa12d7cb55c77af92478c21f7526ca`. Entrega local, sem push/merge/deploy.

## Resultado

Criada `src/infrastructure/support-workflow-checklist.ts`, com `createPostgresChecklistWorkflow`. A factory reutiliza `createSupportWorkflow` e compõe o adaptador existente `createPostgresExecutionChecklistStore` no mesmo cliente emprestado pelo executor. A leitura exigida pelo perfil publicado faz `assertReady` e `readExecutionChecklist`, incluindo a conferência das evidências. Não usa o eventual leitor customizado do store do host como fallback.

Os demais métodos do workflow são delegados explicitamente, preservando o receiver de instâncias de classe. A factory não adquire conexão, não começa/confirma transações, não cria papéis e não publica templates. Cada operação continua com sua própria transação; as três marcações e a resolução são requisições distintas. Dentro da resolução, leituras e decisão compartilham a conexão da operação.

Um perfil sem checklist não passa a exigir sua instalação; a devolutiva e a recuperação de recibo histórico autorizado não executam novamente a conferência de conclusão. Um checklist requerido não é dispensado por falha de instalação ou por resposta inválida.

## Limite central

`createStore(client, principal)` ainda deve devolver uma implementação DURÁVEL dos métodos `readTicket`, `readProfile`, `readReceipt`, `verifyAssignee` e `commitDecision`. Ela deve manter locks/CAS/auditoria/evento/outbox/recibo no mesmo client. A factory não transforma um store em memória em implementação PostgreSQL. Nenhuma fixture integra o produto. Runtime, template/vínculo qualificados e proteção de todas as escritas terminais continuam pendentes.

## Provas locais

21 testes novos com workflow, autorização, serviço de marcação, adaptador de checklist e executor reais. Apenas transporte SQL e store de workflow são controlados. Incluem três marcações por serviço real seguidas de resolução, recusa de evidência retirada após marcações, privacidade, readiness, perfil/revisão, preservação de `this`, replay, confirmação perdida e expiração.

605 regressões anteriores +21 novas =626 aprovações no recorte local; não é CI completo. Tipos focais TS5.8.3/Node25.1.0 globais aprovados. Três mutações detectadas (readiness, fallback indevido, receiver). Código correto restaurado. Navegador bloqueado em `page.goto` com `ERR_BLOCKED_BY_ADMINISTRATOR`; nenhum check visual novo passou. Políticas não modificadas.

O SQL candidato e os31cenários que passaram na J estão byte a byte preservados. A evidência histórica J não aprova esta factory nem sua montagem futura. Nova execução SQL/CI não realizada nesta sessão.

## Revisão

Autorrevisão em passagem separada. Sem revisão independente. A confirmação do preview por metadados continua erro de build2, sem acesso ao log completo ou causa exclusiva estabelecida. Escrita remota anteriormente bloqueada não foi reencodada/repetida por outro caminho.

## Integração seguinte

Incorporar o cumulativo inteiro ao PR30 pelo patch03 no fluxo autorizado. Na montagem do backend, substituir a composição manual do leitor de checklist por esta factory, fornecendo os demais métodos reais de workflow. Executar Node+tipos+contratos+SQL+browser+build no checkout/lock reais. Manter o atendimento fechado até migration/upgrade/readiness, fontes, templates, vínculos, escrita terminal e aceite de jornada estarem concluídos.
