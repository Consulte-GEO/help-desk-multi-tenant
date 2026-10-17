# Melhorias adicionais — lista para aprovação

Preparado em **15/10/2026**. **14 propostas, todas pendentes de decisão.** Esta lista não altera as 49 tarefas, os 32 grupos complementares ou os 107 RF do handoff anterior. A aprovação pedida é para **inclusão no planejamento**, não para execução ou publicação imediata.

“Capacidade adicional” indica um fluxo não localizado explicitamente nas fontes comparadas. “Ampliação de escopo” indica um incremento específico sobre tema já previsto. Não são alegações de que todo o código necessário está ausente.

**Minha sugestão é avaliar primeiro MEL-01, MEL-03, MEL-04, MEL-06 e MEL-08.** MEL-02 ganha relevância quando houver analistas simultâneos; MEL-07 depende do CSAT; MEL-09 da publicação de conhecimento; MEL-12 e MEL-14 de equipe/dados que justifiquem o investimento. A ordem é uma recomendação, não uma decisão tomada.

Esforço relativo: **M** = mais de uma camada ou jornada; **L** = frente transversal ou qualificação extensa. São estimativas preliminares, sem dias, custo ou retorno financeiro prometidos. O valor esperado é hipótese a verificar com as medidas propostas.

## Quadro resumido

| ID | Melhoria | Tipo | Esforço | Quando avaliar | Sua decisão |
|---|---|---|---|---|---|
| [MEL-01](#mel-01) | Usar um pedido anterior como base | Capacidade adicional | M | Avaliar primeiro | Pendente |
| [MEL-02](#mel-02) | Avisar quando dois analistas atuam no mesmo chamado | Capacidade adicional | M | Conforme demanda | Pendente |
| [MEL-03](#mel-03) | Transferir responsabilidade com aceite de quem assume | Capacidade adicional | M | Avaliar primeiro | Pendente |
| [MEL-04](#mel-04) | Revisar a qualidade do atendimento por amostra | Capacidade adicional | M | Avaliar primeiro | Pendente |
| [MEL-05](#mel-05) | Investigar causa raiz e verificar ações preventivas | Ampliação de escopo | M | Conforme demanda | Pendente |
| [MEL-06](#mel-06) | Alertar antes de enviar possíveis senhas ou tokens | Ampliação de escopo | M | Avaliar primeiro | Pendente |
| [MEL-07](#mel-07) | Dar tratamento às avaliações negativas | Ampliação de escopo | M | Após base prevista | Pendente |
| [MEL-08](#mel-08) | Qualificar a acessibilidade das jornadas completas | Ampliação de escopo | L | Avaliar primeiro | Pendente |
| [MEL-09](#mel-09) | Localizar quem recebeu uma orientação depois corrigida | Capacidade adicional | L | Após base prevista | Pendente |
| [MEL-10](#mel-10) | Agendar atendimento dentro do chamado | Capacidade adicional | M | Conforme demanda | Pendente |
| [MEL-11](#mel-11) | Coordenar janelas de mudanças e períodos de bloqueio | Ampliação de escopo | M | Após base prevista | Pendente |
| [MEL-12](#mel-12) | Sugerir responsável por habilidade, disponibilidade e carga | Ampliação de escopo | L | Conforme demanda | Pendente |
| [MEL-13](#mel-13) | Medir onde a abertura de chamados encontra obstáculos | Capacidade adicional | M | Após base prevista | Pendente |
| [MEL-14](#mel-14) | Simular demanda e capacidade futura da equipe | Capacidade adicional | L | Conforme demanda | Pendente |

<a id="mel-01"></a>

## MEL-01 — Usar um pedido anterior como base

**Capacidade adicional · Esforço M · Avaliar primeiro · Decisão: Pendente**

**Benefício esperado:** Reduzir digitação em solicitações repetidas de cadastro e acesso.

**Exemplo Consulte GEO:** Usar um cadastro de usuário da mesma obra como ponto de partida para pedir outro usuário.

**Incremento proposto:** Criar uma nova solicitação a partir de outra autorizada e concluída, copiando apenas campos permitidos e exigindo revisão.

**Diferença para o que já está previsto:** Formulários versionados, rascunhos e reclassificação já existem ou estão previstos em HD-011/012 e AUX-10/11; não localizamos o comando de reaproveitar outra solicitação.

**Recorte mínimo para futura especificação:**

- Selecionar pedido anterior dentro do acesso atual.
- Mostrar campos reaproveitados, incompatíveis e que precisam de nova confirmação.
- Criar nova intenção e novo protocolo somente após revisão.

**Dependências e momento:**

- Formulário vigente e autorização por obra/conta; reaproveitar abertura e snapshot existentes.
- HD-011/012 são bases relacionadas; não depende da API Novo GEO.

**Como validar um piloto:**

- Beneficiário, permissões, aprovações e execução anterior não são herdados.
- Mudança de versão ou revogação de acesso impede cópia indevida.
- Repetir o envio não cria dois chamados; uma nova solicitação não é confundida com retry do original.

**Como medir utilidade:** Tempo para preparar pedidos repetidos e quantidade de campos corrigidos, comparados com uma linha de base.

**Limite importante:** Não copiar anexos ou valores privados indiscriminadamente. Não contornar consultas ou aprovações necessárias.

**Comparação local:** `AUX-10/11`; `HD-011/012`; `RF-FOR-01/06`.

**Referências:** [W3C — Redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-02"></a>

## MEL-02 — Avisar quando dois analistas atuam no mesmo chamado

**Capacidade adicional · Esforço M · Conforme demanda · Decisão: Pendente**

**Benefício esperado:** Evitar respostas duplicadas ou contraditórias e trabalho simultâneo desnecessário.

**Exemplo Consulte GEO:** O analista vê que outra pessoa está redigindo; se uma resposta nova chegar, revisa seu rascunho antes de enviar.

**Incremento proposto:** Presença temporária de analistas autorizados e aviso de atualização antes do envio, sem bloquear o atendimento.

**Diferença para o que já está previsto:** CAS, versões e idempotência já protegem a gravação; HD-019 prevê tratar conflitos. O adicional é prevenir o conflito enquanto a resposta está sendo preparada.

**Recorte mínimo para futura especificação:**

- Indicar visualização/redação sem transmitir o texto digitado.
- Expirar presença ao sair, trocar identidade ou perder conexão.
- Avisar sobre nova resposta preservando o rascunho.

**Dependências e momento:**

- Mais de um analista simultâneo para justificar o investimento.
- Sessão, autorização e feedback de conflito de HD-019.

**Como validar um piloto:**

- Presença de pessoa sem acesso não é exibida nem concede acesso.
- Indicador expirado desaparece e não impede atendimento.
- CAS continua obrigatório mesmo quando não há presença visível.

**Como medir utilidade:** Ocorrências de respostas simultâneas e retrabalho percebido pela equipe; validar primeiro se esse problema ocorre.

**Limite importante:** Não transmitir conteúdo de digitação, nem criar uma trava exclusiva que abandone o ticket bloqueado.

**Comparação local:** `HD-019`; `src/application/helpdesk.ts:123/141`; `Busca dirigida por presence, typing, collision e digitando`.

**Referências:** [Zendesk — Avoiding agent collision](https://support.zendesk.com/hc/en-us/articles/9186264597146-Avoiding-agent-collision)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-03"></a>

## MEL-03 — Transferir responsabilidade com aceite de quem assume

**Capacidade adicional · Esforço M · Avaliar primeiro · Decisão: Pendente**

**Benefício esperado:** Evitar chamados sem responsável efetivo durante passagem de turno, férias ou troca de equipe.

**Exemplo Consulte GEO:** Quem transfere registra a próxima ação e o compromisso com o cliente; o sucessor confirma que assumiu.

**Incremento proposto:** Transferência em duas etapas, com aceite, recusa e prazo para resposta; até a conclusão, o responsável continua explícito.

**Diferença para o que já está previsto:** Atribuição, transferência com nota e resumo já estão em HD-019, RF-CEN-02/12 e AUX-25. O aceite da responsabilidade não está especificado.

**Recorte mínimo para futura especificação:**

- Solicitar transferência com contexto mínimo e ação pendente.
- Aceitar ou recusar com histórico.
- Expor transferência vencida e responsável atual para tratamento manual.

**Dependências e momento:**

- Roster e cobertura autorizada de HD-022; reaproveitar atribuição e notas existentes.
- Definir com a operação o prazo e o tratamento de ausência, sem alterar SLA automaticamente.

**Como validar um piloto:**

- Recusa ou silêncio não deixa o chamado sem responsável identificado.
- Assumir não cria acesso a novas contas ou obras.
- Transferência não descarta operações com resultado ainda desconhecido nem seus recibos.

**Como medir utilidade:** Chamados parados após transferências e tempo entre solicitação e aceite da passagem.

**Limite importante:** Oferecer exceção operacional auditada para indisponibilidade, evitando tornar a passagem uma barreira ao atendimento.

**Comparação local:** `HD-019/022`; `RF-CEN-02/12`; `AUX-01/25`.

**Referências:** Proposta desta análise, derivada das lacunas comparadas no projeto.

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-04"></a>

## MEL-04 — Revisar a qualidade do atendimento por amostra

**Capacidade adicional · Esforço M · Avaliar primeiro · Decisão: Pendente**

**Benefício esperado:** Identificar problemas de orientação e oportunidades de treinamento que volume, SLA e satisfação não revelam sozinhos.

**Exemplo Consulte GEO:** Revisar alguns atendimentos comuns e difíceis por clareza, correção técnica, diagnóstico e próximo passo.

**Incremento proposto:** Ficha interna de revisão com critérios versionados, justificativa, possibilidade de contestação e alinhamento entre revisores.

**Diferença para o que já está previsto:** Checklist de execução, indicadores HD-028 e satisfação HD-029 já estão previstos. Nenhum deles é uma revisão interna independente da conversa.

**Recorte mínimo para futura especificação:**

- Escolher amostra pequena e variada com critérios explícitos.
- Revisar manualmente mensagens e evidências autorizadas.
- Registrar feedback e ações de treinamento; discutir divergências dos avaliadores.

**Dependências e momento:**

- Responsável pela revisão, critérios de qualidade e tempo reservado.
- Pode começar como procedimento/documento antes de ganhar uma tela própria.

**Como validar um piloto:**

- Cada avaliação aponta evidência e versão do critério utilizado.
- Casos difíceis não são excluídos para melhorar artificialmente o resultado.
- Divergências podem ser revistas; feedback não vira ranking automático de pessoas.

**Como medir utilidade:** Frequência dos tipos de falha na amostra e evolução após ações de treinamento, mantendo claro o tamanho e o viés da amostra.

**Limite importante:** Começar sem pontuação automática por IA e sem monitoramento invasivo de funcionários.

**Comparação local:** `HD-028/029`; `RF-CEN-07`.

**Referências:** [Zendesk — Viewing and managing scorecards](https://support.zendesk.com/hc/en-us/articles/8875998154906-Viewing-and-managing-scorecards); [Zendesk — Using Zendesk QA as a reviewer](https://support.zendesk.com/hc/en-us/articles/7043669307418-Using-Zendesk-QA-as-a-reviewer)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-05"></a>

## MEL-05 — Investigar causa raiz e verificar ações preventivas

**Ampliação de escopo · Esforço M · Conforme demanda · Decisão: Pendente**

**Benefício esperado:** Reduzir recorrência e transformar incidentes relevantes em melhorias verificáveis.

**Exemplo Consulte GEO:** Depois de restaurar uma integração, acompanhar a correção estrutural e verificar se o mesmo problema voltou.

**Incremento proposto:** Registro leve de investigação após restauração: linha do tempo, hipóteses, causa confirmada, ações e avaliação da eficácia.

**Diferença para o que já está previsto:** HD-017 e AUX-19/20/21/26 já cobrem incidentes, agrupamento, contornos e encaminhamento a desenvolvimento. O ciclo posterior de investigação e eficácia é o adicional.

**Recorte mínimo para futura especificação:**

- Selecionar incidentes ou recorrências que justificam revisão.
- Separar fatos, hipóteses e fatores contribuintes.
- Reutilizar subtarefas AUX-15 para ações com responsável e evidência de conclusão.

**Dependências e momento:**

- Vínculos de chamados/incidentes e evidência suficiente.
- Responsável pela investigação; não exige CMDB nem adoção de ITIL integral.

**Como validar um piloto:**

- Restaurar serviço não fecha automaticamente a investigação.
- Uma hipótese nunca aparece como causa comprovada.
- Ação concluída é distinta de ação eficaz; resultados negativos também são registrados.

**Como medir utilidade:** Recorrência em uma população e período comparáveis; não inferir causalidade apenas da queda do número de tickets.

**Limite importante:** Manter análise interna separada de comunicação pública e preservar dados privados dos clientes.

**Comparação local:** `HD-017/028`; `AUX-15/19/20/21/26`; `RF-BUG-05/07`.

**Referências:** [Atlassian — Problem management process](https://www.atlassian.com/itsm/problem-management/process); [Atlassian — Incident postmortems](https://www.atlassian.com/incident-management/postmortem)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-06"></a>

## MEL-06 — Alertar antes de enviar possíveis senhas ou tokens

**Ampliação de escopo · Esforço M · Avaliar primeiro · Decisão: Pendente**

**Benefício esperado:** Reduzir o envio acidental de credenciais em mensagens livres e respostas públicas.

**Exemplo Consulte GEO:** Ao colar uma chave privada ou um link de recuperação, o autor recebe um alerta e revisa o conteúdo antes do envio.

**Incremento proposto:** Detecção delimitada de padrões de alto risco no texto livre, com indicação do trecho e decisão explícita do autor.

**Diferença para o que já está previsto:** A separação de públicos e a sanitização de diagnósticos em AUX-04 já existem no plano. O detector preventivo do conteúdo livre não foi localizado.

**Recorte mínimo para futura especificação:**

- Começar por padrões precisos, como chave privada, token e link de recuperação.
- Revisar o trecho sem alterá-lo silenciosamente.
- Validar o controle também no servidor, evitando registro do valor sensível em logs e telemetria.

**Dependências e momento:**

- Política por tipo de campo e testes de falso positivo/negativo.
- Compositor de mensagens e contratos existentes; sem serviço externo de IA obrigatório.

**Como validar um piloto:**

- CNPJ, e-mail e dados técnicos legitimamente solicitados não são bloqueados em massa.
- O trecho sensível não aparece em logs ou indicadores do detector.
- O texto só muda pela ação consciente do autor; histórico e snapshots permanecem íntegros.

**Como medir utilidade:** Alertas úteis e falsos positivos em amostra autorizada, sem armazenar o próprio segredo para medir.

**Limite importante:** É uma camada preventiva, não prova de que todo segredo será detectado nem constatação de vulnerabilidade atual. Não promete recuperar e-mails já enviados.

**Comparação local:** `AUX-04`; `web/app.js:438–444`; `src/application/helpdesk.ts:99–104`.

**Referências:** [Zendesk — Redacting ticket content](https://support.zendesk.com/hc/en-us/articles/4408846470170-Redacting-ticket-content)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-07"></a>

## MEL-07 — Dar tratamento às avaliações negativas

**Ampliação de escopo · Esforço M · Após base prevista · Decisão: Pendente**

**Benefício esperado:** Transformar insatisfação em revisão e ação de melhoria, além de uma nota no painel.

**Exemplo Consulte GEO:** Uma avaliação baixa gera uma pendência interna para verificar o ocorrido e decidir se cabe contato humano com o cliente.

**Incremento proposto:** Pendência interna deduplicada pelo recibo da avaliação, com responsável, motivo, ação e encerramento.

**Diferença para o que já está previsto:** HD-029 prevê convite, nota, comentário, recibo e métricas. O acompanhamento posterior da avaliação negativa não está explícito.

**Recorte mínimo para futura especificação:**

- Definir quais avaliações exigem revisão humana.
- Criar uma única pendência interna por recibo elegível.
- Registrar ação e resultado, reutilizando o mecanismo de tarefas quando disponível.

**Dependências e momento:**

- CSAT operacional de HD-029 e responsável pela revisão.
- AUX-15 é base possível para a pendência interna.

**Como validar um piloto:**

- Repetição do mesmo recibo não duplica a pendência.
- Nota baixa não reabre chamado nem envia mensagem automaticamente.
- Posse do convite não é tratada como prova da identidade de quem respondeu.

**Como medir utilidade:** Avaliações negativas revisadas, tempo até análise e ações registradas; não alterar a nota original para melhorar indicadores.

**Limite importante:** O recibo atual usa invitation_possession. Contato externo exige decisão e público legítimos, sem pressionar o cliente a mudar sua avaliação.

**Comparação local:** `HD-029`; `src/application/csat.ts:3–8/14–19`; `AUX-15`.

**Referências:** Proposta desta análise, derivada das lacunas comparadas no projeto.

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-08"></a>

## MEL-08 — Qualificar a acessibilidade das jornadas completas

**Ampliação de escopo · Esforço L · Avaliar primeiro · Decisão: Pendente**

**Benefício esperado:** Permitir que mais pessoas concluam login, abertura e acompanhamento com autonomia.

**Exemplo Consulte GEO:** Abrir e corrigir um pedido usando apenas teclado e leitor de tela, inclusive após erro de validação ou upload.

**Incremento proposto:** Meta WCAG 2.2 AA, inventário de critérios aplicáveis e avaliação de processos completos com tecnologia assistiva.

**Diferença para o que já está previsto:** HD-019, RF-CEN-15 e HD-C058 já contemplam teclado, foco, contraste, mobile e testes sob erro/volume. O adicional é a meta formal WCAG 2.2 AA e a avaliação documentada por critério e processo completo.

**Recorte mínimo para futura especificação:**

- Priorizar login, abertura, anexos, acompanhamento e resposta.
- Combinar testes automáticos com avaliação manual de teclado, leitor de tela, zoom e contraste.
- Registrar evidências por critério, corrigir barreiras e reavaliar os fluxos afetados.

**Dependências e momento:**

- Jornadas suficientemente estáveis e disponibilidade de avaliação manual.
- Reaproveitar os testes de interface; correções podem ser divididas em entregas menores.

**Como validar um piloto:**

- Erros e mudanças de estado são identificáveis sem depender só de cor.
- Diálogos e foco permitem completar o fluxo sem mouse.
- Uma varredura automática isolada não é apresentada como conformidade integral.

**Como medir utilidade:** Jornadas concluídas com tecnologias assistivas e barreiras confirmadas/removidas, por critério.

**Limite importante:** Não remover MFA, CAPTCHA ou autorização para facilitar o teste. A proposta não presume uma conclusão jurídica sobre obrigação aplicável.

**Comparação local:** `HD-019`; `RF-CEN-15`; `HD-C058 no plano de 06/10`.

**Referências:** [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-09"></a>

## MEL-09 — Localizar quem recebeu uma orientação depois corrigida

**Capacidade adicional · Esforço L · Após base prevista · Decisão: Pendente**

**Benefício esperado:** Tratar o impacto de instruções antigas incorretas, além de atualizar o artigo para atendimentos futuros.

**Exemplo Consulte GEO:** Uma macro sobre acesso de laboratório é retirada; a equipe identifica os atendimentos que usaram aquela versão e avalia uma correção.

**Incremento proposto:** Rastrear versão de artigo/macro usada em cada orientação e abrir revisão dos usos afetados após retirada ou substituição.

**Diferença para o que já está previsto:** HD-030/031/032, RF-BC-05/08 e AUX-20 já preveem revisão factual, validade e atualizações. O rastreamento retrospectivo da orientação entregue não está especificado.

**Recorte mínimo para futura especificação:**

- Registrar referência e versão quando o analista aplica conteúdo revisado.
- Ao retirar orientação, listar somente usos identificáveis e autorizados.
- Registrar análise e eventual comunicação corretiva decidida por uma pessoa.

**Dependências e momento:**

- Conhecimento/macros versionados e publicados por audiência.
- A revisão factual Novo GEO continua adiada; preparar rastreabilidade não a reativa.

**Como validar um piloto:**

- Mensagem e artigo históricos não são reescritos silenciosamente.
- Destinatários são reautorizados antes de eventual correção.
- Não há envio em massa automático nem promessa de detectar todos os textos colados manualmente.

**Como medir utilidade:** Cobertura dos usos registrados e tempo para revisar os casos potencialmente afetados.

**Limite importante:** Uma mudança editorial comum não implica que todos os atendimentos antigos estavam errados; exigir motivo e impacto para iniciar a revisão.

**Comparação local:** `HD-030/031/032`; `RF-BC-05/08`; `RF-IA-09`; `AUX-20`.

**Referências:** Proposta desta análise, derivada das lacunas comparadas no projeto.

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-10"></a>

## MEL-10 — Agendar atendimento dentro do chamado

**Capacidade adicional · Esforço M · Conforme demanda · Decisão: Pendente**

**Benefício esperado:** Reduzir desencontros em sessões de diagnóstico, orientação ou acompanhamento de implantação.

**Exemplo Consulte GEO:** Combinar uma sessão com a obra, registrar confirmação e manter o histórico de remarcações no próprio ticket.

**Incremento proposto:** Compromisso futuro entre solicitante e analista, com horário, fuso, duração, objetivo e estados próprios.

**Diferença para o que já está previsto:** AUX-15 trata de subtarefas, AUX-17 de tempo e RF-CEN-08 de reunião como canal de origem. Nenhum especifica esse compromisso confirmado.

**Recorte mínimo para futura especificação:**

- Registro manual inicial de proposta e confirmação de horário.
- Remarcar/cancelar com histórico e participantes autorizados.
- Expor conflitos conhecidos da agenda interna; integração externa fica fora da primeira versão.

**Dependências e momento:**

- Demanda real por sessões combinadas e disponibilidade declarada.
- Notificações somente nos canais já qualificados e quando autorizadas.

**Como validar um piloto:**

- Remarcação preserva o histórico e invalida o horário anterior.
- Agendamento não pausa nem reinicia SLA por si só.
- Sem integração com agenda externa, a interface não promete conhecer todos os compromissos do participante.

**Como medir utilidade:** Desencontros, remarcações e sessões realizadas, se a operação confirmar volume relevante.

**Limite importante:** Não criar videoconferência, acesso remoto ou gravação automática como parte implícita do pedido.

**Comparação local:** `AUX-15/17`; `RF-CEN-08`.

**Referências:** [Freshservice — Work and On-call Calendar](https://support.freshservice.com/support/solutions/articles/211608-manage-your-work-and-on-call-calendar)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-11"></a>

## MEL-11 — Coordenar janelas de mudanças e períodos de bloqueio

**Ampliação de escopo · Esforço M · Após base prevista · Decisão: Pendente**

**Benefício esperado:** Evitar intervenções conflitantes ou executadas em momento inadequado para a operação da obra.

**Exemplo Consulte GEO:** Uma mudança de configuração e uma atualização do Setup afetam o mesmo processo; o calendário mostra a sobreposição antes da execução.

**Incremento proposto:** Janela acordada, serviços afetados, condições de início/interrupção e períodos de congelamento, em visão conjunta.

**Diferença para o que já está previsto:** HD-016/018 já cobrem impacto e prévia; gates de deploy e AUX-20 cobrem release. A coordenação temporal e as condições operacionais são o adicional.

**Recorte mínimo para futura especificação:**

- Começar com registro e calendário manual, sem automação de deploy.
- Identificar sobreposição e condições que impedem a execução.
- Registrar exceção e resultado com os responsáveis apropriados.

**Dependências e momento:**

- Responsáveis pelos serviços e política operacional de mudanças.
- HD-018 e contratos reais para qualquer execução na origem; Novo GEO permanece adiado.

**Como validar um piloto:**

- Janela vencida ou condição alterada exige reavaliação.
- Conflito temporal fica visível sem conceder autorização de execução.
- Aprovação da janela não substitui MFA, aprovação da revisão exata ou gates existentes.

**Como medir utilidade:** Intervenções remarcadas preventivamente e incidentes ligados a sobreposições, sem inventar causalidade.

**Limite importante:** Não inferir regras de segurança de engenharia a partir da wiki ainda não validada. Não reativar comandos perigosos por existir uma janela.

**Comparação local:** `HD-016/018`; `RF-CEN-11`; `AUX-20`; `HD-042/043`.

**Referências:** [Atlassian — What is the change calendar?](https://support.atlassian.com/jira-service-management-cloud/docs/what-is-the-change-calendar/); [Atlassian — Filter and customize your change calendar](https://support.atlassian.com/jira-service-management-cloud/docs/filter-and-customize-your-change-calendar/)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-12"></a>

## MEL-12 — Sugerir responsável por habilidade, disponibilidade e carga

**Ampliação de escopo · Esforço L · Conforme demanda · Decisão: Pendente**

**Benefício esperado:** Distribuir demandas de modo mais adequado quando houver equipe e volume que justifiquem regras adicionais.

**Exemplo Consulte GEO:** Sugerir um analista disponível com experiência em laboratório e cobertura da obra, mostrando o motivo da sugestão.

**Incremento proposto:** Combinar habilidades e disponibilidade declaradas com limite de trabalho em andamento; iniciar com recomendação e confirmação humana.

**Diferença para o que já está previsto:** RF-CEN-02 já prevê assumir/atribuir e há regras de roteamento no roadmap. O adicional é a capacidade humana e a disponibilidade atuais, não outro motor genérico de roteamento.

**Recorte mínimo para futura especificação:**

- Cadastrar poucas habilidades úteis e disponibilidade declarada.
- Filtrar primeiro por autorização/cobertura.
- Exibir sugestão explicável e permitir escolha manual com motivo.

**Dependências e momento:**

- Roster de HD-022 e informação de disponibilidade mantida pela equipe.
- Volume suficiente para justificar o custo; prever ausência de candidato elegível.

**Como validar um piloto:**

- Sem cobertura, indisponível ou com limite de trabalho atingido não é sugerido.
- Na ausência de candidato elegível, o chamado permanece visível na fila para triagem manual.
- A sugestão não cria grant nem atribui automaticamente sem o escopo aprovado.

**Como medir utilidade:** Transferências evitáveis, tempo até atribuição adequada e balanceamento de trabalho, sem ranking individual simplista.

**Limite importante:** Dados desatualizados podem piorar o resultado. Não inferir habilidade a partir de dados pessoais ou usar cliques como capacidade.

**Comparação local:** `RF-CEN-02`; `HD-019/022/046`; `HD-P22; docs/superpowers/plans/2026-10-06-helpdesk.md:380–390`.

**Referências:** [Zendesk — About omnichannel routing](https://support.zendesk.com/hc/en-us/articles/4409149119514-About-omnichannel-routing)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-13"></a>

## MEL-13 — Medir onde a abertura de chamados encontra obstáculos

**Capacidade adicional · Esforço M · Após base prevista · Decisão: Pendente**

**Benefício esperado:** Priorizar simplificações com evidência do que acontece antes de o chamado ser criado.

**Exemplo Consulte GEO:** Identificar que muitos usuários iniciam um tipo de cadastro, encontram erro no mesmo campo e não chegam ao protocolo.

**Incremento proposto:** Funil agregado de seleção de serviço, preenchimento, erro de validação, rascunho, tentativa e abertura confirmada.

**Diferença para o que já está previsto:** HD-028 mede chamados e completude; AUX-11 cuida de rascunho. Observabilidade HTTP mede rota/status/duração, não a sequência anterior à criação.

**Recorte mínimo para futura especificação:**

- Definir poucos eventos sem conteúdo digitado e com retenção limitada.
- Agregar por serviço e versão do formulário.
- Comparar antes/depois de uma simplificação, preservando denominadores e limitações.

**Dependências e momento:**

- Formulários e identificadores de versão estáveis; HD-011/028 são bases relacionadas.
- Política de coleta, retenção e acesso; volume mínimo para não expor jornadas individuais.

**Como validar um piloto:**

- Não registrar resposta, tecla, captura de tela, token nem reprodução de sessão.
- Eventos repetidos não inflacionam a contagem de aberturas.
- Interrupção ou abandono não é rotulado automaticamente como insatisfação.

**Como medir utilidade:** Conclusão por etapa, erros por versão e tempo de preparação agregado; nenhuma meta inventada antes da linha de base.

**Limite importante:** Não acrescentar rastreamento externo como dependência. Evitar instrumentação extensa para um piloto sem volume.

**Comparação local:** `HD-028`; `AUX-11`; `src/observability/http.ts:22–25`.

**Referências:** Proposta desta análise, derivada das lacunas comparadas no projeto.

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

<a id="mel-14"></a>

## MEL-14 — Simular demanda e capacidade futura da equipe

**Capacidade adicional · Esforço L · Conforme demanda · Decisão: Pendente**

**Benefício esperado:** Antecipar acúmulo de pedidos em férias, aumento de obras ou mudança de jornada.

**Exemplo Consulte GEO:** Comparar cenários de demanda e disponibilidade para visualizar possível crescimento da fila, sem mudar escalas automaticamente.

**Incremento proposto:** Planejamento futuro da capacidade humana, com premissas visíveis e incerteza, separado da capacidade técnica do sistema.

**Diferença para o que já está previsto:** HD-046 mede latência, concorrência e infraestrutura; HD-028 tem métricas retrospectivas; AUX-17 prevê esforço. A simulação da equipe é o adicional.

**Recorte mínimo para futura especificação:**

- Começar com cenários simples e capacidade declarada.
- Usar volume, tipo de demanda e tempo efetivo de trabalho quando confiáveis.
- Comparar cenários, sem prometer previsão precisa em amostra pequena.

**Dependências e momento:**

- Histórico confiável e esforço distinguido de tempo em espera.
- HD-028 e, quando adotado, AUX-17; não exige contratar uma plataforma de WFM.

**Como validar um piloto:**

- Premissas e intervalos ficam separados dos dados observados.
- Ausência de histórico produz limitação explícita, não números fictícios.
- Nenhuma escala, SLA ou atribuição é alterada pela simulação.

**Como medir utilidade:** Erro dos cenários contra o resultado observado e utilidade da análise para decisões de capacidade.

**Limite importante:** Prioridade posterior enquanto o piloto não oferecer dados. Não usar o modelo para pontuar produtividade individual.

**Comparação local:** `HD-028/046`; `AUX-17`.

**Referências:** [Zendesk — Understanding WFM forecasting](https://support.zendesk.com/hc/en-us/articles/9858048119194-Understanding-WFM-forecasting)

**Registro da decisão:** Incluir / Adiar / Não incluir / Ajustar escopo. Condições: ____________________.

## Como devolver suas decisões

Você pode responder no chat por ID, por exemplo: “Incluir MEL-01 e MEL-04; adiar MEL-14; não incluir MEL-10; MEL-03 somente com passagem manual”. Itens não mencionados continuam pendentes. Esse exemplo não preenche nem aprova nenhum item.

O quadro HTML permite marcar decisões e gerar um resumo, JSON ou CSV para copiar e devolver. A marcação fica no navegador e não atualiza o backlog nem envia mensagens. O CSV também pode ser preenchido diretamente.

Após sua decisão, somente os itens incluídos deverão entrar no backlog, com o escopo e as condições aprovados. Adiados e rejeitados permanecerão registrados separadamente. Preservar IDs HD/AUX/RF; detalhar a proposta aprovada antes de implementar.
