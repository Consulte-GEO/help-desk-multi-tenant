# Cadastros na abertura Consulte GEO — 14/10/2026

O primeiro atendimento publicado apresentou somente Dúvidas, Backup e Problemas. O usuário informou que Cadastro é a demanda mais comum; a abertura passa a apresentar Cadastros e acessos como primeira opção.

Novo cadastro inclui Usuário, Traço, Usina, Laboratório, Bloco de alvenaria, Cerâmica, Cabos e Fornecedor. Cada tipo tem campos condicionais obrigatórios. Traço exige tipo, FCK, brita, slump, tolerância e fornecedor. Trocar de tipo limpa os dados ocultos antes de salvar. Alteração/desativação de usuário, reenvio de acesso e liberação em obra usam a identificação declarada para execução pela equipe; a integração Novo GEO continua adiada.

A configuração usa a família existente `user_access` e as cinco ações já qualificadas. Os rótulos anteriores de inclusão e liberação continuam legíveis para as mesmas ações e são normalizados somente na cópia de apresentação. Serviço, ação, prioridade, versão, hash e autorização permanecem estritos.

## Publicação transacional

A receita privada grava um serviço, cobertura e configuração, cinco workflows/checklists e uma nova revisão do catálogo. Republica o mesmo cliente, obra e quatro permissões locais e registra um recibo imutável com operador real, requestId, motivo e hashes da configuração/aprovação na mesma transação. O patrocinador precisa continuar sendo o administrador verificado da inicialização existente. Replay confere cobertura ativa e alvo exato, sem reativar cobertura revogada.

Chamados, contador e filas existentes são preservados. A receita não cria helpers, não altera ACLs ou o schema0.24 e mantém as17 migrations e o inventário67/162/58/355/38. A administração de configurações permanece protegida por MFA; a publicação inicial é delegação explícita de operador.

## Validação

CI38617902759, fonte c4aa0b34eb0194657b73029f31f1038729a082cc:4.920 aplicação,599 PostgreSQL e581 interface,6.100 verificações aprovadas, sem falhas/skips/cancelamentos. Fingerprint `5eb0423e8734a3d4e37bd770b38b0f8630fc03f6f2c5b19f3be08cdb6875338e`. Artefato11921017668, SHA `5855b35e028d3856289c8a3e782866af8ae98eae255dfa9fc5506defc95d4162`; seis logs conferidos. A revisão independente confirmou a receita e a compatibilidade dos rótulos.

As provas novas executam a receita no terceiro cluster PostgreSQL17 por operador NOSUPER genuíno. Confirmam compilação nativa, preservação/leitura de um chamado anterior, rollback após falha tardia no recibo, replay sem duplicação, negativa de escopo/aprovação e abertura real dos oito tipos e da liberação em obra com snapshot, checklist, outbox e recibo. A interface verifica os campos condicionais e a limpeza dos dados em desktop e celular.

A configuração real MRV — Residencial Encanto foi publicada às19:12:57Z por operador `postgres`, com requestId `da382ae4-dbf5-43cc-9da6-69bd664cc906`, commandHash do plano `b62ba9b44244fe836e7a6058d035162e0eb8394b75e2912473bf2ade50a5e647` e SQL SHA `26deb0578cf623460ee024f15a2861d7f6f6f762461be39deb9ff7a1be9ff010`. O recibo local registra hash `1786900e4f2b7658b5f4a096c8d505eb5354e0fa21897312ab0e6f56334565a4`, revisão2 e delegação operacional. A leitura independente conferiu definição/artifacts/contentHash exatos, serviço/cobertura ativos, cinco workflows e cinco checklists, catálogo2 e17 migrations. O contrato hospedado passou novamente nas15 verificações de prontidão com67 tabelas e papel da aplicação restrito.

PR35 integrado no commit `99458d90a4e6f311dd9b9a236618e31b8673a3a0`; deploy de produção `6acfd4ec6c2cedd86b78686e` publicado às19:16:49Z em https://helpdesk.consultegeo.org. Os86 arquivos do build conferem porSHA; configuração/capabilities retornam200 com atendimento ativo, rotas autenticadas recusam requisições anônimas com401, links profundos e Wiki retornam200. A prova de interface inclui20 verificações novas em desktop/celular na suíte qualificada; o operador não criou chamados de teste no portal real. Caminho: Novo chamado → Cadastros e acessos → Novo cadastro → Tipo de cadastro.

O usuário confirmou que Cadastros e acessos aparece em Novo chamado após atualizar o portal. Emails: canal Resend técnico conferido, conexão exclusiva qualificada com TLS cliente/backend após habilitar SSL enforcement, DSN e CA instaladas mediante autorização específica; ativação publicada e aceite do worker são registrados no [estado de emails](151-CONSULTEGEO-EMAILS-2026-10-14.md). O teste técnico não representa entrega pelo outbox HelpDesk.
