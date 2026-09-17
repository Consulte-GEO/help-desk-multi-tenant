# Consulte Help Desk — v0.19.0 / vigência e integridade contratual

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega

A resolução de cobertura compara o início inclusivo e o fim exclusivo sem perder microssegundos. O retorno do adaptador é validado integralmente antes de escolher contrato ou criar chamado; configuração inválida é erro controlado, não ausência de cobertura. Reenvios autorizados preservam a resposta histórica, mesmo após o vencimento contratual.

**1.040 testes locais aprovados (38 novos) e 35 checks HTTP da demonstração.** Os três novos testes de socket estão incluídos nos 1.040. Há 201 SQL e 36 browser escritos, ainda sem homologação real. Não há lockfile, npm ci/audit concluídos ou aprovação do runtime. Typecheck global é suplementar.

## Documentação

[Vigência e coberturas](docs/23-VIGENCIA-E-INTEGRIDADE-CONTRATUAL.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Continuidade](docs/05-HANDOFF-REVISAO.md) · [Notas e gravações](docs/22-NOTAS-E-CONFIRMACAO-DE-ESCRITAS.md) · [Precisão temporal](docs/21-PAGINACAO-E-PRECISAO-TEMPORAL.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

M1 e R14-04/05/06 continuam sem homologação PostgreSQL. Comparação exata não melhora a resolução do relógio do servidor e não garante sincronização entre API e banco. Nenhum contrato, snapshot, recibo ou migration foi reescrito.

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

**API/interface0.19.0; schema esperado0.18.0; onze migrations/25 tabelas/18 operações.** Todas as onze migrations anteriores preservadas; nenhuma dependência ou endpoint novo. Nenhuma escrita remota. Não publicar com dados reais antes de homologar.

Sessão humana permanece somente em memória; reload exige novo login. Logout solicita escopo local e não invalida imediatamente um JWT já emitido. MFA/SSO/CAPTCHA, administração, anexos, clocks de SLA, dispatcher/entregas e dois conectores reais continuam pendentes.
