# M1-R11 — Plano de implementação da aceitação de sessões

> Para execução nesta sessão: testes antes da implementação, preservação da base e evidência por tarefa.

**Objetivo:** executar o ciclo básico humano e M2M por interfaces existentes, sem mutações de domínio.
**Arquitetura:** cliente Node privado, transportador humano já existente, backend sem alterações; fixtures locais com handler/auth reais e memória sintética.
**Stack:** TypeScript strip-only/Node22, fetch nativo; dependências e SQL históricos intactos.
**Especificação:** docs/69-M1-R11-CICLO-AUTH-E-M2M.md.

## Restrições e revisão
Plano padrão sem rede. Operações de sessão exigem consentimento explícito na chamada e autorização externa atual. Segredos nunca em artefatos. Sem retries. Cinco segundos/64 KiB. Revisar especialmente resposta de criação perdida, token de outra identidade, recusa de refresh confundida com indisponibilidade, cleanup parcial e M2M de instância errada.

## Tarefa 1 — Cliente, fixture e regressões
Criar `scripts/hosted-auth-acceptance-core.ts`, `tests/fixtures/hosted-auth-fixture.ts`, `tests/m1-hosted-auth-acceptance.test.ts`.
Interface: `runHostedAuthAcceptance(config: unknown, credentials?: unknown, options?: AuthAcceptanceOptions): Promise<AuthAcceptanceReport>`.
- [x] Testes de plano, opt-in, origem, fluxo completo, respostas negativas e cleanup.
- [x] Confirmar falha pela ausência da capacidade.
- [x] Implementar os 12 passos e relatório sanitizado.
- [x] Executar testes focais e suíte completa, preservar falhas reais.

## Tarefa 2 — CLI e entrega
Criar `scripts/hosted-auth-acceptance.ts`, `examples/hosted-auth.fixture.json`; registrar npm script e piso de aplicação quando a contagem final for comprovada.
- [x] Teste de CLI planejado sem env/sem rede e recusa de execução incompleta.
- [x] Implementar leitura limitada da configuração, opções estritas e leitura de segredos somente no modo execute.
- [x] Regressão completa, typecheck e gates disponíveis; nenhuma aprovação herdada do R9 para este código.
- [x] Patch cumulativo R10–R11 e R11-only, reaplicação em cópia limpa, manifesto/hashes, estado/handoff/backlog.

Verificações locais e bloqueios em docs70. Nenhuma aceitação hospedada foi executada; sua pendência permanece no handoff.
