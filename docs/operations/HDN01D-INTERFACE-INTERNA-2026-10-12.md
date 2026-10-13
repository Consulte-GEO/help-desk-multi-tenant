# HDN-01d — interface interna do checklist

Data: 12/10/2026. Base remota consultada: `6e069005beaa12d7cb55c77af92478c21f7526ca`.

## Entrega e limite

Continuação de RF-CEN-07 e RF-CEN-11 do levantamento `Requisitos Help Desk.md`, linhas 197 e 201, e da HDN-01a/b/c. A superfície auxilia a conferência antes da resolução. Não executa ações no GEO, não envia respostas ao cliente e não resolve chamados. O progresso é consultivo: a resolução continua exigindo o workflow e a conferência persistida da HDN-01c.

Esta fatia é local, sobre recorte verificável. Nenhum commit remoto, migration, grant, fator Auth, flag de release, runtime ou deploy foi alterado. Os 32 arquivos do cumulativo HDN-01c foram preservados byte a byte. A correção recente de login/painel da principal permanece intacta.

O primeiro ponto obrigatório continua sendo executar os 19 cenários SQL HDN em PostgreSQL17 descartável. Nesta rodada faltam binários/CLI/Docker, e Git/downloads oficiais não resolveram DNS. Não se substituiu o teste por SQL na produção, engine emulada ou aprovação de testes anteriores. Por decisão registrada no ledger, a implementação prosseguiu somente na interface interna já prevista no plano, sem anunciar fechamento da capacidade.

## Arquivos e responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `web/execution-checklist-contract.js` e `.d.ts` | Validar os DTOs/ETag/audiência, preparar marcação e conferir o recibo; sem autorizar operação. |
| `web/execution-checklist-state.js` e `.d.ts` | Leitura explícita, edição/revisão/confirmação, prazo e geração de contexto, conciliação da mesma intenção. |
| `web/execution-checklist.js` e `.d.ts` | Renderização interna por `textContent`, controles nativos e limpeza de dados/listeners. |
| `web/execution-checklist.css` | Estilos locais do painel e diálogo; não modifica estilos do aplicativo existente. |
| `tests/execution-checklist-ui.test.ts` | Contratos/estado/recibo/cancelamento e fronteiras negativas. |
| `tests/execution-checklist-panel.test.ts` | Renderização e eventos em DOM de teste, não navegador real. |
| `tests/execution-checklist-ui-http.test.ts` | Cliente real contra HTTP loopback próprio, domínio real com identidade/evidências/storage sintéticos. |
| `tests/execution-checklist-ui-registration.test.ts` | Preservação das seis suítes anteriores e inclusão da sétima. |
| `tests/browser-execution-checklist.py` | Especificação Playwright para desktop/mobile, teclado, risco, replay, privacidade e overflow. Bloqueada no ambiente atual. |
| `tests/fixtures/checklist/browser-server.ts` | Fixture isolada, loopback/porta própria e sinalização explícita. Nunca runtime de produção. |

## Composição exigida do host

`mountExecutionChecklist(root, options)` aloca o painel, sem leitura automática. O host injeta `request(path, init): Promise<Response>` usando sua sessão atual em memória, sem retry automático de mutação. A audiência explícita contém `principalId`, `workspaceId`, `accountId`, `ticketId`, `canWrite`. O booleano é somente uma dica da interface; o backend revalida ator, atribuição e recursos em cada operação.

O host deve carregar o módulo somente na área interna autorizada. Não inserir o conteúdo no DOM do cliente, mesmo oculto. `load()` inicia a leitura; `changeAudience(...)` invalida as respostas e limpa os dados anteriores; `clear()` faz o mesmo no logout; `destroy()` limpa dados, listeners e nós ao remover o componente. As chamadas são obrigatórias nas mudanças de pessoa, workspace, conta e chamado, inclusive A→B→A. O componente não persiste tokens, rascunhos ou intenções em localStorage/sessionStorage, clipboard ou logs.

Rotas opcionais já preparadas na HDN-01b/c:

- GET `/v1/internal/tickets/:id/execution-checklist`: `ChecklistRecord` de seis campos, `ETag` igual à revisão do checklist (zero para snapshot ausente).
- POST `/v1/internal/tickets/:id/execution-checklist/marks`: comando estrito de oito campos, `If-Match` e `Idempotency-Key`; resposta `ChecklistMarkReceipt` de onze campos e `ETag` da nova revisão.

Não foram montados endpoints novos em `runtime.ts`, nem acrescentados assets na whitelist do build. A montagem depende de stores, autorização e jornada reais. Não é correto copiar os módulos e declarar a tela implantada.

## Estados de interação

Leitura → lista/contagem de itens obrigatórios → editar um item → revisar → confirmar. Marcação permite `done`, `not_applicable` quando autorizada pelo template, ou retorno a `pending` com motivo. A declaração de risco só é oferecida para item sensível e não substitui aprovação de origem. Os rótulos são pt-BR e a apresentação usa America/Sao_Paulo.

A evidência é informada por ID de nota interna já existente, um por linha, até20. O painel não lê o corpo da nota e não cria nota. O seletor integrado à conversa, com rótulos seguros e notas elegíveis, ainda falta; não apresentar o campo técnico como UX final da central.

Antes da confirmação não há POST. Durante o envio todos os campos ficam indisponíveis e a intenção é fixa. Não existe progresso otimista: sucesso exige recibo correspondente a pessoa, workspace, conta, chamado, item, situação e revisões esperadas. Depois do sucesso é obrigatório atualizar a leitura autoritativa antes de outra marcação.

Uma recusa conhecida na primeira tentativa permite atualizar, sem afirmar que a execução da origem foi desfeita. Falha de transporte, confirmação inválida ou erro desconhecido mantém `unknown`; nenhum novo envio é criado. A conciliação é explícita com chave, caminho, cabeçalhos e corpo idênticos. Uma recusa posterior (inclusive401/403/412) não prova o resultado da tentativa inicial: conserva a intenção desconhecida e orienta suporte autorizado. Logout/contexto elimina os dados locais; não garante cancelar efeito já enviado ao servidor. A recuperação histórica após novo login depende dos recibos persistidos e da interface de operação, não desta memória volátil.

## Revisão e correções

1. Eventos de formulário interpretavam `NamedNodeMap` como mapa de strings. O teste que representa um `Attr` nativo reproduziu a falha; identificadores agora são fixados no listener, não inferidos de atributos.
2. Resposta com MIME inválido e resposta tardia do transporte podiam reter corpo não lido. A limpeza observa e cancela o stream, sem adotar resposta tardia ou repetir a requisição.
3. Listeners dos itens antigos retinham closures depois de atualizar/trocar audiência. A remoção agora é explícita, junto à limpeza de textos, atributos de contexto e campos destacados.

Os testes de revisão falharam antes e passaram após as correções. Autorrevisão em passagem separada; não houve revisor independente.

## Evidência local

217 testes anteriores e67 novos:48 estado/contratos,12 DOM,6 contados no grupo HTTP (cinco subtestes mais agregador) e1 registro. Total284, sem falhas/cancelamentos/skips/TODO. Não somar o grupo HTTP novamente. Quatro mutações detectadas: ignorar conta (1 falha), permitir sair de unknown com recusa posterior (5), trocar chave no replay (2), preservar entrada privada destacada (3). Código restaurado antes da execução final.

A fixture HTTP usa o controlador e o decisor de domínio reais. Sua identidade, armazenamento, evidências e rotas são sintéticos; não é Auth real, banco durável nem o handler de produção. A criptografia ou rede não substituem essa qualificação.

Chromium foi iniciado, mas a navegação inicial ao servidor loopback foi bloqueada por `ERR_BLOCKED_BY_ADMINISTRATOR`, antes de qualquer check da tela. Não houve bypass de política, novo caminho de navegação ou clique forçado. A especificação foi registrada no runner existente, mas navegador real, CSS/foco/teclado/mobile/acessibilidade permanecem sem homologação. DOM de teste não é validação visual.

Typecheck focal com TS5.8.3 e tipos Node25.1.0 globais, opções estritas do projeto. Não instalação canônica/lock nem typecheck integral. Sintaxe Node/Python passou. Sem PG, migration/upgrade, full CI, build completo, audit novo ou fornecedor real nesta fonte.

## Próximos gates da mesma capacidade

Executar os19 cenários no runner PG17 atual; corrigir achados demonstrados; concluir publisher/vínculo qualificado do template e migration aditiva via CLI, com upgrade próprio. Ligar leitura e marcação ao store do workflow na mesma conexão, protegendo todos os caminhos de resolução. Integrar o painel com sessão/audiência/rota existentes e seletor de notas; somente então incluir seus assets e capabilities. Executar a suíte browser registrada, toda a composição e CI da fonte exata, revisar independentemente e manter a ativação operacional separada.
