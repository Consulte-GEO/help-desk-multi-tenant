# HDN-01c — revalidação das evidências antes de resolver

**Base remota:** `6e069005beaa12d7cb55c77af92478c21f7526ca`, com PR29/painel após login preservados.
**Entrada:** HDN-01a/b local, ZIP SHA256 `6adf9b483ae82d0ef4cb6c99da6c7b3a68ed43237a2d5912d787a90e79e62faa`.
**Requisitos:** RF-CEN-07 e RF-CEN-11, mantendo a especificação HDN-01b. Não cria outra função de produto.

## Problema e decisão

A leitura usada na resolução retornava apenas template/snapshot. A validação estrutural não demonstrava que as notas referenciadas ainda existiam ou correspondiam ao mesmo chamado e autor. O fluxo de marcação verificava a nota no momento da marcação; a resolução não repetia essa leitura.

Adicionar uma leitura privada qualificada específica para resolução. A leitura para edição e a recuperação histórica dos recibos permanecem separadas: falha de evidência deve impedir concluir, não impedir examinar o checklist para corrigi-lo. A resolução já confirmada não é desfeita se uma evidência ficar indisponível depois; o reenvio autorizado mantém seu recibo histórico e não resolve outra vez.

## Contrato

`assertChecklistResolutionEvidence(record: ChecklistRecord, raw: unknown): void`, em `src/domain/execution-checklist-mark.ts`, exige metadados de todas e somente as referências do snapshot. A função não é uma prova de origem por si só; o adapter recebe as linhas do banco sob a mesma transação.

`hdn_lock_execution_checklist_resolution(target uuid)` devolve `{record,evidence}`. Reutiliza `hdn_lock_execution_checklist`, preservando locks do ticket/template/vínculo/snapshot e autorização atual. Lê somente metadados de notas do mesmo workspace/conta/ticket, em ordem de UUID, com `FOR SHARE`. Recusa referência ausente e autor/data incompatíveis antes de devolver qualquer coleção parcial. O app nunca passa a lista de evidências ao novo helper; a lista vem do snapshot persistido.

`readExecutionChecklist` do adapter existente passa a usar esse helper, recusa envelope incompatível e ticket diferente e confere os metadados no domínio. Retorna apenas `{template,snapshot}`, mantendo a interface do workflow. Helper ausente não permite fallback à leitura antiga. A função nova entra na lista de revogação de PUBLIC/clientes e recebe EXECUTE apenas para `helpdesk_app`; não concede acesso direto às tabelas.

## Regras

- Evidência nesta fatia continua sendo `note:<UUID>` existente, não arquivo, URL ou auditoria GEO presumida.
- Cada referência corresponde ao autor de cada marcação que a utiliza, não ao operador atual da tela. Uma referência compartilhada é lida uma vez, mas conferida para todos os usos.
- A criação da nota não pode ser posterior à marcação. Comparações preservam microssegundos; representações equivalentes `.000Z` e `.000000Z` não são tratadas como diferentes.
- Nenhuma linha adicional, corpo de nota, flag `verified` ou metadado livre é aceito como evidência.
- Não altera status/SLA, não marca itens, não envia notificação, não executa ação no GEO, não publica template.
- Incompletude permanece distinta de corrupção/indisponibilidade. Um snapshot inexistente continua inexistente; não se fabrica checklist completo.
- Os limites herdados (100 itens, 20 referências/item, JSON limitado) permanecem. A coleção retornada não amplia os limites do parser; payload excessivo é recusado.
- Metadados e integridade referencial não certificam a verdade da declaração nem constituem prova criptográfica do corpo da nota. A imutabilidade e o controle de acesso das notas do core continuam necessários.

## Execução e limites

O PostgreSQL 17 local e acesso de rede para obtê-lo não estavam disponíveis. O conector GitHub expõe leitura/inspeção nesta sessão, sem ação de criação de commit/dispatch; não foi possível disparar novo CI com esta fonte. Não houve uso do Supabase de produção como laboratório nem alteração de segurança de rede.

Por esse bloqueio, o SQL continua candidato NÃO EXECUTADO. Este incremento fecha uma lacuna demonstrável do adapter/domínio e prepara a verificação SQL, mas não encerra T5b da HDN-01b. Não promover o candidato a migration nem montar a rota de resolução antes de executar os 19 cenários e a regressão completa no ambiente apropriado.
