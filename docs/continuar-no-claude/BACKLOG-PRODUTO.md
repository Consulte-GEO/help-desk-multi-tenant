# Saldo do Help Desk para a nova pessoa

50 itens preservados do inventário de16/10/2026 com sete atualizações explícitas a partir dos checkpoints posteriores. Os demais exigem confirmação no recorte recebido. Classes, prioridades e dependências originais são históricas; não são autorização para executar itens adiados ou prazo contratado. O JSON preserva os campos completos da fonte. Não somar RF/AUX/aceites como tarefas adicionais.

## HD-001 Reconciliar fonte canônica e documentação corrente

**Estado:** Síntese canônica já entregue; distribuir e manter contexto.

**Saldo:** docs/ESTADO-ATUAL.md e referências de entrada já existem. Falta manutenção, conciliação do que não está versionado e entrega à nova pessoa; não recriar a síntese como funcionalidade ausente.

**Caminho:** Documentação; MCP permitido após habilitação ou Claude Code.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Decisão / política / documentação. **Prioridade histórica:** P1.

**Reutilizar:** Checkpoints datados e este pacote.

**Aceite original:** README/estado/plano corrente apontam para o mesmo SHA, schema e recibos; outros históricos identificados por data, sem apagar evidências.

**Fonte para o estado:** helpdesk/docs/ESTADO-ATUAL.md

## HD-002 Alinhar contrato público de capacidades e rotas

**Estado:** Parcial; contratos formais e vários recortes já entregues; PR76 aberto.

**Saldo:** Reaproveitar gate formal OpenAPI/JSON Schema e conformidade qualificada nos PR61–67. PR76 qualifica descoberta/sessões de integração e não está integrado. Conferir saldo das respostas positivas de workflow/checklist e intake, capacidades e runtime; não refazer o validador.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-001. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Handlers, DTOs, checker estrutural e contratos existentes.

**Aceite original:** Contrato validado formalmente, respostas de capacidade coerentes com configuração e testes de conformidade das rotas montadas; não anunciar módulos candidatos.

**Fonte para o estado:** helpdesk/docs/implementation/CONTRATOS-ACESSO-2026-10-17.md

## HD-003 Concluir aceite da segunda onda de notificações

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Onda2 já tem oito e-mails reais do CG-10002. Falta aceitar solução, encerramento, reabertura e cancelamento, incluindo destinatários e recebimento. Não é ausência do workflow nem repetição do bug PR49.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** P1.

**Reutilizar:** Workflow, notificações e retorno do cliente corrigidos.

**Aceite original:** Jornadas legítimas autorizadas registram estado, checklist, evento, intenção, entrega e caixa; replay não duplica e dados privados permanecem privados.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-004 Operar exceções e decidir expansão do piloto de e-mail

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Monitor V2 e coleta de abertura/clique já publicados e comprovados. Restam filtros complementares, mobile360px, Tab completo, endereço novo/admin e máscara/equipe, operação de exceções e decisão de expansão/pausa do piloto.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível.

**Dependências originais:** HD-009. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** P1.

**Reutilizar:** Histórico/fila/atenção, filtros, modal, timeline, callbacks nativos e cobertura.

**Aceite original:** Cumprir AC-EMAIL e política de piloto; nenhum N/D vira zero, nenhuma intenção antiga vira coorte nova; somente uma tentativa quando houver uma.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-005 Concluir recuperação Auth e melhorar entregabilidade

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Recuperação/senha existem no código, ocultas no modo simples. Falta decisão de exposição da jornada, diagnóstico da entrega Auth (e-mail anterior em spam) e aceite integral pelo titular. Não é tarefa para desligar tracking do domínio compartilhado.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** P1.

**Reutilizar:** Fluxos Auth e transportes existentes.

**Aceite original:** Link e destinatário corretos, troca completa válida, link vencido/reutilizado recusado e retorno à sessão coerente, sem alterar autoridade do usuário.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-006 Reconciliar os dois cenários antigos de logout global

**Estado:** Regressões combinadas entregues; aceite Auth real permanece.

**Saldo:** Reaproveitar regressões combinadas de logout do PR61 e posteriores. Restam decisão de exposição e aceite legítimo entre dispositivos; testes sintéticos não qualificam Auth produtivo.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** P1.

**Reutilizar:** Logout local/global, confirmação, limpeza e testes separados.

**Aceite original:** Confirmação antiga após nova identidade não atua na nova sessão; timeout real atravessando o estado preserva incerteza/limpeza corretas; verificar revogação sem prometer invalidar bearer antes de expirar.

**Fonte para o estado:** helpdesk/docs/implementation/PRIORIDADES-2026-10-16.md

## HD-007 Retomar a decisão de MFA quando o titular autorizar

**Estado:** Adiamento/fase futura preservados

**Saldo:** Titular adiou ativação/aceite do MFA sensível. Enrolamento inicial e desafio já existem; não há autorização para contornar o adiamento.

**Caminho:** Adiado/futuro; requer decisão antes de execução.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Adiado / fase futura. **Prioridade histórica:** Adiado.

**Reutilizar:** Auth, TOTP, desafio e guardas existentes.

**Aceite original:** Retomada explícita, fator real do titular e recuperação/sucessão qualificados, antes de liberar operações que o exigem.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-008 Qualificar revisão/aprovação e avisos 21–24

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Revisão/aprovação de solicitações possui serviços montados, mas faltam política, roster, audiência e capacidades legítimas; avisos21–24 ainda não ativados. A liberação depende da decisão MFA.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-007, HD-009. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** Condicional.

**Reutilizar:** Revisão, aprovação, withAdministrativeAssurance e templates já existentes.

**Aceite original:** Ator autorizado decide revisão exata com CAS, sem autoaprovação/escopo implícito; avisos só chegam ao público autorizado e MFA é comprovado.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-009 Fixar dicionário de entidades, autoridade e públicos

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Consolidar construtora/conta/obra/contrato/grupo/master/beneficiário e quem pode solicitar, aprovar, executar e consultar cada ação. Há políticas e coberturas; falta decisão operacional inequívoca para ampliar cadastros e audiência.

**Caminho:** Definição do negócio; implementação posterior pelo caminho apto. Não inventar alçada, política ou modelo técnico homologado.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Decisão / política / documentação. **Prioridade histórica:** P1.

**Reutilizar:** ACL e resolução de contexto existentes.

**Aceite original:** Tabela versionada com responsáveis e escopos; mesmo domínio/grupo não concede todas as obras; contrato comercial e grant técnico permanecem distintos.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-010 Reconciliar SLA, calendário, pausas e reabertura

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Calendário08–18h e janela de reabertura sete dias já foram publicados. Reconciliar recibo/política efetiva com JSON draft e regras divergentes das fontes; explicitar pausa, horário útil, feriados, reabertura e prioridade.

**Caminho:** Definição do negócio; implementação posterior pelo caminho apto. Não inventar alçada, política ou modelo técnico homologado.

**Dependências originais:** HD-009. **Classe histórica:** Decisão / política / documentação. **Prioridade histórica:** P1.

**Reutilizar:** Calendário, motor e publicação de configuração.

**Aceite original:** Negócio aprova política e versão instalada; exemplos reproduzíveis e sem recálculo silencioso de históricos. Não escolher regra de engenharia a partir de trecho de Wiki.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-011 Adicionar validação semântica aos formulários existentes

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Campos operacionais são majoritariamente texto. Evoluir compilador/publicador para e-mail, números/unidades e documentos tipados; validação semântica servidor+UI e normalização preservando original.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Motor decimal/integer/cnpj e formulários dinâmicos existentes.

**Aceite original:** Erro por campo, limites/unidades corretos, versões antigas legíveis e validação de dado sem conceder identidade/acesso. CPF/CNPJ separados conforme modelo aprovado.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-012 Completar pedidos de usuário e acesso com alçada explícita

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Cinco ações de usuário já existem, mas beneficiário e grupo são declarações livres. Completar alçada, evidência de antes/depois, campos e revisão de acesso por obra. Diretório vivo continua dependência GEO adiada.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009, HD-011. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Inclusão/alteração/desativação/reenvio/liberação e operação manual.

**Aceite original:** Pedido não concede perfil por texto; beneficiário/obra/alçada revalidados, acessos anteriores preservados e conclusão manual conferida na origem. Telefone obrigatório somente se decidido.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-013 Completar traço e padrões técnicos por material

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Traço já cobre concreto/graute e propriedades básicas. Completar modelo por material/aplicação, flow/argamassa/padrões quando confirmados e unidades/tolerâncias/relações necessárias.

**Caminho:** Definição do negócio; implementação posterior pelo caminho apto. Não inventar alçada, política ou modelo técnico homologado.

**Dependências originais:** HD-011. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Formulário de traço e snapshots atuais.

**Aceite original:** Modelos homologados por especialista, exemplos completos/incompletos, nenhuma norma/default inventado e alterações com alcance explícito.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-014 Completar usina, fornecedor e laboratório

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Usina/fornecedor/laboratório têm inclusão mínima. Completar vínculos central/obra, contatos por finalidade e modo manual/automático por obra quando aplicável.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009, HD-011. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Oito inclusões cadastrais atuais.

**Aceite original:** Entidade e relação identificadas, escopo por obra e efeitos revisados; conferência humana antes de comunicar execução. Integração automática só com contrato real.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-015 Completar bloco, cerâmica e cabos com modelos reais

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Bloco, cerâmica e cabos têm formulários mínimos; faltam modelos reais homologados e regras específicas de material, oferta de template e campos confirmados.

**Caminho:** Definição do negócio; implementação posterior pelo caminho apto. Não inventar alçada, política ou modelo técnico homologado.

**Dependências originais:** HD-011. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Inclusões existentes e mecanismo de formulários.

**Aceite original:** Modelos versionados e saneados, audiência e exemplos qualificados, campos técnicos revisados por responsável sem norma presumida.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-016 Modelar alteração e vínculo de cadastros não humanos

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Alterar/inativar/vincular cadastros não humanos não tem jornada equivalente às ações de usuário. Modelar comandos e relações de usina/traço/fornecedor/laboratório/material.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009, HD-011. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Motor versionado, revisão e ACL existentes.

**Aceite original:** Registro atual, antes/depois, alcance, alçada e evidência manual preservados; relação por obra distinta de alteração central.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-017 Melhorar triagem de dúvida, defeito e incidente

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Dúvidas/problemas já abrem chamados; falta questionário progressivo de contexto, impacto/urgência, reprodução, esperado/observado, contorno e classificação.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-010, HD-011. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Famílias questions/problem e prioridade atuais.

**Aceite original:** Coleta suficiente para reproduzir, sugestão de prioridade por política aprovada, histórico/motivo e sem promessa de SLA por texto livre. Incidente global é AUX-19.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-018 Criar pedidos de configuração com impacto explícito

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Criar pedidos específicos de configuração GEO com antes/depois, cliente/material/obra, impacto histórico e pré-condições. Administração do formulário HelpDesk não substitui esse serviço.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009, HD-011. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Intake/revisão/configuração versionada existentes.

**Aceite original:** Catálogo de parâmetros solicitáveis aprovado, alçada e alcance revisados, conclusão somente após evidência na origem.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-019 Tornar fila e detalhe mais operáveis

**Estado:** Parcial; múltiplas melhorias de fila e detalhe já publicadas.

**Saldo:** Já existem protocolo CG, totais autorizados da fila, resumo de atendimento, descrição, busca local na conversa pública, filtro interno, ordem por criação e períodos de criação/atualização. Restam visões/cockpit e busca global autorizada, entre outros requisitos do inventário. Ler o recorte antes de alterar.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-026. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Fila, cards explicitamente limitados aos carregados, workflow/timeline/atribuição.

**Aceite original:** Contagens antes da paginação no universo autorizado, múltiplas páginas e revogação verificadas; busca privada tem audiência própria; UI preserva dados após CAS/resultado incerto.

**Fonte para o estado:** helpdesk/docs/ESTADO-ATUAL.md

## HD-020 Completar projeção corrente e apresentação do SLA

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** SLA já calculado e selado na abertura/revisão. Falta projeção corrente após todas as transições, leitura autorizada e UI com vencimento/consumo/pausa/violação/asOf/indisponibilidade.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-010. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Motor SLA, calendários e snapshots persistidos (migration M09c).

**Aceite original:** Mesmo histórico/política gera mesmo relógio; reabertura não apaga consumo; horizonte e feriados explicados. capability só ativa após composição qualificada.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-021 Conectar lembretes e escalonamento SLA sem duplicação

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Não há scheduler SLA composto. Conectar propostas do motor a lembretes/escalonamento/espera/encerramento somente conforme política aprovada, reutilizando ledger de entrega.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-010, HD-020, HD-004. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Motor e outbox/worker/Resend atuais.

**Aceite original:** Revalidar estado e audiência antes de enviar; job idempotente; nenhum aviso obsoleto/duplicado ou fechamento por falta de callback; pausas e reabertura qualificadas.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-022 Montar administração durável de membros e convites

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Serviços/handler/UI de membros e convites existem, mas sem store PostgreSQL operacional e montagem no runtime. Completar backoffice de equipe, capacidades, convites e sucessão.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-009, HD-007. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Serviços, políticas e componentes existentes.

**Aceite original:** Transação/CAS/audit/recibo duráveis, expiração/revogação e último admin protegidos. Convite não cria identidade automaticamente. Liberação sensível depende de MFA legítimo.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-023 Completar administração de contratos, cobertura e contexto

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Completar backoffice de contas/obras/contratos/vínculos/cobertura; candidato geral não está montado. Publicação específica de formulários Consulte GEO já é durável e está montada.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-009, HD-007. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Publicador específico e planos privados atuais.

**Aceite original:** Store e fluxos autorizados com histórico de vigência, contexto e grants separados; inativação e cobertura por obra testadas sem generalizar produto além da Consulte GEO.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-024 Qualificar anexos privados e sua autoridade

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Anexos gerais de chamados continuam sem composição. Cancelamento do scanner exige nova política explícita para contratos que hoje exigem scan/clean; não reativar serviço pago nem marcar clean artificialmente.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Contratos de armazenamento/attachments; originais do Apoio em memória não são esse recurso.

**Aceite original:** Ownership, tipos/limites/hash/MIME/quota, ACL viva e upload/download privados qualificados; contrato sem inspeção, se aprovado, informa a condição real e adapta guardas explicitamente.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-025 Implementar retenção, órfãos e remoção verificável de arquivos

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Definir retenção e implementar órfãos/purge com prova de remoção e liberação segura de quota. Inventariar banco, imagens privadas, logs, IA, exportações e demais objetos efetivamente persistidos.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Metadados/contratos lifecycle e inventário atual.

**Aceite original:** Política e exceções aprovadas, remoção idempotente comprovada e audit preservado. retainUntil não significa bytes removidos. Originais locais em memória não viram bucket inexistente.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-026 Montar portal de consulta e totais autorizados

**Estado:** Parcial; não confundir totais já publicados com portal completo.

**Saldo:** Reutilizar totais autorizados completos e composição existente de fila. Completar apenas a parte ainda ausente do portal/cockpit/report contra o schema corrente, com ACL antes de filtros/agregação e testes de revogação; não criar segunda fila.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Portal e agregadores existentes.

**Aceite original:** ACL antes de filtros/LIMIT/agregação, totais completos e asOf, revogação e obras vizinhas verificadas; sem fixture como fallback.

**Fonte para o estado:** helpdesk/docs/ESTADO-ATUAL.md

## HD-027 Completar exportação durável e download seguro

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** CSV seguro/orquestração já existem; faltam store/reserva/objeto/auditoria duráveis e montagem do download autorizado. XLSX global é escopo a decidir; exportações Apoio já entregues são outra função.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-026, HD-025. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Encoder CSV e contratos de exportação existentes.

**Aceite original:** Conjunto completo declarado, limite/expiração, reautorização no link e nenhuma publicação parcial; fórmulas/privados protegidos e cancelamento/revogação testados.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-028 Entregar indicadores com definição e cobertura

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Indicadores de atendimento ainda devolvem indisponibilidade em candidatos. Definir métricas e montar queries/projeções: primeira resposta humana, solução, episódios/SLA, CSAT e bases relacionadas.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-026, HD-020. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Componentes de relatório e fontes de eventos.

**Aceite original:** Dicionário/denominadores aprovados, amostra reconciliada com eventos, cobertura exibida; dado ausente não vira zero e engajamento de e-mail não mede produtividade.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-029 Montar CSAT com convite restrito e consumo controlado

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Serviço de consumo CSAT existe, sem emissão de convites/store operacional/montagem. Completar política de convite por resolução/reabertura e agregação.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009, HD-028. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Serviço de submissão e contratos atuais.

**Aceite original:** Uso único limitado, prazo/revogação/concorrência e recibo; posse de convite não concede acesso ao chamado; nota/comentário não vazam.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-030 Retomar revisão factual da Wiki por prioridade

**Estado:** Adiamento/fase futura preservados

**Saldo:** Revisão factual Wiki contra código/versão Novo GEO foi adiada expressamente. Fontes internas com ressalvas e corpus HDW em quarentena não são conteúdo cliente aprovado.

**Caminho:** Adiado/futuro; requer decisão antes de execução.

**Dependências originais:** HD-037. **Classe histórica:** Adiado / fase futura. **Prioridade histórica:** Adiado.

**Reutilizar:** Wiki v1.7 já publicada e ferramentas editoriais.

**Aceite original:** Retomada explícita com versão de origem/especialista, revisão prioritária de permissões/SLA/cadastros e resolução por afirmação; preservar VERIFICAR e custódia.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-031 Publicar pequeno pacote de conhecimento por audiência

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Base de conhecimento para clientes ainda sem pacote aprovado; manifesto externo vazio. Selecionar lote factual mínimo, público e hashes, montar distribuição/retirada segura.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Projeção editorial/quarentena/hash da Wiki.

**Aceite original:** Aprovação editorial exata por audiência, revogação e retirada verificadas; Wiki interna não é exposta inteira. Pode revisar só o lote sem esperar todo corpus.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-032 Conectar ajuda contextual e macros revisáveis

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Knowledge/macros têm serviços/HTTP/painéis, mas sem store/montagem no shell e compositor. Conectar ajuda contextual por serviço e prévia editável de resposta aprovada.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-031. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Primitives knowledge/macros e ajuda informativa atual.

**Aceite original:** ACL antes de busca/snippet, fonte/versão registrada, macro editável e envio humano normal; conteúdo interno nunca sugerido ao cliente.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-033 Concluir aceite do Apoio Implantação integrado

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Reformular IMP-02 para aceite do Apoio integrado atual. Cadastro/planilhas/laudos/revisão/processos/ajuda/e-mails e persistência já publicados. Setup independente/pooler antigo não bloqueiam esse módulo.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** P1.

**Reutilizar:** PR55/57/58/59/60 e backend privado já entregue.

**Aceite original:** Cumprir AC-APOIO: jornada autenticada hospedada, retomada em outro dispositivo, revisão/devolução/reenvio, e-mail próprio real e qualificação IA/OCR real conforme uso.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-034 Implementar IMP-03: associação processo e chamado

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** IMP-03 ainda precisa associação autoritativa processo/submissão→chamado CG. Campo ticket_number atual usa IMP-UUID; compartilhar sessão/UI/fila não cria vínculo com protocolo CG.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-009, HD-033. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Processos/submissões, fila e abertura CG existentes.

**Aceite original:** Abertura/vínculo idempotente e transacional/reconciliável, mesmo protocolo após ACK perdido, nenhuma duplicação de chamado/aviso e projeção mínima por audiência.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-035 Completar jornada de nova obra e ajuste incremental

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Completar jornada cliente/nova obra/ajuste incremental integrada ao chamado e checklist de implantação. Wizard/parser/PDF/revisão internos já entregues; confirmação no GEO é recorte adiado.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-034, HD-024. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Apoio interno completo e modelos R02/importação/laudos.

**Aceite original:** Solicitação CG e processo mostram pendência/dono/próximo passo, versões/diferenças, revisão interna distinta de confirmação externa, checklist de acesso/configuração/treinamento e conferência final.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-036 Definir e completar pacote de backup/encerramento

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Pedido Backup existe; pacote real de encerramento/backup da obra ainda precisa conteúdo, produtor, manifesto, audiência e download. Gerador GEO aguarda origem adiada.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-037, HD-027. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Intake backup e contratos/exportação existentes.

**Aceite original:** Autorizar geração/conteúdo/destinatário, expiração e hash; comprovar integridade e regra de desativação separada. ZIP não é restore; fechar chamado não desativa obra.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-037 Qualificar origem Novo GEO sem inventar integração

**Estado:** Adiamento/fase futura preservados

**Saldo:** API/IdP/versão/contrato Novo GEO reais foram explicitamente adiados. Preparação local/manual segue; não inventar endpoint, identidade, dado vivo ou escrita de origem.

**Caminho:** Adiado/futuro; requer decisão antes de execução.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Adiado / fase futura. **Prioridade histórica:** Adiado.

**Reutilizar:** Conectores e contratos preparados.

**Aceite original:** Retomada e origem fornecida; identidade/escopo/read-only primeiro, TLS/recibos/limites e negativas qualificados antes de qualquer execução.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-038 Promover persistência HDA com contrato de segurança

**Estado:** Entregue no recorte original.

**Saldo:** Persistência oficial e worker manual já ativos. Não promover de novo; HDA03–13 continuam frentes independentes.

**Caminho:** Reutilizar entrega existente.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Entregue no recorte original. **Prioridade histórica:** Concluído.

**Reutilizar:** Sete tabelas privadas, role, worker manual e GETs ativos.

**Aceite original:** Evidência existente de promoção, consulta e três ciclos204 idle; manter runbook. Novas funções são HD-039–044. Não reaplicar migration.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/HANDOFF-DESENVOLVIMENTO.md

## HD-039 Conectar abertura atômica à tarefa HDA

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Biblioteca transacional HDA existe, mas não está ligada ao intake. Conectar operação/snapshot/job à abertura CG na mesma transação/conexão, preservando atendimento humano.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-038, HD-009. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** Persistência HDA promovida e abertura CG atômica.

**Aceite original:** Replay/rollback/COMMIT desconhecido recuperam mesma intenção/protocolo/outbox; binding/alvo/ator reais qualificados; análise indisponível não bloqueia fallback humano.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-040 Completar consulta, histórico, diff e edição da proposta HDA

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** GET/projeção HDA somente leitura já ativos; painel opcional não montado. Faltam histórico paginado, diff e edição por comandos/CAS na jornada.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-039. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P1.

**Reutilizar:** GETs, projeções e painel existentes.

**Aceite original:** Contexto/fetch autenticado corretos, revisão atual não se passa por história completa; edição invalida provas anteriores e proposta nunca é exibida como executada.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-041 Qualificar worker de análise e CLI dedicada

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Worker manual hospedado já funciona; análise Dev Agent real/CLI dedicada segue não composta e sem qualificação de isolamento/orçamento. Biblioteca Claude não é sandbox.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-039, HD-037. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Worker manual, contrato de análise e bridge preparados.

**Aceite original:** Host Linux/WSL não-root, isolamento SO/rede, binário/hash/modelo/credencial restrita, orçamento/cancelamento/quarentena e análise real qualificados antes de ativar; sem escrever GEO.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-042 Implementar aprovação HDA da revisão exata

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Aprovação HDA da revisão/hash/contexto exatos ainda não entregue. Aprovação de cadastro atual não autoriza execução HDA; MFA continua adiado.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-040, HD-007, HD-009. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** Condicional.

**Reutilizar:** Contratos/revisão existentes, sem liberar efeitos.

**Aceite original:** Exibir efeitos/alvo, ator e MFA legítimos, proibir autoaprovação; mudança de origem/proposta/acesso/prazo invalida aprovação. Aprovar não executa.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-043 Implementar executor determinístico e reconciliação GEO

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Executor/reconciliação GEO ainda futuros; catálogo só tem candidato grant_work e liveExecutionAllowed:false.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-042, HD-037. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** Condicional.

**Reutilizar:** Catálogo fechado e contratos preparados.

**Aceite original:** API homologada/plano exato aprovado, execução determinística com credencial restrita, idempotência e recibos de ambas pontas; resultado incerto exige consulta, sem retry cego.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-044 Qualificar resultado público e piloto HDA

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Resultado público e piloto de execução HDA não qualificáveis até existir execução real. Projeção cliente mínima já existe, mas notificação/efeito e operação piloto ainda não.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível. Depende de autoridade/MFA/origem conforme dependências originais; não liberado por esta análise.

**Dependências originais:** HD-043. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** Condicional.

**Reutilizar:** Projeção mínima e pipeline manual HDA.

**Aceite original:** Verificar projeção/notificação mínima, falhas e retorno humano, revogação, limites/custos/donos/parada e autorização específica do piloto.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-045 Ensaiar restauração e reconciliação completa

**Estado:** Parcial; inventário e relatório locais publicados; restore completo pendente.

**Saldo:** Reutilizar inventário PR71 e relatório de reconciliação PR74. Ainda faltam adaptação dos exports reais quando necessária, autoridade, aplicador durável e ensaio integral banco+objetos+ledgers/configuração/revogação, RPO/RTO e reconciliação de workers sem duplicação.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível.

**Dependências originais:** HD-025. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** P1.

**Reutilizar:** Planos e testes de recuperação existentes; não implica backup ausente.

**Aceite original:** RPO/RTO aprovados e medidos, nova geração e reautorização, workers reconciliados; nenhum envio/efeito já confirmado repetido; outra pessoa reproduz o runbook em bancada descartável.

**Fonte para o estado:** helpdesk/docs/implementation/RECONCILIACAO-RECUPERACAO-2026-10-17.md

## HD-046 Medir capacidade e preparar operação com limites

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Runner local existe. Falta capacidade multi-instância hospedada, metas/SLO/custos aprovados e responsáveis/runbooks/alertas qualificados; pool1 por Function não limita concorrência global.

**Caminho:** Aceite/qualificação autorizados; desenvolvimento somente se houver saldo ou falha reproduzível.

**Dependências originais:** HD-009. **Classe histórica:** Aceite / qualificação residual. **Prioridade histórica:** P1.

**Reutilizar:** Runner, logs HTTP seguros e auditoria de mutação.

**Aceite original:** Medir latência/erro/429/503/vizinho ruidoso/conexões/jobs/custo, fronteira/amostra explícitas e contenção/retomada com responsáveis. Metas locais não viram compromisso produtivo.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-047 Qualificar legado V2 e decidir escopo de histórico

**Estado:** Adiamento/fase futura preservados

**Saldo:** Migração histórica legado V2 é fase futura: fonte/versão/período/identidades/escopo de anexos ainda precisam decisão e export real autorizado.

**Caminho:** Adiado/futuro; requer decisão antes de execução.

**Dependências originais:** Nenhuma listada. **Classe histórica:** Adiado / fase futura. **Prioridade histórica:** P3.

**Reutilizar:** Conector/mapeamento preparados.

**Aceite original:** Qualificação e dry-run saneado com correspondências/erros explícitos, preservando protocolo e sem recriar login compartilhado ou avisos retroativos.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-048 Implementar migração de histórico legado somente leitura

**Estado:** Adiamento/fase futura preservados

**Saldo:** Importação de histórico legado somente leitura depende de HD-047; falta aplicador idempotente e reconciliação no escopo futuro aprovado.

**Caminho:** Adiado/futuro; requer decisão antes de execução.

**Dependências originais:** HD-047. **Classe histórica:** Adiado / fase futura. **Prioridade histórica:** P3.

**Reutilizar:** Mapeamento e contratos de legado.

**Aceite original:** Contagens/hashes/identidades/anexos conferidos, replay sem duplicação, leitura autorizada, sem novo SLA/envios/efeitos de chamados antigos.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## HD-049 Montar SSO e sessão de suporte somente com IdP real

**Estado:** Adiamento/fase futura preservados

**Saldo:** SSO/sessão de suporte aguardam IdP/API Novo GEO reais. Login próprio HelpDesk foi autorizado e está operacional; requisito antigo que proibia esse login foi substituído.

**Caminho:** Adiado/futuro; requer decisão antes de execução.

**Dependências originais:** HD-037. **Classe histórica:** Adiado / fase futura. **Prioridade histórica:** Adiado.

**Reutilizar:** Auth direto, sessão por pessoa e contratos externos.

**Aceite original:** Issuer/subject e audiência qualificados, consentimento/expiração/revogação e trilha de sessão de suporte, sem senha compartilhada/impersonação invisível.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

## MEL-09 Localizar quem recebeu uma orientação depois corrigida

**Estado:** Conforme inventário 16/10; revalidar recorte na fonte recebida

**Saldo:** Registrar artigo/macro e versão exata quando aplicado ao chamado; retirada/substituição com motivo/autor; lista autorizada de usos e análise de impacto afetado/não afetado/inconclusivo/tratado, com evidência e comunicação corretiva humana explícita.

**Caminho:** Claude Code/mantenedor para ponta a ponta; MCP em partes permitidas.

**Dependências originais:** HD-032. **Classe histórica:** Desenvolvimento ou composição. **Prioridade histórica:** P2.

**Reutilizar:** Conhecimento versionado, snapshots e conversa; completar composição de HD-032.

**Aceite original:** Mensagem/snapshot anteriores imutáveis; ACL viva em lista/detalhe/contagem; revisão da correção e reautorização antes de enviar; idempotência; nenhuma inferência retroativa de toda cópia manual ou disparo em massa automático.

**Fonte para o estado:** helpdesk/docs/levantamento-2026-10-16/BACKLOG.json

