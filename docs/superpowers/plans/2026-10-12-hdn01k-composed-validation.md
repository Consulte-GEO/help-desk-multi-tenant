# HDN-01k — plano de verificação da composição do checklist

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para executar tarefa a tarefa.

**Goal:** substituir a simulação manual dos endpoints da fixture pela composição real e validar o conjunto, sem ativar produção.
**Architecture:** fixture de loopback existente → handler/serviço/resolver/store/runner reais; identidade e transporte SQL sintéticos delimitados.
**Tech Stack:** Node22/TypeScript e runner Node, Python/Playwright existente. Sem nova dependência.
**Spec:** handoff HDN-01j; RF-CEN-07 e RF-CEN-11; regras e contratos existentes dos componentes.

## Restrições

Nenhum modelo de teste pode ser montado no runtime. Preservar produção única, login simples/painel, scopes,12migrations e SQL candidato J. Resultados em memória/HTTP não comprovam PostgreSQL. Não contornar recusas de ferramentas ou navegador. Não reimportar canônico antigo como prova de fonte nova.

## Revisão focal

Origem HTTP não pode ser autorizada pelo alias de teste; bytes inválidos não são corrigidos; mark inválido após staging não confirma; resultado desconhecido mantém intenção; métricas da fixture devem demonstrar que o caminho real foi percorrido, sem simular aprovação de camadas omitidas.

## Tarefas e execução

- [x] Conferir J e consultar PR30/head/base;160hashes internos/76de fonte.
- [ ] Incorporar o restante no PR30: tentativa bloqueada pela ferramenta; sem reenvio alternativo.
- [x] Escrever cenários negativos contra a fixture anterior e observar RED.
- [x] Implementar `createChecklistCompositionFixture()` em `tests/fixtures/checklist/composition.ts` e consumi-lo no servidor de loopback existente.
- [x] Preservar credencial/origem sintéticas apenas na fixture; ajustar adapters de teste e preparar check correspondente no browser.
- [x] Revisão: provar e corrigir envio direto do aliasHTTPS; conservar controles UTF-8/origem no handler.
- [x] Baseline J586 e conjunto final605 aprovados no recorte local; typecheck focal e sintaxe.
- [x] Mutações do handler/escopo/recibo detectadas; código restaurado.
- [ ] Navegador real da K: bloqueio na navegação inicial da tentativa baseline, nenhuma aprovação visual.
- [ ] CI integral, nova execução SQL, montagem runtime, templates/bindings/migration/upgrade e revisão independente.
- [x] Pacote cumulativo e handoff, distinguindo resultado local da aprovação histórica da J.

## Decisões

A escrita remota recusada não foi dividida/recodificada ou enviada por outra ação. A execução passou a trabalhar somente na integração local/testes já necessária ao plano. Custo: incorporação e CI permanecem abertos. Nenhuma nova feature de atendimento foi usada para substituir esses aceites.

Autorrevisão do autor, sem revisor independente disponível nesta execução.
