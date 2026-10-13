# HDN-01i — plano executado de correção do adaptador

> Execução inline sobre o handoff HDN-01h; continuar com `superpowers:executing-plans`. Este registro não declara concluído o aceite PostgreSQL.

**Goal:** impedir que uma recusa obrigatória do adaptador do checklist seja capturada para confirmar gravações anteriores.

**Architecture:** reutilizar `rejectTransactionValidation` e o cliente emprestado pelo runner. Cobrir a fronteira do store com um wrapper privado, mantendo dados, consultas, permissões, SQL candidato e contratos públicos anteriores.

**Tech Stack:** TypeScript/Node22, driver pg e runner existentes. Sem nova dependência.

**Spec:** `../specs/2026-10-12-hdn01b-checklist-recording.md`, `../specs/2026-10-12-hdn01c-resolution-evidence.md` e continuidade `2026-10-12-hdn01h-transaction-refusal.md`. RF-CEN-07 e RF-CEN-11.

## Restrições

Base consultada6e069005beaa12d7cb55c77af92478c21f7526ca; trabalho em recorte isolado. Notas continuam privadas. Preservar precisão, revisões, idempotência, COMMIT confirmado/desconhecido, snapshots e scopes. Não instalar SQL em ambiente hospedado, não inventar migration/IdP e não alterar o gate de liberação.

## Foco de revisão

Erro local após SQL bem-sucedido; ausência legítima de recibo; cliente emprestado expirado; consulta ainda em voo; prioridade de falha SQL. Cada condição tem teste nomeado no novo arquivo.

## Tarefas

- [x] Conferir entrada H e base remota; reexecutar 566 testes focais.
- [x] Escrever `tests/execution-checklist-store-validation.test.ts`; observar RED real contra o adaptador H. Captura da recusa não deve deixar COMMIT nem gravações confirmadas no transporte de teste.
- [x] Modificar `src/infrastructure/execution-checklist-store.ts`: wrapper obrigatório nos sete métodos; preservar `transaction_validation_failed` recebido pelo cliente.
- [x] Verificar 20 novos testes e o conjunto586, com tipos estritos.
- [x] Reverter em testes a invalidação e a cobertura dos métodos mark/resolution; confirmar que as regressões detectam e restaurar a fonte correta.
- [x] Acrescentar um cenário pg ao registrador existente, sem modificar o candidato SQL: gravação real seguida de corrupção do envelope, erro capturado e nenhuma persistência final.
- [ ] Executar esse cenário e os30anteriores no PostgreSQL17. Ambiente desta sessão indisponível.
- [x] Autorrevisar separadamente os contratos, diff e limites. Revisão independente não realizada.
- [ ] Executar gates integrais, atualizar evidência canônica e integrar/publicar quando os demais aceites estiverem completos.

## Arquivos

Modificados: `src/infrastructure/execution-checklist-store.ts`, `supabase/tests/execution-checklist-scenarios.ts`. Novos: teste de validação do store, este plano e documento operacional HDN01I.

## Interfaces mantidas

`createPostgresExecutionChecklistStore(client:SqlClient):ExecutionChecklistStore` sem método novo. O wrapper chama `rejectTransactionValidation(client,error):never` já existente; não fornece forma de limpar a recusa. O chamador continua responsável por aguardar operações e usar o cliente correto.

## Comandos de conferência

```sh
node --experimental-strip-types --test --test-reporter=tap tests/execution-checklist-store-validation.test.ts
npm ci
npm run check:lock
npm run check:migrations
npm test
npm run typecheck
npm run check:contracts
npm run check:secrets
npm run test:db:native
npm run test:ui:local
npm run build
npm audit --audit-level=high
```

Os comandos npm completos são para o repositório e lock reais; não foram todos executados nesta sessão. Não marcar como sucesso um cenário não registrado, não executado ou com setup falho.
