# Consulte Help Desk — v0.18.0 / notas e confirmação de escritas

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega

Correção da nota-only: o comando de nota não solicita UPDATE no pai; a migration 011 ajusta o bloqueio interno da conversa para NO KEY UPDATE. Confirmação explícita de comando/uma linha em todos os INSERTs e UPDATEs do adaptador, incluindo recibos idempotentes. UPDATE válido com zero linhas mantém conflito412; confirmação incompatível gera503 e rollback antes de COMMIT.

**1002 testes locais aprovados (20 novos) e 35 checks HTTP de memória.** 196 SQL e36 browser escritos, não homologados. Sem lock real/npm ci/audit. Typecheck global é suplementar. Os três testes novos de socket/driver controlado estão incluídos nos1002, não são testes de PostgreSQL.

## Documentação

[Notas e gravações](docs/22-NOTAS-E-CONFIRMACAO-DE-ESCRITAS.md) · [Precisão temporal](docs/21-PAGINACAO-E-PRECISAO-TEMPORAL.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Continuidade](docs/05-HANDOFF-REVISAO.md) · [Efeitos transacionais](docs/20-EFEITOS-TRANSACIONAIS.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

M1 e R14-04/05/06 continuam sem homologação PostgreSQL. Outbox não significa entrega externa. Cursores antigos de três dígitos seguem aceitos, mas precisão já perdida não pode ser reconstruída: reiniciar as coleções no rollout.

## Plano de provisionamento sem executar SQL

```bash
npm run --silent scopes:plan -- examples/human-scope-change.json
```

Use apenas o exemplo fictício para conhecer o formato. O resultado é SQL parametrizado + valores; precisa de revisão e executor administrativo aprovado. Não é uma rota pública e não altera dados. Não conceder EXECUTE do setter ao loginHTTP.

## Demonstração local

```bash
npm run check:migrations
npm test
npm run demo
```

Node utilizado22.16.0; demo em loopback com memória e dados fictícios. Catálogo, abertura, busca/filtros, mensagens, notas, estados, prioridade, responsável, histórico e ações por chamado preservados. Não comprova o runtime real.

## Homologação

```bash
npm run deps:resolve
# Revisar o lock REAL antes de prosseguir.
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Os runners recusam infraestrutura ausente; não trocam para Supabase remoto ou aprovam etapas por mocks. Não usar o login postgres/service_role no runtime. Frontend estático não é bundle de Functions.

**API/interface/schema0.18.0; onze migrations/25 tabelas/18 operações.** As dez migrations anteriores preservadas; nenhuma dependência ou endpoint novo. Nenhuma escrita remota. Não publicar com dados reais antes de homologar.

Sessão humana permanece somente em memória; reload exige novo login. Logout solicita escopo local e não invalida imediatamente um JWT já emitido. MFA/SSO/CAPTCHA, administração, anexos, clocks de SLA, dispatcher/entregas e dois conectores reais continuam pendentes.
