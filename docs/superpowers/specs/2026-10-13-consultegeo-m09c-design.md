# Consulte GEO M09c — abertura atômica

Autorização: pedido explícito do usuário para desenvolver protocolo, snapshot, evento, fila de email e recibo; decisões de implementação delegadas. Evolução arquitetural da M09b, executada neste chat.

Uma única transação com a identidade humana restrita e o mesmo cliente emprestado revalida a origem, bloqueia o rascunho, a versão publicada e a cobertura vigente. A prévia não reserva protocolo. A criação compara o hash da prévia e o CAS do rascunho. O protocolo CG-10001 em diante é exclusivo por workspace; o contador só muda na abertura efetiva. Cada chamado fixa formulário/respostas públicas, workflow, calendário, SLA, cobertura, referências completas e relógios iniciais. O evento ticket.created e sua outbox mínima usam os formatos existentes. O recibo imutável é vinculado à pessoa, workspace, chave e intenção. O rascunho consumido continua consultável para recuperar confirmação, mesmo após seu TTL, mediante autorização atual. Nunca pode voltar a edição.

O escritor privado verifica nativamente a intenção, valores, perfil, cobertura, relógios e efeitos, sem aceitar o bundle como autoridade. Supressão de qualquer INSERT/UPDATE ou alteração incompatível causa rollback. As funções auxiliares têm search_path vazio, ACL mínima, tabelas privadas com FORCE RLS e nenhum acesso direto da aplicação. A primeira jornada qualificada é Incluir usuário; lookup/anexos sem origem qualificada permanecem recusados. Sem alterações em GEO, envio Resend, instalação hospedada, merge ou deploy.

As duas operações HTTP usam origem exata, Auth/MFA, rate limit, limites JSON, If-Match e Idempotency-Key. Gate e cancelamento valem até COMMIT; confirmação perdida exige o mesmo comando/chave. Capabilities refletem as dependências reais. Netlify sem origem qualificada continua fechado.

Verificação: regressões antes do código; PostgreSQL17 descartável com login restrito, concorrência/replay, perfil fixado, cobertura, acesso, TTL e supressão de efeitos; suite de aplicação/interface e CI original com evidência vinculada ao fingerprint; uma revisão independente final.
