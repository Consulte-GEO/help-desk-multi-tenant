# Consulte Help Desk — v0.16.0 / efeitos transacionais

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega

R14-06: gravações do núcleo associadas ao evento correto e à intenção externa mínima quando pública. Modelo de referência integrado ao COMMIT em memória e migration010 candidata com registros privados gerados pelo banco, vínculo de transação, verificação de evento/outbox e constraint trigger diferido. Notas e atribuições continuam sem outbox externo. Não há envio de notificações.

**950 testes locais aprovados (45 novos) e35 checksHTTP de memória.179 SQL e35 browser escritos, não homologados.** Sem lock real/npm ci/audit; o verify padrão falha nos tipos locais ausentes. Typecheck global é suplementar. O código SQL ainda não foi executado.

## Documentação

[Efeitos transacionais e limites](docs/20-EFEITOS-TRANSACIONAIS.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Continuidade](docs/05-HANDOFF-REVISAO.md) · [Permissões versionadas](docs/19-PERMISSOES-VERSIONADAS.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

R14-04/05/06 possuem código candidato para validação no PostgreSQL. Nenhuma das três está homologada no banco real. Registros antigos não são certificados retroativamente, e as nove migrations anteriores permanecem intactas. Nova tabela privada sem acesso direto/endpoint ao runtime, clientes ou manutenção. Retenção, tamanho e custo precisam de medição; não foi criado expurgo.

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

**API/interface e schema esperado 0.16.0; dez migrations/25 tabelas/18 operações.** Nova migration010; nenhuma dependência ou endpoint novo. Nenhuma escrita remota. Não publicar com dados reais antes de homologar.

Sessão humana permanece somente em memória; reload exige novo login. Logout solicita escopo local e não invalida imediatamente um JWT já emitido. MFA/SSO/CAPTCHA, administração, anexos, clocks de SLA, dispatcher/entregas e dois conectores reais continuam pendentes.
