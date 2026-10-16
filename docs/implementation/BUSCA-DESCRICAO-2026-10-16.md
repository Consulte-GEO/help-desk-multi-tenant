# HD-019 — busca na descrição dos chamados

## Desenho e limites

Continuidade autorizada após o PR68. Acrescentar uma opção explícita **Pesquisar em: Descrição** na caixa de atendimento. A busca padrão por assunto/protocolo/UUID permanece compatível. `search_in=description` exige `q`; a ausência do parâmetro mantém a semântica anterior. Outros valores, vazios e repetições são recusados. Busca literal, dobra de caixa ASCII/Latin-1 determinística, acentos significativos, trim e 2–120 pontos de código. `%`/`_` não são curingas. Não pesquisa notas, mensagens, anexos ou dados de formulários.

Reutilizar `tickets:read`, RLS, a preparação atual de obras CG, principal congelado, filtros e ordenação existentes. Lista e resumo usam o mesmo predicado antes da paginação. O cursor inclui o modo; mudança exige reiniciar a coleção. Nenhuma nova tabela, grant, função privilegiada, migration, dependência, integração ou infraestrutura. Não retornar trechos adicionais ou corpos de mensagens na lista.

UI: seletor junto à busca, ajuda explícita, filtro aplicado identificável, consultas rápidas preservam o modo e o termo; Limpar e logout removem ambos. Filtros não submetidos continuam sinalizados; erros de resumo não se tornam zero. A busca ocorre por submissão do formulário, não ao digitar. Foco e layout devem funcionar a390px e desktop.

### Decisão sobre a busca global de mensagens

A inspeção de `public-workflow-read.ts` e da função existente `hdn_public_messages` mostrou uma união autorizada de mensagens persistidas e interações públicas projetadas dos commits de workflow (pedido de resposta, resposta e solução). Pesquisar apenas `ticket_messages` daria resultados incompletos; ler diretamente o ledger ou ampliar grants quebraria a fronteira privada. A busca global dessa conversa exige uma projeção de pesquisa própria com os mesmos validadores e autorização. Não foi implementada neste recorte. A busca local do PR68 continua limitada às mensagens públicas carregadas, com cobertura explícita.

Fontes consultadas em16/10: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog), avisos [PG17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) e [TLS HTTP](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). Este recorte não usa as extensões/cifras citadas nem altera políticas ou conexões.

## Plano de execução

Execução direta, conforme continuidade autorizada; revisão independente final. Base `c6d398fac03efd2439923c39dce47307b73e0bb7` (PR68).

- [ ] Testes negativos/positivos em `tests/ticket-description-search.test.ts`: HTTP lista/resumo, modo explícito, assunto não coincide, corpus607 antes do LIMIT/teto500, cursor, literalidade, filtros, outro solicitante/conta/workspace/produto e revogação. Rodar antes da implementação e preservar RED.
- [ ] Implementar `search_in?:string` nas opções/filtros em `ticket-search.ts`; `matchesTicketSearch` seleciona apenas assunto ou descrição. Adaptadores memória e PostgreSQL reutilizam o filtro; SQL troca somente coluna constante escolhida pelo servidor, mantendo parâmetros, RLS e namespaces atuais. HTTP aceita o seletor em lista e resumo. OpenAPI descreve os dois contratos, sem mudar DTO.
- [ ] UI: estado da lista/d.ts, resumo por reuso, consultas rápidas, comparação de rascunho, coleta/aplicados e HTML. Testar lista/resumo usando exatamente o mesmo modo, validação, respostas atrasadas, limpar/logout, consultas rápidas e390px em Chromium. Registrar no gate UI.
- [ ] PostgreSQL17 descartável sob login restrito: descrição exclusiva e literals, totais/lista, scopes/revogação e obras CG atuais. Não escrever em produção para essa prova.
- [ ] Qualificar fonte no CI integral Linux Node22/PG17/interface; verificar tipos, contratos, build, lock e segredos. Revisão independente sem bloqueadores, PR/preview, recibos originais por fonte e atualização do estado canônico. Próximo PR fica para revisão, sem merge autorizado antecipadamente.

## Foco da revisão

Troca de modo sem trocar `q` deve invalidar cursor e resposta anterior. Termo presente só no assunto não pode casar em descrição. Coringa/aspas não podem ampliar resultados. Mesmo predicado deve produzir resumo completo e páginas sem duplicações. Mudança/revogação de obra CG precisa remover lista e resumo, mesmo com principal antigo. Nenhum dos testes sintéticos equivale a aceite humano produtivo.

MFA/Novo GEO adiados, scanner cancelado, modelos técnicos ausentes e MCP independente local preservados.

## Execução local inicial

Quatro cenários novos falharam antes do código e passaram após implementação (local-red/green.txt). O navegador falhou pela ausência do seletor antes da UI; depois6/6 verificações passaram. Diagnóstico de consulta rápida com termo vazio também passou: o callback já usa o tratamento de erros comum; nenhuma correção extra de runtime foi necessária. A composição CG tinha uma segunda allowlist e o novo teste montado reproduziu400; corrigida sem remover validação de duplicatas/seletores,24/24 focais aprovados. Sessão Chromium151/Playwright1.64/Python3.14, shell real e Auth/API sintéticos; capturas desktop/mobile conferidas.

Tipos e45 contratos passaram. O primeiro build falhou por DNS do registry no sandbox; log preservado em build-network-failure.txt. Nova tentativa com rede permitida é registrada separadamente. A prova real de RLS/PG17 depende do gate Linux, não dos spies SQL locais. Nenhum resultado pendente é declarado aprovado.
