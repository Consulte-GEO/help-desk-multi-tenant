# Continuidade — Help Desk v0.16.0

Base `b3f70538370704489e01f12545ee578d6b28c84b`; branch `work/helpdesk-v0.16.0`. Hash final no manifesto/bundle. Nenhuma escrita remota. GitHub foi consultado e retornou vazio; Supabase e Netlify não foram reinspecionados. Reinspecionar todos os destinos antes de integrar, preservando trabalho concorrente.

Leia README, AGENTS, documentos 04 e20 e plano atualizado. R14-06 tem implementação candidata, não homologação PostgreSQL. R14-04/05 permanecem candidatos anteriores, sem nova liberação.

## Ordem de execução

1. Resolver dependências no registry autorizado: `npm run deps:resolve`. Revisar lock real/árvore/integridade/origens/licenças/alertas; executar npm ci, verify e audit. DNS voltou a falhar nesta rodada; não usar lock sintético ou typecheck global como substitutos.
2. Conferir `npm run check:migrations`: dez migrations, nove anteriores preservadas; schema0.16.0. Não recalcular hashes para encobrir alteração de histórico.
3. Executar `npm run test:db:local` em PostgreSQL17 novo/descartável com login restrito. Há179 cenários escritos,165 principais+14upgrade. Não usar Supabase real como fallback, apagar schema preexistente para passar ou alterar política de rede/navegador. Docker é padrão; native exige instalação autorizada e usuário não root.
4. Revisar migration010 integralmente: write_effects, xid8, FKs, índices únicos parciais, papéis, funções definer com search_path vazio, contexto, lock do pai, vínculo por evento e trigger diferido. Conferir que erro de SQL direto é recusado e que o UoW não anuncia sucesso quando COMMIT falha. Validar assinatura/tipos/policies/readiness com servidor real.
5. Executar upgrade001–007→008→009→010 no banco separado de testes. A tabela de efeitos deve nascer vazia; nenhum evento/recibo antigo é reescrito. Conferir atribuição, mensagem e reenvio posterior com snapshots preservados. Isso não substitui restore de backup.
6. Validar o protocolo de escrita: chamada/mensagem/nota/transição/prioridade/atribuição geram seus efeitos; mensagem vem antes de avançar versão; evento antes da outbox; no-op/replay não geram novos efeitos. Conferir reuso de evento de transação anterior, múltiplas operações e ROLLBACK TO SAVEPOINT. Notas/atribuições não podem gerar outbox externo.
7. Homologar Auth/M2M, perfis granulares, pooler/TLS/IP e Functions reais. API0.16 exige schema0.16; não publicar apenas o HTML. Medir custo dos novos registros/índices/locks e atualizar política de retenção e recuperação sem apagar mensagens.
8. Rodar interface35HTTP+35browser e rever os fluxos anteriores. O navegador bloqueou antes das asserções nesta rodada. Três testes novos de socket estão incluídos na suíte Node, não substituem DOM nem provedor real.
9. Rodar homologate:local/check:homologation: mínimos950/179/70 efetivamente aprovados, sem skips. Revisar logs/fingerprints; aprovação local não libera destino/capacidade/restore/produção. Manter HELPDESK_RELEASE_APPROVED fechado até decisão explícita.

## Revisão dirigida

- `src/domain/transaction-effects.ts`: modelo de referência por transação, sem histórico como substituto, pares exatos e sem orfandade.
- `src/infrastructure/memory.ts`: registrar somente novas escritas; validar antes de confirmar o clone; replay sem novos efeitos.
- `supabase/migrations/20260917001000_transaction_effects.sql`: cinco helpers privados e seis triggers; nenhuma policy de leitura ou setter HTTP.
- `database-security*.ts`: inventário25 tabelas/36 funções/18 triggers, incluindo quatro diferidos; índices de efeitos obrigatórios. Metadados não atestam semântica.
- `supabase/tests/rls.test.ts`:29 casos adicionais. Um teste antigo de prioridade passa a esperar o contrato já existente de resultado incerto do UoW após erro de COMMIT; rollback continua obrigatório.
- `supabase/tests/upgrade.test.ts`: quatro novos cenários, fonte histórica anterior mantida antes dos novos triggers.
- `tests/v016-*`, `evidence/v016/`:45 testes novos locais, fases de falha/correção, tentativas bloqueadas e revisão local.

## Invariantes e limites

Intenção não é entrega. Registro de efeitos não é autorização nem recibo idempotente. Nunca gerar/limpar/alterar o registro privado via API. Novo helper precisa ser homologado com o owner aprovado e o login real restrito. Não promover essa tabela a auditoria WORM ou certificação de registros anteriores. Não apagar o histórico para contornar falhas do upgrade. Auth/contas/MFA/segredos não foram alterados. M1 permanece aberto; M2, SLA operacional, anexos, dispatcher e conectores reais não foram entregues.
