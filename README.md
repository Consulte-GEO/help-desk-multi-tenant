# Consulte Help Desk — v0.6.0 / observabilidade HTTP e PostgreSQL nativo

Help Desk independente, multiproduto e multicontrato. Workspace, conta, produto/instância, contrato/versão e cobertura permanecem distintos.

**Entrega local, não publicada. M1 ainda aberto.** Nesta rodada: **451 testes locais aprovados**, incluindo cinco testes de HTTP real em loopback/CLI offline; **13 verificações adicionais do smoke HTTP existente** aprovadas com dados fictícios em memória. Nenhum teste PostgreSQL ou browser foi aprovado nesta sessão.

## Executar localmente

```bash
npm test
npm run demo
```

Node utilizado: 22.16.0. A demonstração escuta somente em `http://127.0.0.1:4317`, utiliza dados fictícios em memória, não acessa Supabase nem envia e-mail/webhook. Não é fallback do runtime de produção. `npm run test:ui:local` inicia/encerra suas próprias demonstrações para HTTP + navegador e recusa usar um servidor já existente. O HTTP passou; a navegação continua bloqueada neste ambiente.

## Novidades

A API emite diagnóstico JSON de resultado, rota normalizada, código permitido, fase, duração e UUID de correlação, sem conteúdo de chamados, notas, credenciais, IP ou identificadores de clientes/recursos. Falhas de inicialização também são correlacionadas. Falha do observador não muda o resultado da operação. Isso não é armazenamento durável, auditoria regulatória nem OpenTelemetry completo.

Para sumarizar logs autorizados offline:

```bash
npm run --silent logs:summary -- observacoes.jsonl > resumo.json
# Exemplo com quatro eventos gerados por HTTP local, NÃO produção:
npm run --silent logs:summary -- evidence/m1e/loopback-observations.jsonl
```

O resumo contém contagens e histograma por rota/método; não guarda request IDs nem expõe métricas entre clientes. Não fornece percentis exatos. Arquivo limitado a 256 MiB e linha a 16 KiB.

Para a suíte SQL, Docker continua padrão. Agora há alternativa explícita com PostgreSQL 17 previamente instalado, dependências locais e usuário não root:

```bash
export HELPDESK_TEST_DB_ENGINE=native
export HELPDESK_TEST_PG_BIN=/usr/lib/postgresql/17/bin
npm run test:db:local
```

O diretório acima é exemplo. O runner cria apenas seu cluster temporário em loopback, usa SCRAM, gera segredos temporários, verifica propriedade antes de limpar e preserva dados se não confirmar a parada. Não instala binários, não usa sudo, não muda políticas e não tenta outro servidor silenciosamente. **Os testes do lifecycle utilizam doubles PostgreSQL; nenhum servidor real foi iniciado nesta entrega.**

## Instalação e homologação completa

```bash
npm run deps:resolve
# Revisar lock real, origens, integridades, versões e alertas.
npm run homologate:local
npm run check:homologation
```

O registry novamente falhou com `EAI_AGAIN`; não há lockfile, npm ci ou audit aprovado. `npm run verify` falha por dependências/tipos locais ausentes. A checagem com ferramentas globais passou, mas não substitui a instalação real. O executor agregado mantém etapas não executadas bloqueadas; `verify:release` não passou.

`npm run build` gera somente assets estáticos, não o bundle/execução das Netlify Functions. Não habilitar `HELPDESK_RELEASE_APPROVED` para ocultar ausência de homologação. Ainda são necessários os **60 cenários PostgreSQL**, **14 checks browser**, Auth/pooler/TLS, Functions, carga, restauração e revisão operacional. Não utilizar dados de clientes reais.

## Compatibilidade

**API/interface: 0.6.0. Schema candidato esperado: 0.5.0.** As seis migrations foram preservadas byte a byte; mesmas 23 tabelas candidatas e 16 operações HTTP em 13 caminhos. Não há migration nova porque esta entrega não muda o banco. O catálogo autorizado e a abertura guiada da v0.5.0, as garantias transacionais e as sessões M2M anteriores foram preservados.

## Documentação e continuidade

[Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [Segurança/publicação](docs/03-SEGURANCA-E-PUBLICACAO.md) · [Estado e evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Observabilidade e runner nativo](docs/10-M1E-OBSERVABILIDADE-E-POSTGRES-NATIVO.md) · [OpenAPI](docs/openapi.json) · [Changelog](CHANGELOG.md).

Sem push, merge, deploy, migrations remotas, dados/segredos/MFA alterados ou nova inspeção remota. Destinos informados: GitHub `Consulte-GEO/help-desk-multi-tenant`, Supabase `xaelbntjnvztznnpcvtm`, Netlify `help-desk-multi-tenant`. Reinspecionar antes de integrar e preservar trabalho concorrente. M2 administrativo, intakes, participantes/filas, SLA operacional, anexos, worker/notificações/webhooks e suporte incorporado continuam não implementados.
