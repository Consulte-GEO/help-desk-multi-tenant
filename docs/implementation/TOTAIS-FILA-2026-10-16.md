# Totais autorizados da fila — especificação e plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir os cartões da caixa de chamados para contar todo o resultado autorizado da consulta, independentemente das páginas carregadas (recorte HD-019/HD-026).

**Architecture:** GET `/v1/tickets/summary`, separado da paginação existente. Uma agregação no PostgreSQL sob a mesma identidade, RLS, atualização das obras e namespace local da coleção. Interface com estado transitório próprio, descartado ao mudar filtros ou sessão.

**Tech Stack:** TypeScript, PostgreSQL17, JavaScript nativo e contratos OpenAPI/JSON Schema existentes.

**Spec:** este documento; contexto anterior em `PRIORIDADES-2026-10-16.md` e levantamento de16/10.

## Comportamento e limites

- Filtros `account_id`, `q`, `status`, `priority`, `assignment`, com a mesma validação/autorização da lista. Não aceitar `cursor`, `limit` ou seletores internos.
- Resposta estrita `{as_of,total,statuses:{received,in_progress,waiting_for_you,resolved,closed}}`; inteiros seguros não negativos, soma igual ao total. `as_of` é o instante do servidor após a consulta; lista e resumo são leituras independentes, não um snapshot transacional conjunto.
- Estados públicos já existentes: recebidos=new/triage; atendimento=open/waiting_internal/waiting_third_party; aguardando=waiting_customer; resolvidos=resolved; encerrados=closed/cancelled. Cartão Em atendimento mantém recebidos+atendimento, como atualmente.
- Resumo sem paginação, sem teto artificial de500. A lista mantém limite de500 itens na tela, explicitamente identificado.
- Capacidade `ticket_totals` somente na composição local Consulte GEO efetivamente montada. Composição antiga mantém cartões explicitamente relativos aos itens carregados.
- Na composição ativa, carregamento/falha mostram indisponibilidade, nunca zero presumido ou contagem parcial. Permitir tentar novamente sem bloquear a lista. Filtros novos e logout invalidam respostas antigas; carregar mais não altera os totais.
- Não incluir descrição, notas, mensagens, e-mails ou agrupamentos privados. Não criar cache persistente, migration, grant, infraestrutura ou credenciais.
- MFA/Novo GEO adiados; scanner cancelado; nenhum modelo técnico homologado disponível. Estes itens permanecem fora desta entrega.

## Review Focus

- Resultado com mais de500 chamados: resumo completo, lista limitada.
- Outra conta/workspace/solicitante/obra/produto: nem a existência entra nos totais.
- Consulta antiga concluída após novo filtro/logout: resposta descartada.
- Agregação inválida ou serviço indisponível:503 e indicação de indisponibilidade, sem zeros fabricados.
- Resumo e página em ordens diferentes: lista utilizável e totais vinculados à consulta, sem repetir no carregar mais.

## Implementação (execução contínua autorizada)

- [x] Escrever e executar testes negativos do domínio/HTTP e do estado da interface; comprovar falha antes do código.
- [x] Implementar contrato estrito, serviço e contagem Memory/PostgreSQL, reutilizando preparação local e filtros; testes de isolamento/validação/contagem completa.
- [x] Montar rota autenticada na transação local, capacidade e configuração pública, mantendo gates fechados nos demais modos.
- [x] Integrar cartões, prazo/erro/repetição e limpeza de sessão; incluir módulos no grafo de assets.
- [ ] Atualizar OpenAPI/JSON Schema e testes PostgreSQL/browser reais descartáveis.
- [ ] Rodar verificações, revisão independente da branch e CI Linux; corrigir achados importantes; abrir PR para revisão, sem merge/publicação automática desta nova etapa.

## Publicação anterior — PR61

PR61 mesclado em `2c201d0849da330868ebd7bd2fbd964730a5074a`; deploy Netlify `6ad23360e61e3b1608a0fd71` production READY às11h24 Brasília de16/10/2026.116 arquivos do manifesto conferidos por SHA1/HTTPS, incluindo negação do arquivo privado de configuração. Rotas anônimas401, fontes/migrations404, worker nativo403 e capacidades existentes confirmadas. Sem migration e sem escrita de negócio. A comparação inicial com dist Windows diferiu em seis assets compilados do Apoio; o manifesto do deploy Linux passou integralmente. Evidências em `evidence/prioridades-20261016/production/`. Aceite autenticado complementar permanece distinto desta prova pública.

## Progresso observado

Primeiros7 testes executados vermelhos antes da implementação;31 testes focais atuais aprovados (domínio/HTTP, estado, adaptador, rota transacional, capacidade e grafo estático). Navegador local real com provedor/API sintéticos:6 verificações aprovadas, incluindo totais607 versus lista parcial, erro/repetição, carregar mais sem nova totalização, filtro antigo,390px e logout com resposta pendente. Não é aceite produtivo humano.

Typecheck, contratos45 operações,21 migrations, upgrade CG, segredos heurísticos, lock e build passaram. A execução ampla Windows intermediária teve5853 testes/5713 aprovados/140 falhas; comparação identificou uma falha nova de fixture de build sem os novos assets. A fixture foi ampliada e o caso passou; as demais falhas pertencem à baseline do ambiente Windows/Node24. A qualificação integral Linux/PostgreSQL17/interface ainda é gate separado, sem remover ou pular testes.

A agregação também intersecta a autoridade atual do PostgreSQL com o principal congelado da aplicação, reproduzindo os filtros adicionais de leitura/operador/produto da lista. O teste SQL real inclui principal deliberadamente reduzido, namespace/workspace alheio, protocolo, paginação e desativação de obra; execução pendente do CI.

HD019/026 continuam parcialmente abertos: esta etapa entrega apenas totais da fila; cockpit, visões salvas, portal, relatórios, exportações e indicadores de SLA não são declarados concluídos.

## Revisão independente

Revisão da fonte3871d34 contra2c201d0, sem achados Critical/Important. Conferidos RLS/namespace, interseção do principal, filtros/estados, validação, gates, grafo de assets e respostas antigas. O único achado menor foi405 versus503 para método não permitido na rota montada. Corrigido com teste observado vermelho (503 recebido) e verde (405/Allow GET, sem SQL);32 testes focais aprovados após o ajuste. Nenhum achado conhecido adiado. A íntegra PostgreSQL/interface continua sendo qualificação do CI, não desta revisão.
