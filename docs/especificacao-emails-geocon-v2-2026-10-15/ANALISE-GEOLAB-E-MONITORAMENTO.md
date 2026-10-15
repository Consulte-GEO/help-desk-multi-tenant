# GEOLAB: gestão de e-mails e aplicação ao Help Desk

Análise em 15/10/2026, com leitura autenticada do repositório `Consulte-GEO/geolab`. Base remota fixada na main **cf56929875f368e7d2da87f26f5517db4255f991**. Help Desk local conferido em **91ccdf95db44b11a3906a4c39cf070ff5e91f2a5**. Este documento reúne o que foi encontrado e as decisões do titular nesta conversa.

## 1. Resultado e escopo escolhido

O GEOLAB possui uma central de e-mails com três abas — Painel de envios, Tipos de e-mail e Quem recebe — além de preferências pessoais. Há funções de monitoramento e funções que modificam o envio. O titular escolheu começar pelo **monitoramento**, com histórico, filtros, detalhes, fila, falhas, indicadores de entrega, abertura e clique.

Na primeira versão:

- Monitorar somente notificações de chamados enviadas a solicitantes e equipe.
- Dar consulta à equipe dentro das contas, obras e chamados autorizados.
- Mostrar endereço completo para administradores e endereço mascarado para a equipe.
- Ampliar o registro de eventos do Help Desk para aberturas e cliques.
- Registrar essa telemetria a partir da implantação; ausência de evidência anterior é informação indisponível.
- Manter configuração de recebimento centralizada nos administradores Consulte GEO.
- Não incluir preferências individuais ou ações operacionais de reenvio/configuração nesta fase.

As respostas estão preservadas em [PERGUNTAS-E-ESCOPO.md](PERGUNTAS-E-ESCOPO.md) e [DECISOES.json](DECISOES.json). A aprovação da MEL-09 é independente e está no [backlog adicional](DECISOES-E-BACKLOG-ADICIONAL.md).

## 2. O que foi encontrado no GEOLAB

“Encontrado” significa presença no código fixado; não é comprovação de que o recurso está configurado ou aceito em produção. A documentação histórica de frontend inclui itens que já foram implementados e outros que continuam sendo propostas; ela não foi tomada como fotografia isolada do produto.

| Recurso | Evidência e funcionamento encontrados | Aplicação definida para o Help Desk |
|---|---|---|
| Painel central | `EmailLogPage.tsx:92`: abas Painel/Tipos/Quem recebe; atualização periódica de 60 s | Reaproveitar a organização do monitoramento, adaptando ao frontend nativo do Help Desk |
| Histórico pesquisável | `EmailLogPage.tsx:435` em diante; API `emails.ts:174`: destinatário/evento/ID, período, status e paginação no servidor | Selecionado. Acrescentar vínculo ao protocolo/chamado autorizado; pesquisa respeita mascaramento |
| Detalhe do envio | `EmailLogPage.tsx:507` em diante: linha do tempo, origem, ID do provedor, tentativas/motivo, abertura/clique e navegação para o registro | Selecionado. DTO mínimo; endereço e campos técnicos conforme o papel; não expor metadata bruta |
| Funil e taxas | `emails.ts:151`: enviados, entregues, abertos, clicados e falhas via RPC agregada | Selecionado. Definir denominadores e período de cobertura da nova telemetria |
| Saúde por tipo | `emails.ts:164`: totais e desfechos por evento | Selecionado conforme a evidência disponível; não fabricar indicadores de eventos não registrados |
| Fila e falhas | `EmailLogPage.tsx:369` em diante: pendências, tentativas, erros e idade; há ações de reprocessar | Selecionada a consulta. Ações de reprocessar/reenviar ficam fora da primeira versão escolhida |
| Tipos de e-mail | `EmailTiposPage.tsx:43`: catálogo com busca/categoria, ligado/desligado e exceção por laboratório | Encontrado, mas controle não selecionado para esta fase |
| Matriz Quem recebe | `EmailPapeisPage.tsx:54`: linhas por evento e colunas por papel; configuração por laboratório e permissão específica | Encontrado, mas edição não selecionada. É referência para uma fase futura |
| Destinatário direto | `EmailPapeisPage.tsx:45/311`: acesso, contato, comunicados e certos avisos de cliente não seguem a matriz da equipe | Preservar distinção entre público da equipe e destinatário legítimo do chamado |
| Preferências pessoais | `NotificacoesPage.tsx:24`: lista por categoria, interruptor por evento e histórico recente | Não selecionadas inicialmente, conforme resposta específica do titular |
| Supressões | `emails.ts:112`: listagem e RPCs para bloquear/liberar endereço; a tela reserva essa área ao perfil administrativo apropriado | Não incluir edição na primeira versão; mostrar motivo de bloqueio quando existir evidência autorizada |
| Despacho/dry-run/allowlist | `EmailLogPage.tsx:167` em diante: ativação real com confirmação e allowlist | Controles encontrados, não selecionados para a primeira versão. Preservar a coorte atual do Help Desk |
| Horário de silêncio | Migration `20260626211733...:50`: função por pessoa/fuso e exceção para eventos de sistema; tela pessoal lida não oferece editor do horário | Lastro de backend, sem presumir uma jornada completa de configuração. Fora do recorte escolhido |
| Resumos semanais | Migration `20260818162350...`: digests de corpos de prova/laudos, com agendamento de domínio laboratorial | Não transportar eventos de laboratório ao Help Desk. Eventual resumo de chamados exige decisão futura |
| Modelos de conteúdo | Há catálogo/tabela e renderização; o backlog de frontend lista editor como oportunidade, mas as três abas lidas não implementam editor visual de conteúdo | Editor não foi selecionado; sua referência de planejamento continua em AUX-29 |

Os 17 arquivos lidos e seus hashes de blob estão em [FONTES-GEOLAB.json](FONTES-GEOLAB.json). A tabela usa localizadores de início; trechos e numeração pertencem ao SHA fixado.

## 3. Diferença para o Help Desk atual

O Help Desk já possui canal Resend, outbox, intenção durável, autorização de destinatário, templates versionados, recibos e receptor de callback assinado. A nova central deve apresentar e ampliar essa cadeia existente.

Fontes locais relevantes:

- `src/domain/notification-delivery.ts:4`: tipos de evento e estados `pending`, `retry_wait`, `leased`, `sending`, `unknown`, `accepted`, `delivered`, `failed` e `suppressed`.
- `src/application/notification-outbox.ts:10`: roteamento privado não substitui a reautorização do destinatário na hora do envio.
- `src/infrastructure/notification-runtime.ts`: runtime e papel exclusivo para worker/webhook; schemas privados e verificação de contrato.
- `src/integrations/notifications/resend-events.ts:13`: mapa nativo de `email.sent`, `email.delivered`, `email.failed`, `email.bounced` e `email.suppressed`.
- `src/application/resend-delivery-receiver.ts`: correlação e recibo duráveis de eventos verificados.
- `src/http/handler.ts`: não foi identificada uma central administrativa equivalente às três abas do GEOLAB no runtime HTTP lido.

**Lacuna confirmada para a escolha do titular:** `email.opened` e `email.clicked` não fazem parte do mapa atual de desfechos. Eventos assinados sem suporte retornam `outcome=null`; isso não implementa os contadores e a linha do tempo desejados. A entrega precisa incluir registro próprio e consulta de telemetria, além do painel.

Também não se deve apresentar taxas de reclamação ou causas detalhadas de bounce como se estivessem integralmente coletadas: a normalização atual reúne alguns eventos como `failed`. Detalhes adicionais dependem de persistência explícita e autorizada. Sem evidência, a UI informa indisponibilidade.

## 4. Organização proposta do recorte inicial

Esta organização traduz o escopo escolhido em entregas para futura especificação técnica; não altera contratos ou infraestrutura nesta análise.

### MON-01 — Histórico e filtros autorizados

- Consulta por período, status, evento e protocolo/chamado; destinatário conforme a visibilidade do papel.
- Paginação e totais no servidor, independentes da página atual.
- Lista limitada pela autorização atual de conta/obra, inclusive nos filtros, contagens e detalhes.
- Estado vazio diferente de erro, acesso negado ou coleta ainda inexistente.

### MON-02 — Detalhe e diagnóstico do envio

- Exibir a intenção/evento original, vínculo ao chamado permitido e ID do provedor quando necessário ao papel.
- Linha do tempo separando enfileirado, aceito, entregue e falha; estado desconhecido permanece explícito.
- Mensagens de erro compreensíveis e sanitizadas; mostrar orientação, sem botão de reenvio nesta fase.
- DTO de equipe com e-mail mascarado no servidor; não enviar endereço integral para escondê-lo no CSS.
- Não vazar corpo privado, notas internas, credenciais, links de recuperação, headers ou metadata indiscriminada.

### MON-03 — Registro de abertura e clique

- Aceitar somente eventos cuja procedência e assinatura tenham sido verificadas e que possam ser correlacionados a uma notificação do escopo.
- Registrar identidade do evento, horário e vínculo mínimo de forma idempotente.
- Tratar repetição, chegada fora de ordem e evento sem correlação sem produzir contagem duplicada ou associação por dados não confiáveis.
- Preservar o ciclo de entrega: abertura/clique não é confirmação humana de leitura, não resolve ticket e não substitui autorização.
- Não coletar URL completa com parâmetros sensíveis apenas para reproduzir o campo mostrado no GEOLAB; guardar somente o mínimo qualificado.
- Começar na implantação. Linha anterior sem coleta apresenta “não disponível”, não zero nem cálculo retroativo presumido.

### MON-04 — Indicadores e cobertura

- Volumes de fila, aceites, entregas e falhas, idade de pendências e desfechos por tipo.
- Aberturas e cliques com distinção entre mensagens com evento e quantidade de ocorrências, quando ambas forem adotadas no desenho.
- Denominadores de mensagens elegíveis e janela de coleta visíveis; não misturar todo o histórico com o período que possui telemetria.
- Agregados respeitam o mesmo acesso da lista. Nenhum total global é derivado de `.limit(...)` ou da página carregada.

### MON-05 — Consulta da equipe e administração

- Administradores Consulte GEO: consulta dos destinatários completos no escopo autorizado.
- Equipe: consulta com destinatário mascarado e dados mínimos permitidos.
- Qualquer pesquisa, exportação futura e detalhe precisam aplicar essa diferença no backend.
- Configuração continua centralizada; preferências individuais e ações de ligar/desligar, permitir destino, retirar supressão e reprocessar não foram selecionadas.
- Preservar as regras atuais de MFA de operações sensíveis. A aprovação deste escopo não retoma a ativação de MFA que o titular adiou.

## 5. Critérios de aceite que devem acompanhar o desenho

1. Duas contas/obras sem relação não veem linhas, destinatários, detalhes nem contagens uma da outra.
2. Resposta da API para a equipe não contém o e-mail integral nem caminhos alternativos para obtê-lo por erro ou exportação.
3. Callback inválido não altera indicadores; callback repetido não duplica contagem.
4. Evento sem correlação válida não é associado por e-mail, tag, payload livre ou seleção do navegador.
5. `accepted`, `delivered`, `failed` e `unknown` permanecem distintos; telemetria não fabrica prova de entrega.
6. Atualizar a página ou mudar filtros não altera a fila nem envia mensagens.
7. Totais correspondem ao conjunto autorizado e ao período, mesmo com mais registros que o tamanho da página.
8. Data de início da coleta de abertura/clique é explícita; registros anteriores sem evidência mostram indisponibilidade.
9. Mensagens internas, segredos e conteúdo fora da audiência não aparecem no painel, erros ou logs da própria consulta.
10. A nova central não duplica worker/outbox nem muda regras de envio ou click tracking do provedor.

## 6. O que adaptar e o que preservar

- **Isolamento:** GEOLAB usa laboratório como tenant; Help Desk distingue workspace, conta, instância e obras/recursos. O papel de origem não pode ser copiado como autorização.
- **Acesso a dados:** não copiar chamadas diretas do browser para tabelas de domínio do GEOLAB. Usar a fronteira HTTP e os schemas privados do Help Desk.
- **Fila única:** a outbox e os recibos do Help Desk continuam donos do efeito. Não usar o sender, o cron ou a base produtiva do GEOLAB.
- **Medição:** o GEOLAB ainda possui contagem por status limitada a 5.000 linhas em `emails.ts:73` e fila carregada com limite em tela. Isso não deve ser reproduzido como total do Help Desk. O histórico paginado usa outra consulta, com count no servidor.
- **Preferências:** selecionar papel para receber nunca concede acesso ao conteúdo; o envio revalida a autorização atual.
- **Lista permitida:** no GEOLAB, limpar a allowlist pode liberar todos os destinos. Não transportar essa semântica como um botão neutro no piloto do Help Desk.
- **Reprocessamento futuro:** só tentar novamente quando houver evidência de que é seguro; `unknown` exige conciliação com a intenção original. Essa ação não está na primeira versão escolhida.
- **Visual:** adaptar o comportamento ao frontend HTML/JS do Help Desk; não migrar o produto para React para copiar essas telas.

## 7. Relação com o planejamento anterior

- HD-004 já trata da operação de exceções e expansão do piloto de e-mail. MON-01/02 tornam visível parte dessa operação, sem selecionar reprocessamento ou expansão agora.
- HD-028 já trata de indicadores; MON-04 é o recorte específico de e-mails, com cobertura e denominadores próprios.
- AUX-01 preserva preferências/participantes; preferências pessoais foram explicitamente excluídas da primeira versão.
- AUX-29 preserva editor de modelos; ele não foi selecionado nesta fase.
- AUX-30 preserva entrada por e-mail; responder a um aviso e criar mensagem no chamado é outro fluxo, não implicado pelo monitoramento.
- MEL-09 foi aprovada como melhoria de rastreabilidade de orientação. Não confundir essa aprovação com envio automático de correções por e-mail.

## 8. Fontes e limites

As fontes primárias são os arquivos do [GEOLAB no SHA fixado](https://github.com/Consulte-GEO/geolab/tree/cf56929875f368e7d2da87f26f5517db4255f991), os arquivos locais indicados do Help Desk e as respostas humanas desta conversa. O inventário de fontes inclui caminho, hash de blob e URL fixa. A análise histórica de 13/10 foi usada para localizar componentes, sendo substituída pela leitura remota atual nos pontos aqui descritos.

Foram lidas telas, APIs, funções de recibo, migrations pertinentes e backlog de frontend; não foi executado build, suíte de produto, consulta a dados reais, envio de e-mail ou alteração de serviço. A inspeção do repositório comprova o código encontrado, não o estado operacional das contas GEOLAB/Resend/Supabase. A próxima implementação deve reinspecionar seu HEAD e a configuração real pertinentes, sem herdar segredos ou evidências de outro SHA.
