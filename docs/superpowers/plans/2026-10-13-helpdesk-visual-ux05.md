# UX05 — Plano de implementação

> Execução inline pela continuidade solicitada; fonte de requisitos: `docs/design/HELPDESK_VISUAL_UX05_SPEC.md` e plano UX04.

**Goal:** unificar apresentação e usabilidade da administração, preservando núcleo genérico.
**Architecture:** mounts isolados, helpers sem I/O, controllers originais.
**Tech Stack:** JavaScript ESM/DOM nativo, CSS tokens, Node22, Chromium/Playwright.
**Spec:** `docs/design/HELPDESK_VISUAL_UX05_SPEC.md`.

## Restrições
Nenhuma alteração de schema/Auth/scopes, nenhum envio remoto, nenhum recurso opcional montado no app principal. Não duplicar controles no mobile. Nenhuma conversão de UTC no payload. Preservar descarte por audiência e reconciliação imutável.

## Pontos de revisão
Foco após rerender/modal; duas montagens simultâneas; fonte parcial/resultado incerto; dados privados em referências de nós desmontados; JSON fora do limite/parse inválido.

## Tarefas
- [x] A — Helpers e baseline. Testar texto/status/UTC e hashes dos controllers; RED antes de implementar `web/admin-ui.js/.d.ts`.
- [x] B — Membros. Alterar `web/admin-members.js/.css`; teste RED de reflow, IDs, foco, validação no dialog, capabilities e limpeza. Controller `admin-members-state.js` somente leitura.
- [x] C — Configurações. Alterar mount em `web/admin-configuration.js`; teste RED dos oito tipos, estado publicado, campos estáveis, motivo, booleanos, recusa e replay. Bloco do controller deve manter hash.
- [x] D — Editor. Alterar `web/admin-forms.js`; teste RED de hierarquia/visibilidade de ações, prévia desatualizada, motivo, parse, reconciliação e clear. Reexecutar os oito testes originais recuperados.
- [x] E — Entrega. Adicionar assets a build/demo e CSS ao HTML sem rotas novas; Node focal, navegador e testes do aplicador base/UX01/02/03/04/05. Rodar verificações integrais possíveis, registrar bloqueios.
- [x] F — Revisão inline final, manifesto cumulativo, matriz, plano, evidências atuais/históricas, handoff. Revisão independente não disponível nesta sessão.

## Resultado local e portas ainda abertas
A–D implementadas e verificadas focalmente. E inclui apenas entrega de fonte e provas locais: o build completo, a suíte integral, o typecheck e a composição do app não foram aprovados. F é revisão inline e empacotamento, não revisão independente.

- [ ] G0: aplicar as 14 ligações herdadas no controlador real e concluir as verificações do checkout completo.
- [ ] Montagem administrativa autorizada no host real, sem ativação implícita por publicação de assets.
- [ ] HTTP/CSP, PostgreSQL, Auth, CI, deploy e homologação.

Evidência atual:94 testes Node do subconjunto,222 checks Chromium UX05,93 checks Chromium UX04,47 pares de tokens,23 testes do aplicador sintético;189 IDs/atributos do HTML preservados. Evidências detalhadas acompanham o pacote, fora do diretório público.

**Decisão registrada:** o plano UX04 mencionava manter motivo em conflito. Os controllers originais descartam o diálogo após recusa autoritativa. Preservou-se esse comportamento, sem mudar transações neste ciclo visual. Motivo não é apagado por atualização visual ou durante envio; não há promessa de retenção após uma resposta412.
