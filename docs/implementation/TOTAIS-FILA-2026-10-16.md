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
- [x] Atualizar OpenAPI/JSON Schema e testes PostgreSQL/browser reais descartáveis.
- [x] Rodar verificações, revisão independente da branch e CI Linux; corrigir achados importantes; abrir PR para revisão, sem merge/publicação automática desta nova etapa.

## Publicação anterior — PR61

PR61 mesclado em `2c201d0849da330868ebd7bd2fbd964730a5074a`; deploy Netlify `6ad23360e61e3b1608a0fd71` production READY às11h24 Brasília de16/10/2026.116 arquivos do manifesto conferidos por SHA1/HTTPS, incluindo negação do arquivo privado de configuração. Rotas anônimas401, fontes/migrations404, worker nativo403 e capacidades existentes confirmadas. Sem migration e sem escrita de negócio. A comparação inicial com dist Windows diferiu em seis assets compilados do Apoio; o manifesto do deploy Linux passou integralmente. Evidências em `evidence/prioridades-20261016/production/`. Aceite autenticado complementar permanece distinto desta prova pública.

## Progresso observado

Primeiros7 testes executados vermelhos antes da implementação;31 testes focais aprovados na primeira etapa (domínio/HTTP, estado, adaptador, rota transacional, capacidade e grafo estático). Navegador local real com provedor/API sintéticos:6 verificações aprovadas, incluindo totais607 versus lista parcial, erro/repetição, carregar mais sem nova totalização, filtro antigo,390px e logout com resposta pendente. Não é aceite produtivo humano.

Typecheck, contratos45 operações,21 migrations, upgrade CG, segredos heurísticos, lock e build passaram. A execução ampla Windows intermediária teve5853 testes/5713 aprovados/140 falhas; comparação identificou uma falha nova de fixture de build sem os novos assets. A fixture foi ampliada e o caso passou; as demais falhas pertencem à baseline do ambiente Windows/Node24. A qualificação posterior Linux/PostgreSQL17/interface passou integralmente, conforme recibo abaixo, sem remover ou pular testes.

A agregação também intersecta a autoridade atual do PostgreSQL com o principal congelado da aplicação, reproduzindo os filtros adicionais de leitura/operador/produto da lista. O teste SQL real inclui principal deliberadamente reduzido, namespace/workspace alheio, protocolo, paginação e desativação de obra; execução aprovada no CI da fonte626eed2.

HD019/026 continuam parcialmente abertos: esta etapa entrega apenas totais da fila; cockpit, visões salvas, portal, relatórios, exportações e indicadores de SLA não são declarados concluídos.

## Revisão independente

Revisão da fonte3871d34 contra2c201d0, sem achados Critical/Important. Conferidos RLS/namespace, interseção do principal, filtros/estados, validação, gates, grafo de assets e respostas antigas. O único achado menor foi405 versus503 para método não permitido na rota montada. Corrigido com teste observado vermelho (503 recebido) e verde (405/Allow GET, sem SQL);32 testes focais aprovados após o ajuste. Nenhum achado conhecido adiado. A qualificação PostgreSQL/interface vem do CI abaixo, não desta revisão.

## Continuidade para merge e aceite hospedado desta etapa

1. Usar a fonte e o fingerprint exatos da qualificação desta branch; preservar relatório e logs originais do CI. Conferir base concorrente, revisão e checks do PR antes de um merge posteriormente autorizado.
2. Publicação pelo pipeline Netlify atual, sem migration, novo papel, flag de administração ou segredo. A configuração da composição já existente determina `ticket_totals`; não editar banco para produzir capacidade.
3. Conferir deploy READY/commit publicado, manifesto estático e os dois módulos novos (`ticket-summary-state.js` e `shared/ticket-summary.js`). Negar consulta anônima aos totais; conferir `no-store` e capacidades efetivamente montadas.
4. Com sessão humana legítima, abrir Chamados e comparar cartões versus lista carregada; aplicar busca/status/prioridade/responsabilidade permitidos, atualizar, carregar mais e usar390px. Usar somente chamados existentes autorizados. Não criar registros fictícios para obter volume.
5. Distinguir total zero de resumo indisponível. A repetição do resumo não deve apagar a lista nem enviar comandos de negócio. Conta/obra revogada deve deixar de participar conforme a autoridade corrente, sem restaurar vínculos para o teste.
6. Registrar esse aceite separadamente das fixtures locais/CI. Se o controle de navegador falhar, manter a pendência explícita; não alterar MFA, sessão, política de navegador, gates ou banco para contorná-la.

O próximo recorte de desenvolvimento pode projetar o SLA corrente já persistido, com cobertura/definição dos indicadores e tratamento explícito de indisponibilidade. Não criar novas metas ou políticas contratuais, prometer cumprimento de prazo a partir destes totais ou ativar o backoffice sensível enquanto MFA permanece adiada.

## Qualificação final e handoff do PR62

[PR62](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/62), fonte `626eed2de0c91fa1989adb6f77a6d380197b308d`. [CI38919687542](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38919687542): **5855 aplicação +700 PostgreSQL17 +639 interface =7194**, sem falha, cancelamento, skip ou todo. [Merge de teste38919697076](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38919697076) também aprovado. HDA, Apoio e CodeQL aprovados.

Os novos cenários de agregação restrita, paginação e revogação de obra foram confirmados nos logs PostgreSQL; as6 verificações novas da tela aparecem no log de interface. Instalação limpa, audit, verify (inclui typecheck/contratos/build) e validação de evidência passaram.

Artefato original: `helpdesk-homologation-626eed2de0c91fa1989adb6f77a6d380197b308d-38919687542-1`, digest `sha256:69b31419b43165f31a6f42585b55d0631255d19aa594fce4829a86b531a71854`. Fingerprint `a9e20703dde0277a862c83349f656decf17f4b9afdb895b9670e9ad217212dfc`. Relatório e6 logs originais em `evidence/homologation/runs/919c159e-f149-4f78-9ed8-6e0c3e5064db`; recibo em `evidence/totais-fila-20261016/ci-qualified.json`. Cópia conferida por hash contra os arquivos originais, e `check:homologation` aprovado na árvore local. Alterações posteriores de documentação/evidência preservam o fingerprint qualificado.

PR62 pronto para revisão. Nenhuma alteração de banco, configuração ou negócio em produção nesta etapa; publicação e aceite humano dos totais continuam pendentes de seu próprio merge/deploy autorizado. Produção permanece PR61. Os documentos de levantamento/handoff antigos não rastreados foram preservados.
