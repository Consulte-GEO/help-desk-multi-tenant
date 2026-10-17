# Fontes, método e decisões preservadas

Data16/10/2026, horário de referência America/Sao_Paulo. Help Desk auditado em `f13754e`, incluindo PR60/`e89386f`; Wiki irmã `72f4e60`/v1.7/PR17. Core0.27/21 migrations; addons privados são contratos separados. API/interface0.31.0 não é versão do banco.

## Método e alcance

Leitura cruzada de código montado, contratos/candidatos, evidências/recibos,49 tarefas antigas,32 complementos,107RF,14 propostas MEL e decisões humanas. Três revisões independentes por domínio foram consolidadas e os documentos produtivos mais recentes foram conferidos. O remote GitHub foi consultado; não havia PR aberto no corte. Lista de issues retornou vazia na consulta disponível; isso não prova ausência de backlog ou cobertura exaustiva do serviço.

A ferramenta de listagem de chats não concluiu; a recuperação foi feita pelos exports locais exclusivamente dos chats ligados a esta pasta de projeto. São14 chats,139 mensagens humanas e76 finais de assistente, até16/10/2026 11:10:53Z, além desta conversa atual. O consolidado histórico02–13 foi confrontado com as mensagens novas15–16. Não foram auditados chats cloud não presentes, apagados ou de outro computador. Textos de assistente não substituem recibos de entrega. Transcrições brutas e caminhos de sessões não foram distribuídos neste pacote.

Não houve nova operação de banco, navegador, envio, autenticação, migração, deploy ou teste de aplicação neste levantamento. Qualificações produtivas citadas pertencem ao commit/fonte descritos nos respectivos documentos; não são recertificação de cada fluxo do HEAD atual. Nenhum percentual global de conclusão foi inferido.

## Decisões que prevalecem

| Decisão humana | Consequência atual |
|---|---|
| Foco Consulte GEO | Não transformar backlog em plataforma genérica para outras empresas. |
| Produção é o único ambiente hospedado | CI/local descartáveis válidos; não pedir staging hospedado. |
| Novo GEO/API/IdP e revisão factual indisponíveis, deixar preparado | HD-030/037/049 e efeitos dependentes continuam adiados. |
| MFA sensível adiado | Não criar fator/grant/identidade para liberar aprovação/administração. |
|15/10: scanner cancelado | Remover provisionamento/custo da fila; anexos core exigem revisar contrato se retomados, nunca inventar clean. |
| Apoio dentro do HelpDesk, interno suporte/admin | Não reconstruir Setup independente como pré-requisito; PR55–60 já entregaram integração. |
| XLSX/CSV, sem DWG | Não incluir parser/conversão DWG automaticamente. |
| Legado V2 futuro | Não migrar histórico ou reativar contas compartilhadas nesta continuidade. |
| MEL-09 aprovada | Incluir rastreabilidade de orientações corrigidas; outras13 MEL permanecem em decisão. |
| Gestão de e-mail somente monitor de notificações de chamados | Sem editor, reenvio, campanhas, inbound, preferências individuais ou monitor Auth no V1. Fila Apoio e aviso Wiki continuam recortes próprios. |
| Recebimento inicialmente configurado só Consulte GEO | Equipe consulta; admin vê endereço completo, equipe mascarado no servidor; não criar tela de preferência por usuário. |
| Abertura/clique daqui para frente | Cobertura comprovada15/10 19:57:29.552038Z; histórico sem evidência é indisponível; não retroagir. |
| Wiki: texto aprovado exclusivamente por Thiago; mídia direta para corporativo confirmado com acesso | Não equiparar admin genérico a aprovador; domínio isolado não concede acesso Wiki. |
| Tirar Wiki da página de login | Concluído; manter acesso autenticado, não apagar Wiki inteira. |

## Alterações posteriores que invalidam pendências antigas

- PR52: monitor e-mails V2, schema0.27, callback opened/clicked comprovado e smoke desktop autenticado. Restam AC-EMAIL; não refazer monitor/migration.
- HDA: promoção20 e worker manual_review/consulta já ativos. HD-038 entregue no seu recorte, HD-039–044 independentes.
- PR53/54/56: worker/aviso Wiki e composição schema0.27/TLS qualificados. Provider accepted não é entrega/leitura na caixa.
- Wiki v1.7:30 ajustes WUX e contribuição/busca/mídia/avaliação/pedidos implementados. Aceite visual16/10 parcial; integração conhecimento cliente HelpDesk ainda específica.
- PR55/57/58/59/60: Apoio interno integrado, persistência/revisão/importação/laudos/ajuda/e-mails e defeitos UI corrigidos. Fixture completa/CI não comprova jornada humana hospedada nem e-mail IMP real.
- SLA: cálculo/snapshot inicial e revisão já existem. Pendência é projeção corrente/UI/scheduler, não reescrever motor.
- Tabelas repetíveis: motor/UI já existem; falta perfil operacional. Contadores atuais da fila já avisam que contam só carregados.

## Documentos de evidência principais

- Help Desk: [AGENTS](../../AGENTS.md), [estado onda2](../157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md), [ativação](../149-CONSULTEGEO-ATIVACAO-2026-10-14.md), [cadastros](../150-CONSULTEGEO-CADASTROS-2026-10-14.md).
- [Monitor produtivo](../implementation/EMAIL-MONITOR-V2-PRODUCTION-2026-10-15.md), [smoke autenticado](../implementation/EMAIL-MONITOR-V2-ACEITE-AUTENTICADO-2026-10-16.md), [matriz](../implementation/EMAIL-MONITOR-V2-MATRIZ-ACEITE.md).
- [Apoio PR60](../apoio-implantacao-fluxos-ui-2026-10-16.md), [e-mails Apoio](../apoio-implantacao-emails-publicacao-2026-10-15.md), [HDA ativado](../integrations/hda/ATIVACAO_STORAGE_WORKER_20261015.md), [aviso Wiki](../wiki-contribution-email-v1.md).
- Wiki irmã: `wiki-consultegeo/docs/evolucao/REVISAO-INTEGRACAO-V17-2026-10-15.md`, relativo à pasta do projeto; aceite parcial fora do Git HelpDesk em `Entregas/Wiki_Teste_Visual_2026-10-16/RESULTADO_PARCIAL.md`, na mesma pasta do projeto.
- [Auditoria histórica](../handoff-2026-10-15/LEIA-PRIMEIRO.md), [decisão MEL-09](../decisoes-e-emails-geolab-2026-10-15/DECISOES-E-BACKLOG-ADICIONAL.md), [fonte107RF](../requirements/consultegeo/matriz-107-requisitos.json). Históricos preservados; este pacote atualiza o estado, não os apaga.

## Chats recuperados

Títulos abaixo são os títulos originais. Identificador distingue títulos repetidos. [Metadados mínimos](CHATS-COBERTURA.json).

| Título | ID | Última mensagem UTC |
|---|---|---|
| Revisar e publicar repositório | 01a0fc65-967a-7af1-a545-6bd320bbfbdc | 2026-10-02T11:56:33.813Z |
| Help Desk Publicação | 01a10e2a-39ca-7781-a32e-0c2156ada389 | 2026-10-08T22:50:36.871Z |
| Localize plano e desenvolva helpdesk | 01a11398-5868-78d2-a8b2-8873450fc950 | 2026-10-07T02:16:42.414Z |
| Revisar e compatibilizar repositório | 01a12b3d-ba66-7de2-809a-0c4d8971a2d0 | 2026-10-11T14:43:09.831Z |
| Revisar e compatibilizar repositório | 01a12f79-35d8-7771-a775-34b894d4fb57 | 2026-10-12T12:36:38.915Z |
| Revisar e preparar repositório | 01a134f4-b561-7b40-a2a1-b0f4bbcb2b86 | 2026-10-13T12:03:07.117Z |
| Analisar helpdesk e envio de emails | 01a1358a-b43b-7341-8e74-26b2d90f286e | 2026-10-14T20:36:52.910Z |
| Configurar Resend no Help Desk | 01a13a1b-b37e-70b2-bfb9-a5012807beb3 | 2026-10-14T18:08:34.952Z |
| Configurar domínio no Netlify | 01a13ac3-6307-75f0-b07b-82022e46de4c | 2026-10-14T14:14:39.233Z |
| Adicionar acesso ao wiki | 01a13aef-8874-7ef2-a843-53bafccbd606 | 2026-10-14T17:57:46.896Z |
| Revisar e aprimorar o email kit | 01a13b99-8a9f-7f30-9ed3-ae29684c469f | 2026-10-15T11:52:32.216Z |
| Revisar e compatibilizar repositório | 01a13d8d-dce9-7693-97a6-c94f92eca9ba | 2026-10-16T11:10:53.377Z |
| Revise e publique o wiki Consulte | 01a13d8f-da4d-7421-9149-78e911858c31 | 2026-10-16T09:54:51.138Z |
| Remover acesso à wiki da página | 01a13f90-5e72-7c01-9fec-2b99cbf75804 | 2026-10-15T15:08:38.711Z |

As mensagens novas de “Revisar e compatibilizar repositório” (01a13d8d…), “Revise e publique o wiki Consulte” (01a13d8f…) e “Remover acesso à wiki da página” foram especialmente importantes para scanner cancelado, Apoio publicado, Wiki v1.7 e limites do aceite real. Aprovações de e-mail/MEL e falhas do controle desta conversa foram consideradas separadamente.

