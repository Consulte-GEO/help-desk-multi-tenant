# Consultas rápidas da fila — HD019

Continuidade autorizada após o merge/publicação do PR62. Recorte da fila existente; não cria novas categorias, autoridade, relatórios ou visões persistentes.

## Desenho

Botões Todos, Aguardando resposta e Resolvidos para quem tem leitura. Meus atendimentos e Sem responsável somente para operador humano, conforme a identidade já carregada. Estes botões preenchem os filtros públicos atuais e passam pelo mesmo envio/validação da lista; o servidor continua decidindo o acesso por conta/obra. Meus atendimentos significa responsabilidade atribuída ao usuário, não chamados abertos por ele.

Cada consulta define situação e responsabilidade e preserva busca/prioridade digitadas. Todos remove somente situação/responsabilidade. Textos auxiliares tornam esse comportamento explícito. Filtros inválidos não apagam a consulta anterior. O destaque usa os filtros efetivamente aplicados, não campos ainda não enviados; combinação diferente aparece como Personalizada. Sem persistência, compartilhamento de URLs com termos de busca ou ampliação de scopes.

Os totais completos entregues no PR62 continuam sendo consultados junto da primeira página. Carregar mais preserva os totais. Estado de carregamento/erro, respostas antigas, troca de sessão e navegação mobile continuam sob os controladores existentes. Botões acessíveis com `aria-pressed`, teclado nativo, foco conservado após atualização e disposição que quebra linhas em telas pequenas.

## Limites e decisão de sequência

A análise de HD020 encontrou o motor SLA determinístico existente e snapshots de abertura/revisão. Porém o leitor de agregado completo disponível (`hdnr_aggregate`) está acoplado a perfis/políticas de revisão, e a projeção exige histórico completo equivalente à versão corrente, inclusive comandos legados. Não apresentar snapshot antigo como relógio atual nem reutilizar revisão/aprovação como atalho de leitura. HD010/020 permanecem separados para reconciliação de fonte/política e composição própria; não se alteraram prazos, calendário ou regras de reabertura nesta etapa.

MFA/Novo GEO continuam adiados; scanner cancelado; nenhum modelo técnico homologado disponível. Nenhuma migration, grant, segredo, dependência ou infraestrutura adicional nesta entrega.

## Execução e verificação

- [x] Testes negativos dos presets, identidade, preservação de filtros e destaque aplicado.
- [x] Integração na fila/formulário existente e inclusão no grafo de assets.
- [x] Navegador real com API/Auth sintéticos: lista+totais, validação, teclado/foco, mobile, troca para solicitante e logout.
- [x] Gates locais aplicáveis, revisão independente e CI Linux completo; PR separado para revisão. Merge/publicação dessa nova etapa não são presumidos pela autorização específica do PR62.

## Progresso observado

5 testes dos presets executados vermelhos antes do código;33 verificações focais atuais aprovadas. Navegador local real com API/Auth sintéticos alcançou8 asserções aprovadas: lista/totais, preservação de busca/prioridade, teclado/foco, consulta personalizada, validação, bloqueio durante leitura,390px e sessões. O caso de botão destacado após login de novo operador foi observado vermelho (alterava assignment para mine) e corrigido exigindo pertencimento ao grupo DOM atual; verde após a correção. O helper Windows não confirmou encerramento com código0 no último ciclo. Instrumentação externa isolou o bloqueio em `Browser.close`: as8 asserções e `BrowserContext.close` terminaram em cerca de18s; o encerramento do processo foi interrompido no prazo do helper. Por isso a execução local inteira não está declarada aprovada e a prova completa é o gate Linux registrado abaixo, sem alterar o produto ou retirar testes. Capturas sintéticas desktop/mobile em `evidence/ticket-views-20261016/`.

Typecheck, contratos45 operações, lock, segredos heurísticos,21 migrations e build passaram. Execução ampla Windows:5860 testes,5722 aprovados/138 falhas do ambiente; a comparação com a baseline não encontrou novos nomes de falha e a qualificação integral consta no CI Linux abaixo, sem remover testes. Não é aceite hospedado humano.

## PR62 publicado nesta rodada

Merge `40f8f0db4fad736bbaf280f27b797fd93a3ffac2`; deploy production `6ad23faaa12159f25057e22a` READY em2026-10-16T15:16:58.173Z (12h16 Brasília).118 entradas do manifesto conferidas por HTTPS/SHA1; nova capacidade/configuração ticket_totals ativa e consultas anônimas401. Fontes/migrations404, worker nativo403. Sem migration/escrita de negócio. Prova em `evidence/totais-fila-20261016/production/publication.json`; aceite humano permanece distinto.

## Revisão e continuidade

Revisão independente da fonte `34a20fa` contra a base `40f8f0d` encerrada sem achados Critical, Important ou Minor. O revisor reexecutou os5 testes dos presets e inspecionou a integração, os filtros validados, o grafo de assets e as regressões de navegador. Esse resultado não substitui o CI ou o aceite hospedado.

O primeiro CI Linux (`38924421002`, fonte `34a20fa`) aprovou5860 testes de aplicação,700 de PostgreSQL e as8 verificações novas. A suíte ampla de interface encontrou regressão em `browser-simple-access.py:35`: operação indisponível exige nenhum controle do filtro nativamente habilitado. A criação dos atalhos após o bloqueio geral deixava os botões ocultos e com handler bloqueado, mas sem `disabled`. Corrigido no componente para aplicar `disabled` quando indisponível e `aria-disabled` também nesse estado; durante leitura com operação disponível mantém foco e bloqueio por handler. O teste existente não foi alterado. Revisão independente focal do fix aprovou indisponibilidade, retomada, leitura ocupada e preservação dos nós. Reexecução local da suíte de acesso simples aprovou17 verificações com saída0;33 testes focais e typecheck também passaram. Nova qualificação completa obrigatória antes de declarar o PR pronto.

O [PR63](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/63) contém somente este recorte e a documentação/prova da publicação anterior. Produção permanece no PR62. Não reaplicar migrations nem alterar configuração, grants ou políticas para disponibilizar os atalhos.

Após autorização própria de merge/publicação:

1. Reinspecionar a base, os checks, o fingerprint qualificado e o deploy corrente para detectar alterações concorrentes.
2. Publicar pelo pipeline existente e conferir o commit/deploy READY, o manifesto e o novo asset `ticket-views.js`.
3. Na sessão humana legítima, usar chamados existentes: Todos, Aguardando resposta e Resolvidos; para operador, também Meus atendimentos e Sem responsável. Conferir lista e totais na mesma busca/prioridade, combinação manual personalizada, carregamento e recuperação de erro.
4. Conferir teclado/foco e390px. Sair e entrar como outra identidade apenas por autenticação legítima, sem restaurar vínculos revogados, forjar sessão ou alterar MFA. Registrar o aceite humano separado das fixtures de CI.

HD019 permanece parcial: busca por protocolo, totais completos e estes atalhos são recortes distintos. Visões salvas/compartilhadas e indicadores SLA não estão implementados por esta entrega. A próxima frente SLA deve primeiro definir uma leitura autorizada do agregado completo, independente de revisão/aprovação, e reconciliar todos os eventos com a versão corrente. Política ausente ou histórico incompleto deve produzir indisponibilidade explícita; nunca um prazo inventado ou um relógio antigo apresentado como atual.

## Qualificação final do PR63

Fonte `9376ee0fd4e7c8454cd0677783c8f0f615fa79a2`, sobre a base `40f8f0db4fad736bbaf280f27b797fd93a3ffac2`. [CI da fonte 38925957327](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38925957327) aprovado: **5860 aplicação + 700 PostgreSQL17 + 647 interface = 7207**, zero falha, skip, cancelamento ou todo. [Merge de teste38925963806](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38925963806) também aprovado; HDA, Apoio Implantação e CodeQL passaram. O log de interface confirma as8 verificações de consultas rápidas, as17 de acesso simples e326 de composição visual. A limitação de encerramento do Chromium Windows não ocorreu na qualificação Linux.

Instalação limpa, audit, verify (typecheck, contratos, segredos, lock, migrations e build) e validação das evidências aprovados. A revisão independente inicial e a revisão focal da correção encerraram sem achados pendentes. A primeira falha de CI registrada acima permanece como histórico; a fonte corrigida foi qualificada integralmente.

Artefato original: `helpdesk-homologation-9376ee0fd4e7c8454cd0677783c8f0f615fa79a2-38925957327-1`; digest `sha256:67cbd6a2fa8d46e1a1490e90ca9dc19b4c70f11c8bc3be427652fdb3047c92d0`. Fingerprint `76a7e41009ebcc18e9ebfe1947f3dffae5d03085251770cf77e6f21d2922eed3`. Relatório e seis logs originais em `evidence/homologation/runs/eec474b5-e8d5-48c3-9a9e-25181d3f4b1d/`, copiados sem reconstrução, validados por hash antes/depois e contra as fontes locais. Recibo em `evidence/ticket-views-20261016/ci-qualified.json`; `npm run check:homologation` passou na árvore local.

As alterações seguintes de documentação/evidência preservam esse fingerprint; não são uma nova homologação de código diferente. A prévia inicial do Netlify falhou na consulta de extensões (HTTP502); a tentativa seguinte falhou no build, antes deste checkpoint de qualificação. A nova prévia deve ser conferida após enviar as evidências, sem retirar gates. Produção continua no PR62; o PR63 não foi mesclado/publicado e não houve migration, escrita de negócio ou envio de e-mail nesta etapa. Aceite humano hospedado continua próprio.

## Publicação autorizada do PR63

O registro anterior descreve a qualificação pré-merge. PR63 mesclado em `d3322af608e64bd7402aeb01b492f8a19f25c3b2`, às13h10 Brasília de16/10. Deploy production `6ad24c9493f8e03c1e182b61` READY/publicado em2026-10-16T16:12:08.815Z (13h12).119 entradas do manifesto conferidas por HTTPS/hash; consultas anônimas401, fontes/migrations404 e worker nativo403. Sem migration/escrita de negócio. Prova em `evidence/ticket-views-20261016/production/publication.json`. CI pós-merge38929911773, HDA, Apoio e CodeQL aprovados. Aceite humano autenticado permanece próprio. Continuidade do HD002 em [Conformidade de respostas](CONFORMIDADE-RESPOSTAS-2026-10-16.md).
