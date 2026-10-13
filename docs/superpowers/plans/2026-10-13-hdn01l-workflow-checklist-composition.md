# HDN-01l — Composição do leitor PostgreSQL com o workflow

Base: PR30 a5b23a9 + cumulativo HDN-01k. Fonte de requisito: RF-CEN-07 e plano CG-08; handoff K, aceite 4. Execução local isolada, sem integração remota devido ao bloqueio registrado da K.

## Escopo
Conectar explicitamente o adaptador PostgreSQL do checklist ao executor de workflow existente. Não criar um novo motor, nova transação, pool, SQL ou mudança de status. A factory recebe o store real de workflow ainda a completar e fornece a leitura qualificada de checklist pela mesma conexão emprestada. O perfil publicado continua determinando quando exigir checklist; perfis antigos e devolutivas mantêm comportamento. O leitor realiza readiness somente quando consumido, valida evidências e não usa callback arbitrário de checklist do store de base.

## Tarefas
1. RED: teste com a factory ainda ausente; provar entrada por createSupportWorkflow real e leitor de checklist SQL real, mantendo apenas transporte/estado de workflow sintéticos.
2. Implementar a factory de composição com delegação explícita, preservando `this` de classes e a mesma conexão.
3. Casos: completo/pendente, evidência ausente/estranha, perfil/revisão incompatível, ausência de instalação, autorização revogada, replay/COMMIT desconhecido, legado/devolutiva, transferência e mesma conexão. Nenhum dado de checklist em saída pública.
4. Testes de regressão focais e tipos; revisão separada; pacote cumulativo e handoff. Browser bloqueado não é homologação. SQL da J permanece histórico, não reexecutado automaticamente nesta fatia.

## Limites e decisões
A factory é composição reutilizável, não mount no runtime. `readTicket`/`readProfile`/`commitDecision` reais e protection de todas as escritas ainda exigem conclusão. Não usar fixture de teste como store real. Não alterar SQL candidato/migrations/evidência canônica/Auth/grants/gates. Incorporação/CI/preview/browser serão realizados pelo fluxo autorizado; não reencodar ou usar outro serviço para contornar bloqueio de escrita.
