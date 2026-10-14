# UX08 — Plano de implementação
> Execução inline conforme continuidade solicitada. Spec: docs/design/HELPDESK_VISUAL_UX08_SPEC.md.

- [x] A. Conferir refs e ler fontes de montagem, sessão e callback; separar ativo/opcional/avançado preservado.
- [x] B. Testar RED mensagens por códigos; implementar helpers e mount sem alterar disponibilidade dos controles. Exercitar foco, erros locais, limpeza e carregamento tardio.
- [x] C. Testar mount callback sem consumo automático e com descarte tardio; adaptar UI e manter geo-auth-state.js com blob original.
- [x] D. CSS de acesso/dialogs com 44px, mobile16px, tokens; nenhum hidden/inert removido.
- [x] E. Testar browser e subconjunto cumulativo, tentar gates completos e registrar causas; atualizar manifesto, hooks, aplicador, matriz, handoff e ZIP.

G0 permanece obrigatório: fonte integral, Auth/DB/HTTP/CSP/CI/revisão independente. Não substituir testes integrais pelos focais.

Resultado local: 35 testes novos UX08 (incluídos em109 focais), 326 checks Chromium UX08 e 276 de regressão UX07. Gates integrais não aprovados; acabamento do pacote é conferido em suas evidências. Nenhuma publicação.
