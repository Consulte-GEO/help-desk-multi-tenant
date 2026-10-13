# HDN-01a — plano executável

> Usar superpowers:executing-plans com TDD, conforme execução solicitada. Não fazer push/merge/deploy como efeito implícito desta entrega local.

**Goal:** impedir resolver pedido que exige checklist sem a conferência interna completa.
**Architecture:** estender `decideSupportTransition` e `createSupportWorkflow`; requisito produzido pelo perfil fixado, snapshot lido pelo adapter privado da mesma transação, auditoria mínima e outbox inalterada.
**Tech Stack:** Node22/TypeScript e helpers existentes, sem novas dependências.
**Spec:** ../specs/2026-10-12-hdn01-execution-checklist.md

## Restrições e foco de revisão
Sem redução de ACL/MFA/recibos; campos de checklist não vêm do corpo do comando. Compatibilidade apenas com perfil antigo sem a propriedade, nunca com null/digest incorreto. Instantes exatos, drafts não aprovam, nenhuma evidência privada no DTO/outbox. Dados de origem continuam sujeitos a qualificação e SQL/CAS reais.

## Tarefa 1 — domínio
Files: criar `src/domain/execution-checklist.ts` e `tests/execution-checklist.test.ts`.
Interfaces: `parseExecutionChecklistReference(input:unknown):ExecutionChecklistReference`; `parseExecutionChecklistTemplate(input:unknown):ExecutionChecklistTemplate`; `assertExecutionChecklistComplete(input:unknown, expected:ExecutionChecklistContext, at:string):ExecutionChecklistCompletion`.
- [ ] Escrever testes negativos e positivos sem implementação; import opcional deve falhar com a ausência da interface claramente identificada.
- [ ] Executar Node test e registrar RED.
- [ ] Implementar contrato estrito e retorno sem evidências/textos.
- [ ] Executar suíte, conferir GREEN e limites.

## Tarefa 2 — composição existente
Files: modificar `src/domain/support-workflow.ts` e `src/application/support-workflow.ts`; criar `tests/execution-checklist-workflow.test.ts`.
Interfaces: ampliar união de requirements com `execution_checklist`; método opcional de leitura privada é obrigatório quando há referência no perfil. `commitDecision` recebe auditoria com confirmação vinculada e deve manter CAS/locks desse snapshot.
- [ ] Testar resolve com checklist pendente, adapter ausente e snapshot trocado: espera recusa e zero efeito.
- [ ] Executar RED antes de ligar a guarda.
- [ ] Integrar requisito e guarda, mantendo caminhos anteriores.
- [ ] Executar novos testes, regressões anteriores e TypeScript estrito focal.

## Tarefa 3 — modelos e entrega
Files: criar `profiles/consultegeo/execution-checklists.draft.json` e testes correspondentes, sem rotina de seed/publicação.
- [ ] Criar modelos explícitos de revisão, sem regras comerciais/engenharia inventadas.
- [ ] Testar que todos são drafts e não satisfazem resolução.
- [ ] Autorrevisão, mutações focais, aplicação/reversão de patches e execução a partir do ZIP final.
- [ ] Gerar comparativo de 107 requisitos, novo plano integral, handoff e ZIP cumulativo do incremento sobre a base que já contém HDW-00/00b, sem reaplicá-las.

## Verificação local
`node --experimental-strip-types --test --test-reporter=tap tests/*.test.ts` no recorte reunido. Resultado não substitui CI integral, PostgreSQL, upgrade, browser ou revisão independente no checkout real.
