# Consulte GEO M09b — catálogo e rascunho durável

M09b entrega três operações opcionais: catálogo autorizado, leitura e gravação CAS de rascunho próprio. O plano anterior incluiu também abertura; após analisar as fronteiras transacionais, a abertura foi separada em M09c. Isso exige outra rodada de qualificação para protocolo, snapshot, workflow e evento/outbox antes de montar o envio. Essa separação é uma decisão de implementação dentro da autorização de continuidade.

- API/interface0.29.0, schema candidato0.22.0, quinze migrations, quatorze anteriores imutáveis.
- Produto vem da conexão CG; serviço deve existir no produto e corresponder à família M04. Sem inferência de SUPPORT, nomes ou e-mails.
- Resolver da origem e observação SQL atual, pessoa humana, conta, produto, scopes e conjunto completo de obras são obrigatórios. Nenhuma fonte real é simulada ou ativada.
- Catálogo só expõe formulários públicos da última versão publicada de cada configuração; rascunho mantém versão publicada anterior fixada. Nunca adota sucessora draft.
- Rascunho de 30 minutos, dono/conta/obras/formulário/versão/expiração imutáveis, CAS e replay da mesma intenção sem novo efeito. Dados incompletos ordinários são salvos, sem significar aptidão para envio.
- Duas tabelas privadas com ENABLE/FORCE RLS e nenhum direito direto da app/cliente/worker/publicador. Helpers estreitos repetem ACL/contexto nativo e mantêm o mesmo cliente transacional emprestado. Resposta obrigatória inválida é sticky e impede COMMIT.
- Lock consistente: origem/grant/observação, chave do rascunho, versão publicada; nenhuma edição concorrente altera a versão fixada. Alteração e audit ficam juntos; efeito suprimido ou fonte expirada antes do COMMIT recusa.
- Flag HELPDESK_CONSULTEGEO_INTAKE=false; precisa business/workflow/origem HTTPS e portas reais de servidor. Netlify ainda não tem adaptador M08 qualificado; chamadas recusam. UI M09a não montada na aplicação.
- Sem allocator, criação de ticket, prévia operacional, envio de email, upload, on-behalf, GEO write, migração hospedada ou alteração de grant real nesta fatia.

M09c implementará atomicamente protocolo por workspace, snapshot privado fixado, referência CG selada, estado inicial, core event/audit/outbox e receipt/reconciliação; primeira abertura qualificada: Incluir usuário. Lookup/file exigem fontes qualificadas M08/M11. O perfil M04 com prioridade/SLA fixos já está preparado e testado no domínio.

Validação: testes focais RED/GREEN, CI original integral em PostgreSQL17 descartável, inventário nativo contra contrato estático revisado e uma revisão final independente com único fix pass. Nenhum banco hospedado serve como laboratório. PR31 permanece draft, sem merge/deploy.
