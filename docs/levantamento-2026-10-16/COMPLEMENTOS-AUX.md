#32 complementos dos requisitos — leitura atual

Não são32 novas aprovações nem tarefas para somar às49HD. São recortes que evitam perder cláusulas dos107RF. A especificação histórica detalhada (passos, RF, critérios) permanece em [PENDENCIAS-RF-ESPECIFICAS](../handoff-2026-10-15/PENDENCIAS-RF-ESPECIFICAS.md). A coluna atual abaixo prevalece quando a fonte antiga conflita com decisões posteriores. JSON deste pacote conserva o texto histórico explicitamente rotulado.

| ID | Recorte | Situação e pendência atual |
|---|---|---|
| AUX-01 | Compartilhamento por obra, seguidores e menções | Compartilhamento/seguidores/menções sem jornada montada. Preferências individuais não entram no monitor V1: recebimento configurado só pela Consulte GEO. |
| AUX-02 | Canal pré-login de assistência de acesso | Assistência pré-login é ampliação diferente do reset Auth existente; confirmar prioridade e política de abuso. |
| AUX-03 | Entradas e atalhos contextuais no Novo GEO | Atalhos/origem no Novo GEO adiados. Remoção do atalho Wiki no login já concluída não é esta função. |
| AUX-04 | Diagnóstico interno e captura revisável de tela | Diagnóstico/captura de tela precisam fonte real e revisão/consentimento; não expor logs internos ao cliente. |
| AUX-05 | Abertura pelo Android sem perda de dados offline | Android/offline dependem decisão e app/origem; não equivalem à verificação mobile web pendente. |
| AUX-06 | Ficha contextual do cliente para o analista | Ficha contextual de cliente requer identidade/dados da origem; SLA local/conta existente podem evoluir sem inventar diretório vivo. |
| AUX-07 | Notificações no sino do GEO | Sino Novo GEO adiado; e-mail transacional e monitor já entregues não o substituem. |
| AUX-08 | Busca específica no catálogo de serviços | Catálogo contextual existe; busca/sinônimos de serviços não montados. |
| AUX-09 | Tabelas repetíveis nos formulários Help Desk | Repeater/table_paste já existem no motor/UI. Falta habilitação compatível no compilador/registry SQL e modelos operacionais Consulte GEO; não criar outro componente. |
| AUX-10 | Reclassificação segura sem perda de respostas | Reclassificação com mapa e preservação não montada; revisão comum de respostas já existe. |
| AUX-11 | Autosave de rascunho sem repetição de intenção | Draft persistido e salvar explícito já existem. Autosave é incremento condicionado, com CAS/intenção incerta. |
| AUX-12 | Vídeo curto e reprodução privada de anexos | Wiki já suporta mídia e Apoio tem ajuda com imagem/vídeo. Vídeo privado anexo de chamado geral ainda depende de HD-024/política, sem scanner cancelado. |
| AUX-13 | Regras de espera, encerramento e reabertura | Workflow e reabertura sete dias publicados. Faltam aceites, taxonomia, continuação vinculada fora da janela e eventual scheduler aprovado (HD-021). |
| AUX-14 | Relações entre chamados e mescla revisável | Relação/mescla não montadas; não misturar conversas de clientes por causa comum. |
| AUX-15 | Subtarefas internas com responsáveis e prazo | Checklist entregue não é subtarefa com responsável/prazo/dependência. |
| AUX-16 | Abertura em nome do cliente e canal de origem | Serviço de beneficiário delegado existe sem composição na abertura. Canal de origem não integra mensageria externa. |
| AUX-17 | Apontamento de tempo com correção auditada | Apontamento explícito de esforço não montado; exige confirmar utilidade/prioridade. |
| AUX-18 | Ações em massa com resultado por chamado | Sem ações em lote na jornada; N comandos idempotentes com resultado individual se aprovado. |
| AUX-19 | Gestão de incidente e avisos públicos de status | Sem gestão/status público de incidente; exige desenho editorial de audiência, cache e autoridade. |
| AUX-20 | Vínculo com desenvolvimento, atualização e release | Serviço external-work candidato existe; faltam montagem e vínculo ticket/tema/release, sem resolver ticket automaticamente. |
| AUX-21 | Agrupar melhorias e registrar decisão institucional | Agrupar melhoria e decisão institucional não está montado; não confundir com aprovação das MEL. |
| AUX-22 | Registrar piloto comercial de implantação | Piloto comercial de implantação é política/contrato, não se conclui com Apoio técnico publicado. |
| AUX-23 | Autoatendimento guiado e declaração de resolução | Wiki interna v1.7/avaliações entregues. Autoatendimento cliente na abertura e declaração de resolução exigem pacote externo e integração próprios. |
| AUX-24 | Transformar resposta em rascunho editorial sanitizado | Wiki já recebe contribuições/correções. Converter resposta HelpDesk em proposta editorial sanitizada ainda precisa integração; texto mantém aprovação Thiago. |
| AUX-25 | Assistência interna de resumo, resposta e pergunta ao Dev Agent | IA do Apoio já tem implementação específica; resumo/resposta/pergunta Dev Agent em atendimento geral não montados. |
| AUX-26 | Classificação e similaridade de chamados avaliadas | Similaridade de título Wiki entregue não é classificação/similaridade de chamados; avaliar corpus e métricas antes de ativar. |
| AUX-27 | Assistente cliente na abertura, somente após decisão | Assistente cliente continua desligado/adiado; não ativar como consequência do OCR interno. |
| AUX-28 | Governança e quotas de IA por conta e recurso | Consentimento/quotas de IA específicos Apoio já existem; governança transversal por conta/recurso segue ampliação. |
| AUX-29 | Editor operacional de modelos de e-mail | Templates/versionamento e configuração administrativa não significam editor operacional. Editor fica fora do monitor V1 aprovado; confirmar ampliação antes de desenvolver. |
| AUX-30 | Resposta por e-mail e threading autenticado | Saída/callback Resend entregues não são inbound/threading. Resposta por e-mail exige decisão e autenticação próprias. |
| AUX-31 | Canal WhatsApp oficial como extensão opcional | WhatsApp é opcional sem aprovação; não incluir canal pago por inferência. |
| AUX-32 | Política e evidência de consulta interna dos analistas | Logs HTTP e auditoria de escrita existem. Política e consulta auditada de leituras por finalidade ainda por definir. |

Origem GEO, Android, IA geral, CSAT, canais e processos comerciais não se tornam prioridade imediata por constarem da matriz. Reconciliar o recorte na etapa de planejamento. Preferências individuais, editor de e-mail e inbound ficam fora da primeira gestão de e-mails aprovada. Scanner permanece cancelado.

