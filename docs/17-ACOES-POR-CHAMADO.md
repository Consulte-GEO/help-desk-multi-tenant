# v0.13.0 — ações disponíveis por chamado

## Decisão e escopo

Recorte de HD-103/HD-105: o GET individual devolve orientações de operação calculadas pelo servidor para o principal atual e o mesmo snapshot de chamado/versão. A tela deixa de reconstruir a máquina de estados e de decidir escrita de notas somente pelo papel. Não muda regras de autorização, grants, estados, condições de reenvio ou banco.

O campo `available_actions` existe somente no GET individual: não em listagem nem em respostas idempotentes. Inclui referência e versão do chamado, resposta pública, leitura/escrita de notas, prioridade, assumir/liberar e destinos de transição com motivo obrigatório quando reabrir. Cliente/integração não recebem destinos administrativos. O campo é consultivo, não assinatura/autorização/reserva; cada comando existente revalida acesso/versão no servidor.

## Execução nesta rodada

- Reproduzir base v0.12.0 (753 testes locais).
- Escrever regressões do GET e da divergência entre perfil e scopes; ver falha antes de implementar.
- Derivar ações das funções de política/workflow existentes, sem segunda máquina de estados no frontend.
- Validar pacote de ações na UI e recusar ausente/malformado/divergente, sem fallback a permissões locais.
- Separar falha de leitura das notas da conversa pública; nunca reapresentar notas anteriores como resultado de nova consulta falha.
- Testar perfis de leitura, notas somente leitura/escrita, perfis mistos, terminal, reabertura, reenvio, acesso revogado e mensagens em chamado fechado sem reabrir implicitamente.
- Atualizar contrato, transporte de demo/assets, testes HTTP/navegador e documentação; executar verificações disponíveis e registrar bloqueios reais.

## Limites preservados

Resposta pública e nota continuam permitidas pelas mesmas regras anteriores, inclusive sem reabrir automaticamente um chamado resolvido/encerrado. A responsabilidade não concede acesso. Escopo `notes:write` não é reinterpretado como `notes:read`. Um administrador sem `tickets:write` não ganha escrita. O histórico interno continua com a política atual, separada de leitura do texto de notas.

Sem instalação via registry alternativo, sem política de rede/navegador alterada, sem testes no Supabase remoto e sem publicação. M1 continua condicionado a dependências reais/PostgreSQL/upgrade/runtime/navegador.

## Contrato e funcionamento

| Campo | Origem da disponibilidade |
|---|---|
| `reply` | Ticket legível e scope `tickets:write` |
| `read_notes` | Política de leitura interna: operador da conta e `notes:read` |
| `add_note` | Política de escrita interna: operador da conta e `notes:write` |
| `change_priority` | Operador, `tickets:write` e estado não encerrado/cancelado |
| `claim`, `release` | Mesmas regras de responsabilidade existentes: assumir para si; liberar próprio/admin; sem acesso novo |
| `transitions` | Destinos da máquina existente para agente/cliente e scope de escrita; motivo obrigatório em resolved→open |

`ticket_id` e `version` vinculam os hints ao GET, não são credencial. `If-Match` segue protegendo a versão nas operações existentes; uma revogação de scope pode ocorrer sem alterar o ETag. Por isso não persistir hints, não copiar para idempotência e nunca dispensar autorização do comando. O endpoint continua `Cache-Control: no-store`.

### Notas opcionais

A consulta do detalhe valida as ações antes de solicitar as páginas. Sem read_notes não é feita requisição de leitura de notas, inclusive quando o usuário só tem permissão de escrever nota. Se uma leitura antes oferecida falhar, o retorno composto tem notas vazias, flags de nota localmente reduzidas, aviso e opção de atualizar. Não apresenta o erro bruto nem notas de uma resposta anterior. O servidor continua decidindo o acesso real.

Falha pública não é opcional. Uma conversa pública ou GET inválidos mantêm o detalhe indisponível até correção/nova leitura. Não há mutação ou autenticação repetida automaticamente pelo loader. Em troca de identidade, respostas antigas não iniciam requisições adicionais nem se tornam o novo detalhe.

### Compatibilidade e privacidade

Frontend e backend0.13 devem ser homologados juntos. Clientes estritos atualizarão o schema de GET para TicketDetail. Listas, criação, prioridade, atribuição e transições permanecem Ticket; o cache anterior não precisa de migration. Não há IDs de outros operadores no novo campo nem motivos/dados de conversas. Os módulos são entregues no build estático e no demo, sem dependências novas.

### Fontes técnicas consultadas

As fontes orientam a decisão, não comprovam a implementação local:
- OWASP Authorization Cheat Sheet: validar permissões em cada requisição e negar por padrão. https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- RFC9110, seção13.1.1: If-Match/controle condicional; não é mecanismo de autorização. https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1

### Evidência e estado

789 testes locais/35 HTTP aprovados. 125 SQL e35 browser escritos, não aprovados. Estado e comandos exatos no documento04. Sem homologação de provedor, Postgres, Netlify ou produção. A checagem estática HTML/imports detectou IDs/assets ausentes na implementação inicial; a correção não foi chamada de teste DOM.
