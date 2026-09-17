# Consulte Help Desk — v0.13.0 / ações por chamado

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega

Ações de cada chamado calculadas pelo servidor e interface em modo de consulta quando faltam escopos. Leitura/escrita de notas independentes; transições vêm da máquina de estados existente, não de uma cópia no frontend. Falha nas notas deixa a conversa pública disponível sem reutilizar itens privados antigos. Controle de rascunho preserva o canal durante atualização e nenhuma mutação é repetida.

**789 testes locais e35 checks HTTP aprovados.125 SQL e35 browser escritos, não homologados.** Sem lock real/npm ci/audit; verificação padrão falha nos tipos locais ausentes. Typecheck global é suplementar. Não houve publicação nem reinspeção remota.

## Documentação

[Ações por chamado](docs/17-ACOES-POR-CHAMADO.md) · [Sessão humana e limitações](docs/16-SESSAO-HUMANA.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Revisão acumulada v0.11](docs/15-REVISAO-CONSOLIDADA.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

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

**API/interface 0.13.0; schema esperado0.9.0;8 migrations/23 tabelas/18 operações.** Nenhum pacote adicional instalado, migration nova ou efeito remoto. Não publicar apenas HTML nem usar service_role/postgres/BYPASSRLS como runtime normal.
