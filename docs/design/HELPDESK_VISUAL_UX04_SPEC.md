# Help Desk — UX03-C + UX04

## Objetivo
Concluir a apresentação do host opcional de abertura e padronizar portal, fila, detalhe público e relatório com a identidade Consulte GEO da UX01. Preservar a genericidade e todas as fronteiras de autorização.

## Decisões
- Sem nova rota, auto-mount, endpoint, permissionamento ou dependência. Módulos continuam opcionais.
- Preservar o state machine de intake e seu contrato. O host valida os campos antes de salvar/revisar e usa ações por etapa; inputs não são reconstruídos no ciclo de status.
- Confirmar continua ação explícita separada da revisão. Unknown oferece somente conciliação da mesma intenção. Rejeição explícita e indisponibilidade devem ser legíveis.
- Callbacks tardios não podem repovoar dados depois de clear/destroy. Eventos de alteração de lookup/linhas/colagem invalidam qualquer prévia do host.
- Portal/fila mantêm APIs render existentes. Contagens são servidor; zero é válido; null, tipo inválido, números negativos e métricas desconhecidas não viram zero.
- Detalhe usa projeção pública, não lê notas/histórico interno nem imprime objetos desconhecidos. Texteamento seguro com textContent.
- Reaproveitar tokens, 44px, bordas14px/cartões24px, layout320–1440 e contraste por tema. Sem fontes novas.
- Preservar foco por ação estável em rerender de lista; não montar UI privada apenas oculta.

## Fora do escopo
Integração de endpoints reais dos opcionais, filtros de servidor novos, gráficos fabricados, exportação/CSV, SSO, SLA, autorização e ativação operacional. G0 das ligações UX02/UX03 permanece dependente do checkout completo.
