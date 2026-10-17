# Levantamento do core funcional — 16/10/2026

Auditoria somente leitura da árvore `helpdesk/`, HEAD `f13754e`, confrontada com `AGENTS.md`, os 49 itens do `docs/handoff-2026-10-15/BACKLOG.json`, o complemento `PENDENCIAS-RF-ESPECIFICAS.md`, a matriz dos 107 RF e checkpoints posteriores. Não houve execução de testes, inspeção de produção/browser, alteração de código ou commit. As referências abaixo são relativas a `C:/Users/thiag/OneDrive/Documentos/ChatGPT/Help Desk/helpdesk/`. Evidências hospedadas são registros documentais existentes, não uma nova homologação nesta auditoria.

## Resultado da reconciliação

O core de abertura e atendimento está implementado e montado: catálogo contextual, rascunho, prévia, abertura transacional com protocolo/snapshot, conversa pública, notas internas, timeline, busca por assunto/UUID, prioridade, assumir/liberar responsabilidade, workflow e checklist. Não há fundamento para recriar esses módulos por tarefas antigas de integração. Cadastros e acessos contempla oito tipos de inclusão e cinco ações de usuário; a execução GEO é manual. Oito cadastros não significa oito CRUDs.

Persistem desenvolvimento/composição reais em validação semântica e formulários de negócio; projeção corrente de SLA; backoffice genérico de membros/convites/contratos; portal com totais autorizados/indicadores/exportação; e complementos RF que ainda não têm jornada montada. Há também aceite real pendente de ações já implementadas. MFA do aprovador e origem Novo GEO permanecem adiados pelo usuário.

O backlog de 15/10 usava baseline `306dd5c`/PR49/schema0.25. O HEAD auditado já inclui monitor de e-mails V2/schema0.27, persistência HDA e Apoio Implantação integrado/publicado. Por isso, seus estados não são uma lista atual de funcionalidades ausentes. `src/version.ts:2` continua API/interface0.31.0; os documentos recentes registram core0.27/21 migrations e addon privado do Apoio. Não reusar contagens antigas como inventário corrente.

## O que já existe e não deve ser reimplementado

| Recorte / IDs antigos | Evidência no HEAD | Consequência |
|---|---|---|
| Abertura estruturada, rascunhos e protocolos; RF-CAT-01, RF-FOR-01/06, RF-CIC-01 | `src/infrastructure/consultegeo-runtime.ts:34` monta catálogo e GET/PUT de drafts; `:35` monta prévia/criação; `web/app.js:396` monta a jornada real; `src/application/support-intake.ts:87`–`:112` fixa prioridade, snapshot, protocolo e efeitos | Não relistar M09b/M09c/UX10 como implementação faltante. Restam aprimoramentos e aceites específicos abaixo. |
| Oito inclusões e cinco ações de usuário; HD-011–016 | `src/application/consultegeo-registration-operation.ts:9`, `:18`–`:30`; ações vêm de `src/integrations/consultegeo/configuration.ts:19`–`:22`; publicação e confirmação do usuário em `docs/150-CONSULTEGEO-CADASTROS-2026-10-14.md:21`–`:25` | Cadastro de Usuário, Traço, Usina, Laboratório, Bloco, Cerâmica, Cabos e Fornecedor existe. Alterar/desativar/reenviar acesso/liberar obra são ações de usuário, com identificadores declarados e execução manual. |
| Workflow/checklist; RF-CIC-02/03, RF-CEN-07/11 | Runtime `consultegeo-runtime.ts:50`–`:51`, rotas `:63`–`:64`; montagem `web/app.js:215`; transições `src/domain/support-workflow.ts:28`–`:56`; guarda de checklist `src/application/support-workflow.ts:66`–`:74` | Iniciar, triar, responder, pedir dados, aguardar interno/terceiro, resolver, fechar, reabrir, cancelar e transferir já têm regras. Checklist obrigatório realmente bloqueia resolução. |
| Conversa/notas/timeline, busca e comandos básicos; HD-019 | `src/http/handler.ts:80` em diante implementa lista, detalhe, mensagens, notas, timeline, atribuição, prioridade e transição; `src/domain/policy.ts:19`–`:23` separa notas; `consultegeo-runtime.ts:52` monta o acesso por recursos | Não confundir lacunas de cockpit/BI/equipes com ausência de fila e conversa básicas. |
| Calendário e relógios de SLA parcialmente persistidos; HD-010/020 | `src/domain/sla-clock.ts:20` calcula clocks; `src/application/support-intake.ts:90`/`:112` inclui clocks na abertura; `supabase/migrations/20261014015714_consultegeo_m09c_atomic_opening.sql:202`, `:205`, `:217` os sela no snapshot; `src/application/support-review.ts:91`, `:144`, `:171` calcula e envia clocks nas revisões/decisões | A frase histórica “ausência de persistência” é ampla demais. Falta uma projeção corrente completa e leitura operacional, não o motor inteiro nem o snapshot inicial. |
| Política inicial publicada | `docs/149-CONSULTEGEO-ATIVACAO-2026-10-14.md:11`, `:23` registra calendário útil 08–18h, reabertura sete dias e publicação real; `docs/150...:21` registra publicação da configuração de cadastro | O JSON `profiles/consultegeo/operational-policy.v1.json` ainda ter status draft não prova que nenhum calendário foi publicado. Deve-se reconciliar o artefato/recibo exato com decisões divergentes. |
| MFA básico, consulta de segurança e primeiro TOTP | `docs/154-ACESSO-MFA-ONDA2-2026-10-15.md:3`, `:19`; `web/access-mode.js:8`; `web/app.js:625` em diante preserva desafio antes da consulta de negócio | Não criar de novo MFA nem desativar guardas. Aceite do fator real e retomada pelo titular são etapas próprias. |
| Monitoramento e-mails V2 | `consultegeo-runtime.ts:29`–`:30`, `:55`; `web/app.js:104`–`:106`; `docs/implementation/EMAIL-MONITOR-V2-ACEITE-AUTENTICADO-2026-10-16.md:5`, `:15` em diante | Já existe histórico/fila/atenção, filtros e detalhe. Smoke autenticado desktop real está registrado; mobile/todos os filtros/mascaramento do agente continuam com limites próprios. Não classificar todo HD-004 como monitor inexistente. |
| Apoio Implantação | `src/infrastructure/runtime.ts:34`–`:35` monta `/v1/implementation-support`; `web/app.js:487` monta a aba; `docs/apoio-implantacao-fluxos-ui-2026-10-16.md:23` em diante registra qualificação e publicação PR60 | Cadastro em etapas, planilhas, laudos, rascunhos/processos e revisão existem na sessão HelpDesk para equipe/admin. Isso não equivale à conclusão de IMP-03 nem a execução Novo GEO. |

## Desenvolvimento e composição que continuam necessários

### D01 — Validação semântica dos cadastros (HD-011; RF-FOR-01/04)

**Estado:** pendência real de evolução, com motor reutilizável. A configuração operacional cria quase todos os valores pelo helper `input(...,'text',{maxLength})` (`src/application/consultegeo-registration-operation.ts:15`); e-mail, documentos fiscais, FCK, slump/tolerância, resistência e diâmetro permanecem texto (`:19`–`:26`). O motor genérico já possui tipos decimal/integer/cnpj e validação em `shared/form-rules.js:3`, `:52`, `:90`; porém a configuração Consulte GEO admite somente `text/textarea/boolean/select/lookup/file/info/download` em `src/integrations/consultegeo/configuration.ts:11` e recusa outros em `:36`. É preciso evoluir o contrato/publicador nativo de forma compatível, e não apenas trocar o campo no browser.

**Conclusão observável:** publicação de nova versão validada no servidor e UI; entradas inválidas recebem erro por campo; números/unidades e original normalizado distinguíveis; documentos/e-mails válidos não concedem identidade ou acesso; snapshots antigos continuam legíveis. Modelar CPF separadamente de CNPJ quando a política realmente aceitar os dois.

### D02 — Alçada e completude de pedidos de acesso (HD-012; RF-PER-02, RF-CEN-11)

**Estado:** cinco ações já existem, mas `requested_group` e `beneficiary` são declarações livres (`consultegeo-registration-operation.ts:19`, `:27`); telefone é opcional. Não há diretório vivo GEO nessa operação. O catálogo de automação continua candidato fechado, `liveExecutionAllowed:false`, em `src/domain/registration-action-catalog.ts:12`–`:14`, e apenas liberação de obra é ação candidata.

**Falta:** publicar alçadas/roster por pessoa e cobertura, orientar campos obrigatórios conforme modelos reais, registrar o antes/depois e evidência de execução manual. A integração de diretório/perfis vivos fica vinculada à origem adiada; não é necessário bloquear melhorias de coleta independentes.

**Conclusão:** solicitante não concede o próprio perfil preenchendo texto; equipe comprova beneficiário e obras, revalida alçada e preserva acessos existentes; retorno HelpDesk só anuncia resultado conferido na origem. Não tornar telefone obrigatório sem decisão/modelo.

### D03 — Traço e padrões por material (HD-013)

**Estado:** concreto/graute, FCK, brita, slump, tolerância, fornecedor e código existem (`consultegeo-registration-operation.ts:20`); flow/argamassa/aplicação/padrões de ensaio não estão representados nesse formulário. As fontes de negócio continuam secundárias e não bastam para definir regra de engenharia.

**Conclusão:** contrato revisado por material, unidades e tolerâncias explícitas; exemplos saneados completos/incompletos qualificados; dados desconhecidos não viram defaults; alteração mostra alcance e preserva o original.

### D04 — Usina, fornecedor e laboratório (HD-014)

**Estado:** há nome/documento/endereço mínimo da usina, nome/documento/contato do laboratório e nome/documento/contato do fornecedor (`:21`–`:22`, `:26`). Relação central/obra, contatos por finalidade e modo manual/automático por obra ainda não compõem o pedido atual.

**Conclusão:** identificar entidade e vínculo afetados, permitir escopo por obra quando a origem suportar, indicar efeitos e necessidade de conferência. Consulta/alteração automática depende de contrato real GEO; texto não cria fornecedor central.

### D05 — Bloco, cerâmica e cabos com modelos homologados (HD-015; RF-FOR-11)

**Estado:** formulários mínimos existem (`:23`–`:25`), com nome/fornecedor e poucas propriedades. A necessidade de modelo/valores adicionais consta de `docs/handoff-2026-10-15/AUDITORIA-WIKI-E-NEGOCIO.md:100` e `:149`; não houve checkpoint posterior qualificando modelos específicos desses três materiais.

**Conclusão:** obter e versionar modelos reais, definir somente campos confirmados e validar por material; exemplos completos/incompletos têm resultado esperado; oferta/download usa versão e audiência corretas. Não inventar norma ou campos obrigatórios.

### D06 — Alteração/vínculo de cadastros não humanos (HD-016)

**Estado:** `include` permite oito tipos; todas as demais ações caem no ramo de usuário (`consultegeo-registration-operation.ts:18` e `:27`). Não existe jornada equivalente de alterar/inativar/vincular usina/traço/laboratório/fornecedor/material na composição atual.

**Conclusão:** modelar comando por entidade e relação, identificar o registro atual, alcance por obra, revisão do efeito e evidência manual; ações centrais/destrutivas recebem alçada própria. Não reaproveitar “Alterar usuário” com outro rótulo.

### D07 — Triagem estruturada de dúvidas/defeitos/incidentes e prioridade (HD-017; RF-FOR-12, RF-CIC-07)

**Estado:** as famílias questions/problem já existem, mas a geração padrão só acrescenta orientação e `details` (`src/integrations/consultegeo/configuration.ts:59`–`:72`). `problem` tem quatro entradas de prioridade (`:21`), e o intake usa `fixedPriority` quando fornecida (`src/application/support-intake.ts:87`). Não há questionário operacional específico de impacto/urgência, reprodução, esperado/observado/contorno na configuração atual.

**Conclusão:** coleta progressiva suficiente para reproduzir e diferenciar dúvida/defeito/limite/melhoria; regra de sugestão aprovada, sem deixar texto escolher promessa de SLA; motivos/histórico de prioridade preservados. Incidente global e agrupamento de clientes são extensões próprias, não uma consequência automática do formulário.

### D08 — Pedidos de configuração com impacto (HD-018)

**Estado:** a enumeração de serviços no compilador (`configuration.ts:19`–`:22`, `:60`) abrange usuário/dúvidas/backup/nova obra/estrutura/problema. Não há família específica de configuração por cliente/material, antes/depois/efeitos históricos no pedido operacional. Existe administração da configuração do HelpDesk, que é outra função.

**Conclusão:** definir catálogo aprovado de configurações GEO solicitáveis, abrangência/antes/depois/pré-condições, alçada, efeito histórico e prova manual. Não confundir publicar formulário do HelpDesk com alterar parâmetro de ensaio na origem.

### D09 — Projeção corrente e apresentação de SLA (HD-020; RF-CAT-05, RF-CIC-06)

**Estado:** cálculo e snapshots de abertura/revisão já existem. A capability geral permanece `sla_clocks:false` (`src/http/handler.ts:12`). O workflow ordinário monta decisão/evento/audit/outbox/recibo (`src/application/support-workflow.ts:64`–`:84`) sem projeção de clocks no bundle; o store envia ao helper a submissão de comando, não um relógio (`src/infrastructure/support-workflow-store.ts:143`–`:145`). O portal candidato devolve SLA indisponível (`src/application/portal-read.ts:34`–`:35`). O app montado não consome endpoint de SLA.

**Falta:** leitura autorizada do histórico completo e política/calendário fixados, atualização/projeção após todas as transições e apresentação `dueAt/asOf/consumo/violação/pausa/indisponibilidade`. A fonte JSON draft deve ser reconciliada com o recibo instalado; não publicar novos prazos silenciosamente.

**Conclusão:** mesma versão/histórico produz mesmo resultado; espera/reabertura não apagam consumo e violações; horizonte/feriado/pausa explicados; API e UI só anunciam capacidade quando montadas/qualificadas.

### D10 — Lembretes, espera e escalonamento (HD-021; RF-CIC-04/08; AUX-13)

**Estado:** `src/domain/sla-clock.ts:90`–`:93` gera apenas `reminder_proposal`, dependente de canal aprovado. Os workers atuais tratam notificações e Apoio; não há composição do planejador de SLA no runtime. Resolver/fechar/reabrir são comandos existentes, não um scheduler de encerramento automático.

**Conclusão:** política publicada de destinatário/percentual/cadência/pausa/encerramento; job de produto idempotente revalida estado/acesso antes do envio; não manda aviso obsoleto nem encerra por falha/ausência de callback. Percentual75%, cinco dias e outros exemplos históricos não são defaults autorizados.

### D11 — Fila/cockpit com totais reais e filtros completos (HD-019/026; RF-CEN-01/02/03)

**Estado:** fila atual busca assunto/UUID, status, prioridade e atribuição, com paginação (`handler.ts:80` em diante). `web/app.js:143`–`:150` calcula cartões pelos itens carregados e **avisa explicitamente essa limitação**, inclusive teto500. Isso evita afirmar um total inexistente; a pendência é oferecer agregações completas, não corrigir um contador que já se apresenta como amostra.

Há candidato mais completo: `src/domain/portal-query.ts:42`–`:68` agrega antes do limite; `src/application/portal-read.ts:59`–`:62` fornece lista/cockpit/report/export; `src/http/portal.ts:6` tem as rotas. O runtime atual (`src/infrastructure/runtime.ts:33`–`:35`, `consultegeo-runtime.ts:54`–`:67`) não monta `createPortalHandler`. O adapter `portal-read-store.ts:5`–`:17` ainda se qualifica como candidato e exige contrato exato de banco.

**Conclusão:** completar autoridade/store e composição contra schema corrente; contar universo completo autorizado antes da paginação; oferecer equipes/roster, filtros/visões/ordenação por SLA quando SLA existir; metadados `asOf` e indisponibilidade real. Validar múltiplas páginas, revogação e obras vizinhas. Não substituir a fila existente por uma fixture de portal.

**Busca a ampliar quando priorizada:** o predicado corrente pesquisa assunto e UUID (`src/infrastructure/postgres.ts:105`), sem protocolo CG, mensagem ou nota. A própria interface descreve “Busca por assunto/UUID” (`web/app.js:148`). A busca por protocolo do monitor de e-mails V2 não amplia a busca da fila de chamados. Busca em conteúdo privado exige desenho de audiência próprio.

### D12 — Exportação durável e download (HD-027)

**Estado:** encoder CSV com proteções existe (`src/application/report-export.ts:7`–`:13`); orquestração, limite10mil, reserva, comparação de hash, reautorização e link curto existem (`:16`–`:47`). `ReportExportStore` e `ReportExportStorage` são interfaces e o handler de portal não é montado no runtime atual. Não há entrega operacional XLSX por esse serviço. O export Excel/JSON do Apoio, agora entregue, não representa exportação global de tickets.

**Conclusão:** store/reserva/objeto privados e audit duráveis; contrato com schema atual; gerar conjunto declarado completo, revalidar acesso/objeto na emissão do link; expiração/revogação/falha parcial não publicam arquivo final; nenhum dado interno na exportação cliente. Decidir XLSX como escopo próprio em vez de supor que já existe por haver planilha no Apoio.

### D13 — Indicadores de atendimento (HD-028)

**Estado:** leitor candidato devolve explicitamente `availability:'unavailable'` para primeira resposta humana, solução, CSAT, conhecimento e desenvolvimento (`src/application/portal-read.ts:61`); `web/reports.js:4`–`:15` preserva esse significado. Monitor V2 tem métricas de comunicação, que não medem produtividade/tempo de atendimento.

**Conclusão:** dicionário das métricas e denominadores/episódios/horário útil aprovado, consultas persistidas e composição real; amostra reconcilia eventos; fonte incompleta não vira zero; clique/abertura não medem trabalho humano. Não há justificativa para chamar o painel atual de BI completo.

### D14 — Administração durável de equipe/convites (HD-022)

**Estado:** serviço e regras existem em `src/application/member-admin.ts:10`–`:26`, `:75` em diante; handlers/UI existem em `src/http/member-admin.ts:65` e `web/admin-members.js`. A própria interface exige implementação PostgreSQL antes de uso vivo (`member-admin.ts:14`–`:17`); o runtime atual não importa/monta esses handlers. Convite é para pessoa já cadastrada, sem criar usuário ou e-mail automaticamente (`src/http/member-admin.ts:63`).

**Conclusão:** persistência transacional de roster/capabilities/CAS/audit/recibos, composição Auth+MFA e UI por capacidades reais, aceitação/revogação/expiração/sucessão e último administrador protegido. A parte sensível só é liberável após retomada legítima de MFA; desenvolvimento isolado não exige contornar essa decisão.

### D15 — Administração de contas/obras/contratos/cobertura (HD-023)

**Estado:** serviço geral `src/application/configuration-admin.ts:13`–`:24`/`:58` e handler `src/http/configuration-admin.ts:18` são candidatos fora da composição. Já há administração durável **específica** Consulte GEO, montada com `createPostgresConsulteGeoConfigurationStore` em `consultegeo-runtime.ts:32`; publica formulários/workflow/checklist/calendário e não equivale ao backoffice geral. Conta/obra/vínculos atuais são provisionados por planos privados (`consultegeo-initial-operation.ts:27`, `consultegeo-registration-operation.ts:42`).

**Conclusão:** fluxos autorizados de registro/vínculo/inativação/publicação das entidades necessárias à operação, contrato/grants separados, histórico fixado; store durável e UI explicam falta de contexto/permissão. Não generalizar além do caso Consulte GEO nem confundir um contrato com concessão automática de acesso.

### D16 — CSAT (HD-029)

**Estado:** submissão com posse de convite, expiração/revogação/consumo e recibo existe (`src/application/csat.ts:6`–`:26`); o comentário de `:12`–`:14` deixa claro que não emite convites. Não há composição no runtime atual.

**Conclusão:** definir política de emissão/resolução/reabertura, store e consumo duráveis, audiência/token de uso limitado, integração dos convites e agregação por período. Posse de convite não abre o ticket. Só ativar quando essa ampliação for priorizada e qualificada.

### D17 — Macros de atendimento e ajuda no formulário (HD-032; RF-CEN-05, RF-FOR-07)

**Estado:** há contratos/serviços de conhecimento e componentes de macro com prévia (`src/application/knowledge.ts:22` e `:34`, `web/optional-support.js:65`); não há montagem de macros no compositor de conversa do app corrente. A orientação textual `info` já está na abertura (`consultegeo-registration-operation.ts:17`, `configuration.ts:64`). O Apoio agora tem ajuda contextual com imagem/vídeo no cadastro (checkpoint de16/10), mas essa ajuda não compõe automaticamente a abertura de ticket core.

**Conclusão:** selecionar artigos/modelos aprovados por audiência/subcategoria, publicar variáveis públicas limitadas, montar a prévia/editabilidade no compositor e confirmar envio pelo fluxo normal. Cliente não recebe roteiro interno; nenhum clique da macro publica/enfileira automaticamente. A revisão factual da Wiki permanece adiada nos recortes que dela dependem.

## Complementos dos 107 RF: lacunas reais, mas não prioridade/escopo automaticamente aprovados

O complemento de 15/10 traz 32 recortes AUX. Para o core, as lacunas abaixo ainda não têm jornada correspondente nas rotas montadas em `consultegeo-runtime.ts:54`–`:67` e `handler.ts:80` em diante. A conclusão é sobre **composição operacional no HEAD**, não uma alegação de que não existe qualquer contrato/teste/candidato. As fases originais e os vínculos detalhados continuam no CSV dos107RF.

| Recorte | Estado reconciliado e base reutilizável | Critério de conclusão |
|---|---|---|
| AUX-01 / RF-PER-03/04, RF-CEN-12 | Compartilhamento opcional por obra, seguidores e menções ainda sem jornada. `src/domain/policy.ts:13`–`:17` permite operador/gestor ou autor, não um seguidor arbitrário. Transferência já existe; não é menção. | Política versionada de audiência por obra, revogação e autorização de lista/contagem/detalhe/envio; colega da conta não ganha acesso sem cobertura integral. |
| AUX-02 / RF-ACE-03 | Assistência de acesso pré-login verificada é diferente de recuperação de senha. Login direto existe, mas nenhum canal de chamado anônimo de assistência aparece no runtime. | Link/verificação restritos a auxílio de acesso, abuso/quotas/expiração, sem conceder identidade GEO por posse de e-mail. |
| AUX-08 / RF-CAT-03 | Não há busca específica de serviços/sinônimos. Catálogo autenticado existe; `web/consultegeo-operation.js:18` usa seletores e `web/support-catalog-state.js:3`–`:26` pagina opções. | Busca no universo autorizado com sinônimos aprovados, sem confundir busca de ticket/wiki. |
| AUX-09 / RF-FOR-03 | Corrigir interpretação antiga: **motor e UI de repetição já existem** em `shared/form-rules.js:3`/`:60` e `web/dynamic-form.js:31`–`:50`, com testes de abertura. O compilador Consulte GEO exclui repeater/table_paste (`configuration.ts:11`/`:36`) e o registry operacional publicado exclui esses tipos (`consultegeo-registration-operation.ts:39`). | Evoluir publicador/SQL/configuração para modelos reais e montar na abertura com erros por linha/limites/snapshots. Não criar segundo componente de tabela nem tratar tabelas do Apoio como entrega desse formulário. |
| AUX-10 / RF-CAT-04 | Revisão de respostas existe; mudança de categoria/formulário com mapa de campos não está montada. | Reclassificação por comando/CAS, mapa explícito, revisão de perdas, snapshot original; campos privados/desconhecidos nunca viram descrição pública por fallback. |
| AUX-11 / RF-FOR-06 | Rascunho persistido e botão salvar já existem. `web/support-intake.js:10`, `:20`, `:57`, `:116`, `:128` separa edição de salvamento explícito; não agenda autosave. | Se retomado como prioridade: autosave com frequência/conflitos/expiração/descarte definidos e tratamento da intenção incerta, sem repetir gravação ou perder contexto. |
| AUX-13 / RF-CIC-05/11 | Reabertura com janela, motivo e guarda existem (`support-workflow.ts:51`–`:52`); falta aceite real dos ciclos e uma jornada de novo chamado vinculado após expirar. Resolução é texto; não há taxonomia publicada de motivos. | Aceite dos ciclos, relação para continuidade fora da janela, taxonomia e relatórios; encaminhar não declara resolução técnica. Sete dias já foram publicados no piloto e não devem ser trocados por regra presumida. |
| AUX-14 / RF-CIC-09 | Relação tipada/mescla não estão montadas; histórico de cada ticket já existe. | Relação/mescla revisável com autoria, duas conversas preservadas e público separado; causa comum não une dados de clientes. |
| AUX-15 / RF-CIC-10 | Checklist existe; não há subtarefa com dono/prazo/dependência no workflow atual. | Persistência de subtarefas internas com estados/histórico e autorização contida no ticket. Não renomear item de checklist para alegar entrega. |
| AUX-16 / RF-CEN-08 | Beneficiário delegado tem verifier e serviço (`src/application/intake-beneficiary.ts:7`–`:35`, `support-intake.ts:61`/`:112`). Runtime constrói intake sem essa dependência (`consultegeo-runtime.ts:35`); handler declara somente abertura ordinária (`src/http/consultegeo-opening.ts:4`). Canal de origem completo não é DTO atual. | Compor autoridade de beneficiário, executor/solicitante/motivo/proveniência/canal, cobertura e replay. “Origem WhatsApp” não integra envio WhatsApp. |
| AUX-17 / RF-CEN-13 | Apontamento explícito de tempo não está montado. | Registro/correção auditada e relatório de esforço separado de duração/SLA; não deduzir de cliques. |
| AUX-18 / RF-CEN-14 | Comandos atuais são por ticket; não há jornada de lote. | N intenções por ticket com autorização/chave/resultado independentes, resumo dos efeitos e reconciliação de falha parcial. |
| AUX-19 / RF-BUG-05/08 | Entidade de incidente e status global pré-login não estão montados. | Processo de autoridade/publicação/retirada, aviso global sanitizado, política de cache e comandos por ticket. Não confundir erro individual ou monitor de e-mail com incidente global. |
| AUX-20/21 / RF-BUG-01/03/04/06 | `src/application/external-work.ts:13`–`:25` recebe eventos verificados e nunca resolve ticket; sem montagem no runtime e sem jornada de link manual/tema/release na fila atual. | Link/tema privado por ticket, fonte do release, decisão humana e retorno individual autorizado; cadência separada de SLA, contagem por cliente distinto, sem promessa comercial ou publicação remota automática. |
| AUX-32 / RF-PER-07 | Logs HTTP e auditorias de mutação existem. Não equivalem a registro operacional de quem consultou qual conteúdo por finalidade; política de leitura ainda por definir. | Eventos mínimos de acesso relevantes, finalidade/retenção/audiência, consulta restrita e tratamento de falha; MFA/roster reais quando aplicável. Não coletar cliques de produtividade. |

Outros AUX relacionados a origem GEO (03–07), arquivos/vídeo12, conhecimento23/24, IA25–28, templates29 e canais30/31 precisam ser reconciliados nas frentes responsáveis. Não contam como trabalho core já autorizado apenas por constarem da matriz histórica.

## Integração/configuração e decisões, sem alegar ausência de código

1. **HD-010 — política de SLA:** calendário útil e reabertura já foram publicados (doc149:11/23), mas o draft de referência e divergências de negócio devem ser ligados a recibo/versão instalada. Conclusão: decisão aprovada, artefato efetivo e documentação coerentes; chamados antigos mantêm versão. Não escolher prazo de Wiki ou JSON automaticamente.
2. **HD-007/008 — MFA e aprovação:** adiamento expresso em `docs/157-ONDA2-RETORNO-DO-CLIENTE-2026-10-15.md:34`. Stores/rotas/desafio/UI já existem e `consultegeo-runtime.ts:43`–`:49` monta serviços de revisão; operações sensíveis passam por `withAdministrativeAssurance`. Faltam roster/política/capabilities/audiência/aceite legítimos, incluindo avisos21–24. Conclusão depende de nova decisão do titular; não fabricar fator, aprovador ou grant.
3. **HD-037 — origem Novo GEO:** segue preparada/adiada, reiterada no checkpoint mais recente do Apoio (`docs/apoio-implantacao-fluxos-ui-2026-10-16.md:3`). RF-PER-06 e RF-ACE-01/02/04/05/06/07/08/10/11/12/13 e RF-FOR-02/05 dependem dessa fonte quando exigem login, lookup, diagnóstico ou execução vivos. A operação local/manual funciona e não deve ser bloqueada por isso.
4. **HD-024/033/035 — anexos e implantação:** fluxo do Apoio foi significativamente entregue depois do handoff; scanner foi cancelado pelo usuário no estado mais recente. O registry core de intake ainda tem `files:false` e compilador de nova obra exige arquivo (`configuration.ts:38`/`:70`). Decidir contrato de confiança/autoridade compatível com o cancelamento antes de abrir anexos no core; não reativar scanner automaticamente nem apresentar seleção de arquivo em memória como armazenamento/scan homologados. Persistência/processo Apoio não encerra associação ticket↔processo IMP-03.

## Aceites que continuam pendentes e limites que não são defeitos demonstrados

| Item | Estado atualizado | Fechamento correto |
|---|---|---|
| HD-003 / RF-CIC-02/05 | `docs/157...:26`/`:32` registra CG-10002 com8 e-mails e falta de solução/encerramento/reabertura/cancelamento. Nenhum checkpoint posterior lido registra essas quatro ações aceitas. | Executar somente ciclos reais autorizados, com sessão legítima, conferir formulário/checklist, eventos/recibos/destinatários/caixa e isolamento. Não reabrir desenvolvimento do retorno do cliente PR49, já corrigido. |
| HD-005 — senha/recuperação | Código de recuperação existe; e-mail chegou spam e cadeia integral não foi comprovada no handoff. **UI atual simples desativa recuperação/senha/global logout/troca de workspace:** `web/access-mode.js:3`, `web/app.js:514`, `:523`, `:549`. MFA inicial tem liberação independente no doc154. | Reconciliar produto/acesso à jornada, diagnosticar entregabilidade Auth e aceitar troca integral com titular. Não listar senha como totalmente inexistente nem ativar UI avançada por inferência. Preservar click tracking compartilhado. |
| HD-006 — logout global | Dois cenários combinados continuam registrados em `docs/122-HD-P06-ENCERRAMENTO-GLOBAL-DE-SESSOES.md:19`. Os testes atuais `tests/human-global-signout.test.ts:20`–`:24` cobrem timeout no transporte e `:26`–`:49` estado/limpeza separadamente; `tests/browser-human-session.py:527`–`:556` cobre confirmação/falha. Não foi encontrada prova posterior dos dois cenários combinados exatos. | Acrescentar só regressões combinadas ainda ausentes: confirmação obsoleta após nova identidade; timeout real do transporte atravessando estado. Aceite entre dispositivos separado; bearer emitido pode valer até expirar. Não declarar bug com base em recomendação histórica. |
| HD-004 — operação de e-mail | Monitor V2 já publicado; smoke real desktop documentado em16/10. Permanecem todos os filtros/mobile, dados novos completos/máscara agente e eventual refinamento de origem das linhas da timeline. | Concluir verificações complementares quando controle browser funcionar e qualificar expansão/pausa/coorte por decisão. Não tratar timeout da ferramenta como bug de produto nem repetir migrations por isso. |
| Apoio atual | PR60 corrigiu revisão/data/status/aprovação/autoria/correção/cache,43 cenários fullshell,49PG+30browser+13frontend documentados; deploy READY. Fluxo produtivo completo e e-mail real para endereço autorizado continuam pendentes por controle browser. | Qualificação hospedada com sessão e dados legítimos. Não confundir API/armazenamento/fila sintéticos da fixture com prova de entrega/persistência hospedada. |
| RF-PER-05/08, RF-CEN-04/07/11 | Separação de notas, isolamento, checklist e tela unificada existem. Ampliação de aceites por público/conta/obra e efeito externo permanece por recorte. | Verificar efetiva ausência de privados em DOM/e-mail/export/anexo e negativas de conta/obra/revogação nas novas integrações. Não reescrever segurança existente sem achado. |

## Prioridade de engenharia sugerida para planejamento, não autorização de implementação

1. Primeiro confirmar o escopo atual de negócio e separar aceites curtos das frentes de engenharia. Atualizar a lista de trabalho à baseline f13754e, sem sobrescrever o pacote histórico.
2. Evoluir coleta/validação e checklists por cadastro, preservando execução manual e adiamento GEO. São melhorias independentes da API de origem.
3. Completar projeção/leitura de SLA e conectar totais reais à fila, reutilizando motor/SQL/candidatos existentes.
4. Montar exportação, indicadores e backoffice necessários ao Consulte GEO com persistência e autoridade atuais. Administração protegida depende da retomada de MFA para liberação.
5. Priorizar explicitamente os complementos RF de fase2/3 antes de implementá-los; sua existência na matriz não os transforma em compromissos imediatos.

As referências fornecem critérios para fechar tarefas sem confundir código, configuração, publicação e aceite. Nenhum teste novo foi criado ou executado para produzir este levantamento documental.


---

Leitura complementar: [backlog reconciliado](BACKLOG-ATUALIZADO.md), [decisões e fontes](FONTES-E-DECISOES.md). Fontes ../wiki-consultegeo ou wiki-consultegeo são do repositório irmão situado na pasta do projeto, fora da raiz helpdesk.
