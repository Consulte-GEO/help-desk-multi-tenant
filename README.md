# Consulte Help Desk — v0.8.0 / prioridade auditável e histórico

Help Desk independente, multiproduto e multicontrato. **Entrega local, M1 aberto, não publicada.**

## O que muda
A equipe autorizada pode alterar a prioridade de um chamado com motivo interno, versão esperada e chave de reenvio. Cliente, gestor da conta e M2M não podem reclassificá-la. O cliente vê a nova prioridade, não a justificativa. O comando não altera contrato, estado ou SLA; mesma prioridade mantém a versão. Encerrados/cancelados não recebem nova mudança.

A seção Histórico usa paginação real da API, carregamento sob demanda, eventos legíveis e controles para retry/atualizar. Razões internas só para operador. Rascunhos de resposta e prioridade são independentes; resultados tardios não apagam novas edições nem substituem outro chamado. Conflito 412 pede atualização explícita e revisão, sem reenvio automático com versão nova.

```http
PATCH /v1/tickets/{ticket_id}
Idempotency-Key: <chave estável>
If-Match: "7"
Content-Type: application/json

{"priority":"high","reason":"Reclassificação pela equipe"}
```

Também exige autenticação e workspace autorizado. Exemplo completo em examples/ticket-priority.http; contrato em docs/openapi.json. Preservados catálogo, busca e filtros, notas, sessões M2M e diagnósticos anteriores.

## Execução local
```bash
npm test
npm run demo
```
Node 22.16.0 utilizado. Demo somente loopback 127.0.0.1:4317, memória e dados fictícios; não utiliza Supabase nem envia notificações. `npm run test:ui:local` controla suas próprias demonstrações.

**569 testes locais e 22 checks HTTP aprovados.** Os 82 SQL e 22 browser estão escritos, não aprovados. Estado puro e HTTP não são homologação de navegador/banco.

## Gate pendente
```bash
npm run deps:resolve
# Revisar o lock real e a árvore instalada antes de continuar.
npm run homologate:local
npm run check:homologation
```
Registry falhou por DNS; não há lock/npm ci/audit. A verificação padrão falhou por tipos locais ausentes. Checagem global é apenas evidência suplementar. Docker/servidor faltam; navegador bloqueia antes das asserções. Nenhum bloqueio de política foi contornado.

Banco de testes: PostgreSQL 17 descartável, 82 cenários, login restrito. Runner Docker padrão ou native explicitamente selecionado com binários instalados e usuário não root. Jamais reutilizar banco remoto/real como fallback. `npm run build` gera somente frontend estático, não Functions.

## Compatibilidade
API e schema candidato **0.8.0**, sete migrations, 23 tabelas, 17 operações HTTP. Migration007 acrescenta permissões/guard/constraint e cache para prioridade; as seis anteriores estão intactas. Runtime recusa schema0.5.0. Homologar fresh install e upgrade, sem publicar somente HTML.

Sem push/merge/deploy/migrations remotas/dados/segredos/MFA. GitHub foi lido e retornou vazio; Supabase e Netlify não reinspecionados. Reinspecionar destinos antes de integrar e preservar trabalho concorrente.

[Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Prioridade/histórico](docs/12-M1G-PRIORIDADE-E-HISTORICO.md) · [OpenAPI](docs/openapi.json).

M2/backoffice, participantes/filas, intakes, SLA operacional, anexos, worker/e-mail/webhooks e sessões incorporadas continuam fora desta entrega. Não usar dados reais antes de homologação e liberação explícitas.
