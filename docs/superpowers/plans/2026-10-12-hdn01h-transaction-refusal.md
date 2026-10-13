# HDN-01h — recusa lógica obrigatória: plano de execução e continuação

> Execução inline conforme continuidade solicitada. Aplicar `superpowers:executing-plans` e testes negativos antes da correção; revisão independente antes da integração/publicação.

**Objetivo:** impedir que uma recusa capturada do guard legado confirme gravações anteriores e manter a validação nativa como critério obrigatório de saída.

**Arquitetura:** ampliar o runner existente com um estado privado somente de recusa ligado ao cliente emprestado. O guard legado reporta a falha a esse runner; não há outro pool, transação ou persistência de erro.

**Stack:** TypeScript/Node22, driver pg declarado no lock e PostgreSQL17. Nenhuma dependência nova.

**Especificação:** `docs/operations/HDN01H-RECUSA-TRANSACIONAL-2026-10-12.md`; contratos anteriores de HDN-01 e RF-CEN-07/11. O plano V2 e a matriz original de requisitos seguem no cumulativo.

## Restrições globais

Somente fonte local e fixture descartável. Não reaplicar R1/HDW/login/painel já integrados. Preservar 12 migrations, schema0.19.0, API0.27.0, scopes de Thiago, notas privadas e semântica de confirmação perdida. Nenhuma mudança hospedada nesta entrega. Nunca usar produção como fixture.

## Revisão focal

Erro capturado após SQL bem-sucedido; reutilização física da conexão; erro de payload hostil; SQL em andamento durante recusa; COMMIT confirmado ou perdido. Cada caso possui teste focal; invariantes SQL de encerramento continuam exigindo o runner nativo.

## Tarefa 1 — reprodução dirigida

Arquivos: `tests/execution-checklist-abort-only.test.ts` e `tests/transaction-validation.test.ts`.

- [x] Preservar base e conferir 504 testes existentes.
- [x] Reproduzir instalação parcial, decisão restritiva, retorno inválido e SELECT inválido, após gravação em staging.
- [x] Exigir zero COMMIT e zero gravações confirmadas quando a recusa for capturada.
- [x] Registrar RED com controles positivos para chamado não vinculado.

## Tarefa 2 — recusa no runner existente

Arquivos: modificar `src/infrastructure/transaction.ts` e `src/infrastructure/legacy-transition-guard.ts`.

Interface produzida: `rejectTransactionValidation(client: SqlClient, error: unknown): never`.

- [x] Associar estado privado ao exato cliente do callback, sem ler/reter payload de erro.
- [x] Impedir nova query e COMMIT após recusa, preservando a prioridade de erro SQL/admissão.
- [x] Limpar associação sem afetar outra transação, conexão reutilizada ou COMMIT já enviado.
- [x] Integrar o guard ao mecanismo e preservar suas mensagens seguras.
- [x] Atualizar a expectativa do teste legado para rollback obrigatório, mantendo as demais asserções.

## Tarefa 3 — composição e ensaio SQL

Arquivos: modificar `supabase/tests/execution-checklist-scenarios.ts`. Não alterar o candidato DDL.

- [x] Escrever cenário que marca um item via store real, captura recusa local e verifica ausência de novo snapshot/audit/receipt após rollback.
- [x] Executar 42 regressões adicionais de admissão, ciclo de vida de query e falha de statement; conferir blobs contra a principal.
- [x] Executar conjunto focal, tipos, diff, mutações e repetição do ZIP.
- [ ] Executar os 30 cenários HDN com `npm run test:db:local` ou `npm run test:db:native` no checkout completo e PG17 pertencente ao runner.
- [ ] Corrigir achados SQL, sem transformar erro de setup em aprovação ou ampliar permissões para fazer o teste passar.

## Tarefa 4 — integração que conclui a capacidade

- [ ] Validar aplicação/upgrade, migrar o candidato por CLI com manifest/schema/readiness coerentes, sem reescrever o passado.
- [ ] Completar a proteção SQL dos caminhos de resolução, e armazenar decisão, evidências, eventos, audit/recibo no mesmo cliente.
- [ ] Publicar templates e bindings qualificados e montar endpoints/interface com sessão, conversa e capacidades reais.
- [ ] Executar navegador/CI completo e revisão independente; publicar somente escopo aprovado.

## Decisões registradas

O ambiente sem PostgreSQL e sem checkout integral impediu a tarefa nativa. Foi corrigida uma falha reproduzida na composição existente em vez de abrir outro módulo. A entrega NÃO encerra a tarefa3/4. Os números de teste são resultados observados, não metas nem evidência hospedada.
