# HD-019 — período de criação na fila e nos totais — 17/10/2026

## Desenho e critérios

Acrescentar `created_from` (inclusivo) e `created_before` (exclusivo), opcionais/independentes, à lista e ao resumo. São instantes canônicos UTC Z com3/6 dígitos fracionários, normalizados sem perder microssegundos; se ambos presentes, início estritamente anterior ao fim. Ausentes mantêm a consulta/cursores existentes. Filtros não concedem audiência: manter RLS, workspace, conta/obra, escopos e interseção de operador dos filtros privados.

Aplicar no PostgreSQL antes de LIMIT/contagens e no adaptador de memória com comparação exata. SQL parametrizado, manter posições antigas quando ausentes e calcular as novas após os parâmetros privados opcionais. Cursor e gerações da lista/resumo incluem o intervalo normalizado; mudança invalida resultados antigos. API core e scoped usam as mesmas chaves, recusam repetidos, intervalos vazios/invertidos, datas impossíveis, offsets/frações não canônicos. OpenAPI documenta as duas rotas.

Interface: dois datetime-local opcionais em Filtros adicionais, rótulos e ajuda claros: criação, America/Sao_Paulo, início incluído/fim excluído. Conversor próprio pequeno, baseado no round-trip existente dos calendários/e-mails, recusa lacunas e ambiguidades de fuso e datas impossíveis; não altera o monitor de e-mails. Estado visual mantém valores de parede enquanto a consulta usa UTC canônico. Filtros aplicados/pendentes, limpar/logout, erro sem submissão, resumo, consultas rápidas e mobile390px qualificados. Consultas rápidas preservam o período (como q/prioridade); o filtro de período não torna falsa a indicação da situação/responsabilidade.

Não altera registros, schema/migrations, estados/SLA, política, MFA, Novo GEO, scanner, modelos técnicos ou destinos MCP.

## Plano de execução direta (após publicação do PR71)

1. Branch nova codex/ a partir da produção combinada conferida. Escrever RED em testes focados para gramática/normalização/microssegundos/limites/contagens >página/ACL/revogação/cursores e estado cliente.
2. Implementar application/ticket-search, allowlists HTTP core/scoped, predicado de PostgreSQL, estado cliente/consultas rápidas e schemas OpenAPI; testes reais com login restrito PG17 e binds opcionais.
3. Conversor de parede/SaoPaulo com casos DST real (gap/overlap), gramática e ano inválido; ligar controles/formato de filtros aplicados, dirty state e limpeza. Browser real com API/Auth sintéticas desktop/mobile, usando o shell existente, verifica a mesma query da lista/resumo e nenhuma gravação.
4. Focais/tipos/contratos/build/lock/secrets, revisão independente somente leitura, PR para revisão e CI integral fonte/merge. Preservar relatórios originais, qualificar preview e atualizar checkpoint/estado canônico. Não integrar esse novo PR sem sua autorização própria.

## Pontos de revisão

- Precisão3/6 dígitos e igualdade nos extremos: nenhum Date arredondando o filtro no servidor.
- Datas antigas/lacunas/overlaps e fuso do navegador diferente de SaoPaulo.
- Sem filtro: SQL/cursores/filas existentes preservados; binds depois de localContexts e filtro interno opcionais.
- ACL antes da paginação/total; período público não libera filtro privado em conta de manager.
- Filtros pendentes inválidos e resultados atrasados não substituem consulta aplicada; limpar/logout apagam controles e estado.


## Verificações iniciais (checkpoint histórico anterior ao CI)

Base de produção c24b759, após os merges/publicações70/71 conferidos. RED:7 casos de domínio/relógio e8 bindings SQL falharam antes da implementação; browser inicial recusou ausência dos controles. GREEN:77 focais de janela/busca/resumo/visões, compilador TypeScript e45 operações de contrato aprovados. Chromium real com Auth/API sintéticas:7 grupos aprovados, desktop/390px, navegador em America/Los_Angeles com filtros em Brasília, sem gravação; capturas conferidas. PG17 real ainda pendente no CI; runner nativo do projeto recusa Windows, e essa proteção foi preservada.

Consultados em17/10 o [changelog Supabase](https://supabase.com/changelog.md), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [tipos temporais PostgreSQL17](https://www.postgresql.org/docs/17/datatype-datetime.html). Nenhuma atualização de SDK, servidor ou configuração derivada dessa consulta; manter os índices existentes tickets_cursor/tickets_account_cursor/tickets_requester e predicados sobre created_at sem converter a coluna por linha.

## Qualificação do PR72

Fonte **95f7f2f16417e75cc6dc17ee635027340c2dd17d**. CI da fonte [39029742916](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39029742916) e do merge de teste [39029746665](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39029746665) aprovados. Relatório original e seis logs preservados, hashes e fingerprint conferidos: **19b845feebbe3e817eb787b61cf5eac3e78075c044881e483da00f670da2f061**. Artefato **helpdesk-homologation-95f7f2f16417e75cc6dc17ee635027340c2dd17d-39029742916-1**, digest **sha256:e2944638c4cc9b7d0fbbc47ab6acf71bcc2324d537f29da2050d1d0a882b9fa9**. Aplicação5977, PostgreSQL17 restrito708, interface685: **7370**, sem falha/skip/cancelamento/todo. O gate inclui tipos,45 operações de contrato, build, lock, instalação e auditoria de dependências. A varredura de segredos é heurística, não auditoria integral de segurança.

Os dois cenários novos em PG17 passaram: limites inclusivo/exclusivo com microssegundos e normalização3/6; janela antes de LIMIT com51 resultados autorizados, páginas7, linhas fora da janela/conta e revogação viva. Asserções não dependeram de login proprietário/BYPASSRLS. Nenhuma migration.

A tentativa inicial39029367677 foi recusada:5975/5977 na aplicação por fixture de build sem o conversor;708/708 no banco, interface bloqueada pelo pré-requisito. Os bytes originais e digest foram preservados em [failed-ci](../../evidence/created-window-20261017/failed-ci/39029367677/origin.json), sem sobrescrever o relatório aprovado. Correção restrita: converter incluído na fixture byte-for-byte e na allowlist explícita;4 testes focais passaram. A restauração da formatação OpenAPI foi conferida por igualdade semântica; só quatro declarações novas de parâmetros permanecem no diff. Revisão inicial37 focais e revisão do delta4 testes sem achados acionáveis.

Navegador Chromium real com Auth/API **sintéticas**, desktop1440/mobile390, dispositivo em America/Los_Angeles e controles em Brasília:7 grupos aprovados; capturas finais conferidas. Sem escrita de negócio nem autenticação humana produtiva. [Desktop](../../evidence/created-window-20261017/browser/desktop-synthetic.png), [mobile](../../evidence/created-window-20261017/browser/mobile-synthetic.png) e [revisão](../../evidence/created-window-20261017/review.json).

Preview [PR72](https://deploy-preview-72--helpdesk-consultegeo.netlify.app), deploy6ad361f857ba5073207f9cd7, head559fb9eeb57b48f912b0bdc585de029e45c3f056:10 ativos críticos conferidos por bytes/hash (HTML admite somente inserção CDP restrita do provedor). [Recibo](../../evidence/created-window-20261017/preview.json). A última conferência do head final é registrada no corpo do PR; evidência não concede autorização de merge. Produção continua PR71/c24b759/deploy6ad3596d0e2686c05d296773. PR72 preparado para revisão, **sem merge/publicação**.

## Continuidade e limites

HD019 permanece parcial: este recorte não entrega pesquisa global de mensagens/notas, projeção atual de SLA ou métricas operacionais. Próximo recorte de busca deve considerar também interações públicas do workflow e sua audiência, com revogação antes de LIMIT/contagens, e não pesquisar apenas uma tabela de mensagens. Validação semântica de campos existentes requer versão nova e paridade DSL/publicador/SQL/UI; modelos técnicos continuam ausentes. Administração sensível/MFA e Novo GEO seguem adiados, scanner cancelado. MCP separado permanece local; sua migration não pertence ao banco operacional.
