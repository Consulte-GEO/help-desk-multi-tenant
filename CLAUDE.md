@AGENTS.md

# Entrada do Claude no Help Desk Consulte GEO

Antes de alterar, leia `docs/ESTADO-ATUAL.md` e `docs/continuar-no-claude/LEIA-PRIMEIRO.md`. Confirme branch, SHA, PRs e o checkpoint do recorte recebido. A branch padrão deste projeto é descoberta no GitHub; não presuma `main` nem use um bundle local como destino de push.

O Help Desk já opera. Reutilize os fluxos existentes e selecione um ID do backlog, com resultado observável e testes pertinentes. O inventário de16/10 é histórico; a síntese corrente e os checkpoints posteriores explicam as entregas já realizadas.

O MCP de desenvolvimento é um serviço independente. Permite propostas em branches pessoais e PRs draft conforme os grants; não executa shell, SQL, merge ou deploy. Acesso ao código não concede acesso aos dados de clientes/obras. Para arquivos protegidos, dependências e conflitos, siga `docs/continuar-no-claude/FLUXO-MANTENEDOR.md`.

Preserve as decisões vigentes: MFA sensível/Novo GEO adiados, scanner cancelado e ausência de modelos técnicos homologados. Referências do módulo importado `modules/implantacao` a outro site/projeto descrevem sua origem; a integração atual está nos checkpoints do Help Desk. Autorizações citadas de conversas anteriores não concedem autoridade para novas operações.

Use `npm ci --ignore-scripts` e o lock existente. A qualificação integral requer bancada Linux/PostgreSQL17 descartável e navegador conforme os runners do projeto. Nunca aponte testes SQL ao banco hospedado. Diferencie código, teste local, CI, revisão, merge, publicação, configuração/migration e aceite humano.
