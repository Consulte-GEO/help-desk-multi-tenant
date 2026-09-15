# Consulte Help Desk — fundação v0.1.0

Plataforma de atendimento independente, multiproduto e multicontrato. Workspace representa a operação de suporte; conta representa o cliente atendido; contratos preservam versões e coberturas.

**Esta entrega não está publicada nem liberada para produção.** O pacote contém o primeiro incremento de código, arquitetura, roadmap e evidências locais. PostgreSQL/Supabase reais, empacotamento Netlify e navegador ainda precisam de homologação. Não aplicar as migrations diretamente no projeto remoto para “experimentar”.

## Começar pela demonstração local

Com Node.js 22.16 ou superior compatível com os limites de `package.json`:

```bash
npm test
npm run demo
```

A demonstração escuta apenas em `http://127.0.0.1:4317`. Não exige dependências npm externas para o núcleo nem conexão ao Supabase. Abra no navegador e escolha uma identidade fictícia. Equipe de suporte, cliente de laboratório e cliente de sistema escolar usam o mesmo núcleo; as contas têm visibilidade distinta. Os dados ficam em memória e são perdidos ao reiniciar. Nada é enviado por e-mail ou webhook. A interface não deve ser hospedada usando esse servidor de demonstração.

As URLs públicas do sistema, hospedagem e repositório fornecidas pelo usuário são contexto de destino, não comprovação de que o código deste pacote foi publicado:
- Supabase: `xaelbntjnvztznnpcvtm`.
- GitHub: `Consulte-GEO/help-desk-multi-tenant`.
- Netlify: `help-desk-multi-tenant`, site `ee32e955-42e5-4417-bf4f-39cbef2366cc`.

## Documentação principal

- [Arquitetura consolidada](docs/01-ARQUITETURA.md): conceitos, decisões, fontes, segurança e fronteiras.
- [Plano de desenvolvimento](docs/02-PLANO-DE-DESENVOLVIMENTO.md): M0–M8, backlog, dependências e aceite.
- [Segurança e publicação](docs/03-SEGURANCA-E-PUBLICACAO.md): gates, segredos, incidentes e recuperação.
- [Estado e evidências](docs/04-ESTADO-E-EVIDENCIAS.md): o que foi e não foi verificado.
- [Continuidade e revisão](docs/05-HANDOFF-REVISAO.md): próxima execução orientada a código.
- [OpenAPI](docs/openapi.json): 14 operações implementadas; não inclui funcionalidades especulativas.

## Desenvolvimento e verificações

```bash
# Núcleo e API: não dependem de pacotes externos.
npm test
# Copia apenas assets estáticos para dist; não empacota Functions.
npm run build
npm run check:contracts
# Após instalar dependências em ambiente com registry autorizado:
npm install --ignore-scripts
npm run verify
```

O package-lock ainda precisa ser gerado, revisado e versionado. O CI usa temporariamente `npm install --ignore-scripts`; a primeira tarefa de continuidade é convertê-lo para `npm ci` após aprovação do lockfile. Não há resultado de instalação/audit/bundle Netlify nesta sessão. A checagem de OpenAPI é estrutural; não equivale a conformance completa do padrão.

Para banco real, siga o ambiente descartável descrito em `docs/02-PLANO-DE-DESENVOLVIMENTO.md`. A suíte `npm run test:db` recusa execução sem opt-in e URLs locais do banco `helpdesk_test`. Ela usa login `helpdesk_app` real, não administrador disfarçado. O workflow acompanha o código, mas não foi executado no GitHub porque nada foi enviado ao repositório remoto.

Para interface, instale Playwright em ambiente autorizado e execute `python tests/browser-smoke.py` com a demonstração em execução. O navegador foi impedido de abrir loopback neste ambiente; não há capturas visuais aprovadas nem testes E2E concluídos no pacote.

## Produção e integrações

O adaptador `netlify/functions/api.mts` usa a API moderna Request/Response e variáveis `Netlify.env`. O login PostgreSQL precisa ser restrito, com TLS validado. `.env.example` contém apenas nomes e exemplos não funcionais. `HELPDESK_RELEASE_APPROVED` começa em `false` e não deve ser habilitado antes dos gates.

Pessoas autenticam pelo Supabase; a API busca permissões vivas no domínio. Integrações server-to-server trocam uma chave por uma sessão opaca de até dez minutos. O segredo M2M não vai ao navegador. Sessões incorporadas por usuário externo ainda não existem. Não usar a mesma sessão de máquina como login de todos os usuários de outro produto.

Endpoints de anexos, SLA operacional, fila de atendentes, administração e entregas de e-mail/webhook ainda não estão implementados. As capabilities retornam `false` para funcionalidades ausentes. Não há fallback de banco para dados fictícios.

## Licenciamento e reuso

Código novo produzido para este projeto; nenhum código dos helpdesks open source citados na pesquisa foi copiado. Não foi feita auditoria jurídica de dependências. O pacote não contém código recuperado do GeoLab; o reuso planejado deve passar por revisão de acoplamento e de segurança antes de qualquer importação.
