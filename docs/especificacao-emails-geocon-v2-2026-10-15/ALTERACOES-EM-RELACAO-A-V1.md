# Mudanças da especificação de e mails

Revisão de 15/10/2026 solicitada após o titular apresentar o broadcast do GEOCON e seu modal de entrega.

| Tema | Detalhamento anterior com referência GEOLAB | Especificação V2 |
|---|---|---|
| Referência de apresentação | Central com histórico, painel e detalhe individual | Lista de comunicações, modal de entrega por comunicação e detalhe por destinatário |
| Unidade da lista | Histórico de notificações ainda sem desenho fechado de agrupamento | Evento lógico de chamado e suas intenções autorizadas; tentativas não viram destinatários novos |
| Resumo visual | Indicadores e cobertura a detalhar | Quatro cartões fixos Saiu, Entregue, Aberto* e Clicou, com cobertura e denominadores explícitos |
| Entrega por destinatário | Linha do tempo e diagnóstico | Tabela no padrão da imagem com Destinatário, Status, Enviado, Entregue, Aberto* e Clicou; detalhe permanece |
| Interpretação | Abertura/clique não são leitura humana | Legenda de produto definida, sem garantia de inbox ou identidade humana e sem incluir ciência |
| Atualização | Referência GEOLAB com 60 s | Referência GEOCON de 15 s enquanto visível, sem sobreposição nem respostas de contexto antigo |
| Métricas | Não fabricar eventos nem totais de página | Fórmulas por intenção, independência dos sinais, cobertura por sinal e timestamps comprovados |
| Backend | Ampliar abertura/clique e consultar com autorização | Discriminante verificado de telemetria, persistência idempotente, projeção privada, contrato de cobertura e agregação autorizada |
| Mascaramento | Equipe recebe máscara no backend | Máscara uniforme proposta, sem busca arbitrária por e-mail completo; identificador opaco desambigua linhas |
| Referência técnica | GEOLAB inspecionado | GEOCON inspecionado em SHA fixado; pixel próprio dormente não vira exigência de infraestrutura |

## Decisões preservadas

- Monitoramento somente, com histórico, filtros, detalhes, fila, falhas e indicadores.
- Notificações de chamados para solicitantes e equipe, excluídos os e-mails de autenticação.
- Administradores Consulte GEO com endereço completo autorizado; equipe com máscara do servidor.
- Aberturas e cliques incluídos mediante ampliação real de eventos; início de coleta na implantação.
- Histórico sem evidência anterior fica indisponível; não foi selecionado backfill.
- Configuração centralizada; preferências individuais fora da primeira versão.
- Click tracking do provedor permanece habilitado; nenhuma alteração de configuração compartilhada foi feita.
- MEL-09 aprovada, sem correção ou comunicação em massa automática; outras 13 propostas seguem pendentes.
- Frontend nativo, fila única, schemas privados, segurança e adiamentos do MFA sensível/Novo GEO preservados.

As fórmulas, máscara, agrupamento, cadência e regras de interface são detalhamentos da especificação em resposta ao pedido atual. Não são novas respostas humanas às sete perguntas anteriores. Não há novo recurso operacional que dependa de uma autorização presumida.
