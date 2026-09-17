# Consulte Help Desk — v0.14.0 / revisão de reenvios e identidade

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega

Validação do namespace e da resposta histórica de reenvio; resultado incompatível não vira cache ausente nem produz uma segunda gravação. SQL exige null explícito para ausência. Leitura de identidade humana no backend limitada a64 KiB decodificados, UTF-8 estrito e sinal de prazo compartilhado com o fetch. Sem novo módulo/tela de negócio.

**868 testes locais aprovados (79 novos),35 checks HTTP de memória aprovados.125 SQL e35 browser escritos, não homologados.** Sem lock real/npm ci/audit; verificação padrão falha nos tipos locais ausentes. Typecheck global é suplementar.

## Documentação

[Revisão acumulada e achados](docs/18-REVISAO-REENVIOS-E-IDENTIDADE.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Continuidade](docs/05-HANDOFF-REVISAO.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

R14-04/05/06 distinguem configuração granular de scopes humanos, replay de notas e invariantes SQL por comando. Mocks com scope reduzido não provam que esse perfil está configurável no Supabase. A revisão não é pentest ou certificação independente.

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

**API/interface0.14.0; schema esperado0.9.0; oito migrations/23 tabelas/18 operações.** Sem migration, dependência ou endpoint novos. Nenhuma escrita remota. Não publicar com dados reais antes de homologar.

Sessão humana permanece somente em memória; reload exige novo login. Logout solicita escopo local e não invalida imediatamente um JWT já emitido. MFA/SSO/CAPTCHA, administração, anexos, clocks de SLA, dispatcher/entregas e dois conectores reais continuam pendentes.
