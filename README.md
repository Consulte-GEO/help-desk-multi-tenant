# Consulte Help Desk — v0.12.0 / sessão humana

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega

A interface passa a manter access/refresh tokens somente em memória, renovar sob demanda, compartilhar rotações simultâneas, pausar novas requisições em falhas transitórias e solicitar saída da sessão atual no provedor. Login/refresh/logout atrasados não restauram identidade anterior. Rascunhos são preservados em pausa e removidos na saída. Nenhuma mutação é repetida automaticamente; recusa anterior ao envio é diferenciada de resultado incerto.

**753 testes locais e 32 checks HTTP existentes aprovados.** Os 5 novos testes de loopback com provedor sintético já estão incluídos nos 753. **125 casos SQL e 32 browser são escritos, não homologados.** Sem lock real/npm ci/audit por DNS do registry. Typecheck global suplementar não substitui as dependências do projeto.

## Documentação

[Sessão humana e limitações](docs/16-SESSAO-HUMANA.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Revisão acumulada v0.11](docs/15-REVISAO-CONSOLIDADA.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

## Executar a demonstração local

```bash
npm run check:migrations
npm test
npm run demo
```

Node utilizado 22.16.0. Demo em loopback com memória e dados fictícios, sem Auth externo/notificações. O catálogo, tickets, mensagens, notas, buscas/filtros, prioridade, responsabilidade e histórico anteriores foram preservados. A demonstração não comprova autenticação humana real.

## Homologação pendente

```bash
npm run deps:resolve
# Revisar lock real, árvore, integridades, licenças e alertas.
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Os runners recusam infraestrutura/configuração ausente, não trocam para o Supabase remoto nem criam aprovação por mocks. Homologação local não autoriza publicação, capacidade, residência/RPO/RTO ou restauração.

## Sessão: consequências para o usuário

Recarregar/fechar a página exige novo login. A saída usa scope local e informa se o provedor confirmou. **JWT emitido anteriormente pode continuar válido até expirar:** não foi criada revogação imediata adicional no backend. O projeto exige uma política de sessão homologada antes de produção. Não houve mudança de MFA, configuração Supabase ou senhas; fluxos MFA/SSO/CAPTCHA e recuperação administrativa continuam fora deste incremento.

**API/interface 0.12.0; schema esperado0.9.0;8 migrations/23 tabelas/18 operações.** Nenhum pacote adicional instalado, migration nova ou efeito remoto. Não publicar apenas HTML nem usar service_role/postgres/BYPASSRLS como runtime normal.
