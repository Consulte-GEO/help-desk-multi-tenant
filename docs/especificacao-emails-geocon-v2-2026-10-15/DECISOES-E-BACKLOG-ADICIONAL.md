# Decisões vigentes e backlog adicional — 15/10/2026

Este registro complementa o handoff e a lista de melhorias entregues anteriormente. Os ZIPs anteriores conservam a fotografia da data de sua geração. Para a decisão mais recente, prevalece este documento e seu JSON correspondente.

## Aprovação da MEL-09

**Decisão expressa do titular:** “Aprovo a inclusao das seguintes melhorias MEL-09”.

**Estado:** aprovada para inclusão no desenvolvimento; incluída neste backlog complementar. Implementação ainda não iniciada. As outras 13 propostas MEL continuam pendentes; não foram rejeitadas nem aprovadas por omissão.

### MEL-09 — Localizar quem recebeu uma orientação depois corrigida

**Resultado esperado:** quando um artigo ou macro for retirado ou corrigido por risco/erro, permitir identificar os atendimentos que usaram a versão afetada, revisar seu impacto e registrar a decisão sobre eventual comunicação corretiva.

**Escopo aprovado:** o descrito na proposta MEL-09, sem ampliar a publicação da Wiki ou automatizar envios.

1. Registrar referência, versão e identificador do conteúdo quando uma orientação revisada for aplicada em um chamado.
2. Preservar a mensagem original e a versão efetivamente usada; correção cria novo registro vinculado, sem reescrever o passado.
3. Permitir retirada/substituição com motivo, responsável e versão afetada.
4. Gerar lista interna dos usos identificáveis, limitada ao acesso atual da pessoa que consulta.
5. Registrar análise de impacto e, quando cabível, uma proposta de correção com revisão humana.
6. Reautorizar destinatários e audiência imediatamente antes de qualquer comunicação autorizada.

**Dependências:** HD-030/031/032, conteúdos e macros versionados, vínculos com mensagens/chamados e autorização por conta/obra. O rastreamento pode ser preparado preservando o adiamento da revisão factual Novo GEO. Não supor que todo texto copiado manualmente possa ser reconhecido retroativamente.

**Critérios de aceite:**

- A referência identifica exatamente a versão usada e permite navegar para a evidência autorizada.
- Retirar uma versão produz uma lista reproduzível dos usos registrados, sem misturar clientes ou obras.
- Correção editorial simples não abre uma revisão de impacto automaticamente sem motivo/política definidos.
- A análise distingue afetado, não afetado, inconclusivo e tratado, com autor e evidência.
- Mensagens antigas e snapshots são preservados; comunicação corretiva é explícita e vinculada.
- Repetição de comando não duplica ação ou envio; falha/resultado desconhecido preserva a intenção original.
- Mudança de acesso impede exposição ou novo envio indevido.

**Planejamento:** esforço relativo L, conforme proposta original; ordem e prazo não foram definidos pelo titular. A identificação MEL-09 foi preservada, sem renumerar os 49 HD ou os 32 AUX históricos.

**Composição do planejamento:** backlog-base de 49 HD + recortes AUX existentes + MEL-09 aprovada neste adendo. O JSON `BACKLOG-ADICIONAL.json` representa essa inclusão de forma estruturada.

## Gestão de e-mails inspirada no GEOLAB

O titular pediu análise do repositório e perguntas de escopo para uma futura implementação. As respostas recebidas definiram:

| Tema | Decisão recebida | Aplicação na primeira versão |
|---|---|---|
| Alcance | Somente monitoramento: histórico, filtros, detalhes, fila, falhas e indicadores | Painel de consulta. Nenhuma ação de ligar/desligar ou reenviar foi incluída nesta fase |
| Administração | Somente administradores Consulte GEO; equipe consulta | Configurações continuam centralizadas. Consulta da equipe sempre limitada às contas/obras autorizadas |
| Preferências pessoais | Inicialmente só a Consulte GEO configura o recebimento, sem preferências individuais | Sem tela de preferências individuais nesta fase |

A opção geral de administração mencionava preferências permitidas. A resposta específica sobre a primeira versão determina que elas **não entram inicialmente**. Não há necessidade de reabrir essa decisão.

As perguntas seguintes foram respondidas e fecham o recorte:

| Tema | Decisão recebida |
|---|---|
| Indicadores | Incluir aberturas e cliques, mesmo exigindo ampliar o registro de eventos |
| Destinatários no histórico | Administradores veem endereço completo; equipe vê endereço mascarado |
| Fluxos monitorados | Notificações dos chamados, enviadas aos solicitantes e à equipe |
| Histórico de abertura/clique | Registrar a partir da implantação; anterior sem evidência aparece como indisponível |

As sete decisões estão no [questionário respondido](PERGUNTAS-E-ESCOPO.md). O click tracking do provedor continua habilitado conforme decisão anterior; a escolha atual trata da coleta e exibição no Help Desk. A monitoração de acesso, convite e recuperação de senha não integra este recorte.

O pedido de equivalência ao GEOLAB não autoriza importar sua fila, seu banco, segredos ou permissões. A implementação deve compor a infraestrutura já existente no Help Desk.
