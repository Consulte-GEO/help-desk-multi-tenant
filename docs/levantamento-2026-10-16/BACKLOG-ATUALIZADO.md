# Backlog reconciliado —16/10/2026

Fonte Help Desk `f13754e`; Wiki irmã `72f4e60`. São49 IDs históricos reconciliados e MEL-09 aprovada; não50 funcionalidades inteiramente ausentes. Categorias e contagens em [LEIA-PRIMEIRO](LEIA-PRIMEIRO.md). As prioridades são propostas, sem datas. Reuso e conclusão observável abaixo prevalecem sobre passos antigos que ficaram superados.

As fontes com `src/`, `web/`, `docs/` etc. são relativas à raiz do repositório Help Desk. Fontes começadas por AUDITORIA são arquivos deste pacote. Cada item remete à evidência atual; veja relatórios por domínio para análise de código/linhas. Dependência é de conclusão/liberação, não proíbe preparação isolada. Tarefa futura/condicional não autoriza contrariar adiamentos. Estimativas relativas antigas não foram redimensionadas.

## HD-001 — Reconciliar fonte canônica e documentação corrente

**Classificação:** Decisão / política / documentação. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Este levantamento reconcilia o backlog, mas os documentos introdutórios ainda misturam fotografias antigas (schema0.24/17 migrations, atendimento fechado) e atuais. Falta uma síntese canônica curta e manutenção das referências correntes, preservando históricos.

**Reaproveitar:** Checkpoints datados e este pacote.

**Conclusão verificável:** README/estado/plano corrente apontam para o mesmo SHA, schema e recibos; outros históricos identificados por data, sem apagar evidências.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `AGENTS.md`; `README.md`; `docs/02-PLANO-DE-DESENVOLVIMENTO.md`; `docs/apoio-implantacao-fluxos-ui-2026-10-16.md`.

## HD-002 — Alinhar contrato público de capacidades e rotas

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Reconciliar OpenAPI/rotas/capacidades efetivamente montadas. O checker de contratos atual é estrutural; falta validação oficial do contrato e conformidade das respostas relevantes no runtime composto.

**Reaproveitar:** Handlers, DTOs, checker estrutural e contratos existentes.

**Conclusão verificável:** Contrato validado formalmente, respostas de capacidade coerentes com configuração e testes de conformidade das rotas montadas; não anunciar módulos candidatos.

**Dependências atuais:** HD-001

**Evidências:** `scripts/check-contracts.ts:1`; `src/http/handler.ts:12`; `src/infrastructure/runtime.ts:33`; `src/infrastructure/consultegeo-runtime.ts:54`.

## HD-003 — Concluir aceite da segunda onda de notificações

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Onda2 já tem oito e-mails reais do CG-10002. Falta aceitar solução, encerramento, reabertura e cancelamento, incluindo destinatários e recebimento. Não é ausência do workflow nem repetição do bug PR49.

**Reaproveitar:** Workflow, notificações e retorno do cliente corrigidos.

**Conclusão verificável:** Jornadas legítimas autorizadas registram estado, checklist, evento, intenção, entrega e caixa; replay não duplica e dados privados permanecem privados.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md:26`.

## HD-004 — Operar exceções e decidir expansão do piloto de e-mail

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Monitor V2 e coleta de abertura/clique já publicados e comprovados. Restam filtros complementares, mobile360px, Tab completo, endereço novo/admin e máscara/equipe, operação de exceções e decisão de expansão/pausa do piloto.

**Reaproveitar:** Histórico/fila/atenção, filtros, modal, timeline, callbacks nativos e cobertura.

**Conclusão verificável:** Cumprir AC-EMAIL e política de piloto; nenhum N/D vira zero, nenhuma intenção antiga vira coorte nova; somente uma tentativa quando houver uma.

**Dependências atuais:** HD-009

**Evidências:** `docs/implementation/EMAIL-MONITOR-V2-ACEITE-AUTENTICADO-2026-10-16.md`; `docs/155-EMAIL-KIT-ONDA2-2026-10-15.md`.

## HD-005 — Concluir recuperação Auth e melhorar entregabilidade

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Recuperação/senha existem no código, ocultas no modo simples. Falta decisão de exposição da jornada, diagnóstico da entrega Auth (e-mail anterior em spam) e aceite integral pelo titular. Não é tarefa para desligar tracking do domínio compartilhado.

**Reaproveitar:** Fluxos Auth e transportes existentes.

**Conclusão verificável:** Link e destinatário corretos, troca completa válida, link vencido/reutilizado recusado e retorno à sessão coerente, sem alterar autoridade do usuário.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `web/access-mode.js:3`; `web/app.js:514`; `docs/handoff-2026-10-15/CONVERSAS-E-DECISOES.md`.

## HD-006 — Reconciliar os dois cenários antigos de logout global

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Logout global existe e está oculto no modo simples; faltam dois cenários combinados de regressão e aceite Auth entre dispositivos, sem evidência de bug atual.

**Reaproveitar:** Logout local/global, confirmação, limpeza e testes separados.

**Conclusão verificável:** Confirmação antiga após nova identidade não atua na nova sessão; timeout real atravessando o estado preserva incerteza/limpeza corretas; verificar revogação sem prometer invalidar bearer antes de expirar.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/122-HD-P06-ENCERRAMENTO-GLOBAL-DE-SESSOES.md:19`; `tests/human-global-signout.test.ts`; `tests/browser-human-session.py:527`.

## HD-007 — Retomar a decisão de MFA quando o titular autorizar

**Classificação:** Adiado / fase futura. **Prioridade proposta:** Adiado.

**Situação e trabalho restante:** Titular adiou ativação/aceite do MFA sensível. Enrolamento inicial e desafio já existem; não há autorização para contornar o adiamento.

**Reaproveitar:** Auth, TOTP, desafio e guardas existentes.

**Conclusão verificável:** Retomada explícita, fator real do titular e recuperação/sucessão qualificados, antes de liberar operações que o exigem.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/154-ACESSO-MFA-ONDA2-2026-10-15.md`; `docs/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md:34`.

## HD-008 — Qualificar revisão/aprovação e avisos 21–24

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** Condicional.

**Situação e trabalho restante:** Revisão/aprovação de solicitações possui serviços montados, mas faltam política, roster, audiência e capacidades legítimas; avisos21–24 ainda não ativados. A liberação depende da decisão MFA.

**Reaproveitar:** Revisão, aprovação, withAdministrativeAssurance e templates já existentes.

**Conclusão verificável:** Ator autorizado decide revisão exata com CAS, sem autoaprovação/escopo implícito; avisos só chegam ao público autorizado e MFA é comprovado.

**Dependências atuais:** HD-007, HD-009

**Evidências:** `src/infrastructure/consultegeo-runtime.ts:43`; `docs/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md:34`.

## HD-009 — Fixar dicionário de entidades, autoridade e públicos

**Classificação:** Decisão / política / documentação. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Consolidar construtora/conta/obra/contrato/grupo/master/beneficiário e quem pode solicitar, aprovar, executar e consultar cada ação. Há políticas e coberturas; falta decisão operacional inequívoca para ampliar cadastros e audiência.

**Reaproveitar:** ACL e resolução de contexto existentes.

**Conclusão verificável:** Tabela versionada com responsáveis e escopos; mesmo domínio/grupo não concede todas as obras; contrato comercial e grant técnico permanecem distintos.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/handoff-2026-10-15/AUDITORIA-WIKI-E-NEGOCIO.md`; `src/domain/policy.ts`; `src/integrations/consultegeo/configuration.ts`.

## HD-010 — Reconciliar SLA, calendário, pausas e reabertura

**Classificação:** Decisão / política / documentação. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Calendário08–18h e janela de reabertura sete dias já foram publicados. Reconciliar recibo/política efetiva com JSON draft e regras divergentes das fontes; explicitar pausa, horário útil, feriados, reabertura e prioridade.

**Reaproveitar:** Calendário, motor e publicação de configuração.

**Conclusão verificável:** Negócio aprova política e versão instalada; exemplos reproduzíveis e sem recálculo silencioso de históricos. Não escolher regra de engenharia a partir de trecho de Wiki.

**Dependências atuais:** HD-009

**Evidências:** `docs/149-CONSULTEGEO-ATIVACAO-2026-10-14.md:11`; `profiles/consultegeo/operational-policy.v1.json`; `src/domain/sla-clock.ts`.

## HD-011 — Adicionar validação semântica aos formulários existentes

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Campos operacionais são majoritariamente texto. Evoluir compilador/publicador para e-mail, números/unidades e documentos tipados; validação semântica servidor+UI e normalização preservando original.

**Reaproveitar:** Motor decimal/integer/cnpj e formulários dinâmicos existentes.

**Conclusão verificável:** Erro por campo, limites/unidades corretos, versões antigas legíveis e validação de dado sem conceder identidade/acesso. CPF/CNPJ separados conforme modelo aprovado.

**Dependências atuais:** HD-009

**Evidências:** `src/application/consultegeo-registration-operation.ts:15`; `src/integrations/consultegeo/configuration.ts:11`; `shared/form-rules.js:52`.

## HD-012 — Completar pedidos de usuário e acesso com alçada explícita

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Cinco ações de usuário já existem, mas beneficiário e grupo são declarações livres. Completar alçada, evidência de antes/depois, campos e revisão de acesso por obra. Diretório vivo continua dependência GEO adiada.

**Reaproveitar:** Inclusão/alteração/desativação/reenvio/liberação e operação manual.

**Conclusão verificável:** Pedido não concede perfil por texto; beneficiário/obra/alçada revalidados, acessos anteriores preservados e conclusão manual conferida na origem. Telefone obrigatório somente se decidido.

**Dependências atuais:** HD-009, HD-011

**Evidências:** `src/application/consultegeo-registration-operation.ts:19`; `src/domain/registration-action-catalog.ts:12`.

## HD-013 — Completar traço e padrões técnicos por material

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Traço já cobre concreto/graute e propriedades básicas. Completar modelo por material/aplicação, flow/argamassa/padrões quando confirmados e unidades/tolerâncias/relações necessárias.

**Reaproveitar:** Formulário de traço e snapshots atuais.

**Conclusão verificável:** Modelos homologados por especialista, exemplos completos/incompletos, nenhuma norma/default inventado e alterações com alcance explícito.

**Dependências atuais:** HD-011

**Evidências:** `src/application/consultegeo-registration-operation.ts:20`; `docs/handoff-2026-10-15/AUDITORIA-WIKI-E-NEGOCIO.md`.

## HD-014 — Completar usina, fornecedor e laboratório

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Usina/fornecedor/laboratório têm inclusão mínima. Completar vínculos central/obra, contatos por finalidade e modo manual/automático por obra quando aplicável.

**Reaproveitar:** Oito inclusões cadastrais atuais.

**Conclusão verificável:** Entidade e relação identificadas, escopo por obra e efeitos revisados; conferência humana antes de comunicar execução. Integração automática só com contrato real.

**Dependências atuais:** HD-009, HD-011

**Evidências:** `src/application/consultegeo-registration-operation.ts:21`; `src/application/consultegeo-registration-operation.ts:26`.

## HD-015 — Completar bloco, cerâmica e cabos com modelos reais

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Bloco, cerâmica e cabos têm formulários mínimos; faltam modelos reais homologados e regras específicas de material, oferta de template e campos confirmados.

**Reaproveitar:** Inclusões existentes e mecanismo de formulários.

**Conclusão verificável:** Modelos versionados e saneados, audiência e exemplos qualificados, campos técnicos revisados por responsável sem norma presumida.

**Dependências atuais:** HD-011

**Evidências:** `src/application/consultegeo-registration-operation.ts:23`; `docs/handoff-2026-10-15/AUDITORIA-WIKI-E-NEGOCIO.md:149`.

## HD-016 — Modelar alteração e vínculo de cadastros não humanos

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Alterar/inativar/vincular cadastros não humanos não tem jornada equivalente às ações de usuário. Modelar comandos e relações de usina/traço/fornecedor/laboratório/material.

**Reaproveitar:** Motor versionado, revisão e ACL existentes.

**Conclusão verificável:** Registro atual, antes/depois, alcance, alçada e evidência manual preservados; relação por obra distinta de alteração central.

**Dependências atuais:** HD-009, HD-011

**Evidências:** `src/application/consultegeo-registration-operation.ts:18`; `src/application/consultegeo-registration-operation.ts:27`.

## HD-017 — Melhorar triagem de dúvida, defeito e incidente

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Dúvidas/problemas já abrem chamados; falta questionário progressivo de contexto, impacto/urgência, reprodução, esperado/observado, contorno e classificação.

**Reaproveitar:** Famílias questions/problem e prioridade atuais.

**Conclusão verificável:** Coleta suficiente para reproduzir, sugestão de prioridade por política aprovada, histórico/motivo e sem promessa de SLA por texto livre. Incidente global é AUX-19.

**Dependências atuais:** HD-010, HD-011

**Evidências:** `src/integrations/consultegeo/configuration.ts:59`; `src/application/support-intake.ts:87`.

## HD-018 — Criar pedidos de configuração com impacto explícito

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Criar pedidos específicos de configuração GEO com antes/depois, cliente/material/obra, impacto histórico e pré-condições. Administração do formulário HelpDesk não substitui esse serviço.

**Reaproveitar:** Intake/revisão/configuração versionada existentes.

**Conclusão verificável:** Catálogo de parâmetros solicitáveis aprovado, alçada e alcance revisados, conclusão somente após evidência na origem.

**Dependências atuais:** HD-009, HD-011

**Evidências:** `src/integrations/consultegeo/configuration.ts:19`; `src/integrations/consultegeo/configuration.ts:60`.

## HD-019 — Tornar fila e detalhe mais operáveis

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Fila básica existe. Evoluir cockpit/detalhe: próximo passo/dono/pendências, totais completos, visões e filtros; busca corrente só assunto/UUID, ainda sem protocolo CG e conteúdo de conversa.

**Reaproveitar:** Fila, cards explicitamente limitados aos carregados, workflow/timeline/atribuição.

**Conclusão verificável:** Contagens antes da paginação no universo autorizado, múltiplas páginas e revogação verificadas; busca privada tem audiência própria; UI preserva dados após CAS/resultado incerto.

**Dependências atuais:** HD-026

**Evidências:** `web/app.js:143`; `src/infrastructure/postgres.ts:105`; `src/http/handler.ts:80`.

## HD-020 — Completar projeção corrente e apresentação do SLA

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** SLA já calculado e selado na abertura/revisão. Falta projeção corrente após todas as transições, leitura autorizada e UI com vencimento/consumo/pausa/violação/asOf/indisponibilidade.

**Reaproveitar:** Motor SLA, calendários e snapshots persistidos (migration M09c).

**Conclusão verificável:** Mesmo histórico/política gera mesmo relógio; reabertura não apaga consumo; horizonte e feriados explicados. capability só ativa após composição qualificada.

**Dependências atuais:** HD-010

**Evidências:** `src/application/support-intake.ts:90`; `src/application/support-workflow.ts:64`; `src/application/portal-read.ts:34`; `src/http/handler.ts:12`.

## HD-021 — Conectar lembretes e escalonamento SLA sem duplicação

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Não há scheduler SLA composto. Conectar propostas do motor a lembretes/escalonamento/espera/encerramento somente conforme política aprovada, reutilizando ledger de entrega.

**Reaproveitar:** Motor e outbox/worker/Resend atuais.

**Conclusão verificável:** Revalidar estado e audiência antes de enviar; job idempotente; nenhum aviso obsoleto/duplicado ou fechamento por falta de callback; pausas e reabertura qualificadas.

**Dependências atuais:** HD-010, HD-020, HD-004

**Evidências:** `src/domain/sla-clock.ts:90`; `src/infrastructure/runtime.ts:33`.

## HD-022 — Montar administração durável de membros e convites

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Serviços/handler/UI de membros e convites existem, mas sem store PostgreSQL operacional e montagem no runtime. Completar backoffice de equipe, capacidades, convites e sucessão.

**Reaproveitar:** Serviços, políticas e componentes existentes.

**Conclusão verificável:** Transação/CAS/audit/recibo duráveis, expiração/revogação e último admin protegidos. Convite não cria identidade automaticamente. Liberação sensível depende de MFA legítimo.

**Dependências atuais:** HD-009, HD-007

**Evidências:** `src/application/member-admin.ts:14`; `src/http/member-admin.ts:63`; `web/admin-members.js`; `src/infrastructure/runtime.ts:33`.

## HD-023 — Completar administração de contratos, cobertura e contexto

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Completar backoffice de contas/obras/contratos/vínculos/cobertura; candidato geral não está montado. Publicação específica de formulários Consulte GEO já é durável e está montada.

**Reaproveitar:** Publicador específico e planos privados atuais.

**Conclusão verificável:** Store e fluxos autorizados com histórico de vigência, contexto e grants separados; inativação e cobertura por obra testadas sem generalizar produto além da Consulte GEO.

**Dependências atuais:** HD-009, HD-007

**Evidências:** `src/application/configuration-admin.ts:13`; `src/http/configuration-admin.ts:18`; `src/infrastructure/consultegeo-runtime.ts:32`.

## HD-024 — Qualificar anexos privados e sua autoridade

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Anexos gerais de chamados continuam sem composição. Cancelamento do scanner exige nova política explícita para contratos que hoje exigem scan/clean; não reativar serviço pago nem marcar clean artificialmente.

**Reaproveitar:** Contratos de armazenamento/attachments; originais do Apoio em memória não são esse recurso.

**Conclusão verificável:** Ownership, tipos/limites/hash/MIME/quota, ACL viva e upload/download privados qualificados; contrato sem inspeção, se aprovado, informa a condição real e adapta guardas explicitamente.

**Dependências atuais:** HD-009

**Evidências:** `src/application/attachments.ts:16`; `src/application/attachments.ts:44`; `src/http/handler.ts:12`; `src/integrations/files/storage.ts`.

## HD-025 — Implementar retenção, órfãos e remoção verificável de arquivos

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Definir retenção e implementar órfãos/purge com prova de remoção e liberação segura de quota. Inventariar banco, imagens privadas, logs, IA, exportações e demais objetos efetivamente persistidos.

**Reaproveitar:** Metadados/contratos lifecycle e inventário atual.

**Conclusão verificável:** Política e exceções aprovadas, remoção idempotente comprovada e audit preservado. retainUntil não significa bytes removidos. Originais locais em memória não viram bucket inexistente.

**Dependências atuais:** HD-009

**Evidências:** `docs/handoff-2026-10-15/DESENVOLVIMENTO-E-OPERACAO.md:76`; `src/http/implementation-support.ts:49`; `docs/apoio-implantacao.md:24`.

## HD-026 — Montar portal de consulta e totais autorizados

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Portal/cockpit/report/export tem serviços/handler/store candidatos sem montagem produtiva. Completar contrato durável contra schema corrente e integrar à fila existente.

**Reaproveitar:** Portal e agregadores existentes.

**Conclusão verificável:** ACL antes de filtros/LIMIT/agregação, totais completos e asOf, revogação e obras vizinhas verificadas; sem fixture como fallback.

**Dependências atuais:** HD-009

**Evidências:** `src/application/portal-read.ts:59`; `src/domain/portal-query.ts:42`; `src/infrastructure/portal-read-store.ts:5`; `src/http/portal.ts:6`.

## HD-027 — Completar exportação durável e download seguro

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** CSV seguro/orquestração já existem; faltam store/reserva/objeto/auditoria duráveis e montagem do download autorizado. XLSX global é escopo a decidir; exportações Apoio já entregues são outra função.

**Reaproveitar:** Encoder CSV e contratos de exportação existentes.

**Conclusão verificável:** Conjunto completo declarado, limite/expiração, reautorização no link e nenhuma publicação parcial; fórmulas/privados protegidos e cancelamento/revogação testados.

**Dependências atuais:** HD-026, HD-025

**Evidências:** `src/application/report-export.ts:7`; `src/application/report-export.ts:16`; `src/http/portal.ts`.

## HD-028 — Entregar indicadores com definição e cobertura

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Indicadores de atendimento ainda devolvem indisponibilidade em candidatos. Definir métricas e montar queries/projeções: primeira resposta humana, solução, episódios/SLA, CSAT e bases relacionadas.

**Reaproveitar:** Componentes de relatório e fontes de eventos.

**Conclusão verificável:** Dicionário/denominadores aprovados, amostra reconciliada com eventos, cobertura exibida; dado ausente não vira zero e engajamento de e-mail não mede produtividade.

**Dependências atuais:** HD-026, HD-020

**Evidências:** `src/application/portal-read.ts:61`; `web/reports.js:4`.

## HD-029 — Montar CSAT com convite restrito e consumo controlado

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Serviço de consumo CSAT existe, sem emissão de convites/store operacional/montagem. Completar política de convite por resolução/reabertura e agregação.

**Reaproveitar:** Serviço de submissão e contratos atuais.

**Conclusão verificável:** Uso único limitado, prazo/revogação/concorrência e recibo; posse de convite não concede acesso ao chamado; nota/comentário não vazam.

**Dependências atuais:** HD-009, HD-028

**Evidências:** `src/application/csat.ts:6`; `src/application/csat.ts:12`; `src/infrastructure/runtime.ts:33`.

## HD-030 — Retomar revisão factual da Wiki por prioridade

**Classificação:** Adiado / fase futura. **Prioridade proposta:** Adiado.

**Situação e trabalho restante:** Revisão factual Wiki contra código/versão Novo GEO foi adiada expressamente. Fontes internas com ressalvas e corpus HDW em quarentena não são conteúdo cliente aprovado.

**Reaproveitar:** Wiki v1.7 já publicada e ferramentas editoriais.

**Conclusão verificável:** Retomada explícita com versão de origem/especialista, revisão prioritária de permissões/SLA/cadastros e resolução por afirmação; preservar VERIFICAR e custódia.

**Dependências atuais:** HD-037

**Evidências:** `docs/knowledge/consultegeo/editorial-review-result-v3.json`; `docs/knowledge/consultegeo/REMEDIACAO-CUSTODIA-WIKI-V3.md`; `AUDITORIA-WIKI.md`.

## HD-031 — Publicar pequeno pacote de conhecimento por audiência

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Base de conhecimento para clientes ainda sem pacote aprovado; manifesto externo vazio. Selecionar lote factual mínimo, público e hashes, montar distribuição/retirada segura.

**Reaproveitar:** Projeção editorial/quarentena/hash da Wiki.

**Conclusão verificável:** Aprovação editorial exata por audiência, revogação e retirada verificadas; Wiki interna não é exposta inteira. Pode revisar só o lote sem esperar todo corpus.

**Dependências atuais:** HD-009

**Evidências:** `AUDITORIA-WIKI.md`; `wiki-consultegeo/docs/editorial/aprovacoes.json (relativo à pasta do projeto, ver FONTES-E-DECISOES.md)`.

## HD-032 — Conectar ajuda contextual e macros revisáveis

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Knowledge/macros têm serviços/HTTP/painéis, mas sem store/montagem no shell e compositor. Conectar ajuda contextual por serviço e prévia editável de resposta aprovada.

**Reaproveitar:** Primitives knowledge/macros e ajuda informativa atual.

**Conclusão verificável:** ACL antes de busca/snippet, fonte/versão registrada, macro editável e envio humano normal; conteúdo interno nunca sugerido ao cliente.

**Dependências atuais:** HD-031

**Evidências:** `src/application/knowledge.ts:7`; `src/http/additional-support.ts:16`; `web/optional-support.js:40`.

## HD-033 — Concluir aceite do Apoio Implantação integrado

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Reformular IMP-02 para aceite do Apoio integrado atual. Cadastro/planilhas/laudos/revisão/processos/ajuda/e-mails e persistência já publicados. Setup independente/pooler antigo não bloqueiam esse módulo.

**Reaproveitar:** PR55/57/58/59/60 e backend privado já entregue.

**Conclusão verificável:** Cumprir AC-APOIO: jornada autenticada hospedada, retomada em outro dispositivo, revisão/devolução/reenvio, e-mail próprio real e qualificação IA/OCR real conforme uso.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/apoio-implantacao-fluxos-ui-2026-10-16.md:39`; `docs/apoio-implantacao-emails-publicacao-2026-10-15.md`.

## HD-034 — Implementar IMP-03: associação processo e chamado

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** IMP-03 ainda precisa associação autoritativa processo/submissão→chamado CG. Campo ticket_number atual usa IMP-UUID; compartilhar sessão/UI/fila não cria vínculo com protocolo CG.

**Reaproveitar:** Processos/submissões, fila e abertura CG existentes.

**Conclusão verificável:** Abertura/vínculo idempotente e transacional/reconciliável, mesmo protocolo após ACK perdido, nenhuma duplicação de chamado/aviso e projeção mínima por audiência.

**Dependências atuais:** HD-009, HD-033

**Evidências:** `src/infrastructure/implementation-support.ts:122`; `src/infrastructure/implementation-support.ts:124`; `modules/implantacao/modules/import-process/contracts.ts:8`.

## HD-035 — Completar jornada de nova obra e ajuste incremental

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Completar jornada cliente/nova obra/ajuste incremental integrada ao chamado e checklist de implantação. Wizard/parser/PDF/revisão internos já entregues; confirmação no GEO é recorte adiado.

**Reaproveitar:** Apoio interno completo e modelos R02/importação/laudos.

**Conclusão verificável:** Solicitação CG e processo mostram pendência/dono/próximo passo, versões/diferenças, revisão interna distinta de confirmação externa, checklist de acesso/configuração/treinamento e conferência final.

**Dependências atuais:** HD-034, HD-024

**Evidências:** `docs/apoio-implantacao-fluxos-ui-2026-10-16.md:24`; `modules/implantacao/docs/implantacao/PLANO_ORIGINAL_2026-10-14.md:580`.

## HD-036 — Definir e completar pacote de backup/encerramento

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Pedido Backup existe; pacote real de encerramento/backup da obra ainda precisa conteúdo, produtor, manifesto, audiência e download. Gerador GEO aguarda origem adiada.

**Reaproveitar:** Intake backup e contratos/exportação existentes.

**Conclusão verificável:** Autorizar geração/conteúdo/destinatário, expiração e hash; comprovar integridade e regra de desativação separada. ZIP não é restore; fechar chamado não desativa obra.

**Dependências atuais:** HD-037, HD-027

**Evidências:** `modules/implantacao/docs/implantacao/PLANO_ORIGINAL_2026-10-14.md:640`; `docs/operations/RECOVERY.md`.

## HD-037 — Qualificar origem Novo GEO sem inventar integração

**Classificação:** Adiado / fase futura. **Prioridade proposta:** Adiado.

**Situação e trabalho restante:** API/IdP/versão/contrato Novo GEO reais foram explicitamente adiados. Preparação local/manual segue; não inventar endpoint, identidade, dado vivo ou escrita de origem.

**Reaproveitar:** Conectores e contratos preparados.

**Conclusão verificável:** Retomada e origem fornecida; identidade/escopo/read-only primeiro, TLS/recibos/limites e negativas qualificados antes de qualquer execução.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/apoio-implantacao-fluxos-ui-2026-10-16.md:3`; `docs/156-E06-IMP02-BACKEND-2026-10-15.md`.

## HD-038 — Promover persistência HDA com contrato de segurança

**Classificação:** Entregue no recorte original. **Prioridade proposta:** Concluído.

**Situação e trabalho restante:** Persistência HDA oficial e worker manual_review já ativados: migration20/schema0.26 e compatibilidade0.27. Não resta a promoção descrita no título antigo. Isso não conclui HDA03–13.

**Reaproveitar:** Sete tabelas privadas, role, worker manual e GETs ativos.

**Conclusão verificável:** Evidência existente de promoção, consulta e três ciclos204 idle; manter runbook. Novas funções são HD-039–044. Não reaplicar migration.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/integrations/hda/ATIVACAO_STORAGE_WORKER_20261015.md:3`; `src/infrastructure/registration-runtime.ts:15`.

## HD-039 — Conectar abertura atômica à tarefa HDA

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Biblioteca transacional HDA existe, mas não está ligada ao intake. Conectar operação/snapshot/job à abertura CG na mesma transação/conexão, preservando atendimento humano.

**Reaproveitar:** Persistência HDA promovida e abertura CG atômica.

**Conclusão verificável:** Replay/rollback/COMMIT desconhecido recuperam mesma intenção/protocolo/outbox; binding/alvo/ator reais qualificados; análise indisponível não bloqueia fallback humano.

**Dependências atuais:** HD-038, HD-009

**Evidências:** `src/application/registration-persistence.ts:43`; `src/application/support-intake.ts`; `src/infrastructure/consultegeo-intake-store.ts`.

## HD-040 — Completar consulta, histórico, diff e edição da proposta HDA

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P1.

**Situação e trabalho restante:** GET/projeção HDA somente leitura já ativos; painel opcional não montado. Faltam histórico paginado, diff e edição por comandos/CAS na jornada.

**Reaproveitar:** GETs, projeções e painel existentes.

**Conclusão verificável:** Contexto/fetch autenticado corretos, revisão atual não se passa por história completa; edição invalida provas anteriores e proposta nunca é exibida como executada.

**Dependências atuais:** HD-039

**Evidências:** `src/http/registration-review.ts:9`; `src/application/registration-drafts.ts:16`; `web/registration-automation.js:6`.

## HD-041 — Qualificar worker de análise e CLI dedicada

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Worker manual hospedado já funciona; análise Dev Agent real/CLI dedicada segue não composta e sem qualificação de isolamento/orçamento. Biblioteca Claude não é sandbox.

**Reaproveitar:** Worker manual, contrato de análise e bridge preparados.

**Conclusão verificável:** Host Linux/WSL não-root, isolamento SO/rede, binário/hash/modelo/credencial restrita, orçamento/cancelamento/quarentena e análise real qualificados antes de ativar; sem escrever GEO.

**Dependências atuais:** HD-039, HD-037

**Evidências:** `src/infrastructure/registration-runtime.ts:15`; `workers/dev-agent-bridge/README.md:1`.

## HD-042 — Implementar aprovação HDA da revisão exata

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** Condicional.

**Situação e trabalho restante:** Aprovação HDA da revisão/hash/contexto exatos ainda não entregue. Aprovação de cadastro atual não autoriza execução HDA; MFA continua adiado.

**Reaproveitar:** Contratos/revisão existentes, sem liberar efeitos.

**Conclusão verificável:** Exibir efeitos/alvo, ator e MFA legítimos, proibir autoaprovação; mudança de origem/proposta/acesso/prazo invalida aprovação. Aprovar não executa.

**Dependências atuais:** HD-040, HD-007, HD-009

**Evidências:** `src/application/registration-drafts.ts:27`; `src/domain/registration-action-catalog.ts`; `AUDITORIA-WIKI.md`.

## HD-043 — Implementar executor determinístico e reconciliação GEO

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** Condicional.

**Situação e trabalho restante:** Executor/reconciliação GEO ainda futuros; catálogo só tem candidato grant_work e liveExecutionAllowed:false.

**Reaproveitar:** Catálogo fechado e contratos preparados.

**Conclusão verificável:** API homologada/plano exato aprovado, execução determinística com credencial restrita, idempotência e recibos de ambas pontas; resultado incerto exige consulta, sem retry cego.

**Dependências atuais:** HD-042, HD-037

**Evidências:** `src/domain/registration-action-catalog.ts:6`; `src/domain/registration-action-catalog.ts:12`.

## HD-044 — Qualificar resultado público e piloto HDA

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** Condicional.

**Situação e trabalho restante:** Resultado público e piloto de execução HDA não qualificáveis até existir execução real. Projeção cliente mínima já existe, mas notificação/efeito e operação piloto ainda não.

**Reaproveitar:** Projeção mínima e pipeline manual HDA.

**Conclusão verificável:** Verificar projeção/notificação mínima, falhas e retorno humano, revogação, limites/custos/donos/parada e autorização específica do piloto.

**Dependências atuais:** HD-043

**Evidências:** `src/application/registration-drafts.ts`; `AUDITORIA-WIKI.md`.

## HD-045 — Ensaiar restauração e reconciliação completa

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Restore completo ainda precisa ensaio reproduzível de banco+objetos+configuração+referências de chaves+ledger+revogações, incluindo schema0.27 e addons Apoio; completar aplicador durável onde necessário.

**Reaproveitar:** Planos e testes de recuperação existentes; não implica backup ausente.

**Conclusão verificável:** RPO/RTO aprovados e medidos, nova geração e reautorização, workers reconciliados; nenhum envio/efeito já confirmado repetido; outra pessoa reproduz o runbook em bancada descartável.

**Dependências atuais:** HD-025

**Evidências:** `docs/operations/RECOVERY.md:7`; `src/domain/recovery-plan.ts`.

## HD-046 — Medir capacidade e preparar operação com limites

**Classificação:** Aceite / qualificação residual. **Prioridade proposta:** P1.

**Situação e trabalho restante:** Runner local existe. Falta capacidade multi-instância hospedada, metas/SLO/custos aprovados e responsáveis/runbooks/alertas qualificados; pool1 por Function não limita concorrência global.

**Reaproveitar:** Runner, logs HTTP seguros e auditoria de mutação.

**Conclusão verificável:** Medir latência/erro/429/503/vizinho ruidoso/conexões/jobs/custo, fronteira/amostra explícitas e contenção/retomada com responsáveis. Metas locais não viram compromisso produtivo.

**Dependências atuais:** HD-009

**Evidências:** `docs/133-HD-P04-ENSAIO-DE-CAPACIDADE.md:30`; `docs/operations/SLO-CAPACIDADE-C15-DRAFT.md:3`; `docs/operations/INCIDENTS.md:19`.

## HD-047 — Qualificar legado V2 e decidir escopo de histórico

**Classificação:** Adiado / fase futura. **Prioridade proposta:** P3.

**Situação e trabalho restante:** Migração histórica legado V2 é fase futura: fonte/versão/período/identidades/escopo de anexos ainda precisam decisão e export real autorizado.

**Reaproveitar:** Conector/mapeamento preparados.

**Conclusão verificável:** Qualificação e dry-run saneado com correspondências/erros explícitos, preservando protocolo e sem recriar login compartilhado ou avisos retroativos.

**Dependências atuais:** Sem dependência HD obrigatória; políticas/atores e efeitos devem ser legítimos.

**Evidências:** `docs/integrations/GEO-LEGACY-QUALIFICACAO-PENDENTE.md:5`; `src/connectors/geo-legacy/mapping.ts:12`.

## HD-048 — Implementar migração de histórico legado somente leitura

**Classificação:** Adiado / fase futura. **Prioridade proposta:** P3.

**Situação e trabalho restante:** Importação de histórico legado somente leitura depende de HD-047; falta aplicador idempotente e reconciliação no escopo futuro aprovado.

**Reaproveitar:** Mapeamento e contratos de legado.

**Conclusão verificável:** Contagens/hashes/identidades/anexos conferidos, replay sem duplicação, leitura autorizada, sem novo SLA/envios/efeitos de chamados antigos.

**Dependências atuais:** HD-047

**Evidências:** `docs/integrations/GEO-LEGACY-QUALIFICACAO-PENDENTE.md`; `src/connectors/geo-legacy/mapping.ts`.

## HD-049 — Montar SSO e sessão de suporte somente com IdP real

**Classificação:** Adiado / fase futura. **Prioridade proposta:** Adiado.

**Situação e trabalho restante:** SSO/sessão de suporte aguardam IdP/API Novo GEO reais. Login próprio HelpDesk foi autorizado e está operacional; requisito antigo que proibia esse login foi substituído.

**Reaproveitar:** Auth direto, sessão por pessoa e contratos externos.

**Conclusão verificável:** Issuer/subject e audiência qualificados, consentimento/expiração/revogação e trilha de sessão de suporte, sem senha compartilhada/impersonação invisível.

**Dependências atuais:** HD-037

**Evidências:** `docs/handoff-2026-10-15/RASTREABILIDADE-107-RF.csv`; `src/infrastructure/runtime.ts`.

## MEL-09 — Localizar quem recebeu uma orientação depois corrigida

**Classificação:** Desenvolvimento ou composição. **Prioridade proposta:** P2.

**Situação e trabalho restante:** Registrar artigo/macro e versão exata quando aplicado ao chamado; retirada/substituição com motivo/autor; lista autorizada de usos e análise de impacto afetado/não afetado/inconclusivo/tratado, com evidência e comunicação corretiva humana explícita.

**Reaproveitar:** Conhecimento versionado, snapshots e conversa; completar composição de HD-032.

**Conclusão verificável:** Mensagem/snapshot anteriores imutáveis; ACL viva em lista/detalhe/contagem; revisão da correção e reautorização antes de enviar; idempotência; nenhuma inferência retroativa de toda cópia manual ou disparo em massa automático.

**Dependências atuais:** HD-032

**Evidências:** `docs/decisoes-e-emails-geolab-2026-10-15/DECISOES-E-BACKLOG-ADICIONAL.md:7`; `src/application/knowledge.ts:7`; `AUDITORIA-WIKI.md`.

