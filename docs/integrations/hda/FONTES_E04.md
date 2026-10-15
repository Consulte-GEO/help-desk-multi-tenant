# Fontes e alcance da E04

## Artefatos internos

- ZIP E03 fornecido nesta conversa. Hash SHA256: `92f4ced5d02ce19864da139cedf075a67305d735cdd332dec50f8a4a9d26a3b5`.
- Plano V2 preservado em `plano_v2/`: paralelização de HDA-04 sem credenciais de execução permitida; ativação depende de banco/CLI qualificados.
- GitHub, principal observada `164113065839f3f985404b6ec812da311b6ade1d`: https://github.com/Consulte-GEO/help-desk-multi-tenant/commit/164113065839f3f985404b6ec812da311b6ade1d
- AGENTS.md consultado nessa revisão. A leitura confirma apenas o documento, não novo aceite remoto.
- Busca por registration-analysis-worker na principal não retornou resultado; busca indexada não substitui comparação por caminho na integração.

## Documentação primária consultada em 14/10/2026

- Execução programática, modo bare, stdin, saída estruturada e limites: https://code.claude.com/docs/en/headless
- Referência de flags: https://code.claude.com/docs/en/cli-reference
- RLS PostgreSQL17: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- Obtenção de fontes PostgreSQL17: https://www.postgresql.org/docs/17/install-getsource.html

A documentação pública é referência para o adaptador candidato. Não comprova a versão, flags, autenticação, configuração ou isolamento do Dev Agent instalado. O download de PostgreSQL não foi concluído; nenhum binário foi executado/instalado a partir dessas páginas. Nenhum endpoint privado foi acessado via web.
