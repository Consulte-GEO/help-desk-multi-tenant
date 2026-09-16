# Consulte Help Desk — v0.5.0 / catálogo autorizado e abertura guiada

Help Desk independente, multiproduto e multicontrato. Workspace, conta, produto/instância, contrato/versão e cobertura permanecem distintos.

**Entrega local, sem publicação e sem encerramento do M1.** Há **407 testes locais aprovados** e **13 verificações HTTP em demonstração de memória**. PostgreSQL, dependências reproduzíveis, runtime remoto e navegador continuam sem homologação.

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

O executor de homologação exige lock, npm ci, audit, verify, PostgreSQL descartável e HTTP/browser. Os 60 cenários SQL existem, mas não executaram por ausência de Docker/servidor. Não usar o projeto Supabase remoto para substituir esses testes. O novo gate verifica fontes/logs e não aceita etapas ausentes, skips ou resultados antigos de outro código.

`npm run build` gera apenas assets estáticos. `npm run verify:release` **não passou** e agora exige também evidência de homologação local. Isso ainda não substitui bundle de Functions nem aprovação real de Auth/pooler/TLS/RLS e do destino. Não ligar `HELPDESK_RELEASE_APPROVED` para remover o bloqueio.

## Funcionalidade desta versão

`GET /v1/support-contexts` descobre opções autorizadas de conta, sistema/ambiente e serviço, usando o scope `contexts:resolve`. Padrão 50, máximo 100 por página. Não expõe política, notas ou credenciais. A abertura usa nomes em vez de UUIDs manuais, exige escolha quando há várias opções e só seleciona automaticamente quando a lista completa contém uma opção. Seleção não concede autorização: resolução e criação continuam revalidando contratos.

Há carregamento, erro/tentativa novamente, ausência de opções, mais páginas e proteção contra respostas de um formulário/perfil anterior. Testes de estado e HTTP passaram; a integração visual/DOM segue pendente. O exemplo server-to-server está em `examples/support-context-discovery.http`.

**API/interface e schema candidato: 0.5.0.** Nova migration 006: helper privado de leitura, índice e versão de schema. As cinco anteriores foram preservadas; continuam 23 tabelas candidatas. Nada foi aplicado no Supabase remoto. A API 0.5.0 recusa schema antigo; não publicar apenas o frontend.

As garantias da v0.4.0 de confirmação transacional e encerramento da própria sessão M2M foram preservadas. Não há retry automático de mutações com resultado incerto. O demo continua sem backend M2M, sem envio externo e sem fallback em produção.

## Documentação

[Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [Segurança/publicação](docs/03-SEGURANCA-E-PUBLICACAO.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Limites e retenção](docs/06-M1-SEGURANCA-E-LIMITES.md) · [Homologação M1b](docs/07-M1B-HOMOLOGACAO.md) · [Transações/sessões M1c](docs/08-M1C-TRANSACOES-E-SESSOES.md) · [Catálogo e abertura](docs/09-M1D-CATALOGO-E-ABERTURA.md) · [OpenAPI](docs/openapi.json) · [Changelog](CHANGELOG.md).

Destino informado: Supabase `xaelbntjnvztznnpcvtm`; GitHub `Consulte-GEO/help-desk-multi-tenant`; Netlify `help-desk-multi-tenant`. Não houve escrita nem nova inspeção remota nesta rodada. Nenhum segredo real foi provisionado. Os avisos remotos registrados anteriormente são históricos, não uma nova leitura.

Administração de usuários/contratos, intakes, participantes/filas, SLA operacional, anexos, dispatcher/e-mails/webhooks e sessões incorporadas continuam fora da implementação. M2 permanece posterior à homologação efetiva do M1.
