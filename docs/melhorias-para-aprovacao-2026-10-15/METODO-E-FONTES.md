# Método, exclusões e fontes

Data: 15/10/2026. Pedido: identificar melhorias adicionais para o titular decidir sobre sua inclusão. Não houve desenvolvimento de funcionalidade, atualização do backlog, envio de mensagens a terceiros ou mudança de produção. Os arquivos novos são documentos e um quadro local de decisão.

## Base e alcance

Foram comparados o handoff anterior (49 HD, 32 AUX, 107 RF), o roadmap de 06/10, planos posteriores, wiki e trechos do código. As buscas cobriram presença, digitação simultânea, amostragem/scorecards, causa raiz/pós-incidente, previsão de capacidade humana, funil de abertura e tratamento de avaliações negativas, além das frentes relacionadas. A comparação semântica distingue um tema amplo de um incremento que ainda não foi especificado.

A base do handoff era o checkout 306dd5c reconciliado com PR49/d036fcc. Nesta rodada o HEAD local foi reconferido em **91ccdf95db44b11a3906a4c39cf070ff5e91f2a5**. Depois do PR49, os commits 45ce666 e 91ccdf9 removem o atalho Wiki da página de login e registram sua validação. Esse delta não especifica as melhorias desta lista. A fotografia anterior foi preservada; sua documentação não deve ser interpretada como o HEAD permanente do projeto.

Não reabrimos o inventário integral de chats nesta rodada. As decisões de produção única, MFA/origem adiada, legado V2 e foco Consulte GEO permanecem válidas. Não há aprovação implícita de novos canais, infraestrutura, ferramenta paga, automação recorrente ou IA em produção.

“Não previsto” significa **não localizado como escopo equivalente nas fontes examinadas**. Não prova ausência em conversas indisponíveis, commits posteriores ou código não examinado. Antes de implementar um item aprovado, revalidar sua base e reaproveitar os componentes existentes. Não foram realizados testes completos dos produtos nesta rodada documental.

## Propostas descartadas por sobreposição ou falta de necessidade concreta

| Tema | Já coberto por | Motivo |
|---|---|---|
| Anexos privados, SLA, filas, indicadores, administração, exportação e CSAT básico | HD-019 a HD-029 | Já são frentes do backlog. |
| WhatsApp, resposta por e-mail, seguidores, menções, subtarefas e ações em massa | AUX-01/15/18/30/31 | Já foram preservados como recortes específicos. |
| Kit de diagnóstico, captura e trace sanitizados | AUX-04; RF-ACE-06/13 | MEL-06 trata somente do conteúdo livre escrito, não recria o diagnóstico. |
| Responsável, validade e revisão periódica de artigos | RF-BC-05; AUX-20 | MEL-09 adiciona rastreamento de orientação já entregue. |
| CRUD/inativação de serviço e encerramento de obra | Roadmap HD-P08/HD-C031; RF-PRJ-05/08 | Não confundir alteração de status com capacidade inédita. Campanha ampla de retirada não foi incluída por falta de demanda concreta. |
| Roteamento ou simulação genéricos de SLA/regras | Roadmap de 06/10 | MEL-12 delimita capacidade/disponibilidade humana; MEL-14 delimita projeção futura da equipe. |
| Treinamento básico, ajuda contextual, macros e IA geral | HD-032/044 e AUX-25 a AUX-28 | MEL-04 adiciona revisão humana sistemática de qualidade; não é outra ferramenta geral de IA. |
| Completude por etapas e confirmação funcional do resultado | HD-011/013/017/028/044; RF-CIC-03; checklists | São melhorias possíveis, mas com sobreposição significativa. Preferimos qualificar esses detalhes nas tarefas já previstas antes de criar nova proposta. |

## Referências externas

Documentação primária consultada em 15/10/2026. As fontes demonstram práticas; a adaptação ao Consulte GEO e o benefício esperado são inferências desta análise. Não há recomendação de contratar esses produtos, copiar toda sua arquitetura ou adotar seus preços/planos.

- **R01 — [Zendesk — Avoiding agent collision](https://support.zendesk.com/hc/en-us/articles/9186264597146-Avoiding-agent-collision):** Distingue visualização, edição e atualização simultânea de chamados.
- **R02 — [Zendesk — Viewing and managing scorecards](https://support.zendesk.com/hc/en-us/articles/8875998154906-Viewing-and-managing-scorecards):** Avaliação de qualidade com categorias e critérios próprios.
- **R03 — [Zendesk — Using Zendesk QA as a reviewer](https://support.zendesk.com/hc/en-us/articles/7043669307418-Using-Zendesk-QA-as-a-reviewer):** Revisão humana de conversas, comentários e discussão da avaliação.
- **R04 — [Atlassian — Problem management process](https://www.atlassian.com/itsm/problem-management/process):** Separa restauração de serviço da investigação e prevenção de recorrência.
- **R05 — [Atlassian — Incident postmortems](https://www.atlassian.com/incident-management/postmortem):** Revisão após incidentes com aprendizado e ações de melhoria.
- **R06 — [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/):** Critérios de acessibilidade e avaliação de páginas e processos completos.
- **R07 — [W3C — Redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry):** Evitar redigitação desnecessária no mesmo processo. Reuso entre chamados é adaptação proposta, não exigência desse critério.
- **R08 — [Freshservice — Work and On-call Calendar](https://support.freshservice.com/support/solutions/articles/211608-manage-your-work-and-on-call-calendar):** Organização temporal de trabalho e tarefas ligadas a tickets. Confirmação pelo cliente é adaptação proposta.
- **R09 — [Zendesk — About omnichannel routing](https://support.zendesk.com/hc/en-us/articles/4409149119514-About-omnichannel-routing):** Considera disponibilidade, capacidade e habilidades na distribuição de atendimento.
- **R10 — [Atlassian — What is the change calendar?](https://support.atlassian.com/jira-service-management-cloud/docs/what-is-the-change-calendar/):** Visão conjunta de mudanças planejadas.
- **R11 — [Atlassian — Filter and customize your change calendar](https://support.atlassian.com/jira-service-management-cloud/docs/filter-and-customize-your-change-calendar/):** Calendário com períodos de manutenção e congelamento.
- **R12 — [Zendesk — Understanding WFM forecasting](https://support.zendesk.com/hc/en-us/articles/9858048119194-Understanding-WFM-forecasting):** Previsão de volume e dimensionamento de equipe com dados históricos e cenários.
- **R13 — [Zendesk — Redacting ticket content](https://support.zendesk.com/hc/en-us/articles/4408846470170-Redacting-ticket-content):** Demonstra o problema de conteúdo sensível em mensagens; remoção posterior tem limites e não recupera mensagens já entregues. O alerta preventivo é proposta desta análise.

Não foram atribuídos percentuais de ganho, retorno financeiro ou prazos sem medição. Para cada proposta há uma medida possível; ela não equivale a resultado obtido nem obrigação de instrumentar tudo.
