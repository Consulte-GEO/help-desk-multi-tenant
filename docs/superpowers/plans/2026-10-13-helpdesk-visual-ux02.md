# UX02 — plano de implementação

> Executar com superpowers:executing-plans; continuidade autorizada no plano UX01.

**Goal:** facilitar atendimento móvel e priorizar conversa, sem mudar o domínio.
**Architecture:** estado puro + montagem DOM + hooks focais opcionais no app; CSS progressivo.
**Tech Stack:** ES modules/HTML/CSS nativos, Node 22, Python/Playwright.
**Spec:** docs/design/HELPDESK_VISUAL_UX02_SPEC.md

## Global Constraints
Preservar todos os controles e handlers existentes. Não alterar auth, SQL, permissões ou gate. Não copiar fontes. Não publicar. ZIP cumulativo visual UX01+UX02, sem incorporar M02.

## Review Focus
Retorno com GET pendente; duas escolhas concorrentes; refresh sem roubar foco; nota interna e motivos preservados; recusa de permissões sem conteúdo residual visível.

## Tarefas e evidência desta rodada
- [x] Estado puro: begin/finish/fail/back/reset e filtros normalizados. RED 12 falhas por ausência; GREEN 12 aprovados em `tests/inbox-view-state.test.ts`.
- [x] Montagem DOM: disclosure de filtros, retorno móvel, ações secundárias e nota interna; ausência comprovada em RED; 352 verificações de bancada aprovadas no resultado final.
- [x] Preparar hooks do app: dez transformações por fragmentos exatos e hash Git original. O arquivo integral foi lido no GitHub; não foi materializado nem executado integralmente nesta sessão.
- [ ] Aplicar os hooks no checkout completo e testar o controlador real com respostas controladas, incluindo abertura, erro, mutações pendentes e limpeza de sessão.
- [x] Build/demo: acrescentar os três assets novos nas listas fechadas. A execução integral de build está bloqueada na cópia seletiva; não equivale a build aprovado.
- [x] Regressão visual UX01: 314 verificações da bancada anterior; 20 testes Node focais no total; 47 pares de contraste; 14 testes do aplicador em repositório sintético.
- [x] Auto-revisão, registro dos bloqueios, pacote cumulativo e plano atualizado.
- [ ] G0: revisão independente, suíte completa, composição, Auth/API/PostgreSQL, CSP/HTTP e aceite antes da publicação.

## Registro de execução
Base observada: 604478e2d05ed019baac6d92a9a04db236fafb82. M02: 3fb1e4664cb462bf0e00d8a7e0bb4249c25b30b7. Quatro arquivos compartilhados têm o mesmo blob nas duas referências: app.js, index.html, build.mjs e demo.ts. Isso não certifica a integração de toda a M02.

Ruling: G0 pendente impede publicação, não o desenvolvimento de candidato UX02 isolado. Não somar evidências históricas como homologação nova. A cópia seletiva não é um checkout integral.

A primeira ampliação da bancada encontrou dois erros de foco (350/352): desktop com foco no botão Voltar oculto e retorno do guia com foco no título da lista oculto. Foram corrigidos na origem dos eventos de apresentação; nova rodada 352/352. O módulo não intercepta Escape global, não altera hash/history, não envia operações e não cria armazenamento de rascunhos.

## Limites remanescentes
O guard já existente cobre mutações em andamento e abertura não conciliada; não introduz um novo estado de resultado desconhecido para todas as mutações. Voltar preserva o chamado atual em memória, mas selecionar OUTRO chamado mantém a política anterior de limpeza de rascunhos. Não anunciar preservação ilimitada entre chamados, recargas ou identidades. Revisar esses percursos no controlador integrado.
