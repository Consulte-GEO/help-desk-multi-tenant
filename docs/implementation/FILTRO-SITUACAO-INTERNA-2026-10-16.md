# HD-019 — filtro de situação interna da equipe

## Desenho delimitado

Continuidade autorizada após PR69, base `72a72b51ea651fa5d377f2632646a352d39e90f1`. Acrescentar `internal_status` opcional à lista e ao resumo, limitado aos nove estados existentes do core. Filtro exato combinado por AND com busca, situação pública, prioridade e responsabilidade. Não muda DTO, estados, transições, SLA ou notas. Omitir mantém consultas e cursores anteriores. O seletor faz parte do vínculo do cursor e da geração dos resultados.

A audiência é a mesma que já recebe `internal_status` no DTO: humanos administradores ou agentes da conta, com `tickets:read`. Solicitante, gestor de conta e integração recebem403 ao solicitar o filtro. Um agente com papel diferente em outra conta só pesquisa os estados internos nas contas em que é operador; o SQL deve aplicar essa interseção com o principal congelado antes do LIMIT, além de RLS e autorização CG vivas. Totais usam o mesmo conjunto. Não ampliar `notes:read` nem conceder acesso por um filtro.

UI: “Situação interna da equipe” em Filtros adicionais, visível na mesma condição de responsabilidade. Campos vazios são omitidos; valores desconhecidos ou repetidos recusados. Filtro aplicado e rascunho diferenciados; paginação preserva seleção. Consultas rápidas limpam a situação interna e sincronizam o controle, pois definem a situação da consulta; enquanto ela estiver selecionada, a consulta é personalizada. Busca, modo de descrição e prioridade continuam preservados. Limpar/logout retiram seleção e resultados;390px e desktop devem continuar utilizáveis.

Sem migrations, grants, dependências, infraestrutura ou dados de teste produtivos. Usar login restrito PostgreSQL17 em banco descartável. MFA/Novo GEO adiados, scanner cancelado, modelos técnicos ausentes e MCP independente local preservados.

## Plano e verificações

Execução direta com testes antes do código, conforme continuidade autorizada. Usar o isolamento de branch existente; preservar os documentos locais não versionados. Referência de segurança: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), changelog consultado em16/10; sem alteração de políticas ou extensões.

- [x] Testes RED/green de validação, HTTP, estados públicos combinados, cursor, contas mistas, gestor/solicitante/integração, scope e revogação. Corpus maior que a página e totais completos.
- [x] Implementar opções/normalização/predicado compartilhado e admissão; allowlists core e composição CG; SQL com parâmetros, interseção de operador antes do LIMIT e paridade com resumo.
- [x] UI/estado/consultas rápidas/rascunhos, contrato OpenAPI e jornada Chromium com APIs sintéticas: equipe e solicitante, filtros/paginação/totais, limpeza/logout e390px.
- [x] PostgreSQL17 real: login restrito, contas mistas antes do LIMIT, estados combinados, cursor e revogação; namespace CG atual. Sem mudança de fixtures para ocultar falhas.
- [ ] Tipos, contratos, build/lock/scan; CI Linux integral, revisão independente e recibos por fonte; PR/preview prontos para revisão. Sem merge antecipado da próxima entrega.

## Foco da revisão

Não confundir gestor de conta com operador. Se o primeiro ticket mais recente for de conta em que o agente só é solicitante/gestor, ele não pode consumir a página do filtro privado. Estado público incompatível resulta zero, sem alterar política. Mudança de filtro invalida respostas/cursor anteriores. Atalho não pode deixar controle antigo aplicado parcialmente. Nenhum conteúdo de notas ou campo privado adicional participa dos resultados.

## Execução local

Quatro cenários novos falharam antes do código e passaram depois. O Chromium falhou pela ausência do seletor antes da UI e passou5/5 depois: equipe, lista/totais, paginação, consulta rápida,390px e troca para solicitante após logout. Shell real e Auth/API sintéticos; não é aceite humano produtivo.

A primeira rodada focal teve74/76: dois testes antigos exigiam400 para internal_status válido por ser parâmetro antes desconhecido. O novo contrato exige403 para não operadores. Preservados os diagnósticos; separado o parâmetro desconhecido (400) do parâmetro privado não autorizado (403) em ambos os testes, mantendo todas as recusas anteriores. Nenhuma mudança de runtime para satisfazer esse legado. Rodada final76/76, tipos e45 contratos aprovados. Casos PostgreSQL escritos para login restrito, contas mistas antes do LIMIT, revogação e namespaces CG; gate real ainda pendente.

Build, lock e scan heurístico concluídos com sucesso. Nenhuma migration alterada. A revisão independente é somente leitura; qualificação integral Linux/PG17 ainda pendente nesta fonte.

## Fonte e revisão independente

Fonte `d638cd0d5563f17aff0d340ccdc18bff7f05e378`, fingerprint `f75c7a653779e90512cb6b8d7f43adbdce2fe5c2afde5ea2adf560be4ea29d23`. Revisão somente leitura encerrada sem achado acionável;45/45 focais reexecutados, zero falha/skip. Reviewer não repetiu PG17/Chromium e não declara aceite humano. [PR70](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/70) em rascunho; CI da fonte38988545433 e merge de teste38988551964 em andamento. Sem merge/publicação desta implementação.

## Qualificação integral da fonte

[CI38988545433](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38988545433) aprovado em `d638cd0d5563f17aff0d340ccdc18bff7f05e378`: **5919 aplicação +706 PostgreSQL17 +678 interface =7303**, zero falha/skip/cancelamento/todo. Node22/Linux, instalação limpa, audit, lock, tipos,45 contratos, migrations/upgrade e build aprovados. Inclui seis cenários Node novos, três PG novos e cinco verificações Chromium novas; não7303 funcionalidades novas.

Artefato original `helpdesk-homologation-d638cd0d5563f17aff0d340ccdc18bff7f05e378-38988545433-1`, digest `sha256:f095f0400d0658a809c0b17ef23fce92254ca185a00dc2de23e12ebe8eab098d`. Relatório e seis logs originais preservados em evidence/homologation; `ci-qualified.json` registra hashes/origem e fingerprint inalterado, reconferido antes/depois da cópia. Casos de conta mista antes do LIMIT, autorização/revogação e namespace CG passaram no PG17 real.

Merge de teste [38988551964](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38988551964) aprovado. HDA fonte38988545421/PR38988551985 e Apoio fonte38988545466/PR38988551959 aprovados. Primeira prévia d638/6ad2c76561bc8e3c0d7f8194 falhou antes da inclusão do relatório aprovado; recibo identificado como não qualificado. A publicação produtiva continua no PR69. Prévia qualificada ainda será conferida; PR70 continua rascunho até a entrega final.
