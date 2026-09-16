# Consulte Help Desk — v0.9.0 / responsabilidade pelo atendimento

Produto independente, multiproduto e multicontrato. **Entrega local; M1 aberto; não publicada.**

## O que muda
Operador humano autorizado pode **assumir para si um chamado desocupado** ou **liberar o próprio atendimento**. Administrador do workspace pode liberar o de outro atendente, inclusive após revogação do vínculo, mas não tomar silenciosamente um chamado ocupado. Motivo interno, versão e chave de reenvio são obrigatórios. Responsabilidade nunca concede acesso e não altera estado, prioridade, contrato, SLA ou fila.

Cliente, gestor de conta e M2M não podem executar a operação nem recebem o resumo de responsabilidade. O operador vê `unassigned`, `mine` ou `other`, sem identificadores de outros atendentes. O histórico é interno, sem outbox/e-mail/webhook para essa mudança. Não é diretório de equipe ou módulo de filas.

```http
POST /v1/tickets/{ticket_id}/assignments
Idempotency-Key: <chave estável>
If-Match: "7"
Content-Type: application/json

{"action":"claim","reason":"Assumindo a análise técnica"}
```

Também exige autenticação humana e workspace autorizado. `release` libera; não existe parâmetro de usuário destino. Exemplo completo em `examples/ticket-assignment.http`.

## Interface
Os controles “Assumir atendimento” e “Liberar atendimento” usam os flags fornecidos pela API. Rascunho separado de mensagem/prioridade; resposta atrasada não apaga edições novas nem muda outro chamado. Erro de versão ou disputa pede atualização explícita. Um reenvio incerto não troca automaticamente a chave. Indicadores também aparecem na lista da equipe, e eventos privados na seção Histórico. **A integração DOM foi codificada, mas não homologada em navegador nesta sessão.**

## Execução local
```bash
npm test
npm run demo
```
Node utilizado: 22.16.0. Demonstração somente em loopback, memória e dados fictícios. Não utiliza Supabase nem envia notificações.

**635 testes locais e 28 checks HTTP aprovados.** Os **100 cenários SQL e 25 checks browser são escritos, não aprovados**. Doubles SQL e estado puro da interface não equivalem a banco/navegador real.

## Homologação pendente
```bash
npm run deps:resolve
# Revisar lock/árvore/integridade/alertas; a resolução não concluiu neste ambiente.
npm run homologate:local
npm run check:homologation
```
Registry retornou EAI_AGAIN. Sem lock real, npm ci/audit; o verify padrão falhou por tipos locais ausentes. Checagem global suplementar passou, não substitui instalação. Docker/servidor ausentes; browser bloqueou na navegação. Nenhum fallback remoto ou política foi contornado. `npm run build` gera apenas assets, não Functions.

## Compatibilidade
API/interface e schema candidato **0.9.0**. Oito migrations, 23 tabelas, 18 operações/14 caminhos. A migration008 adiciona `tickets.assigned_to`, grant restrito, guards, evento privado e cache reautorizado. Sete migrations anteriores intactas. Runtime recusa schema0.8.0. Validar instalação nova e upgrade001–007→008 em PostgreSQL17 descartável com dados fictícios.

Sem push, merge, deploy, migrations remotas, dados, segredos ou MFA. **Não houve nova inspeção remota nesta rodada.** Reinspecionar os destinos antes de integrar e preservar trabalho concorrente.

[Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Responsabilidade](docs/13-M1H-RESPONSAVEL.md) · [OpenAPI](docs/openapi.json).

M2/backoffice, atribuição arbitrária, participantes/filas, intakes, SLA operacional, anexos, worker/e-mail/webhooks e sessões incorporadas continuam fora desta entrega. Não usar dados reais antes de homologação e liberação explícitas.
