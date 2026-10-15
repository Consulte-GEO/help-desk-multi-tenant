# Revisão técnica — E06

**Natureza: autorrevisão focada, não revisão independente.**

| Achado | Impacto | Tratamento e prova |
|---|---|---|
| Processador espera indefinidamente um analisador que ignora cancelamento | Importante: chamador fica preso; liberar instância prematuramente permitiria sobreposição | Espera abortável + quarentena até settlement real. Dois regressivos falharam antes e passaram depois. Nenhuma escrita tardia. |
| Mapa de rótulos consultava propriedades herdadas | Menor no caminho validado; helper isolado podia falhar com entrada desconhecida | Consulta de propriedade própria. Casos `__proto__`/`toString` falharam antes, depois passaram. |
| Mensagem poderia afirmar ausência de cadastro sem prova da origem | Risco de comunicação incorreta | Texto limitado: a análise não confirma criação. Não infere o resultado de ações humanas paralelas. |
| Persistência sem execução PostgreSQL desde E02 | Bloqueador conhecido para operação | Mantido explícito. O runner recusou pré-requisitos; nenhum teste estático foi promovido a homologação de banco. |
| Contexto/público da nova consulta poderiam ser confundidos com autorização | Limite arquitetural | Parser confere escopo, mas autorização depende do servidor. Sem endpoint, rota ou público interno selecionável pelo browser. |
| Dados podem sobreviver em nós destacados ou respostas tardias | Risco de privacidade na troca de sessão | Limpeza usando helper canônico e cancelamento/epoch; verificado no Chromium DOM e em Node. |

## O que não foi alterado para obter aprovação

Nenhuma proteção do runner root, SQL, permissões, autenticação, prazo de transação, migration, gate, build ou ambiente de navegação foi desabilitada. Não foi implantado fallback de memória para produção. As fixtures em memória/DOM são apenas testes.

## Restrições preservadas

Apenas a ação piloto já definida (`geo.user.grant_work.v1`) gera proposta nesta apresentação. Pedido, proposta e efeitos não são um comprovante de execução. A visão do cliente não inclui respostas integrais, destino, hash do rascunho, configuração do agente ou referências internas. A interface não permite gravação, edição nem aprovação.

A janela de exibição é um limite local de retenção, não revogação instantânea. O host deve abortar o sinal ao revogar sessão/acesso ou trocar chamado/conta. Apenas o servidor pode decidir o público e a autorização de cada nova consulta. Dados retornados por autoridade sintética na fixture não comprovam a autorização hospedada.

## Foco da próxima revisão

Executar as provas nativas existentes sobre fixture isolada e cadeia completa do banco; qualificar todas as grants antes de conectar um endpoint de consulta; depois realizar fluxo HTTP/UI autenticado e inspeção independente. Não substituir esse trabalho por aumentar contagens de testes locais.
