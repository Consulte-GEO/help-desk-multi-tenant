# Consulte Help Desk — v0.11.0 / revisão consolidada

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## Esta entrega
Revisão acumulada da arquitetura/código frente aos relatórios originais. Corrigidos IDs incompatíveis na autenticação/persistência, texto não persistível e ausência de revalidação do vínculo das mensagens/notas/eventos ao chamado autorizado. Novo filtro de equipe `assignment=mine|unassigned`, combinado com busca, situação e prioridade, sem conceder acesso por responsabilidade.

710 testes locais e32 verificações HTTP de memória passaram. **125 testes SQL e27 browser estão escritos, não homologados**. O registro de dependências continua inacessível nesta execução; sem lockfile/npm ci/audit. Não tratar typecheck global ou testes controlados como prova do runtime real.

## Navegação
[Revisão consolidada e matriz](docs/15-REVISAO-CONSOLIDADA.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [OpenAPI](docs/openapi.json).

## Executar somente a demonstração local
```bash
npm run check:migrations
npm test
npm run demo
```
Node utilizado22.16.0. Demonstração em loopback/memória com dados fictícios, sem envio de e-mail/webhook. `check:migrations` somente verifica arquivos. O manifesto é revisável, não assinatura ou prova de execução SQL.

## Homologação pendente
```bash
npm run deps:resolve
# Revisar o lock real, árvore, integridades, licenças e alertas.
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```
Docker padrão; native requer PostgreSQL17 instalado e usuário não root conforme documento10. Não há fallback remoto ou instalação automática. Rodar fresh e upgrade em bancos novos separados com fixtures. Autenticação/pooler/TLS/Functions e critérios operacionais continuam gates distintos do teste local.

## Compatibilidade
**API/interface0.11.0; schema0.9.0.** Oito migrations intactas,23 tabelas,18 operações/14 caminhos. Nenhuma migration nova. Não publicar apenas HTML como produto completo. Build é estático, não bundle Functions.

Sem push/merge/deploy/migrations remotas ou alterações de dados, segredos/MFA. GitHub retornou vazio, Supabase sem tabelas nos schemas consultados/sem migrations e Netlify manteve a página manual sem Functions. Reinspecionar destinos antes de qualquer integração para preservar trabalho concorrente.

M2/backoffice, filas/participantes, intakes, SLA operacional, anexos, dispatcher/e-mail/webhooks e sessões incorporadas não implementados. Histórico de chamados não é auditoria administrativa completa. Duas fixtures não comprovam dois conectores reais. Não usar dados reais antes de homologação/liberação explícitas.
