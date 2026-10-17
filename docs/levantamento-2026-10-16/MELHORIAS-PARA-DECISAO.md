# Melhorias adicionais e decisão vigente

**MEL-09 foi aprovada e está no backlog. As outras13 propostas aguardam decisão.** Não confundir IDs MEL com Mxx/WUX da Wiki, já entregues em seu próprio escopo. Referência completa original: [lista de propostas](../melhorias-para-aprovacao-2026-10-15/LISTA-PARA-APROVACAO.md); o JSON atual preserva escopo, benefícios e critérios sem alterar a decisão das demais.

## MEL-01 — Usar um pedido anterior como base

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Criar uma nova solicitação a partir de outra autorizada e concluída, copiando apenas campos permitidos e exigindo revisão.

**Critério:** Beneficiário, permissões, aprovações e execução anterior não são herdados. Mudança de versão ou revogação de acesso impede cópia indevida. Repetir o envio não cria dois chamados; uma nova solicitação não é confundida com retry do original.

**Cuidado:** Não copiar anexos ou valores privados indiscriminadamente. Não contornar consultas ou aprovações necessárias.

## MEL-02 — Avisar quando dois analistas atuam no mesmo chamado

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Presença temporária de analistas autorizados e aviso de atualização antes do envio, sem bloquear o atendimento.

**Critério:** Presença de pessoa sem acesso não é exibida nem concede acesso. Indicador expirado desaparece e não impede atendimento. CAS continua obrigatório mesmo quando não há presença visível.

**Cuidado:** Não transmitir conteúdo de digitação, nem criar uma trava exclusiva que abandone o ticket bloqueado.

## MEL-03 — Transferir responsabilidade com aceite de quem assume

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Transferência em duas etapas, com aceite, recusa e prazo para resposta; até a conclusão, o responsável continua explícito.

**Critério:** Recusa ou silêncio não deixa o chamado sem responsável identificado. Assumir não cria acesso a novas contas ou obras. Transferência não descarta operações com resultado ainda desconhecido nem seus recibos.

**Cuidado:** Oferecer exceção operacional auditada para indisponibilidade, evitando tornar a passagem uma barreira ao atendimento.

## MEL-04 — Revisar a qualidade do atendimento por amostra

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Ficha interna de revisão com critérios versionados, justificativa, possibilidade de contestação e alinhamento entre revisores.

**Critério:** Cada avaliação aponta evidência e versão do critério utilizado. Casos difíceis não são excluídos para melhorar artificialmente o resultado. Divergências podem ser revistas; feedback não vira ranking automático de pessoas.

**Cuidado:** Começar sem pontuação automática por IA e sem monitoramento invasivo de funcionários.

## MEL-05 — Investigar causa raiz e verificar ações preventivas

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Registro leve de investigação após restauração: linha do tempo, hipóteses, causa confirmada, ações e avaliação da eficácia.

**Critério:** Restaurar serviço não fecha automaticamente a investigação. Uma hipótese nunca aparece como causa comprovada. Ação concluída é distinta de ação eficaz; resultados negativos também são registrados.

**Cuidado:** Manter análise interna separada de comunicação pública e preservar dados privados dos clientes.

## MEL-06 — Alertar antes de enviar possíveis senhas ou tokens

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Detecção delimitada de padrões de alto risco no texto livre, com indicação do trecho e decisão explícita do autor.

**Critério:** CNPJ, e-mail e dados técnicos legitimamente solicitados não são bloqueados em massa. O trecho sensível não aparece em logs ou indicadores do detector. O texto só muda pela ação consciente do autor; histórico e snapshots permanecem íntegros.

**Cuidado:** É uma camada preventiva, não prova de que todo segredo será detectado nem constatação de vulnerabilidade atual. Não promete recuperar e-mails já enviados.

## MEL-07 — Dar tratamento às avaliações negativas

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Pendência interna deduplicada pelo recibo da avaliação, com responsável, motivo, ação e encerramento.

**Critério:** Repetição do mesmo recibo não duplica a pendência. Nota baixa não reabre chamado nem envia mensagem automaticamente. Posse do convite não é tratada como prova da identidade de quem respondeu.

**Cuidado:** O recibo atual usa invitation_possession. Contato externo exige decisão e público legítimos, sem pressionar o cliente a mudar sua avaliação.

## MEL-08 — Qualificar a acessibilidade das jornadas completas

**Decisão:** Pendente. **Esforço relativo preliminar:** L.

Meta WCAG 2.2 AA, inventário de critérios aplicáveis e avaliação de processos completos com tecnologia assistiva.

**Critério:** Erros e mudanças de estado são identificáveis sem depender só de cor. Diálogos e foco permitem completar o fluxo sem mouse. Uma varredura automática isolada não é apresentada como conformidade integral.

**Cuidado:** Não remover MFA, CAPTCHA ou autorização para facilitar o teste. A proposta não presume uma conclusão jurídica sobre obrigação aplicável.

## MEL-09 — Localizar quem recebeu uma orientação depois corrigida

**Decisão:** Incluir — aprovado pelo usuário. **Esforço relativo preliminar:** L.

Rastrear versão de artigo/macro usada em cada orientação e abrir revisão dos usos afetados após retirada ou substituição.

**Critério:** Mensagem e artigo históricos não são reescritos silenciosamente. Destinatários são reautorizados antes de eventual correção. Não há envio em massa automático nem promessa de detectar todos os textos colados manualmente.

**Cuidado:** Uma mudança editorial comum não implica que todos os atendimentos antigos estavam errados; exigir motivo e impacto para iniciar a revisão.

## MEL-10 — Agendar atendimento dentro do chamado

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Compromisso futuro entre solicitante e analista, com horário, fuso, duração, objetivo e estados próprios.

**Critério:** Remarcação preserva o histórico e invalida o horário anterior. Agendamento não pausa nem reinicia SLA por si só. Sem integração com agenda externa, a interface não promete conhecer todos os compromissos do participante.

**Cuidado:** Não criar videoconferência, acesso remoto ou gravação automática como parte implícita do pedido.

## MEL-11 — Coordenar janelas de mudanças e períodos de bloqueio

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Janela acordada, serviços afetados, condições de início/interrupção e períodos de congelamento, em visão conjunta.

**Critério:** Janela vencida ou condição alterada exige reavaliação. Conflito temporal fica visível sem conceder autorização de execução. Aprovação da janela não substitui MFA, aprovação da revisão exata ou gates existentes.

**Cuidado:** Não inferir regras de segurança de engenharia a partir da wiki ainda não validada. Não reativar comandos perigosos por existir uma janela.

## MEL-12 — Sugerir responsável por habilidade, disponibilidade e carga

**Decisão:** Pendente. **Esforço relativo preliminar:** L.

Combinar habilidades e disponibilidade declaradas com limite de trabalho em andamento; iniciar com recomendação e confirmação humana.

**Critério:** Sem cobertura, indisponível ou com limite de trabalho atingido não é sugerido. Na ausência de candidato elegível, o chamado permanece visível na fila para triagem manual. A sugestão não cria grant nem atribui automaticamente sem o escopo aprovado.

**Cuidado:** Dados desatualizados podem piorar o resultado. Não inferir habilidade a partir de dados pessoais ou usar cliques como capacidade.

## MEL-13 — Medir onde a abertura de chamados encontra obstáculos

**Decisão:** Pendente. **Esforço relativo preliminar:** M.

Funil agregado de seleção de serviço, preenchimento, erro de validação, rascunho, tentativa e abertura confirmada.

**Critério:** Não registrar resposta, tecla, captura de tela, token nem reprodução de sessão. Eventos repetidos não inflacionam a contagem de aberturas. Interrupção ou abandono não é rotulado automaticamente como insatisfação.

**Cuidado:** Não acrescentar rastreamento externo como dependência. Evitar instrumentação extensa para um piloto sem volume.

## MEL-14 — Simular demanda e capacidade futura da equipe

**Decisão:** Pendente. **Esforço relativo preliminar:** L.

Planejamento futuro da capacidade humana, com premissas visíveis e incerteza, separado da capacidade técnica do sistema.

**Critério:** Premissas e intervalos ficam separados dos dados observados. Ausência de histórico produz limitação explícita, não números fictícios. Nenhuma escala, SLA ou atribuição é alterada pela simulação.

**Cuidado:** Prioridade posterior enquanto o piloto não oferecer dados. Não usar o modelo para pontuar produtividade individual.


