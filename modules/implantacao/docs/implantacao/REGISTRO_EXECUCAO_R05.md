# Execução R05 — plano: PLANO_IMPLANTACAO_REVISAO_R04_2026-10-14.md

Base remota consultada dcf5607652281bb688f366e6a4f05e07eb698d31, sem alterações desde R04. Esta árvore é uma reconstrução parcial do pacote, NÃO um clone.

## Decisões desta rodada
- Foco: primeiro painel Vue de revisão ligado ao namespace importProcess, edição justificada por campo, proteção de descarte e montagem passiva no AppShell existente.
- Não construir identidade fictícia no produto. A criação do binding continua dependendo de capability/sessão/portas autorizadas. Sem binding, não há consultas nem painel com dados.
- DNS do container impede npm/clone. HTTP local no Chromium é recusado por política; não contornar. Testes offline de DOM não serão chamados de HTTP, reload ou sessionStorage real.
- Vue 3.5.13 está instalado no ambiente via trame_client. Pode qualificar renderização Vue, não o lock completo da aplicação.
- Baseline processos: 240/240. Primeira execução integridade: 112/113 por helper inalterado ausente do pacote incremental. Restaurado normalizationService.ts da baseline-leitura somente no workspace para reexecutar. Não alterar o teste para ocultar o bloqueio.

## Pré-flight
- Painel consome ProcessViewState/ImportProcessPresentation e as ações já expostas por registerImportProcessSession.
- Correções consomem parseSnapshot/parseField e nunca mudam rawValue/rawUnit, semanticRole ou vínculos.
- Save usa o rascunho do controlador; alterações locais do editor ainda não aplicadas precisam de confirmação de descarte separada.
- AppShell somente observa existência do módulo e o monta; não registra sessão nem habilita backend.

## Tarefas
- [x] R05-1: correção rastreável de campo e projeção paginada testadas.
- [x] R05-2: componente Vue com revisão, salvamento, recuperação GET e descarte explícito.
- [x] R05-3: montagem passiva e proteção do prebuild, teste de integração.
- [x] R05-4: qualificação offline Vue, regressões, revisão e pacote cumulativo.

## Rulings e evidências finais
- Ruling: substituir montagem no AppShell pela view administrativa dedicada — evita misturar o salvamento do wizard com a revisão de importação — não altera o wizard nem presume sessão de negócio pronta.
- R05-1: 21 testes de correção/projeção; RED observado nos primeiros 19 e nas regressões de precisão e tipo; GREEN final.
- R05-2: 19 testes de opções/ciclo de vida e 16 verificações DOM; RED observado nas primeiras 16 e nas regressões de contexto. Vue real com store-port/cliente simulados.
- R05-3: 5 testes do aplicador R05 e 6 de view/wiring. Transformações do router/prebuild não foram executadas sobre checkout completo.
- R05-4: suítes focais 138 + 280 = 418; typechecks de módulos aprovados; browser anterior 10 e similaridade 21. Os limites de PG, navegador com navegação e aplicação completa continuam explícitos.
- Final review: self-review (no subagent tool). Não houve revisão independente.
- Final fixed: impedida precisão inteira silenciosamente perdida; tipo numérico não vira texto para escapar da validação; navegação para outra seleção e troca de namespace limpam/confirmam corretamente.
- Deferred minor: melhorar foco automático ao abrir o editor/confirmadores e avaliar cards no mobile, após montar com o design system e router reais. Componente é navegável por teclado, mas auditoria completa de acessibilidade não foi realizada.
