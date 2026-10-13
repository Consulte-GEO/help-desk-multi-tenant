# HDN-01f — disponibilidade e cancelamento durante o checklist

## Estado

Incremento local cumulativo sobre `6e069005beaa12d7cb55c77af92478c21f7526ca`. Sem commit remoto, migration, deploy, alteração de Auth/scopes ou montagem de endpoint. Este checkpoint complementa HDN-01a–e; não reaplicar os pacotes antigos como mudanças independentes.

## Comportamento

Antes da correção, a disponibilidade era examinada apenas no começo do handler. Uma requisição admitida podia atravessar uma espera de autenticação/diretório e chamar o serviço depois do fechamento. Os testes da composição controlada também reproduziram confirmação após o fechamento durante a espera pelo pool ou por respostas SQL.

Agora o handler confere disponibilidade/cancelamento ao iniciar e depois dos limites de requisição, autenticação, corpo e diretório. Ele passa a mesma admissão privada à aplicação. O runner existente faz a checagem antes/depois de queries e antes de COMMIT. Se a recusa acontecer enquanto uma query está em andamento, a conexão é limpa pelo mecanismo existente; esta fatia não cria outro gerenciador transacional.

Leituras retidas após fechamento não são devolvidas. Marcações já confirmadas continuam confirmadas. COMMIT sem confirmação permanece `transaction_outcome_unknown`; fechar o gate não comprova rollback. A retomada da mesma intenção só acontece por ação explícita, com acesso e gate novamente válidos. Não há reenvio automático.

## Contrato de integração

`read(p, ticketId, refs, signal?, admission?)`

`queryEvidence(p, ticketId, refs, query, signal?, admission?)`

`mark(p, ticketId, refs, command, key, requestId, signal?, admission?)`

`admission` é `TransactionAdmission` do runner atual (`() => void`), não um campo de request. O montador HTTP entrega esse callback automaticamente. Uma composição alternativa deve transmiti-lo quando o atendimento depender de contenção; a opcionalidade preserva chamadas internas antigas, não qualifica uma nova rota que omita sua política de liberação.

O guard deve ser síncrono. O runner recusa Promise ou valor não-void, inclusive função async que o TypeScript aceita como `() => void`. Não embrulhar com `()=>{guard();}` e perder o retorno; transmitir o callback ou seu retorno para a validação existente.

`enabled()` precisa refletir o estado autoritativo disponível nessa instância. Um booleano constante ou cache desatualizado não prova contenção distribuída. Revogação ainda não observada, dados já enviados e COMMIT já confirmado não são desfeitos por esta correção.

Os adapters conservam dois erros adicionais: `release_gate_closed` (503) e `request_cancelled` (409). Mensagens de transporte são substituídas por textos locais. A mudança em `resource-access-store.ts` é compartilhada e exige regressão integral na integração.

## Verificação

RED/GREEN observado em duas famílias. 462 testes locais finais e typecheck focal passaram. Os testes adicionais utilizam módulos reais do HTTP, serviço, resolvedor, store e runner, mas simulação controlada do driver/autoridade; isso não é persistência durável.

Os 23 cenários de `supabase/tests/execution-checklist-scenarios.ts` permanecem sem execução nova. Candidato SQL, cenários, UI, drafts e 12 migrations não foram alterados. Não houve navegador novo: não há mudança visual nesta fatia. Revisão pelo próprio autor; revisão independente pendente.
