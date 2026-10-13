# HDN-01d — plano executado da interface interna do checklist

> **Execução:** superpowers:executing-plans; validação antes de conclusão. Autorrevisão não substitui revisão independente.

**Objetivo:** completar a superfície interna já prevista para marcar um item e recuperar confirmação desconhecida, sem abrir atendimento.

**Arquitetura:** componentes ES modules sem framework, com DTOs fechados, controlador em memória e renderer interno. A autenticação é fornecida pela sessão existente; autorização e resolução continuam no servidor. SQL da HDN-01c não é alterado.

**Stack:** Node22/TypeScript do projeto; HTML/CSS/JS e Playwright no runner já existente.

**Spec:** `../specs/2026-10-12-hdn01c-resolution-evidence.md` e `../../operations/HDN01D-INTERFACE-INTERNA-2026-10-12.md`; RF-CEN-07 e RF-CEN-11 do levantamento entregue pelo usuário.

## Restrições globais

Nenhuma nova permissão, session fallback, usuário de produção, fonte GEO presumida ou endpoint público. Manter os19 cenários SQL como pendentes enquanto não executados. Uma barra de progresso não autoriza resolução. Notas e motivos internos não saem para cliente/email. Não usar leitura pública em caso de recusa. Nenhum retry automático de mutação ou nova chave para conciliar. Contexto antigo não é reutilizado. As seis suítes originais de navegador e seus limites são preservados. Testes novos não substituem execução integral com lock/SQL/browser.

## Revisão focal

- Troca A→B→A enquanto a resposta de A aguarda: resposta antiga descartada e corpo encerrado.
- Servidor responde diferente do item/ator/revisão enviado: sucesso não é reconhecido e intenção permanece desconhecida.
- Replay de uma gravação possivelmente concluída recebe403/412: não voltar a editar com outra chave.
- DOM removido ainda referenciado por código do host: limpar valores, rótulos, atributos e listeners de audiência antiga.
- Evidência não qualificada e estado sem autorização: não fazer a interface resolver ou corrigir dados automaticamente.

## Tarefas e verificação

- [x] Reconsultar base remota, verificar entrada C e tentar o ponto PG17. Resultado bloqueado, sem modificar o ambiente hospedado.
- [x] Escrever45 testes RED do contrato/estado; implementar `createExecutionChecklistController`, confirmar GREEN.
- [x] Escrever10 testes RED de montagem DOM; implementar `mountExecutionChecklist` e CSS local.
- [x] Criar fixture HTTP própria, testes de composição e especificação Playwright sem usar alvo hospedado.
- [x] Acrescentar especificação no runner como sétima suíte, preservando as seis existentes.
- [x] Reproduzir/fixar casos Attr, streams não lidos e retenção de listeners; quatro mutações devem falhar.
- [x] Executar284 testes focais e typecheck estrito; registrar natureza de cada teste.
- [ ] Homologar a especificação Playwright. Ambiente bloqueou a navegação inicial; nenhuma asserção visual concluída.
- [ ] Executar19 cenários SQL em PG17 e integrar template/store/runtime. Não concluído por este plano local.
- [ ] Revisão independente e CI integral em checkout completo, depois publicação somente do escopo validado.

Comando focal: `node --experimental-strip-types --test --test-reporter=tap tests/execution-checklist*.test.ts tests/support-workflow.test.ts tests/support-workflow-application.test.ts`.

Comando browser no checkout apto: `npm run test:ui:local`. Não usar `--force`, remover política ou trocar URL de navegação para contornar bloqueio. A suite `tests/browser-execution-checklist.py` possui fixture própria em loopback; não aceita URL hospedada ou credencial de usuário.

Ledger e logs da execução ficam no pacote, separados da evidência canônica do produto. Nenhum total futuro de CI é fixado por esta contagem local.
