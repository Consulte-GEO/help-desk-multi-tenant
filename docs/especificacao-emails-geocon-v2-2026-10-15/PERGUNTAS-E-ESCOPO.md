# Gestão de e-mails — decisões e perguntas de escopo

## Respostas já recebidas

1. **Primeira versão:** somente monitoramento — histórico, filtros, detalhes, fila, falhas e indicadores.
2. **Administração:** centralizada nos administradores Consulte GEO. Equipe com consulta dentro da autorização atual.
3. **Preferências individuais:** não entram inicialmente; a Consulte GEO configura o recebimento.

Essas respostas definem o recorte inicial e prevalecem sobre sugestões anteriores de gestão completa.

## Perguntas adicionais respondidas

### P4 — Indicadores de abertura e clique

O GEOLAB possui essas informações no painel. O receptor atual do Help Desk normaliza `email.sent`, `email.delivered`, `email.failed`, `email.bounced` e `email.suppressed`. Abertura e clique não fazem parte do mapa de desfechos atual; eventos assinados sem desfecho suportado retornam `outcome=null`. Mostrar esses indicadores exige registro próprio, além da interface.

- Opção A: primeira versão com fila, envio aceito, entrega e falhas; abertura/clique depois.
- Opção B: incluir abertura/clique agora e ampliar o registro de eventos necessário.

**Resposta recebida:** opção B — incluir aberturas e cliques, mesmo exigindo ampliar o registro de eventos. Abertura/clique são telemetria, sem comprovar leitura humana, identidade ou autorização. Não alterar a configuração de click tracking já autorizada no provedor.

### P5 — Endereços no histórico

Dentro das contas e obras autorizadas, quem deve consultar o endereço completo?

- Opção A: administradores veem completo; equipe de consulta vê mascarado.
- Opção B: administradores e equipe autorizada veem completo.
- Opção C: todos veem mascarado; identificação completa apenas no procedimento administrativo.

**Resposta recebida:** opção A — administradores veem endereço completo; equipe vê endereço mascarado. Mascaramento não substitui autorização das linhas, contagens e detalhes.

### P6 — Fluxos monitorados

**Resposta recebida:** notificações dos chamados, enviadas aos solicitantes e à equipe. Não incluir nesta primeira versão e-mails de acesso, convite e recuperação de senha, que exigem correlação e política próprias.

### P7 — Histórico de abertura/clique

**Resposta recebida:** registrar a partir da implantação. O histórico anterior aparece como informação indisponível quando não houver evidência. Não recuperar ou inferir valores retroativos sem fonte, nem apresentar ausência de coleta como zero aberturas/cliques.

**As sete perguntas desta rodada estão respondidas.** O desenho técnico pode usar essas decisões como requisitos, preservando as autorizações próprias de implementação e publicação.

## Propostas de experiência para o recorte escolhido

Estes pontos são sugestões a apresentar no desenho, não respostas atribuídas ao titular:

- Período inicial de 30 dias, atalhos de 7/30/90 dias e paginação no servidor, como referência do GEOLAB.
- Filtros de status, tipo de evento, protocolo/chamado e destinatário, conforme acesso e capacidade de pesquisa do papel.
- Detalhe com origem, destinatário permitido, linha do tempo, tentativas, falha compreensível e próxima ação recomendada.
- Separar aceitação pelo provedor de entrega e de confirmação do resultado no portal.
- Mostrar fila total e idade dos pendentes por consulta agregada autorizada; não somar apenas a página carregada.
- Usar vocabulário do Help Desk; abrir o chamado de origem somente quando autorizado.

## Questões futuras, fora da primeira versão selecionada

Se o titular retomar gestão ativa, definir então: controles por conta/obra, matriz de papéis e destinatários diretos, eventos obrigatórios/opcionais, horários de silêncio, resumos, supressões, reprocessamento seguro e auditoria das alterações. Não é necessário responder a esses pontos para concluir o recorte de monitoramento escolhido.

Editor de conteúdo de e-mail, envio de teste e resposta por e-mail são capacidades específicas: não considerar que foram selecionadas apenas pela expressão “gestão de e-mails”. O editor já possui referência em AUX-29; entrada por e-mail em AUX-30.
