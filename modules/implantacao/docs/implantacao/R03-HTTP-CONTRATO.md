# IMP-02b / R03 — transporte HTTP e cliente de sessão

Status: bibliotecas implementadas; nenhum endpoint montado ou publicado. O serviço permanece draft-only e operacional=false. Este contrato não libera envio ao Help Desk, upload, importação, Dev Agent ou aprovação técnica.

## Fronteira de servidor

`createImportProcessHttpHandler(options)` em `modules/import-process/http.ts` recebe Web Request e produz Web Response. O host existente deve construir `service`, `authenticate`, `locate`, `admit` e a flag `enabled`. Não existe listener do produto nem backend paralelo. `enabled` ausente é fechado. Todos os testes que o habilitam usam fixtures explicitamente identificadas.

`authenticate(request, signal)` deve validar a sessão na fonte real. Um bearer de formato correto NÃO autentica ninguém. `locate(credential, caseId, operation, signal)` precisa retornar somente o escopo visível àquela credencial; deve devolver null para desconhecido/inacessível, sem funcionar como oráculo de existência. A autoridade do serviço é reconsultada dentro do fluxo existente. `admit` aplica quota por identidade confiável; limites de tráfego pré-autenticação, tamanho de headers e proteção da infraestrutura pertencem também ao gateway/host.

A seleção enviada ao criar (`scope`) não é grant. Nas outras operações o HTTP não aceita scope/account/obra/actor no body: recupera esse contexto no servidor e o serviço o autoriza. Chaves de storage, portas, papéis, `ready`, `approved` e permissões não são campos de comando.

## Rotas candidatas

Prefixo fixo do adaptador de servidor: `/v1/import-processes`.

| Método/rota | Body além de operationId/expectedVersion | Resposta |
|---|---|---|
| POST no prefixo | scope, purpose, target, snapshot, reason | 201 na primeira criação; 200 em replay |
| GET /{caseId} | nenhum | processo, revisão atual e metadados públicos de arquivos |
| POST /{caseId}/revisions | snapshot, reason | recibo versionado |
| GET /{caseId}/revisions/{number} | nenhum | revisão com hash |
| POST /{caseId}/cancellation | reason | recibo de cancelamento de rascunho |
| POST /{caseId}/artifacts | name, mime, bytes, sha256 | recibo de declaração, arquivo pending |
| POST /{caseId}/artifacts/{artifactId}/verification | nenhum | resultado da inspeção exclusivamente server-side |

Não há listagem de processos, endpoint de bytes, URL assinada, exclusão física, execução ou notificação. O caseId do processo retomado deve vir do contexto autorizado já conhecido; não se inventa catálogo local.

Todos exigem Bearer validado pelo host. POST exige Origin exatamente igual ao configurado e `Content-Type: application/json`. O adaptador não abre CORS, não devolve `Access-Control-Allow-Origin` e não usa cookies como autenticação. Planejar montagem same-origin; não colocar tokens em URL ou iframe para contornar isso.

Escritas exigem `Idempotency-Key` idêntico ao UUID operationId. Criação usa expectedVersion=0. Demais escritas exigem `If-Match: "imp:<caseId>:<version>"`, compatível com expectedVersion. GET do processo e recibos retornam esse ETag. Revisão histórica usa `"rev:<caseId>:<number>:<hash>"`, não serve para editar. Não aceita ETag fraco, de outro processo, wildcard, query de escopo, body comprimido ou versões ambíguas.

Exemplo de corpo de revisão (UUIDs de exemplo não são cadastros existentes):

```json
{
  "operationId": "00000000-0000-4000-8000-000000000020",
  "expectedVersion": 1,
  "snapshot": {"schemaVersion":"1","records":[],"decisions":[],"findings":[],"artifactIds":[]},
  "reason": "Conferência da estrutura"
}
```

## Limites e erros

Body de comando limitado a 1 MiB por bytes efetivamente lidos, com conferência opcional de Content-Length; parsing UTF-8 fatal. JSON sem shape válido é recusado. Resposta composta limitada a 4 MiB. Bearer limitado a 8192 caracteres antes da porta de autenticação. Portas de autenticação/diretório/quota e reader têm deadline e AbortSignal. Não interromper arbitrariamente uma transação de gravação e depois declarar que foi cancelada.

Todas as respostas: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Vary: Authorization, Origin` e requestId gerado pelo servidor. Exceções desconhecidas não retornam stack, SQL, token, mensagem do driver ou body da requisição.

Erro JSON: status, code, message, requestId, outcome. `outcome` é not_started, not_committed ou unknown. 412 é conflito de versão; 428 é versão/If-Match ausente; 409 cobre conflitos do processo/idempotência; 413 excede limite; 415 formato não suportado; 422 conteúdo inválido; 429 quota; 503 indisponibilidade/barreira/resultado incerto.

`not_committed` depende do contrato transacional do Repository real. COMMIT incerto, falha desconhecida depois de iniciar a escrita ou aborto HTTP depois da confirmação nunca viram um sucesso fictício nem uma promessa de rollback. A recuperação utiliza a MESMA operação, versão e conteúdo, não um novo UUID.

## Cliente e controlador

`modules/import-process-client/client.ts` recebe `sessionFetch` do host; não guarda senha/token, não usa localStorage e não renova sessão por conta própria. Só aceita basePath relativo local; credenciais omitidas, redirects recusados e cache desativado. O fetch de sessão existente pode renovar a credencial, mas deve preservar comando e operationId. Não há retry automático nesta biblioteca.

Só importa em runtime `canonical.ts`, que é contrato puro. Tipos de domínio são imports type-only. Nunca importar `service.ts`, `postgres.ts`, conexão ou configurações privadas no frontend. Nenhum desses arquivos foi montado no Vue atual.

Respostas de outro processo/operação, versão ou ETag incompatíveis, revisão com hash incorreto, shape inesperado e conteúdo excessivo são recusados. Erro de transporte após despacho de escrita é incerto. O cliente não exibe a mensagem arbitrária de um proxy HTML.

`createImportProcessController({client,newId,onChange})` oferece open, edit, save, retry, clearSession e getState. O Vuex existente pode receber onChange e disparar ações; não se introduz outra biblioteca de estado.

- open retoma o processo pelo servidor. Não sobrepõe rascunho sujo sem discardChanges=true; não muda processo durante intenção pendente.
- save fixa UUID, versão, snapshot e justificativa. Bloqueia nova edição durante envio ou incerteza.
- 412 preserva o rascunho e abre estado conflict; não mescla nem sobrescreve automaticamente.
- retry repete exatamente a intenção pendente. Uma nova recusa de autenticação NÃO resolve o resultado incerto da tentativa anterior.
- Recibo confirmado + falha de releitura gera refresh_required, não 'salvamento falhou'. Nova edição exige atualizar a versão.
- clearSession limpa memória privada e ignora respostas tardias. Não cancela transação já enviada nem substitui o logout do host.
- Estado é entregue por cópia. Não há 'salvo' por fallback local.

Limite importante: intenção pendente do controlador vive SOMENTE em memória. Hard reload/logout elimina a chave local; não prometer retry idempotente entre dispositivos nesta fatia. O processo e seus recibos terão a durabilidade do Repository real, ainda não qualificado. Recuperação de intenção pendente após reiniciar navegador exige persistência privada apropriada/consulta autorizada a recibos e permanece próxima etapa.
