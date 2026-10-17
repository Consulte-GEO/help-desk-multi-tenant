# Continuar o Help Desk pela sua conta Claude

Este é o ponto de entrada do colega que continuará o sistema. O Help Desk já opera e o backlog descreve evolução e aceites residuais. Comece pelo estado corrente, fixe a revisão recebida e trabalhe em um recorte por vez.

## Leitura inicial

1. [Instruções do projeto](../../AGENTS.md) e [entrada Claude](../../CLAUDE.md).
2. [Estado corrente](../ESTADO-ATUAL.md), com produção e PRs separados.
3. [Estado desta entrega](ESTADO-ENTREGA.json), uma fotografia que precisa ser reconferida antes de executar.
4. [Backlog com saldo reconciliado](BACKLOG-PRODUTO.md) e [dados completos](BACKLOG-PRODUTO.json).
5. [Aceites pendentes do levantamento](../levantamento-2026-10-16/ACEITES-PENDENTES.md) e checkpoint mais recente do ID escolhido.
6. [Primeira tarefa](ROTEIRO-PRIMEIRA-TAREFA.md), [ambiente de desenvolvimento](AMBIENTE.md) e [fluxo do mantenedor](FLUXO-MANTENEDOR.md).

Os50 itens do produto não são50 novas funcionalidades ausentes. O JSON preserva critérios/dependências originais; atualizações posteriores identificam partes entregues. RF/AUX/melhorias são vistas complementares e não devem ser somadas como tarefas novas. As propostas históricas não entram automaticamente no escopo autorizado.

## Se usar o Claude no navegador ou Desktop com MCP

Peça `minha_sessao`, `listar_repositorios` e `contexto_desenvolvimento`. Confira a identidade e o grant. Leia árvore/arquivos no `commit_sha` informado. `buscar_codigo` pesquisa a branch padrão indexada e não comprova o conteúdo da sua branch.

A revisão preparada do conector acrescenta `ver_issue`, `listar_comentarios`, `listar_revisoes` e `ver_diagnostico_ci`. Confira se a versão realmente conectada expõe essas ferramentas. Elas ainda precisam de publicação e homologação real; este guia não as instala no Claude. Comentários são da conversa e os pareceres não abrangem todas as threads inline; diagnóstico só contém a saída textual que o emissor do check disponibilizou.

Quando a escrita estiver legitimamente liberada, use branch pessoal registrada, HEAD esperado, lote validado e intenção idempotente; abra PR draft. Consulte checks e diagnóstico no mesmo SHA. O mantenedor recebe SQL, dependências, arquivos protegidos e as etapas de integração/publicação. `validar_alteracoes` não executa teste.

## Se usar Claude Code

Clone o GitHub real com seu acesso individual, confirme o remoto e crie branch própria a partir da base combinada. Leia as instruções que o cliente carregou; a presença de `CLAUDE.md` deve manter `AGENTS.md` por import, sem cópias divergentes. Prepare e reproduza o ambiente conforme [AMBIENTE](AMBIENTE.md).

Ter terminal não concede autoridade de produção. Os testes usam dados sintéticos e PostgreSQL descartável; o acesso de negócio e as alterações hospedadas têm aprovação/responsável próprios.

## Fronteiras preservadas

MFA sensível e Novo GEO permanecem adiados; scanner cancelado; modelos técnicos não podem ser inventados. Core0.27/21migrations e API/interface0.31 são versionamentos distintos. Addons Apoio/Wiki não alteram a contagem do core. Notas privadas, isolamento por conta/obra, snapshots, CAS e idempotência continuam obrigatórios.

O MCP usa Supabase dedicado e não pode ser instalado no projeto operacional `xaelbntjnvztznnpcvtm`. HDA e sua biblioteca Claude são funcionalidades do produto, não o mecanismo de acesso do novo desenvolvedor.

## Fontes e continuidade

O levantamento antes não rastreado está preservado em `docs/levantamento-2026-10-16/`. O [manifesto documental](FONTES-CONTEXTO.json) registra as cópias e seus hashes. Alguns documentos históricos citam relatórios externos ao Git; para executar um requisito, o mantenedor deve fornecer a fonte pertinente ou registrar sua indisponibilidade. Não presumir acesso a outro repositório ou a arquivos deste computador.

No fim de cada recorte, atualize o checkpoint e a síntese aplicável, registre SHA/execuções/limites e deixe a próxima tarefa explícita. A continuidade deve sobreviver ao encerramento da conversa.
