# Matriz integral — 107 requisitos do levantamento de 12/10/2026

> **M09c — 14/10/2026:** protocolo/snapshot/recibo e fila nativos homologados; quatro entregas parciais atualizadas no JSON, mantendo 107 RF e as prioridades originais. Pending indica fila, sem prova de envio. [Estado e limites](../../145-CONSULTEGEO-ABERTURA-ATOMICA-M09C-2026-10-13.md).

As prioridades abaixo são as do documento do Claude, não uma promessa de entrega. A disposição é a avaliação desta revisão. A presença de módulos consolidados não significa integração operacional. Os requisitos não foram renumerados. A referência de linha usa a numeração do arquivo original anexado, lido em UTF-8.

**Inventário:** 107 RF distintos; 52 MVP, 43 Fase 2, 12 Fase 3. Nenhum RNF codificado consta do arquivo, embora a introdução explique a sigla. Requisitos técnicos complementares estão no plano, claramente identificados.

## Perfis e permissões

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-PER-01** · linha 43 | MVP | Reaproveitar e integrar · HDN-02/03 | Reaproveitar identidade externa por issuer/subject e sessão por pessoa. O grupo da origem é dado para mapeamento qualificado, não grant adotado do browser; registro técnico local não é outro login. **Reuso:** identity/session/resource ACL/admin-policy. |
| **RF-PER-02** · linha 44 | MVP | Ajustar explicitamente · HDN-02/03 | Master por grupo/pessoa exige grant autoritativo e versionado da conta e do conjunto de recursos. Ser master não ignora obra C nem cria wildcard. **Reuso:** identity/session/resource ACL/admin-policy. |
| **RF-PER-03** · linha 45 | Fase 2 | Acrescentar/antecipar · HDN-02/03 | Audiência compartilhada por obra é nova política explícita; escopo e revogação antes de lista, contagem e detalhe. Não alterar histórico de audiência sem migração aprovada. **Reuso:** identity/session/resource ACL/admin-policy. |
| **RF-PER-04** · linha 46 | Fase 2 | Ajustar explicitamente · HDN-02/03 | Seguidor só entra se autorizado a todos os recursos do chamado; ser da mesma construtora é necessário, não suficiente. Revogação impede novas notificações. **Reuso:** identity/session/resource ACL/admin-policy. |
| **RF-PER-05** · linha 47 | MVP | Reaproveitar e integrar · HDN-02/03 | Preservar separação de tabela/DTO/outbox e distinção visual; testar ausência de notas inclusive no DOM oculto e exportação. **Reuso:** identity/session/resource ACL/admin-policy. |
| **RF-PER-06** · linha 48 | MVP | Ajustar explicitamente · HDN-02/03 | Não adiar revogação para o próximo login. Manter revalidação atual por operação e sessão com estratégia de revisão da origem; histórico preservado sem acesso do ex-colaborador. **Reuso:** identity/session/resource ACL/admin-policy. |
| **RF-PER-07** · linha 49 | Fase 2 | Ajustar explicitamente · HDN-02/03 | Não rebaixar o MFA já exigido para administração/ações sensíveis à Fase 2. Registro de leitura pela equipe pode ser completado sem criar acesso universal. **Reuso:** identity/session/resource ACL/admin-policy. |
| **RF-PER-08** · linha 50 | MVP | Reaproveitar e integrar · HDN-02/03 | Critério obrigatório em HTTP e PostgreSQL, incluindo A/B/C na mesma conta e IDs repetidos em tenants diferentes; não basta UI. **Reuso:** identity/session/resource ACL/admin-policy. |

## Acesso e integração com o Novo GEO

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-ACE-01** · linha 58 | MVP | Ajustar explicitamente · HDN-02 | Reaproveitar OIDC/PKCE e sessão opaca; IdentityServer mencionado não comprova endpoints, audience, client ou refresh reais. Código transitório no callback dedicado não é token de acesso na URL. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-02** · linha 59 | MVP | Reaproveitar e integrar · HDN-02 | Link sem pop-up preservado. Destino permitido do servidor e retorno pós-login com allowlist; sem PII ou credencial no link. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-03** · linha 60 | MVP | Ajustar explicitamente · HDN-02/13 | Novo canal MVP de assistência de acesso: e-mail verificado comprova posse de caixa, não identidade GEO/construtora. Lead privado e limitado, sem leitura de chamados ou recuperação de senha por associação de e-mail. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-04** · linha 61 | MVP | Ajustar explicitamente · HDN-02 | Contribuição de contexto estruturado. Browser/tela são dados diagnósticos declarados; pessoa/obra/material/conta devem vir de verificação no servidor e API qualificada. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-05** · linha 62 | Fase 2 | Acrescentar/antecipar · HDN-02 | Handoff de registro por identificador opaco e revalidação de origem; ainda exige mudança no consumidor GEO, não inferir tabela/API pelo nome da tela. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-06** · linha 63 | Fase 2 | Acrescentar/antecipar · HDN-02 | Trace/último erro em seção interna sanitizada, tamanho/retencão limitados; não anexar stack, payload ou tokens automaticamente ao texto público. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-07** · linha 64 | Fase 3 | Acrescentar/antecipar · HDN-02 | Versão e quantidade de pendências como diagnóstico com origem; preservar dados offline e não sugerir limpeza antes de análise. Contrato Android específico. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-08** · linha 65 | Fase 2 | Acrescentar/antecipar · HDN-02 | Sino exige adapter, dedup e autorização de destinatários da origem; não chamar de pronto por existir outbox no Help Desk. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-09** · linha 66 | MVP | Reaproveitar e integrar · HDN-02 | Deep link autorizado após login, sem tokens duráveis, open redirect ou exposição de chamado alheio. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-10** · linha 67 | Fase 2 | Reaproveitar e integrar · HDN-02 | Leituras da origem com autorização e auditoria próprias; sem SQL direto, scripts administrativos ou reenvio usado como consulta. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-11** · linha 68 | Fase 3 | Reaproveitar e integrar · HDN-15 | Escrita fica Fase 3: contrato comprovado, prévia de payload, aprovações, confirmação humana, idempotência e auditoria dos dois sistemas. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-12** · linha 69 | MVP | Ajustar explicitamente · HDN-02 | Preservar binding conta/tenant/conexão e cobertura completa por recurso; campos de link e body não são autoridade. **Reuso:** geo-login/external-session/resource-access. |
| **RF-ACE-13** · linha 70 | Fase 3 | Acrescentar/antecipar · HDN-02 | Captura explícita, com recorte/revisão do usuário e tratamento como anexo privado; não capturar credenciais ou enviar automaticamente. **Reuso:** geo-login/external-session/resource-access. |

## Catálogo de serviços

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-CAT-01** · linha 94 | MVP | Reaproveitar e integrar · HDN-04 | Catálogo por subcategoria é reutilização do motor existente; nove famílias do documento são propostas a versionar como drafts, não fato confirmado do wiki original. **Reuso:** form-catalog/profile-expansion. |
| **RF-CAT-02** · linha 95 | Fase 2 | Acrescentar/antecipar · HDN-04 | Filtrar por entitlement/material qualificado antes da busca; visibilidade do catálogo não concede autorização de execução. **Reuso:** form-catalog/profile-expansion. |
| **RF-CAT-03** · linha 96 | Fase 2 | Acrescentar/antecipar · HDN-04 | Busca por vocabulário de obra é melhoria útil de UX; limitar ao catálogo disponível e autorizado, não aos rótulos legados indiscriminadamente. **Reuso:** form-catalog/profile-expansion. |
| **RF-CAT-04** · linha 97 | MVP | Ajustar explicitamente · HDN-07 | Não converter campos sem correspondência para descrição pública. Preservar snapshot imutável privado, mapa explícito de campos e revisão do cliente quando necessários. **Reuso:** form-catalog/profile-expansion. |
| **RF-CAT-05** · linha 98 | MVP | Ajustar explicitamente · HDN-04 | Exibir dueAt calculado da política/calendário publicados com asOf e erro explícito; números de prazo da proposta não viram SLA aprovado. **Reuso:** form-catalog/profile-expansion. |

## Formulários de cadastro

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-FOR-01** · linha 116 | MVP | Reaproveitar e integrar · HDN-04/06 | Reaproveitar DSL/renderização e tipos existentes; conferir lacunas de e-mail/telefone/CEP e restrições por campo. Nenhum script ou regex arbitrária de cliente. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-02** · linha 117 | MVP | Reaproveitar e integrar · HDN-04/06 | Obras/grupos/traços/fornecedores exigem API qualificada e contexto atual, não listas fixas inventadas. Grupo descrito não é grant por nome. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-03** · linha 118 | MVP | Reaproveitar e integrar · HDN-04/06 | Reaproveitar tabelas repetíveis com limites, unidades, erros por linha e seleção integral; lista de pessoas não cria logins em lote automaticamente. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-04** · linha 119 | MVP | Ajustar explicitamente · HDN-04/06 | Validação sintática local compartilhada; faixas técnicas só conforme contrato material/ensaio/configuração. Não codificar FCK, tolerância ou idade universal. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-05** · linha 120 | Fase 2 | Reaproveitar e integrar · HDN-04/06 | Consulta de duplicidade é sugestão autoritativa da origem, não vínculo automático por e-mail/nome/equivalência aproximada. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-06** · linha 121 | Fase 2 | Reaproveitar e integrar · HDN-04/06 | Autosave fica Fase 2 da fonte; rascunho seguro e proteção contra perda/unknown existentes continuam básicos. Debounce/CAS, sem salvamento fora da audiência. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-07** · linha 122 | MVP | Reaproveitar e integrar · HDN-04/06 | Orientação mínima no MVP, curada e versionada. Vídeos/templates só em origens permitidas; KB indisponível não impede pedido legítimo. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-08** · linha 123 | Fase 2 | Acrescentar/antecipar · HDN-04/06 | Planilha modelo versionada, staging/erros por linha, limites e revalidação; não executar macros/fórmulas nem criar usuários sem decisão. **Reuso:** form-rules/form-catalog/support-intake. |

## Formulários de implantação, ajustes, dúvidas, problemas e backup

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-FOR-09** · linha 146 | MVP | Ajustar explicitamente · HDN-08 | Planilha e DWG só obrigatórios se pipeline real daquele formato estiver qualificado; categoria permanece indisponível até isso, sem fingir suporte pelo MIME. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-10** · linha 147 | Fase 2 | Acrescentar/antecipar · HDN-08/14 | Validador estrutural de abas/colunas da versão do modelo, sem fórmula executada; não interpretar “qualquer formato” como parser ilimitado. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-11** · linha 148 | MVP | Reaproveitar e integrar · HDN-04/08 | Templates versionados por material, privados/permitidos e com hash. Caminho interno do Drive não vira link público. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-12** · linha 149 | MVP | Reaproveitar e integrar · HDN-04/06 | Sugestão baseada em política publicada; diagnóstico declarado não comprova impacto, e alteração pelo analista exige motivo. **Reuso:** form-rules/form-catalog/support-intake. |
| **RF-FOR-13** · linha 150 | Fase 2 | Acrescentar/antecipar · HDN-14 | Vídeo/gravação fica dependente de scan/preview/custo/quota próprios; não liberar tipos hoje não qualificados. **Reuso:** form-rules/form-catalog/support-intake. |

## Ciclo de vida, prioridade e SLA

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-CIC-01** · linha 173 | MVP | Ajustar explicitamente · HDN-03 | Continuação do número legado exige inventário/cutover de sequência, colisões e decisão por workspace. Preservar UUID e referência histórica; não renumerar CG já emitidos. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-02** · linha 174 | MVP | Reaproveitar e integrar · HDN-05/09 | Preservar eventos/auditoria/outbox/recibo atômicos. Disparar intenção de notificação não é confirmar entrega. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-03** · linha 175 | MVP | Reaproveitar e integrar · HDN-05/09 | Reaproveitar revisão e retorno, com lista de campos solicitados, dados anteriores preservados e evidência revalidada; nota interna não equivale a resposta. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-04** · linha 176 | Fase 2 | Reaproveitar e integrar · HDN-05/09 | Fase 2 e política/canal aprovados. Não autoencerrar pendência sensível nem ignorar aviso com entrega desconhecida. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-05** · linha 177 | MVP | Ajustar explicitamente · HDN-05/09 | Sete dias são sugestão, não default. Reabertura guarda episódio, consumo e violação prévios; prazo atual publicado controla a decisão. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-06** · linha 178 | MVP | Ajustar explicitamente · HDN-09 | Dois relógios já existem como motor; completar calendário/SQL. Não parar solução ao escalar bug nem zerar histórico na reabertura; atualização técnica pode ter relógio separado. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-07** · linha 179 | MVP | Reaproveitar e integrar · HDN-05/09 | Reaproveitar prioridade versionada; dois dias úteis e regras de crítico precisam de política aprovada e exceções, sem impor promessa automaticamente. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-08** · linha 180 | Fase 2 | Reaproveitar e integrar · HDN-05/09 | 75%/plantão são propostas de operação que dependem de responsáveis/canal/scheduler; alertas idempotentes, sem alarmar destinatários não autorizados. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-09** · linha 181 | Fase 2 | Acrescentar/antecipar · HDN-05/09 | Relações e mescla exigem política de audiência. Mesmo defeito em contas distintas pode compartilhar causa, nunca conversa/anexo de outro cliente. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-10** · linha 182 | Fase 2 | Acrescentar/antecipar · HDN-05/09 | Subtarefas internas são contribuição a separar de checklist; dono/prazo/histórico por etapa, sem sub-ACL que amplie o chamado. **Reuso:** support-workflow/sla-clock/business-calendar. |
| **RF-CIC-11** · linha 183 | MVP | Ajustar explicitamente · HDN-05/09 | Motivos de encerramento são contribuição; “problema encaminhado” não deve fingir resolução. Estado final e motivo precisam de compatibilidade aprovada. **Reuso:** support-workflow/sla-clock/business-calendar. |

## Central de atendimento

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-CEN-01** · linha 191 | MVP | Reaproveitar e integrar · HDN-05 | Completar SQL/índices/metadata de fila; filtros e ordenação no universo autorizado, asOf explícito e contagem antes de paginação. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-02** · linha 192 | MVP | Reaproveitar e integrar · HDN-05 | Equipes de fila são diferentes de roles/permissões; atribuição verifica operador e cobertura integral, sem transferir acesso. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-03** · linha 193 | MVP | Reaproveitar e integrar · HDN-05 | Cockpit mínimo no MVP com fontes persistidas. Métrica ausente é indisponível, nunca zero para parecer completo. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-04** · linha 194 | MVP | Reaproveitar e integrar · HDN-05 | Compor tela única preservando endpoints/DTOs internos separados; previews qualificados, sem HTML/planilha executável fornecida por cliente. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-05** · linha 195 | MVP | Reaproveitar e integrar · HDN-05 | Reaproveitar macros públicas com prévia e confirmação. Acrescentar nome/obra somente por contexto permitido, nunca variáveis de notas/PII genéricas. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-06** · linha 196 | Fase 2 | Acrescentar/antecipar · HDN-05 | Ficha de cliente é novo agrupamento de leituras autorizadas; por obra/material e com atualização, sem dashboard que exponha toda a conta ao N1 sem concessão. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-07** · linha 197 | MVP | Acrescentar/antecipar · HDN-01/05 | Contribuição prioritária. Nesta rodada: referência versionada, validação de checklist e guarda de resolve na aplicação existente. Marcação/UI/SQL ainda necessários. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-08** · linha 198 | MVP | Acrescentar/antecipar · HDN-05 | Canal de origem e on-behalf entram cedo. Solicitante verificado, executor separado, motivo/proveniência; isso não instala integração WhatsApp. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-09** · linha 199 | Fase 2 | Acrescentar/antecipar · HDN-05 | Atalho configurado pela origem, sem tokens ou dados privados na URL; não elevar contexto ao abrir tela GEO. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-10** · linha 200 | Fase 3 | Reaproveitar e integrar · HDN-15 | Escrita assistida permanece Fase 3 com aprovação, payload e confirmação; checklist não implementa nem autoriza essas chamadas. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-11** · linha 201 | MVP | Acrescentar/antecipar · HDN-01/07 | Contribuição prioritária. Checklist sensível exige evidência e reconhecimento por executor; não dispara comando, substitui alçada ou concede permissão GEO. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-12** · linha 202 | Fase 2 | Acrescentar/antecipar · HDN-05 | Menção interna não é seguidor público. Transferência preserva histórico, nota e acesso atual do novo analista. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-13** · linha 203 | Fase 2 | Acrescentar/antecipar · HDN-05 | Tempo de trabalho explícito, corrigível com auditoria, separado do tempo decorrido/SLA; não inferir produtividade de cliques. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-14** · linha 204 | Fase 2 | Acrescentar/antecipar · HDN-05 | Ações em massa são N intenções com autorização por chamado e resumo de efeitos; não usar consulta inicial como permissão permanente. **Reuso:** portal-read/support-workflow/knowledge. |
| **RF-CEN-15** · linha 205 | Fase 2 | Acrescentar/antecipar · HDN-05 | Atalhos/foco/teclado requerem teste real de navegador/acessibilidade; evitar atalhos destrutivos e perda de rascunho. **Reuso:** portal-read/support-workflow/knowledge. |

## Base de conhecimento e autoatendimento

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-BC-01** · linha 213 | MVP | Ajustar explicitamente · HDN-11 | Há contradição com a introdução que posterga KB. Orientação mínima curada no MVP; editor amplo e mídia após provedor e saneamento, sem bloquear cadastros. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-02** · linha 214 | MVP | Ajustar explicitamente · HDN-11 | “Isso resolveu” é autodeclaração de ajuda, não prova causal de ticket evitado nem resolução de atendimento. Não tornar consulta obrigatória. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-03** · linha 215 | Fase 2 | Acrescentar/antecipar · HDN-11 | Sinônimos revisados por produto/material e contexto; não confundir adicional/sobra ou comportamento legado. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-04** · linha 216 | MVP | Reaproveitar e integrar · HDN-11 | Preservar audiência pública/interna na persistência/SQL/snippets, não somente no editor ou CSS. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-05** · linha 217 | Fase 2 | Acrescentar/antecipar · HDN-11 | Completar responsável/revisão/feedback; fonte vencida sinalizada e conteúdo retirado quando inseguro, sem reescrever artigos históricos. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-06** · linha 218 | MVP | Ajustar explicitamente · HDN-11/HDW-00b | Carga automática recusada. 171+50 são candidatos: HDW-00b mantém quarentena, marcadores e seleção humana. Revisão alegada pelo novo documento não remove achados. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-07** · linha 219 | Fase 2 | Reaproveitar e integrar · HDN-11 | Limitações com fonte/data/aplicabilidade/contorno qualificado, sem converter “a confirmar” ou manual legado em fato atual. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-08** · linha 220 | Fase 2 | Acrescentar/antecipar · HDN-11 | Mudança publicada exige evidência da origem e versão, revisão de artigos afetados e audiência; não usar status de backlog como release. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-09** · linha 221 | Fase 3 | Reaproveitar e integrar · HDN-11 | Diagnóstico guiado avançado Fase 3; preservar roteiros internos úteis antes, sem scripts de manutenção travestidos de leitura. **Reuso:** knowledge + HDW-00/00b. |
| **RF-BC-10** · linha 222 | Fase 2 | Acrescentar/antecipar · HDN-11 | Resposta para artigo vira rascunho sanitizado, com revisão editorial; não copiar conversa privada ou evidência de clientes. **Reuso:** knowledge + HDW-00/00b. |

## IA no help desk

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-IA-01** · linha 230 | MVP | Reaproveitar e integrar · HDN-11/15 | Restrições obrigatórias para qualquer IA, mas nenhuma IA precisa estar ativa no MVP. Fonte/ACL/limites/custos/trace são pré-requisitos, não uma entrega automática. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-02** · linha 231 | Fase 2 | Reaproveitar e integrar · HDN-15 | Sugestão não executa reclassificação nem muda prioridade/SLA; limiar/calibração em avaliação e decisão humana. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-03** · linha 232 | Fase 2 | Reaproveitar e integrar · HDN-15 | Resumo interno com citação e revisão humana; somente contexto autorizado, sem dados de outras contas. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-04** · linha 233 | Fase 2 | Reaproveitar e integrar · HDN-15 | Prévia com fontes, edição e confirmação; não enviar sozinha nem tratar texto do modelo como obrigação comercial. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-05** · linha 234 | Fase 2 | Reaproveitar e integrar · HDN-15 | Contrato com o Dev Agent, isolamento, sanitização e resultado interno com fontes; não presumir MCP/API real disponível. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-06** · linha 235 | Fase 3 | Reaproveitar e integrar · HDN-15 | Anexo primeiro passa pipeline seguro; extração assistida não corrige fonte, executa fórmula ou valida engenharia. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-07** · linha 236 | Fase 3 | Reaproveitar e integrar · HDN-15 | Assistente público somente artigos aptos, consentimento para anexar conversa, saída para atendimento sem bloqueio e budgets reais. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-08** · linha 237 | Fase 3 | Reaproveitar e integrar · HDN-15 | Semelhança sugere incidente; não agrega/publica chamados de clientes diferentes ou faz merge automaticamente. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-09** · linha 238 | Fase 2 | Reaproveitar e integrar · HDN-15 | Log com resultado/fontes/revisão humana e retenção aprovada, sem guardar prompts/PII irrestritos. **Reuso:** nenhum provedor de IA ativo nesta entrega. |
| **RF-IA-10** · linha 239 | Fase 2 | Reaproveitar e integrar · HDN-15 | Switch por recurso/conta, quotas distribuídas e custos aprovados; desligar não bloqueia atendimento humano. **Reuso:** nenhum provedor de IA ativo nesta entrega. |

## Notificações

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-NOT-01** · linha 262 | MVP | Reaproveitar e integrar · HDN-09 | Completar domínio/provedor e evidências de autenticação; nenhum DNS ou e-mail é alterado nesta rodada. **Reuso:** outbox-dispatch/delivery-ledger/templates. |
| **RF-NOT-02** · linha 263 | MVP | Reaproveitar e integrar · HDN-09 | Modelos publicados por versão, variáveis públicas permitidas e renderização escapada; não editor de código arbitrário. **Reuso:** outbox-dispatch/delivery-ledger/templates. |
| **RF-NOT-03** · linha 264 | MVP | Ajustar explicitamente · HDN-09 | Completar ledger real. Estados incluem pending/sending/accepted/unknown/delivered/bounced, e destinatário visível somente à audiência permitida. **Reuso:** outbox-dispatch/delivery-ledger/templates. |
| **RF-NOT-04** · linha 265 | Fase 2 | Reaproveitar e integrar · HDN-09 | Inbound separado com threading, verificação de remetente/identidade, abuso, dedup e scan; From ou token em endereço não dão acesso. **Reuso:** outbox-dispatch/delivery-ledger/templates. |
| **RF-NOT-05** · linha 266 | Fase 2 | Reaproveitar e integrar · HDN-09 | Preferências e sino com contrato/adaptador próprios; revogação e mensagens obrigatórias de segurança têm política separada. **Reuso:** outbox-dispatch/delivery-ledger/templates. |
| **RF-NOT-06** · linha 267 | Fase 3 | Reaproveitar e integrar · HDN-09 | API oficial/consentimento/custo aprovados e modelo de destinatários; registrar origem WhatsApp no MVP não significa habilitar este canal. **Reuso:** outbox-dispatch/delivery-ledger/templates. |

## Bugs, incidentes e pedidos de melhoria

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-BUG-01** · linha 275 | MVP | Acrescentar/antecipar · HDN-05/14 | Link manual no MVP é contribuição prática. Fonte/origem e audiência revisadas; não criar item remoto até adapter e payload qualificados. **Reuso:** external-work/support-workflow. |
| **RF-BUG-02** · linha 276 | MVP | Reaproveitar e integrar · HDN-05/14 | Contorno revisado e contextual, sem instrução destrutiva para apagar prova ou dados offline; preservar ressalvas. **Reuso:** external-work/support-workflow. |
| **RF-BUG-03** · linha 277 | MVP | Ajustar explicitamente · HDN-05/14 | Cinco dias são exemplo de cadência, não prazo aprovado. Manter SLA/violação de solução e criar cadência de atualização separada. **Reuso:** external-work/support-workflow. |
| **RF-BUG-04** · linha 278 | Fase 2 | Reaproveitar e integrar · HDN-05/14 | Mesma causa técnica pode ligar vários tickets privados, mas aviso é por destinatário com ACL; prova de release real e revisão de artigo. **Reuso:** external-work/support-workflow. |
| **RF-BUG-05** · linha 279 | Fase 2 | Acrescentar/antecipar · HDN-05/14 | Incidente é entidade com escopo e mensagem pública curada; automação em massa e encerramento exigem condições explícitas. **Reuso:** external-work/support-workflow. |
| **RF-BUG-06** · linha 280 | Fase 2 | Acrescentar/antecipar · HDN-05/14 | Contagem por construtora pseudonimizada/privada, não exposição de clientes; decisões versionadas sem promessa de prazo. **Reuso:** external-work/support-workflow. |
| **RF-BUG-07** · linha 281 | Fase 2 | Reaproveitar e integrar · HDN-05/14 | Taxonomia de motivo/categoria/causa separada; decisão humana, não inferência automática pela IA. **Reuso:** external-work/support-workflow. |
| **RF-BUG-08** · linha 282 | Fase 3 | Acrescentar/antecipar · HDN-05/14 | Página pré-login só status global aprovado e sem identificação de clientes/obras. Não publicar detalhes internos de incidente. **Reuso:** external-work/support-workflow. |

## Implantação, piloto e backup como fluxos de projeto

| Código / fonte | Prioridade original | Disposição / etapa | Decisão, critério e ligação ao existente |
|---|---|---|---|
| **RF-PRJ-01** · linha 303 | MVP | Ajustar explicitamente · HDN-08/10 | Contribuição forte: etapas, responsáveis e dependências. Sete dias permanecem política a aprovar; cronograma não exige obra já existente. **Reuso:** support-intake/approvals/package-delivery. |
| **RF-PRJ-02** · linha 304 | Fase 2 | Acrescentar/antecipar · HDN-08/10 | Projeção pública reduzida, pendências próprias e progresso persistido; não expor scripts/checklists técnicos internos. **Reuso:** support-intake/approvals/package-delivery. |
| **RF-PRJ-03** · linha 305 | MVP | Ajustar explicitamente · HDN-01/08 | Conferência versionada por cliente/material; flags do wiki são orientações a qualificar, não defaults que o Help Desk altera. Modelos desta rodada continuam drafts. **Reuso:** support-intake/approvals/package-delivery. |
| **RF-PRJ-04** · linha 306 | Fase 2 | Acrescentar/antecipar · HDN-08/10 | Checkpoint como registro auditável; convite Google Calendar/Teams é ação externa distinta, não criado automaticamente. **Reuso:** support-intake/approvals/package-delivery. |
| **RF-PRJ-05** · linha 307 | MVP | Ajustar explicitamente · HDN-10 | Separar geração, entrega autorizada, prazo comercial e eventual desativação na origem. URL curta não é o prazo do pacote; aprovação/entrega não desativam obra. **Reuso:** support-intake/approvals/package-delivery. |
| **RF-PRJ-06** · linha 308 | Fase 3 | Reaproveitar e integrar · HDN-15 | Gerador de pacote na origem é Fase 3 e contrato próprio; Help Desk não deve inventar Databook ou equivaler a restore. **Reuso:** support-intake/approvals/package-delivery. |
| **RF-PRJ-07** · linha 309 | Fase 3 | Ajustar explicitamente · HDN-15 | Piloto comercial da obra não é o gate técnico de liberação do Help Desk. Duração citada é contexto a confirmar, não cronograma automático. **Reuso:** support-intake/approvals/package-delivery. |
| **RF-PRJ-08** · linha 310 | MVP | Ajustar explicitamente · HDN-08/10 | Estado da obra na origem e acesso no Help Desk exigem contrato revisado; não usar existência de outra obra ativa para conceder acesso a todas. **Reuso:** support-intake/approvals/package-delivery. |

## Leitura das contribuições não codificadas

Os oito perfis, nove famílias, tabelas de formulários e dez etapas de implantação também são requisitos de desenho. Foram incorporados ao comparativo e ao plano sem inventar códigos RF no documento original. Os grupos/campos/estados citados precisam de contratos da origem e decisões de produto quando divergem do sistema implementado.

Os rótulos “a definir”, “a decidir”, “sugestão”, “ex.” e “número a atualizar” são preservados como pendências. Não há transformação dessas passagens em defaults aprovados.
