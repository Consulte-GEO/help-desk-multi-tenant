# HDN-01e — seleção privada de notas de evidência

## Estado — 12/10/2026

Incremento local sobre HDN-01a/b/c/d. Principal reconsultada: `6e069005beaa12d7cb55c77af92478c21f7526ca`. Nenhum commit remoto, alteração de Auth/scopes, migration, novo fornecedor ou deploy. O login simplificado e o painel após login não foram modificados. Não reaplicar HDW-00/00b nem R1, que já estão integrados.

O objetivo desta fatia é retirar a digitação cotidiana de UUIDs do painel. RF-CEN-07 e RF-CEN-11 continuam sendo checklist de execução e reconhecimento de risco; não são autorização ou escrita na origem. O handoff D já previa seleção de notas elegíveis.

## Composição implementada

`shared/checklist-evidence.js` e declaration definem o contrato compartilhado de consulta e página. `createExecutionChecklistService.queryEvidence` usa a autoridade existente, `runResourceTicketTransaction` e a mesma conexão do adaptador. Confere registro privado, responsável atual, estado do chamado e revisões antes de ler notas. Usa o acesso `notes.read` e preserva as exigências do executor do checklist; não concede escopos.

O store faz SELECT parametrizado sobre `helpdesk_core.internal_notes`. Aplica workspace, conta, chamado, autor atual e limite temporal antes da paginação. O ORDER BY utiliza `created_at` nativo e UUID, descendentes; cursor por par `(at,id)`, sem OFFSET, sem COUNT e sem total fictício. Retorna20 opções e valida também a21ª linha usada para indicar continuação. Uma resposta inválida não é aproveitada parcialmente.

A resposta inclui somente contexto/revisões, instante da leitura, lista `{id,at}` e posição da próxima página. Corpo, título, trecho, email e metadados privados adicionais são recusados pelo contrato fechado. Um cursor é apenas posição, não credencial ou autorização. Os metadados são de consulta; não garantem que a evidência continue válida no momento da marcação ou resolução.

## HTTP

Montador opcional ampliado: `POST /v1/internal/tickets/:id/execution-checklist/evidence` realiza exclusivamente consulta. Body: `{expectedTicketVersion,expectedChecklistRevision,before}`, com `before:null` ou `{id,at}`; limite8KiB, `If-Match` da revisão do checklist, origem exata, autenticação, quota e diretório de recursos completo. Nenhum ator/conta/scopes chega por esse body. Query string é recusada; GET/HEAD/PUT não executam a consulta. Não exige chave idempotente porque não há mutação.

Resposta200 contém ETag, no-store e contrato fechado. Dependência ausente resulta em indisponibilidade; não há fallback para uma coleção sem escopo. A rotina não emite nota, marcação, recibo de gravação, auditoria, evento ou notificação. A resolução e marcação existentes continuam revalidando a evidência separadamente.

## Interface

O fluxo é consultar checklist → escolher item → Consultar minhas notas → selecionar → revisar → confirmar. Paginação20, seleção máxima20; a página antiga não é acumulada sem limite. Trocar de página preserva somente as seleções limitadas. Uma nova consulta inicial limpa a seleção explicitamente. Data em pt-BR/America/Sao_Paulo; ordenação e contratos preservam microssegundos UTC.

A opção mostra data e referência privada, não o corpo da nota. A conversa continua sendo o local de leitura do texto: não foi implementado pré-visualizador nem navegação automática até a nota. Não há campo editável para UUID no painel. A API headless `setField('evidenceText',...)` anterior permanece por compatibilidade dos testes/comandos; ela não é um bypass de autorização, pois a marcação sempre verifica as referências no servidor.

Falha na consulta limpa opções e retorna indisponibilidade, não lista vazia de sucesso. Cancelamento, troca de item/status/audiência e descarte do componente invalidam respostas tardias. Consulta e mudança de seleção não são permitidas depois da revisão da marcação ou enquanto seu resultado está desconhecido. A conciliação anterior continua com a mesma chave e conteúdo, sem reenvio automático.

Na revisão, selecionar uma opção recriava o checkbox. A regressão demonstrou e a correção preservou o mesmo nó/listener/estado durante a seleção; não é uma prova de teclado/foco de navegador. Corrigido também o texto para explicar conferência de vínculo/autoria/data, sem sugerir que o servidor certifica a veracidade do conteúdo ou da execução GEO.

## Validação e limites

Baseline284/284. Novos74:25contrato,18store/serviço,10HTTP,20UI e1composiçãoHTTP no arquivo existente. Final358/358, zero falhas/cancelamentos/skips/TODO, em execução do recorte e posteriormente na fonte extraída com o mesmo harness de dependências. Tipos focais TS5.8.3/tiposNode25.1.0 globais, Node22.16.0. Não é npmci nem CI integral.

RED observado por camada; quatro mutações detectadas: contexto de conta, filtro de autor SQL, campos extras e limite de seleção. O teste do filtro SQL inspeciona o comando emitido e não prova RLS no motor. As fontes foram restauradas antes das execuções finais.

SQL:19cenários anteriores preservados e4adicionados, total23. Nenhum executado nesta rodada. O candidato `hdn_execution_checklist.sql` permanece idêntico ao pacote D; não há função/tabela/grant/migration novo. Os casos novos cobrem projeção sem corpo/sem marcação, RLS de recurso negado, paginação confrontada com consulta de referência e revogação de notes:read.

Chromium tentou abrir a fixture e recebeu `ERR_BLOCKED_BY_ADMINISTRATOR` antes de carregar a tela. Zero checks de navegador aprovados nesta execução. Não contornado. Sem banco17/Docker/CLI, registry sem DNS e download do PostgreSQL oficial falhou. Não usar o Supabase hospedado como substituto de laboratório.

Autorrevisão, sem revisor independente disponível. O template complementar de code-review foi solicitado e não pôde ser lido; não foi presumida uma revisão externa. Toda publicação depende de checkout completo, testes atuais e revisão independente.

## Sequência obrigatória

Executar os23cenários HDN pelo runner PostgreSQL17 já existente; resolver defeitos demonstrados; completar publisher de templates/vínculos qualificados e sua integridade; integrar leitura/mark/resolução na mesma conexão; proteger caminhos antigos; depois gerar migration pela CLI com schema/manifest/readiness e upgrade. Montar painel/consulta com sessão/conversa reais e incluir whitelist de `shared/checklist-evidence.js` somente na integração revisada. Não copiar assets como substituto de montagem. Verificar navegador desktop/mobile/teclado e CI integral. Atendimento continua fechado.
