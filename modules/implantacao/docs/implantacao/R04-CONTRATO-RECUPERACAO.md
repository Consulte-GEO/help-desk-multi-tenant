# R04 — Recuperação de confirmação e ligação ao Vuex

## Escopo e limites
Implementa o recorte D/E do IMP-02b aprovado na R03: consulta de recibos autorizada, marcador mínimo por aba, retomada pelo controlador e registro dinâmico de módulo Vuex. Não monta API, listener, bucket, autenticação ou telas de produção. Não altera o SQL candidato. Não recupera conteúdo ainda não enviado nem substitui a persistência do servidor.

## Serviço e HTTP
`createImportProcessService().getOperationReceipt(credential, scope, operationId)` usa a mesma transação, a mesma fonte de autorização vigente e o mesmo repositório. O recibo é localizado pelo ator atual, não pelo solicitante informado pelo browser. A fonte é revalidada antes de devolver a resposta. Histórico adulterado, hash inválido e versão impossível falham fechados.

Nova rota: `GET /v1/import-processes/{caseId}/operations/{operationId}`. Mantém bearer, localizador privado, admissão e gate da R03; não aceita seleção por query. O módulo continua fechado se `enabled()` não retornar exatamente true. A consulta é somente leitura no domínio; não gera evento de negócio, recibo novo ou execução.

Envelope confirmado: `{caseId, operationId, status:'confirmed', requestHash, receipt}`. O recibo é validado, recebe `replayed:true` e retorna ETag da versão daquela operação, que pode ser anterior à versão atual do processo. Não contém o comando nem o snapshot.

Envelope não confirmado: `{caseId, operationId, status:'unconfirmed', requestHash:null, receipt:null}`, HTTP 200, sem ETag e com `Cache-Control: no-store`. Ausência não implica rollback: a primeira solicitação pode estar atrasada ou a confirmação ainda não estar visível. A UI não habilita uma nova gravação a partir dessa ausência.

## Cliente
`getOperationReceipt(caseId, operationId, expectedVersion, requestHash, signal?)` valida caso, operação, versão, hash do pedido, envelope e ETag. O hash esperado é o mesmo do serviço: `contentHash({operation:'revise', command:{...saveCommand, scope}})`.

`controller.restorePending()` lê o marcador depois de restaurada a identidade autenticada e consulta apenas GET. Sem marcador, retorna false sem rede. Com marcador, retorna true e representa o resultado em seu estado. `controller.recover()` consulta novamente, também sem POST. `retry()` com comando ainda em memória conserva o reenvio idempotente da R03; sem comando, depois de reconstruir o controlador, delega à consulta de recibo e não reenvia dados.

## Marcador local
`createSessionRecoveryJournal(window.sessionStorage)` é uma porta explícita, não fallback. A chave é `cg:import-process:pending:v1`. Campos permitidos: `schemaVersion`, `workspaceId`, `accountId`, `actorId`, `caseId`, `operationId`, `expectedVersion`, `requestHash`.

Esses identificadores são metadados privados, mas NÃO credenciais/capacidades. Não se gravam bearer, senha, snapshot, nome de arquivo, justificativa ou conteúdo de planilha. A identidade local vem do host autenticado; o backend sempre autoriza novamente. Marcador de outra identidade, conteúdo extra ou formato malformado bloqueia antes da consulta. Storage indisponível impede enviar a gravação; não existe fallback silencioso para outro meio.

O marcador é gravado e relido ANTES do POST. A limpeza só remove o marcador esperado, sem apagar chaves alheias. Falha de limpeza após confirmação gera `cleanup_required`, preservando recibo conhecido e impedindo nova edição. Marcador não resolvido jamais é substituído automaticamente por outro UUID.

`sessionStorage` é limitado à sessão da aba. Recarga da página preserva seus dados; fechar a aba, limpar armazenamento ou encerrar sessão não tem garantia de recuperação local. Não há backup de rascunho ainda não enviado. Isso precisa ficar claro na tela e no aviso de saída. A R04 testou reconstrução do controlador com storage simulado, NÃO hard reload usando sessionStorage nativo no navegador.

## Ciclo de vida
- `controller.detach()` limpa a memória/aborta callbacks locais, mas preserva marcador. Usar ao desmontar tela ou preparar reload; não desfaz escrita no servidor.
- `controller.clearSession()` limpa memória e tenta remover marcador da identidade. Usar para logout/revogação, não para uma simples saída da tela. Erro de storage não é escondido.
- Não chamar clearSession em beforeunload: isso apagaria justamente o localizador necessário à retomada.
- Um controlador antigo não deve interferir no estado ou marcador de uma montagem mais nova.

## Vuex 4
`registerImportProcessSession({store, client, newId, recovery, enabled})` usa registro dinâmico com namespace `importProcess`, estado por instância, mutations e actions. O store existente continua com setup, validation e export; seu index não é modificado pelo pacote. Gate ausente/false não registra módulo nem consulta rede. Colisão é recusada.

Actions: `open({caseId,discardChanges?})`, `edit(snapshot)`, `save(reason)`, `retry`, `recover`, `restorePending`, `clearSession`. Getter: `importProcess/presentation`. `binding.dispose()` desmonta preservando marcador; `binding.endSession()` encerra a sessão local e limpa o marcador. As duas operações invalidam callbacks tardios e só removem o namespace se ainda pertencer à montagem.

`presentImportProcess` produz rótulo, mensagem, versão consultada, versão do recibo e guardas de edição/salvamento/consulta/saída. Não representa exportação como importação, não mostra confirmação sem recibo e não troca de permissões. `shouldWarnBeforeUnload` é um dado para o host conectar ao evento: não há aviso instalado na aplicação nesta rodada.

### Exemplo de ligação — depende das portas reais do host
```ts
// Somente depois de resolver a sessão e a capability no servidor:
const binding = registerImportProcessSession({
  store,
  enabled: serverCapability === true,
  client: createImportProcessClient({ sessionFetch }),
  newId: () => crypto.randomUUID(),
  recovery: { identity, journal: createSessionRecoveryJournal(window.sessionStorage) },
});
if (binding.available) await store.dispatch('importProcess/restorePending');
// Desmontagem de componente: binding.dispose().
// Logout ou troca de escopo: binding.endSession(), além do logout do host.
```
`sessionFetch`, `identity` e `serverCapability` não podem vir de parâmetros de URL, conteúdo da planilha ou cadastro digitado. O exemplo NÃO implementa essas portas nem autoriza sua simulação na produção. Construir o journal pode falhar pela política do navegador; o host deve informar a indisponibilidade, não ignorá-la.

## Qualificação pendente
PostgreSQL real, papel restrito, RLS, confirmação ambígua de COMMIT, restore e durabilidade permanecem gates independentes. Executar também Vuex real pelo lock do projeto, tela real com XLSX e hard reload em navegador permitido. Testar receipt antigo com head novo, duas abas, retorno tardio, logout e erro de quota. Sem recibo após reload, não há reenvio do comando: requer investigação/recuperação operacional; não oferecemos cancelamento fictício.

## Referências verificadas em 14/10/2026
- Store remoto: `frontend/src/store/index.ts`, commit `dcf5607652281bb688f366e6a4f05e07eb698d31`.
- MDN, Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
- Vuex 4, registro dinâmico de módulos: https://vuex.vuejs.org/guide/modules.html
- Vuex 4, referência da API: https://vuex.vuejs.org/api/
