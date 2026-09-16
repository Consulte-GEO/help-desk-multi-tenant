# v0.8.0 — Prioridade auditável e histórico na tela

## Recorte de desenvolvimento
Antecipação delimitada da operação HD-301, sobre o ticket existente; M1 permanece aberto e M2 não é declarado entregue. A base é d05f6f6f430dd624a7c550f81d81d895e858c156. Não escrever nos ambientes remotos.

## Decisões
PATCH /v1/tickets/{ticket_id} aceita exclusivamente priority e reason. Exige If-Match exato, Idempotency-Key e pessoa operadora da conta com tickets:read/tickets:write. Requester, gestor da conta e integração não reclassificam a prioridade. Prioridade igual é no-op autorizado/versionado, sem incremento, evento ou outbox; sua resposta pode ser reexecutada com a mesma chave. Chamados closed/cancelled não são reclassificados. Motivo obrigatório (1–2000 caracteres, sem controles ou surrogate isolado), exclusivo da equipe.

Mudança preserva estado, identidade e contrato; atualiza priority/version/updated_at, evento e outbox na mesma transação. Replay revalida também a condição de operador; revogação de papel não transforma cache em autorização. O evento público expõe somente from/to/version; não o motivo nem IDs internos. Outbox contém somente IDs/versão já previstos, sem motivo. Não recalcula SLA.

O histórico usa a API de timeline existente, com páginas de 50, carga sob demanda, limite 500 na tela, validação integral e geração por sessão/chamado. Não bloqueia conversa se falhar. Usar textContent. Detalhes desconhecidos não são renderizados como JSON. Cliente não recebe eventos internos. Uma nova consulta substitui apenas dados da mesma geração; mudança de contexto cancela a aplicabilidade, não promete cancelar requisição já em andamento.

## Execução
- [x] Testes de autorização, concorrência, replay, rollback, no-op e projeção antes do código.
- [x] Serviço, método de persistência exclusivo da prioridade e PATCH estrito.
- [x] Migration 007: grant de coluna, guard operador/terminal, evento/outbox obrigatório para mudança; seis anteriores intactas.
- [x] Estado puro testado, integração DOM codificada e erros explícitos; navegador/acessibilidade pendentes.
- [x] OpenAPI, capabilities, logs, testes SQL e smoke HTTP/navegador.
- [x] Verificações reais disponíveis; separar testes escritos dos executados e bloqueios do ambiente.

## Verificação externa utilizada
HTTP If-Match protege contra sobrescrita concorrente (RFC 9110, seção 13.1.1). PostgreSQL 17 oferece constraint triggers diferidos para verificar invariantes no fim da transação (documentação CREATE TRIGGER). Estas referências orientam o desenho, não comprovam o SQL desta entrega. A homologação PostgreSQL e do host segue obrigatória.

- [ ] Instalação limpa/auditoria de dependências, PostgreSQL real, browser, destino e critérios operacionais.
