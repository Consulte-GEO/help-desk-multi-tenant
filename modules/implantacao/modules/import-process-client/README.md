# Cliente de processos de implantação — R04

Cliente HTTP browser-safe, controlador, journal mínimo de recuperação e binding Vuex 4.

`client.ts`: fetch de sessão injetado; valida respostas/recibos e resultados incertos.
`controller.ts`: edições/versões/conflitos; restorePending/recover por GET após reconstrução.
`recovery-journal.ts`: sessionStorage explicitamente injetado; IDs/hash somente, sem credenciais/conteúdo.
`vuex-binding.ts`: módulo dinâmico namespaced, sem trocar store/stack.
`presentation.ts`: rótulos/versões/guardas para a UI.

Leia docs/implantacao/R04-CONTRATO-RECUPERACAO.md. Gate e portas reais são obrigatórios. dispose/detach preservam o marcador; endSession/clearSession são para logout. A aplicação publicada não foi modificada para registrar o módulo. Nunca chamar clearSession em beforeunload.

Hard reload nativo, Vuex real e banco real ainda precisam de qualificação. Testes do journal usam StoragePort simulado. Fechar aba/limpar storage ou perder rascunho não enviado não é coberto. Falhas não habilitam fallback ou novo UUID automático.


## R05 — revisão visual
`field-review.ts` aplica correções justificadas preservando bruto/semântica/unidade e recusando edição obsoleta. `panel-options.ts` contém o Options API do SFC ImportProcessPanel. ImportProcessView conecta as guardas de navegação. Sem registro autorizado do namespace, nenhum processo é consultado. Não há credenciais, storage remoto, executor ou aprovação no componente. Ver o handoff R05 para qualificação com Vuex/banco/sessão reais.
