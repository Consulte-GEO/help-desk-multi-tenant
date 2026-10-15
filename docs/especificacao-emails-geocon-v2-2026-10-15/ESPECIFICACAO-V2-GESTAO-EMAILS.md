# Gestão de e mails do Help Desk

Especificação V2 para desenvolvimento e handoff ao Claude. Revisão de 15/10/2026. O monitoramento passa a usar a apresentação do modal de entrega do broadcast do GEOCON: indicadores por comunicação, explicação dos sinais e tabela por destinatário. As escolhas humanas anteriores continuam válidas. A implementação do produto é uma etapa posterior.

## 1 Objetivo e limites da primeira versão

A equipe precisa saber quais notificações de um chamado entraram na fila, foram aceitas pelo provedor, tiveram entrega confirmada, apresentaram falha ou produziram sinais de abertura e clique. A tela deve permitir localizar uma comunicação e investigar cada destinatário sem alterar seu envio.

Entram histórico, filtros, detalhes, consulta da fila, falhas e indicadores das notificações de chamados para solicitantes e equipe. Administradores Consulte GEO veem endereços completos no escopo autorizado; equipe vê endereços mascarados pelo servidor. Aberturas e cliques são registrados daqui para frente. Histórico anterior sem evidência apresenta indisponibilidade.

Não entram criação de broadcasts, campanhas, redação ou disparo manual, reenvio, reprocessamento, cancelamento de fila, edição de templates, matriz de recebimento, preferências individuais, remoção de supressão, exportação, mensagens de autenticação ou ciência obrigatória. A configuração de recebimento permanece centralizada na Consulte GEO. A tela de monitoramento não concede novas permissões de administração.

MEL-09 permanece aprovada como rastreabilidade de orientações depois corrigidas. As outras 13 propostas permanecem pendentes. A nova referência visual não amplia essa aprovação.

## 2 Referências e precedência

As decisões literais estão em [DECISOES.json](DECISOES.json). Esta V2 substitui a organização visual e detalha as entregas MON-01 a MON-05 da análise anterior do GEOLAB. O GEOLAB continua como referência de histórico, filtros e diagnóstico; o GEOCON passa a orientar a apresentação da entrega.

A referência de código é [Consulte-GEO/geocon no commit 61bc639](https://github.com/Consulte-GEO/geocon/tree/61bc63935d5e84cebadfe080cee2317467b8171d). A comparação está em [ANALISE-REFERENCIA-GEOCON.md](ANALISE-REFERENCIA-GEOCON.md). O Help Desk foi conferido no commit `91ccdf95db44b11a3906a4c39cf070ff5e91f2a5`; quem implementar deve atualizar a inspeção antes de mudar contratos.

As regras de cálculo abaixo são adaptações para o Help Desk. Algumas diferem do GEOCON para preservar evidências, autorização e a fila existente. O protótipo [PROTOTIPO-ENTREGA-EMAIL.html](PROTOTIPO-ENTREGA-EMAIL.html) usa dados fictícios e demonstra a apresentação, sem simular uma integração operacional.

## 3 Navegação e unidade de consulta

### EMV2-01 Lista de comunicações

Entrada sugerida no menu da equipe: **E-mails**, título **Comunicações por e-mail**. A posição e a rota final devem seguir o shell nativo existente. Não copiar o menu completo de administração do GEOCON.

Cada linha representa uma comunicação lógica originada por um evento de chamado, com o contexto e a audiência de envio preservados. Mostrar protocolo, assunto seguro, tipo de notificação, data do evento, quantidade de destinatários autorizados, resumo de entrega e ação **Ver entrega**. Se o evento não produzir assunto autorizado para o perfil, usar um título neutro do tipo de notificação.

A chave lógica deve aproveitar a identidade durável do evento e o contexto do Help Desk: workspace, conta, chamado e canal. Não agrupar todas as mensagens de um chamado em uma única entrega. Não misturar eventos públicos e internos porque têm o mesmo assunto, horário, protocolo ou endereço. O agrupamento é uma projeção de consulta das intenções existentes; não cria uma segunda fila nem altera suas chaves de idempotência.

Uma mesma intenção por destinatário e canal ocupa uma linha no modal. Tentativas de entrega pertencem ao detalhe dessa linha. Nova tentativa não aumenta o denominador. Se houver nova comunicação autorizada, ela tem identidade própria, mesmo quando o texto é idêntico. Não deduplicar pessoas pelo texto do e-mail em detrimento das identidades reais já persistidas.

### EMV2-02 Filtros e consultas operacionais

Filtros: período do evento, protocolo/chamado, tipo de notificação, conta/obra autorizada, estado de entrega e necessidade de atenção. Datas usam o fuso informado na interface; o intervalo enviado ao backend é definido sem ambiguidades. A ordenação padrão é por evento mais recente e identidade estável como desempate.

Oferecer atalhos de consulta **Histórico**, **Fila** e **Falhas e atenção**, reutilizando a mesma fonte. Fila inclui `pending`, `retry_wait`, `leased` e `sending`; `unknown` aparece destacado em atenção, sem ser apresentado como falha definitivamente segura para reenviar. Falhas inclui `failed` e `suppressed`, com motivo qualificado quando disponível.

Pesquisa por destinatário completo fica restrita ao administrador autorizado. Para equipe, não oferecer busca por texto arbitrário de endereço completo, autocomplete ou resposta que funcione como teste de existência de destinatário. A equipe pode filtrar por identidade de participante já autorizada ou pelo identificador seguro exibido. Os filtros não ampliam acesso.

Paginação, total de comunicações, total de destinatários e indicadores são calculados no servidor sobre o conjunto autorizado. Um limite técnico ou uma página de 25/50 linhas nunca vira o total global. Cursores preservam precisão temporal e desempate do projeto. Uma mudança de filtro cancela a consulta anterior e descarta respostas atrasadas.

## 4 Modal de entrega inspirado no GEOCON

### EMV2-03 Estrutura e comportamento

Ao acionar **Ver entrega**, abrir diálogo **Entrega do e-mail**, com subtítulo composto por protocolo, assunto autorizado e tipo do evento. Exibir também data da comunicação e última atualização, sem poluir o título.

Desktop: largura máxima aproximada de 768 px, cantos arredondados, fundo branco e sobreposição escurecida. Cabeçalho e rodapé permanecem visíveis; corpo tem rolagem interna quando necessário. Ações de fechamento: X com nome acessível, botão **Fechar** e Escape. O clique no fundo não precisa fechar o diálogo. A interação não altera o envio.

Ordem do conteúdo:

1. Quatro cartões principais: **Saiu**, **Entregue**, **Aberto*** e **Clicou**.
2. Resumo de fila/falha/atenção quando houver ocorrências ou acesso pelo atalho correspondente.
3. Bloco azul **Como interpretar os sinais**.
4. Indicação de cobertura e de horário/fuso.
5. Tabela paginada de destinatários, com cabeçalho fixo e área de rolagem de aproximadamente 320 px em desktop.
6. Rodapé com Fechar; paginação pode ficar imediatamente abaixo da tabela.

Usar três colunas de cartões em telas largas, mantendo Clicou na segunda linha como a referência; duas colunas no celular quando couber. Os quatro cartões principais permanecem visíveis mesmo quando o valor é zero ou indisponível. Cores e ícones ajudam a leitura, mas rótulo e texto sempre comunicam o significado.

### EMV2-04 Tabela por destinatário

| Coluna | Conteúdo e regra |
|---|---|
| Destinatário | Endereço completo autorizado para admin; máscara enviada pelo backend para equipe. Um identificador opaco distingue linhas com máscaras iguais. |
| Status | Badge de diagnóstico conforme a prioridade da seção 6. Não depender apenas de verde/vermelho. |
| Enviado | Momento da aceitação comprovada pelo provedor, não a criação da intenção nem o início da tentativa. |
| Entregue | Primeira entrega confirmada registrada, se houver. |
| Aberto* | Primeiro evento de abertura registrado, com ressalva de medição aproximada. |
| Clicou | Primeiro evento de clique registrado, sem afirmar identidade humana. |

Datas usam `dd/MM/aaaa HH:mm`, com fuso **America/Sao_Paulo** explícito na tabela ou legenda. O detalhe pode mostrar segundos; a persistência e os cursores preservam a precisão original. Não inferir sequência causal por coincidência visual de minutos.

Usar **—** para evento não observado em uma coleta aplicável; usar **N/D** com motivo para informação não coletada, sem suporte histórico ou indisponível. O texto acessível deve distinguir os dois. Uma linha histórica pode ter Enviado e Entregue conhecidos, com Aberto* e Clicou indisponíveis.

Ação de detalhe por destinatário deve ser explícita, por exemplo no identificador ou botão **Detalhes** acessível. Não tornar o e-mail um `mailto:` para a equipe. O backend não devolve o endereço integral em atributos, títulos, URLs ou mensagens de erro para esse perfil.

### EMV2-05 Texto dos sinais

Texto de produto proposto para o bloco explicativo:

- **Saiu:** o provedor aceitou o envio. Isso ainda não confirma a entrega.
- **Entregue:** o provedor informou a entrega ao servidor de destino. Isso não garante caixa de entrada nem leitura.
- **Aberto*:** sinal aproximado de carregamento de imagem. Proteções de privacidade e bloqueio de imagens podem distorcer a medição.
- **Clicou:** foi registrado acesso a um link rastreado. Esse sinal não identifica, por si só, a pessoa que clicou.

Acrescentar: **Abertura e clique não equivalem a ciência, aceite ou confirmação de leitura.** O recurso não introduz ação de ciência, assinatura ou aceite do chamado. Não copiar a afirmação da imagem de que clique é imune a falsos positivos ou de que entrega garante a caixa do destinatário.

O uso de pixel e redirecionamento para medição é explicado pelo [Resend sobre abertura e clique](https://resend.com/blog/open-and-click-tracking). A existência de eventos de entrega, abertura e clique via webhook consta na [documentação de webhooks](https://resend.com/docs/webhooks/introduction). O painel do Help Desk deve descrever o sinal observado, sem transformá-lo em prova humana.

## 5 Indicadores e denominadores

### EMV2-06 Contagem por intenção

Considere `N` o número de intenções de destinatários autorizadas naquela comunicação, sem multiplicar tentativas, callbacks ou ocorrências repetidas. O backend retorna o mesmo universo para cartões, tabela e total. Se o perfil só pode ver parte dos destinatários, o denominador representa essa parte; não revelar o total oculto nem avisar quantos foram ocultados.

| Cartão | Numerador | Denominador e ressalva |
|---|---|---|
| Saiu | Intenções com aceitação persistida do provedor ou evento verificado `email.sent` | N; se a cobertura de aceitação for desconhecida, declarar cobertura parcial em vez de preencher ausência histórica com zero |
| Entregue | Intenções com evidência persistida de entrega confirmada | N, com cobertura declarada; abertura/clique não criam essa evidência |
| Aberto* | Intenções elegíveis com pelo menos um `email.opened` verificado | Quantidade E de intenções com coleta de abertura aplicável e íntegra |
| Clicou | Intenções elegíveis com pelo menos um `email.clicked` verificado | Quantidade E de intenções com coleta de clique aplicável e íntegra |

Na coorte nova integralmente acompanhada, E = N e a apresentação coincide com `15 / 27` da imagem. Em conjunto misto, mostrar `2 / 4 com coleta`, acompanhado de **Cobertura: 4 de 6 destinatários**. Se E = 0, mostrar **N/D**, sem apresentar `0 / N`. Abertura e clique podem ter elegibilidades diferentes; o contrato suporta cobertura separada para cada sinal.

Os quatro indicadores se sobrepõem. Não somar Saiu + Entregue + Aberto* + Clicou para obter o total. Eles também não precisam formar um funil estritamente decrescente: um clique pode chegar antes do callback de entrega ou sem callback de abertura. A UI conserva essa lacuna em vez de inventar eventos.

Não contar cliques repetidos como novos destinatários. Contagem de ocorrências, se útil ao diagnóstico, é separada e rotulada no detalhe; não é requisito de gráfico adicional da primeira versão. Esta V2 define contagens por comunicação e por tipo, sem criar metas ou ranking de produtividade individual.

### EMV2-07 Fila e falhas

Mostrar quantidades de **Na fila**, **Em envio**, **Falhou**, **Suprimido** e **Requer atenção**, quando presentes, com estado e motivo próprios. Pendência aguardando retry não é Pulado; desconhecido não é Falhou; suprimido não implica necessariamente que chegou ao provedor.

Idade de pendência é calculada pelo servidor a partir do marco persistido apropriado. Se `nextAttemptAt` existir, exibir como previsão do agendador atual, sem prometer entrega naquele horário. Sem horário conhecido, usar **Sem previsão registrada**. Não inventar causa detalhada de bounce/reclamação se a cadeia atual só normalizou `failed`.

No histórico e no resumo por tipo, os indicadores seguem o filtro e a data do evento da comunicação. O detalhe apresenta eventos posteriores até `asOf`. Deixar explícito que se trata da situação atual de comunicações originadas no período, evitando misturar contagem por data de abertura com contagem por data de envio.

## 6 Estado de entrega e engajamento

### EMV2-08 Separação dos eixos

Preservar a máquina de estados existente: `pending`, `retry_wait`, `leased`, `sending`, `unknown`, `accepted`, `delivered`, `failed`, `suppressed`. Abertura e clique são fatos adicionais; não adicionar `opened`/`clicked` como substitutos obrigatórios do estado operacional.

Prioridade de apresentação do badge principal:

1. Inconsistência/correlação em atenção ou `unknown`: **Requer atenção** / **Resultado desconhecido**.
2. `failed` ou `suppressed`: **Falhou** / **Suprimido**, mesmo com engajamento anterior.
3. Entrega confirmada sem conflito: **Clicou**, depois **Aberto***, depois **Entregue**, conforme fatos existentes.
4. Aceite confirmado sem entrega: **Saiu**. Se houver clique/abertura, mostrar sinal complementar sem inferir entrega.
5. Demais estados: **Na fila**, **Aguardando nova tentativa** ou **Em envio** conforme o estado real.

O detalhe sempre mostra o estado operacional e os sinais separados. A existência de clique com estado ainda desconhecido continua chamando atenção. Uma falha posterior não apaga datas verdadeiras anteriores; eventos fora de ordem não regridem silenciosamente a projeção. A regra de reconciliação atual continua responsável pela entrega.

### EMV2-09 Linha do tempo de diagnóstico

Ao abrir uma linha, apresentar intenção e evento originais, tipo, protocolo autorizado, enfileiramento, tentativas, aceite, entrega, falha, abertura e clique com os dados existentes. Distinguir **ocorreu em** do instante em que o sistema recebeu o callback.

Erros têm código e descrição sanitizada; orientações podem pedir análise de configuração ou conciliação, sem botão de correção nesta fase. Não exibir corpo bruto do webhook, headers, segredo, token, URL assinada, conteúdo de nota interna ou HTML integral de e-mail. Exibir versão/hash de template e ID do provedor somente conforme permissão de diagnóstico, por padrão administrativa. À equipe, oferecer referência opaca de atendimento e informação suficiente para compreender o estado.

## 7 Ampliação do registro de eventos

### EMV2-10 Procedência e correlação

Ampliar o receptor Resend existente para reconhecer `email.opened` e `email.clicked`, preservando verificação de assinatura sobre os bytes originais, validade temporal, identidade do evento, hash e correlação durável pelo envio conhecido. Não aceitar telemetria criada pelo browser.

Hoje `resend-events.ts` admite eventos assinados sem desfecho como `outcome=null`; isso não conserva, por si só, o tipo e a projeção necessários para esta tela. O novo contrato deve carregar um discriminante verificado de telemetria ou de entrega e preservar a marca de procedência. O adaptador deve distinguir evento sem suporte de evento de engajamento suportado sem desfecho de entrega.

O mesmo provedor pode atender outros sistemas. Um callback com assinatura válida não autoriza associação a qualquer ticket. Só projetar eventos correlacionados a uma intenção Help Desk de canal e escopo reconhecidos. Eventos desconhecidos ou sem correlação seguem o fluxo durável de pendência/atenção, sem associação por endereço, assunto, tags livres ou escolha de usuário.

Não implantar um segundo pixel/redirect próprio para reproduzir a referência. No GEOCON, essa alternativa está marcada como dormente e o código indica o webhook do provedor como fonte atual. O click tracking do provedor permanece habilitado conforme a decisão já tomada; a implementação não altera configurações compartilhadas de outros sistemas.

### EMV2-11 Persistência e idempotência

Persistir, no schema privado e com acesso restrito, vínculo da intenção/envio, identidade e hash do evento do provedor, tipo qualificado, instante do evento e instante de recebimento. Tratar uma repetição com mesma identidade e conteúdo como no-op. Mesma identidade com conteúdo incompatível exige atenção; não sobrescrever silenciosamente o recibo anterior.

A atualização da projeção e seu recibo devem ser atômicos conforme as práticas do projeto. Entrega e engajamento não podem competir gravando versões incompatíveis do mesmo registro. Eventos distintos fora de ordem conservam a cronologia; primeiro evento é o menor instante qualificado conhecido, sem reescrever o histórico bruto.

Não armazenar URL completa de clique com parâmetros sensíveis, IP, user agent ou payload bruto apenas para copiar o GEOCON. A primeira versão precisa do fato de clique, identidade do evento e vínculo, não do histórico de navegação. Se a recepção exige ler campos adicionais, eles são descartados antes da persistência e não entram em logs de erro.

### EMV2-12 Cobertura a partir da implantação

Registrar início de coleta, elegibilidade por sinal e eventuais lacunas conhecidas de operação. Não usar a simples presença de uma coluna nova como prova de coleta histórica. Notificações anteriores sem evidência continuam N/D. Se houver evidência histórica já legítima, exibi-la com sua origem; não executar backfill ou buscar histórico retroativo no provedor nesta fase.

Um evento recebido depois da implantação, mas referente a envio anterior, não transforma toda a coorte antiga em plenamente acompanhada. A projeção pode registrar o fato observado, mantendo o motivo de cobertura parcial. O contrato deve separar **fato observado** e **cobertura para taxa**. Com cobertura desconhecida, não publicar taxa aparentemente completa; mostrar os fatos conhecidos e sua limitação.

Para envio novo, se não for possível atestar que a coleta estava habilitada, mostrar **Coleta não confirmada**. A ausência de callback não prova falta de abertura. A aprovação de aberturas/cliques exige registrar e testar esses eventos; apenas desenhar os cartões não conclui a entrega.

## 8 Contratos de consulta e autorização

### EMV2-13 Fronteira HTTP e dados mínimos

Implementar consultas autenticadas pela fronteira HTTP nativa. Nomes de rotas, capacidades e migrations serão definidos no plano técnico após reinspeção; os nomes abaixo são contratos conceituais, não endpoints disponíveis hoje.

| Consulta | Entrada | Saída mínima |
|---|---|---|
| Coleção de comunicações | Filtros validados, cursor e tamanho limitado | Linhas autorizadas, próximo cursor, totais do filtro, cobertura e `asOf` |
| Entrega da comunicação | Identidade opaca do grupo, cursor de destinatários | Metadados seguros, cartões, cobertura por sinal, página de destinatários, total e `asOf` |
| Detalhe do destinatário | Identidade do grupo e da intenção | Estado operacional, sinais, tentativas e linha do tempo autorizados |

O DTO de destinatário inclui identidade opaca, `recipientDisplay`, classificação da visibilidade, estado operacional, badge, datas conhecidas, cobertura e motivo seguro. Não é necessário enviar campos integrais e mascarados juntos. O servidor decide qual projeção o perfil recebe. Atributos e links de chamado só existem quando autorizados.

`null` sozinho não diferencia coleta ausente de evento ainda não observado. Para cada sinal, devolver disponibilidade como `observed`, `not_observed`, `not_collected` ou `unavailable`, com motivo qualificado quando necessário. Contrato real pode adotar os nomes do projeto, preservando essas quatro situações. Erro de consulta é estado de transporte separado, não uma resposta de indicadores vazios.

### EMV2-14 Escopo e privacidade

Revalidar workspace, conta, obra/recurso, chamado e audiência em cada consulta. Ser admin da Consulte GEO permite a projeção completa dentro do acesso efetivo; não remove limites contratuais nem torna todo evento interno público. Solicitantes não recebem automaticamente acesso a esta central da equipe.

Aplicar autorização antes de agrupamentos e contagens. Se não houver permissão para determinada comunicação, lista, detalhe e cursores não revelam sua existência. Preservar a convenção do produto para respostas de recurso não encontrado/negado. Não informar total global não autorizado junto de linhas filtradas.

Para equipe, máscara padrão proposta: primeira letra do local + `***@` + domínio mascarado, por exemplo `a***@e***.org`. Não usar tamanho real do nome como quantidade de asteriscos; não incluir endereço completo em resposta, DOM, log, tooltip, busca ou mensagem de erro. O identificador opaco da linha permite desambiguar. Esta regra de máscara é detalhamento desta V2 e deve ser aplicada de forma uniforme no backend.

Não persistir os dados do painel no localStorage, em cache compartilhado ou no service worker. Respostas privadas seguem os cabeçalhos de cache e o transporte de sessão adotados pelo Help Desk. Uma troca de identidade/workspace ou revogação limpa imediatamente linhas, detalhes, cartões e requisições pendentes.

## 9 Atualização e estados de interface

### EMV2-15 Atualização sem efeitos de negócio

Usar a cadência de referência de 15 segundos enquanto a tela/modal está visível, sem consultas sobrepostas. Ao ocultar aba, fechar diálogo ou trocar contexto, suspender/cancelar a consulta correspondente. Retomar com leitura atual ao voltar. Manter o transporte de sessão existente e descartar respostas de um contexto anterior, inclusive se a chamada não puder ser abortada a tempo.

Resumo e página devem refletir a mesma leitura coerente (`asOf` e contexto), evitando misturar indicadores novos com linhas de outro filtro. Paginação pode avançar usando snapshot/cursor qualificado ou reiniciar a coleção se ela não puder ser reconciliada com segurança. O servidor continua dono do relógio e do total.

Não reiniciar o diálogo, mover foco ou alterar posição de rolagem a cada atualização. Se houver erro transitório no mesmo contexto ainda autorizado, identificar **Não foi possível atualizar** e a data da última leitura; números antigos não recebem aparência de atualização bem sucedida. Falha de sessão/acesso limpa os dados. Atualizar, pesquisar ou abrir o modal nunca envia e-mail nem reprocessa intenção.

### EMV2-16 Estados vazios e indisponibilidade

| Situação | Apresentação |
|---|---|
| Consulta inicial em andamento | Esqueleto/indicador com nome acessível; não apresentar zeros provisórios |
| Nenhuma comunicação no filtro | Nenhuma comunicação encontrada; permitir ajustar filtros |
| Grupo sem registros de envio | Sem dados de entrega; informar que não há registros por destinatário, sem inventar total |
| Histórico sem coleta de abertura/clique | N/D com motivo e cobertura; manter os dados de envio conhecidos |
| Coleta parcial/interrompida conhecida | Aviso de cobertura parcial; fatos conhecidos separados das taxas |
| Erro de leitura | Mensagem de erro e ação de tentar consultar novamente; não confundir com fila vazia |
| Revogação ou sessão encerrada | Limpeza dos dados e fluxo nativo de sessão/acesso |

### EMV2-17 Responsividade e acessibilidade

Implementar no HTML/JS nativo, com diálogo acessível, foco inicial previsível, foco contido, Escape, nome/descrição e retorno de foco ao acionador. Se o acionador deixar de existir, devolver foco a um ponto seguro da lista. Conteúdo de fundo fica inerte durante o modal.

No celular, limitar o diálogo à altura útil, permitir rolagem do corpo e da tabela sem cortar o fechamento. Tabela pode rolar horizontalmente, com indicação e cabeçalhos semânticos; manter destinatário/status legíveis. Não reduzir fonte até tornar datas ilegíveis. Verificar zoom de 200%, teclado, foco visível, contraste e largura de 360 px. Atualizações periódicas não devem anunciar toda a tabela a leitores de tela; avisos relevantes usam região de status discreta.

## 10 Implementação e entrega ao Claude

### EMV2-18 Sequência de desenvolvimento

| Entrega anterior | Detalhamento V2 | Evidência exigida antes de concluir |
|---|---|---|
| MON-03 | EMV2-10 a EMV2-12 | Evento assinado de abertura/clique registrado e correlacionado; duplicado/fora de ordem/inválido cobertos; nenhuma regressão de entrega |
| MON-05 | EMV2-13 e EMV2-14 | Contratos e testes de autorização/máscara no servidor, incluindo contagens e campos técnicos |
| MON-01 | EMV2-01 e EMV2-02 | Histórico por comunicação, filtros, paginação e totais completos |
| MON-04 | EMV2-06 e EMV2-07 | Agregados corretos e cobertura conhecida/parcial/antiga sem taxas enganosas |
| MON-02 | EMV2-03 a EMV2-05, EMV2-08 e EMV2-09 | Modal GEOCON adaptado, tabela por destinatário e detalhe seguro |
| Transversal | EMV2-15 a EMV2-19 | Atualização, estados, acessibilidade, regressões e registro de implantação |

Começar pela extensão de telemetria e pelo modelo de consulta, depois compor a interface. Um protótipo com números fictícios serve para revisão visual; não pode virar fallback de produção. Dimensionar índices e paginação a partir das consultas reais e avaliar retenção/custo antes de introduzir uma nova tabela de eventos.

O handoff operacional está em [HANDOFF-CLAUDE.md](HANDOFF-CLAUDE.md). O colega deve receber o repositório, o handoff geral e este pacote. A conta Claude terá seus próprios acessos; não transferir tokens, sessões de browser, cookies, segredos ou arquivos `.env` do Codex.

### EMV2-19 Verificação e publicação

Executar os cenários de [CHECKLIST-ACEITE.md](CHECKLIST-ACEITE.md), os checks exigidos pelo AGENTS.md vigente e as regressões do fluxo de notificações. SQL deve ser testado com papel restrito em PostgreSQL descartável; mocks não comprovam isolamento. Verificar o frontend no navegador com dados sintéticos e depois realizar apenas o aceite real autorizado.

Não repetir bootstrap, cadastros do piloto, publicação de fila ou migrations já aplicadas. Não alterar os chamados reais CG-10001/CG-10002 como fixtures. Preservar templates e routing publicados, o worker e o receptor atuais, gates, allowlist/coorte de piloto, regras de MFA e os adiamentos do Novo GEO. A implantação da extensão e o início efetivo da coleta devem ter evidência própria, distinta do arquivo de especificação.

Registrar commit, contrato/schema, checks executados, mudanças reais de infraestrutura, instante de início da coleta e limitações remanescentes. Não declarar aberturas/cliques aceitos em produção só porque o endpoint respondeu ou o cartão apareceu. O monitoramento só se conclui quando fonte, projeção, autorização e apresentação foram verificadas em conjunto.
