# HDN-01a — checklist de execução antes da resolução

## Intenção e base
O pedido de 12/10/2026 solicita comparar `Requisitos Help Desk.md` com o planejamento existente, elaborar um novo plano e continuar implementando. RF-CEN-07/RF-CEN-11/RF-PRJ-03 acrescentam a exigência de conferência de execução; ela não equivale a execução automática no GEO. Implementar agora o bloqueio na composição de workflow existente, sem criar outro handler ou relaxar ACL.
Base remota reconsultada: 6f7bc832d504ec1285d6125b68ab83be70c1f57f. A HDW-00/00b foi integrada pelo PR27 durante a execução. Não reaplicar seus arquivos locais antigos. O trabalho ocorre em recorte isolado; não afirmar clone, banco real ou CI integral.

## Contrato
`SupportWorkflowProfile.executionChecklist?: {id, version, sha256}` é uma referência fixada na versão do perfil. Ausência preserva a compatibilidade dos perfis antigos. Presença inválida não pode significar ausência. Apenas a operação `resolve` produz a exigência de checklist. Cancelamento, devolutiva e transferência não são bloqueados por pendência de execução; fechar consome a resolução já registrada. Montagem produtiva deve impedir bypass pelo handler genérico antigo.

Template publicado: schema 1, id opaco, versão positiva, status e lista limitada de itens com id/rótulo/obrigatoriedade/possibilidade explícita de não aplicação/exigência de evidência/risco ordinary ou sensitive. Rascunho não permite resolver. O digest fixa todo o template; alterar rótulo ou regra sem mudar digest é recusado.

Snapshot privado: workspace/conta/chamado/revisão do chamado/versão do perfil, referência do template, revisão do checklist e respostas por item. Resposta tem status pending/done/not_applicable, ator e instante quando realizada, referências opacas de evidência, motivo e reconhecimento de risco quando aplicável. Dados estruturais estritos; sem getters, campos extras, duplicatas ou arredondamento de microssegundos.

Todo item obrigatório deve estar concluído ou explicitamente dispensado por regra do template com motivo. Itens sensíveis são obrigatórios e não admitem dispensa e exigem evidência e reconhecimento explícito do mesmo executor, com instante não anterior à execução e não posterior ao instante do evento de resolução. O reconhecimento não concede autorização, não comprova auditoria GEO, não aprova engenharia e não substitui MFA ou aprovação institucional. Não são comandos de origem.

`SupportWorkflowTransaction.readExecutionChecklist?(ticketId)` entrega template/snapshot privados, com linhas retidas na mesma transação. Se o perfil exige e o adapter não implementa, negar. Antes de `commitDecision`, validar vínculo e completude. A auditoria recebe somente digest, revisões e contagens; recibo público, evento público e outbox permanecem sem checklist, motivos privados e referências de evidência. Persistência futura deve fazer CAS de ticket e checklist, auditar marcações e conferir o ator na escrita. Replays autorizados devolvem o recibo histórico sem refazer a execução.

## Entrega e exclusões
Incluir quatro templates de referência como drafts (usuário, traço, usina, laboratório), fora de seeds e sem publicação automática. Não impor 28 dias universalmente, mudar perfis GEO, enviar credenciais, instalar SQL ou liberar ações de risco. UI de marcação, endpoint, publicador de templates e store durável ficam nas próximas tarefas, explicitamente não implementados nesta fatia.

## Testes
Negativas de template ausente/draft/divergente, snapshot estrangeiro/antigo, item obrigatório/duplicado/desconhecido, dispensa sem regra/motivo, confirmação ausente/futura, hash alterado, fonte malformada e client fields tentando aprovação. Composição real do workflow/resolver/runner com driver controlado: zero commitDecision em recusa, rollback, auditoria mínima, replay, ACL revogada, perda do ACK sem duplicação. Testes antigos de workflow e HDW-00b mantidos.
