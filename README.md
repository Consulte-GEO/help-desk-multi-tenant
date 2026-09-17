# Consulte Help Desk — v0.15.0 / permissões humanas versionadas

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega

Capacidades humanas versionadas por pessoa/workspace em migration candidata privada; nenhum fallback de permissões para perfis ausentes. Getter compartilhado entre identidade e RLS, histórico de revisão e plano de provisionamento offline. Recibo da própria nota sem conceder leitura da coleção. Nove migrations (oito anteriores intactas), nenhum endpoint ou dependência novos.

**905 testes locais aprovados (37 novos),35 checksHTTP de memória.146 SQL e35 browser escritos, não homologados.** Sem lock real/npm ci/audit; verificação padrão falha nos tipos locais ausentes. Typecheck global é suplementar. A CLI não configura o Supabase.

## Documentação

[Permissões versionadas e uso do plano](docs/19-PERMISSOES-VERSIONADAS.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Continuidade](docs/05-HANDOFF-REVISAO.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

R14-04 e R14-05 possuem código candidato para alinhamento do banco; ainda precisam de homologaçãoSQL. R14-06 (evento/outbox para todas as mudanças) continua pendente. Não há administraçãoM2. Escopos são um teto por workspace e não substituem vínculo por conta/papel/recurso.

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

**API/interface e schema esperado0.15.0; nove migrations/24 tabelas/18 operações.** Nova migration009; nenhuma dependência ou endpoint novo. Nenhuma escrita remota. Não publicar com dados reais antes de homologar.

Sessão humana permanece somente em memória; reload exige novo login. Logout solicita escopo local e não invalida imediatamente um JWT já emitido. MFA/SSO/CAPTCHA, administração, anexos, clocks de SLA, dispatcher/entregas e dois conectores reais continuam pendentes.
