# Consulte Help Desk — v0.3.0 / continuidade do M1

Help Desk independente, multiproduto e multicontrato. Workspace, conta, produto/instância, contrato/versão e cobertura permanecem distintos.

**Entrega local, sem publicação e sem encerramento do M1.** Há **274 testes locais aprovados** e **nove verificações HTTP em demonstração de memória**. PostgreSQL, dependências reproduzíveis, runtime remoto e navegador continuam sem homologação.

## Executar o núcleo e a demonstração

Com Node compatível com `package.json` (ambiente usado: Node 22.16.0):

```bash
npm test
npm run demo
```

A demonstração escuta apenas em `http://127.0.0.1:4317`, usa dados fictícios em memória, não acessa Supabase e não envia e-mail/webhook. Não é fallback do runtime de produção. Em outro terminal:

```bash
node scripts/smoke-local-http.mjs
```

Para iniciar demonstrações frescas automaticamente e executar HTTP + browser:

```bash
npm run test:ui:local
```

Esse último comando exige porta livre, Python/Playwright/Chromium autorizados e falha se o navegador não puder executar. Nesta sessão, o HTTP passou e a navegação foi bloqueada; a interface não está visualmente homologada.

## Instalação e homologação local completa

```bash
npm run deps:resolve
# Revisar lock, origens, integridades, versões e audit antes de prosseguir.
npm run homologate:local
npm run check:homologation
```

A tentativa real de dependências retornou `EAI_AGAIN registry.npmjs.org`; **não há lockfile nesta entrega**. `npm run verify` falhou por tipos locais não instalados. A checagem com compilador/tipos globais passou, mas não substitui instalação limpa.

O executor de homologação exige lock, npm ci, audit, verify, PostgreSQL descartável e HTTP/browser. Os 35 cenários SQL existem, mas não executaram por ausência de Docker/servidor. Não usar o projeto Supabase remoto para substituir esses testes. O novo gate verifica fontes/logs e não aceita etapas ausentes, skips ou resultados antigos de outro código.

`npm run build` gera apenas assets estáticos. `npm run verify:release` **não passou** e agora exige também evidência de homologação local. Isso ainda não substitui bundle de Functions nem aprovação real de Auth/pooler/TLS/RLS e do destino. Não ligar `HELPDESK_RELEASE_APPROVED` para remover o bloqueio.

## Correções desta versão

Vigência contratual revalidada com horário após espera; validação de identidade/scopes humanos e M2M; entrada HTTP com prazo/bytes/UTF-8 controlados; parâmetros ambíguos recusados; snapshots de envios que preservam rascunhos novos e descartam respostas de outro contexto; executor local com evidência por etapa.

**API/interface: 0.3.0. Schema esperado: 0.2.0.** As quatro migrations da v0.2.0 permanecem inalteradas. Nenhuma migration adicional é necessária apenas por esse incremento de aplicação. Sua aplicação e teste reais continuam pendentes.

## Documentação

[Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [Segurança/publicação](docs/03-SEGURANCA-E-PUBLICACAO.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Limites e retenção](docs/06-M1-SEGURANCA-E-LIMITES.md) · [Homologação M1b](docs/07-M1B-HOMOLOGACAO.md) · [OpenAPI](docs/openapi.json) · [Changelog](CHANGELOG.md).

Destino informado: Supabase `xaelbntjnvztznnpcvtm`; GitHub `Consulte-GEO/help-desk-multi-tenant`; Netlify `help-desk-multi-tenant`. Não houve escrita nem nova inspeção remota nesta rodada. Nenhum segredo real foi provisionado. Os avisos remotos registrados anteriormente são históricos, não uma nova leitura.

Administração de usuários/contratos, intakes, participantes/filas, SLA operacional, anexos, dispatcher/e-mails/webhooks e sessões incorporadas continuam fora da implementação. M2 permanece posterior à homologação efetiva do M1.
