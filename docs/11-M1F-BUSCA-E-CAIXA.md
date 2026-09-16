# v0.7.0 — Busca autorizada e caixa de chamados

## Entrega e enquadramento

Incremento local sobre v0.6.0, sem publicação. API/interface 0.7.0; schema esperado 0.5.0. Seis migrations anteriores preservadas; 23 tabelas candidatas. A implementação antecipa **parte delimitada de HD-302 (busca/paginação, planejada em M3)** e evolui HD-105 (estado da interface). Não significa fechamento M1, início/conclusão do backoffice M2 ou entrega completa de M3. A antecipação permite melhorar a caixa já existente sem introduzir módulos administrativos ou ignorar homologação pendente.

## Problema observado na base

O campo de busca da v0.6.0 filtrava `s.tickets` no navegador. Ele examinava assunto e descrição, mas apenas dos chamados já carregados. Assim, um chamado autorizado fora da primeira página podia parecer inexistente. A listagem também não distinguia gerações de consulta: respostas fora de ordem podiam substituir uma lista mais recente dentro da mesma sessão.

## Contrato da API

`GET /v1/tickets` mantém autenticação, scope `tickets:read`, autorização de conta/recurso, DTO e paginação existentes. Acrescenta parâmetros opcionais:

| Parâmetro | Semântica |
|---|---|
| `q` | Fragmento literal do **assunto**, ou identificador completo exato; 2–120 pontos de código Unicode após trim. |
| `status` | `received`, `in_progress`, `waiting_for_you`, `resolved`, `closed`. |
| `priority` | `low`, `normal`, `high`, `urgent`. |
| `account_id` | Filtro já existente; não concede acesso à conta. |
| `limit` / `cursor` | Contrato anterior, 1–100 resultados por chamada; interface solicita 25. |

Os filtros são combinados por AND e aplicados **antes** de ordenar/limitar, tanto em memória quanto na consulta PostgreSQL candidata. Query duplicada, valor explicitamente vazio, parâmetro desconhecido e estado interno como seletor são recusados. Não há endpoint novo: continuam 16 operações / 13 caminhos. `/capabilities` acrescenta `ticket_search: true` para o código que suporta o contrato.

Exemplos (usar bearer humano ou sessão curta M2M válida; nunca enviar segredo M2M ao browser):

```http
GET /v1/tickets?q=Relat%C3%B3rio&status=in_progress&priority=high&limit=25
Authorization: Bearer <sessao>
X-Workspace-Id: <workspace-autorizado>
```

O termo é literal: `%`, `_`, aspas e operadores não funcionam como SQL, curingas ou linguagem de busca. Texto entra como parâmetro, não interpolação. A implementação usa um alfabeto explícito de equivalência entre maiúsculas/minúsculas ASCII e Latin-1 nos dois adaptadores, sem depender de locale do banco. **Acentos são significativos:** `RELATÓRIO` encontra `relatório`, mas `relatorio` não é a mesma busca. Alfabetos fora desse conjunto não têm equivalência universal de caixa; sequências Unicode canonicamente equivalentes não são normalizadas. Não há stemming, fuzzy search, ranking ou FTS.

O fragmento não pesquisa descrição, respostas públicas ou notas internas. Isso altera deliberadamente o escopo do antigo filtro local por assunto/descrição. A descrição permanece no DTO autorizado e na tela do chamado; excluir do predicado textual não a remove da consulta normal de um recurso autorizado.

## Situação pública e autorização

| Situação filtrável | Estados internos correspondentes |
|---|---|
| received | new, triage |
| in_progress | open, waiting_internal, waiting_third_party |
| waiting_for_you | waiting_customer |
| resolved | resolved |
| closed | closed, cancelled |

Cliente não ganha um filtro que permita distinguir espera interna de outros estados públicos. A query não consulta notas internas nem muda sua projeção. Autorização existente de solicitante/gestor/agente, conta, workspace e integração continua aplicada. Cursor e parâmetro são seletores, não credenciais.

A consulta candidata permanece em `helpdesk_core.tickets` com o papel restrito e contexto transacional; não cria função SECURITY DEFINER nem altera grants/RLS. Testes locais do adaptador examinam SQL/argumentos controlados; **não comprovam RLS ou plano de execução reais**. Referências técnicas para a homologação: documentação oficial PostgreSQL 17, `functions-string.html` (`strpos`/`translate`) e `ddl-rowsecurity.html`.

## Cursores e páginas vivas

Hash do contexto inclui workspace, principal, conta e filtros normalizados. Trocar q, status ou prioridade torna o cursor incompatível; mudar só a caixa latina/trim mantém a mesma semântica. Sem os novos filtros, preserva-se o contexto dos cursores antigos. O cursor não é assinado como autorização; cada chamada precisa ser autenticada/autorizada novamente.

Ordem continua `created_at DESC, id DESC`. São páginas vivas, não snapshot: estados, privilégios e prioridades podem mudar entre chamadas. Não é garantido que percorrer todas as páginas durante mudanças concorrentes produza um retrato histórico imutável.

## Interface

Busca aplicada por botão/Enter, com situação e prioridade opcionais. Limpar filtros restaura a consulta sem os três filtros. A listagem não faz um segundo filtro local que esconda chamados depois da paginação. Contagens e indicadores dizem explicitamente **itens carregados**; não representam total global, backlog total ou métricas corporativas.

`ticket-list-state.js` guarda estado somente em memória por sessão/consulta. Cada request captura geração/operação/cursor; resposta de outra geração é descartada. A página inteira é validada antes de aplicar, com clones defensivos, rejeição de campos adicionais, IDs duplicados, cursor repetido e payload malformado. Falha mantém páginas já aceitas para nova tentativa, sem repetir silenciosamente criação/mutação. Trocar sessão descarta a lista.

A tela limita a 500 chamados carregados por consulta; depois pede refinamento. Essa proteção de memória da UI **não limita o total da API a 500**, nem autoriza leitura adicional. Os endpoints continuam pagináveis conforme as permissões e limites de requisições existentes.

Aplicar/limpar filtros não muda automaticamente o detalhe selecionado e não apaga o rascunho. Pode haver um detalhe aberto fora da nova lista; isso é intencional para preservar trabalho. Só o carregamento inicial de uma sessão escolhe o primeiro chamado quando nenhum detalhe foi selecionado durante a espera.

## Testes e limites de evidência

35 testes locais novos: 16 serviço/HTTP, 12 estado puro, sete adaptador/limites/observação. Suíte completa: **486 aprovados**. Red/green registrados para busca e estado. Smoke real HTTP em loopback: **17 checks**, usando memória e dados fictícios, incluindo 30 chamados para comprovar busca fora da primeira página.

Oito testes PostgreSQL acrescentados (68 escritos no total): paginação com 31 criações, conta/workspace/UUID conhecido, campos excluídos, revogação, projeção pública de estado, caracteres literais, equivalência Latin-1 e integração/prioridade. **Zero executados contra banco real.** Três checks browser acrescentados (17 escritos no total): filtros combinados, limpeza e resposta antiga após query nova. **Zero aprovados no navegador nesta sessão**, bloqueado em navegação.

Sem EXPLAIN, carga, tempo de resposta do banco ou homologação visual. O predicado por substring pode ler muitas linhas autorizadas, especialmente para termos comuns; não foi criado índice supostamente otimizador sem medição. Avaliar seletividade, plano com RLS, número de linhas, latência e custo; só então decidir índice trigram/FTS, sempre em migration própria e com semântica explícita.

Os logs da aplicação não registram q/filtros. O termo vai na URL GET e pode estar presente em logs de ingresso/proxy fora desta instrumentação; verificar redação e retenção no destino. Não digitar segredos no campo de busca. Respostas mantêm `Cache-Control: no-store`.
