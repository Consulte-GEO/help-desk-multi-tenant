# UX03 — abertura guiada e formulários dinâmicos / plano e registro de execução

> **Execução:** continuação solicitada pelo usuário do plano UX02. Usar o fluxo `executing-plans` e revisão independente no checkout integral antes de integrar. Os itens marcados abaixo referem-se exclusivamente à implementação e aos testes explicitados.

**Objetivo:** melhorar a abertura existente e o preenchimento de formulários sem modificar autorização, intenção de negócio, cobertura ou schema.

**Arquitetura:** estado puro de apresentação + adaptação reversível dos nós do formulário existente. O renderer dinâmico usa o parser compartilhado original; somente a camada de interação e feedback muda. Não introduzir React/Tailwind ou outra dependência de produto.

**Stack:** JavaScript nativo, declarações TypeScript, CSS por tokens, testes Node e bancada Playwright Python/Chromium. **Especificação:** `docs/design/HELPDESK_VISUAL_UX03_SPEC.md`.

## Restrições globais
Preservar genericidade, acesso simplificado, hidden/inert avançados, contratos, versões, idempotência, segregação público/interno e gate operacional. Sem fontes no pacote, credenciais de teste reais ou chamadas externas. Não persistir respostas em navegador/URL. Review local nunca é autorização. Componente opcional publicado como asset não é componente montado/habilitado.

## Pontos de revisão
Troca de audiência durante lookup; campo condicional recriado durante digitação; colisão entre nome de campo e caminho de linha; dados alterados depois da revisão; perda de resposta após envio. Esses cenários precisam de testes focais e de regressão no host real, com evidências separadas.

## Tarefa 1 — estados e transições de abertura
**Arquivos:** `web/opening-flow.js`, `web/opening-flow.d.ts`, `tests/opening-flow.test.ts`.
**Interface:** `createOpeningFlow()` retorna `view/update/next/back/edited/reviewCoverage/allowSubmit/reset`. Consome `status/canSubmit/pending/unresolved/ambiguous` do controlador. Não emite API, chave ou payload de negócio.

- [x] Escrever testes de três passos, campos inválidos, revisão invalidada, cobertura ambígua e recuperação. Executar RED: 8 falhas/6 acertos no stub inicial.
- [x] Implementar snapshot de revisão e locks de apresentação. Executar GREEN: 14 testes.
- [ ] Aplicar o contrato ao `renderCatalog` do controlador completo; confirmar recuperação real com a mesma chave e corpo.

## Tarefa 2 — modal progressivo sobre os controles existentes
**Arquivos:** `web/opening-wizard.js/.d.ts`, `web/form-experience.css`, `web/index.html`, `scripts/visual-opening/browser-check.py`; quatro operações de app no pacote.
**Interface:** `mountOpeningWizard(document)` retorna `update/open/reset/dispose`. O controlador original conserva submit e validação final. Import tardio aguarda fechamento de modal já aberto; ausência do asset mantém o formulário legado.

- [x] Montar seções sem clone/reset dos controles. Associar erros, resumo com foco, contagem e revisão textual.
- [x] Exercitar etapas, tentativa de envio precoce, mudança pós-review, múltiplas coberturas, cancelamento, recuperação e dispose na bancada nativa.
- [x] Reproduzir e corrigir foco em painel que acaba de ficar oculto após recusa do catálogo; guardar RED e GREEN.
- [ ] Validar as quatro operações de app no checkout integral. A montagem tardia descrita no hook ainda depende do teste E2E do host.

## Tarefa 3 — feedback e renderer dinâmico
**Arquivos:** `web/form-feedback.js/.d.ts`, `web/dynamic-form.js/.d.ts/.css`, `tests/form-feedback.test.ts`, mesma bancada nativa.
**Interface:** `validate({focus?:boolean})` é adição compatível; `validate()` e `snapshot()` continuam disponíveis. `draftAnswers` e o snapshot mantêm contrato. Boolean continua boolean no payload, agora com seleção visual explícita de ausência/Sim/Não.

- [x] Executar a bancada no renderer original: reproduzir quatro falhas em seis verificações iniciais, incluindo perda de foco, IDs colidentes e ausência do novo feedback.
- [x] Criar registro de controles da audiência renderizada, erros humanos por campo/linha e foco/caret restaurável.
- [x] Melhorar linhas repetidas, limites, colagem e proteção de resolução assíncrona. Preservar parser e retornos autorizados como referências.
- [x] Exercitar false obrigatório, campos internos ausentes do DOM do cliente, paste inválido sem perda e lookup atrasado após clear/destroy.
- [ ] Executar os testes antigos do renderer e dos hosts no repositório completo. Ajustes de fake DOM precisam corresponder à semântica nativa nova, nunca remover assertions de segurança para obter aprovação.

## Tarefa 4 — entrega estática e integração verificável
**Arquivos:** `scripts/build.mjs`, `scripts/demo.ts`, `tests/opening-assets.test.ts`, `tests/opening-composition.test.ts`, `scripts/visual-opening/verify-integration.mjs`.

- [x] Reproduzir e corrigir CSS de UX02 servido como JavaScript no servidor de demonstração. Manter lista explícita e `nosniff`.
- [x] Acrescentar apenas quatro assets de execução; não publicar docs/testes/fixtures como recursos estáticos.
- [x] Testar gate estático: checkout incompleto retorna blocked/2, hooks ausentes failed/1, fixture sintética correta passed/0 com `integrated:false` em todos os resultados.
- [ ] Executar o gate com app completo e inspecionar o diff resultante. Gate estático verde não substitui testes funcionais.

## Tarefa 5 — pacote, regressão e revisão
- [x] Reexecutar 46 testes Node focais da seleção recuperada.
- [x] Reexecutar 106 verificações UX03, 352 UX02 e 314 UX01 em browser nativo com fixtures locais; 47 pares selecionados de tokens.
- [x] Testar o aplicador cumulativo em 18 casos sintéticos, incluindo base/UX01/UX02/no-op, conflito, mistura, symlink e rollback de exceções capturadas.
- [x] Tentar verify, build, typecheck e composição. Registrar bloqueios do checkout seletivo; não convertê-los em sucesso.
- [x] Revisão própria de fontes, fronteiras e outputs; corrigir o gate que não reconhecia o literal real dos loops de MIME, com teste positivo sintético.
- [ ] Revisão independente e G0 integral, CI da fonte atual, publicação autorizada e aceite humano.

## Decisões registradas
1. Não contornar a falta de checkout integral com stubs de domínio. Os stubs aparecem exclusivamente em testes declaradamente sintéticos.
2. Não montar o painel opcional `support-intake.js` como efeito do novo CSS. Sua composição externa/review ainda requer o fechamento UX03-C no próximo ciclo.
3. Preservar UI single-page como fallback de falha do import opcional; não introduzir dependência visual capaz de impedir login.
4. O cumulativo contém UX01–UX03, mas não reaplica HDN/M02 nem substitui o repositório. A branch M02 mudou e exige reconciliação no destino.
