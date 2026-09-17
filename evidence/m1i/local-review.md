# Revisão local — 0.10.0

Sem revisor independente/subagente. Revisão do contrato estático contra as oito migrations, diff do runtime, scripts/targets, limites de arquivo, testes e documentos.

## Pontos conferidos
- Nenhuma migration foi editada; schema continua0.9.0; nova versão da interface não força alteração DDL.
- A consulta de prontidão depende apenas de catálogo, não toca dados de negócio e não concede/revoga nada.
- Privilégio de coluna complementa o de tabela, conforme PostgreSQL17; contrato fixa assinaturas usando os nomes dos tipos do catálogo.
- Manifesto antes do driver e uso dos mesmos bytes; falha não gera reparo nem apaga caminhos.
- Testes de upgrade usam banco novo local e rejeitam existente. Runners passam os dois arquivos com concorrência1; papel do cluster permanece compartilhado como no ambiente descartável.
- A fixture conserva cache antigo sem assignedTo enquanto o ticket atual recebe null; teste exige replay original mesmo após atribuição.
- SQL de fixture teve colisão de nome detectada pelo TypeScript, corrigida por renomeação; ordenação JSON ganhou parênteses explícitos. Sem alegar execução PostgreSQL.
- Uma verificação agrupada foi interrompida pela ferramenta; reteste isolado foi concluído e evidência parcial foi preservada sem contar como aprovação.

## Restrições para revisão externa
Executar o SQL de catálogo, migrations e119cenários de fato; conferir owners/search_path, custos/plano, triggers, policies e grants no destino. Os metadados não atestam os corpos das funções, a expressão de CHECK/WHEN ou o predicado dos índices; não existe detecção contínua após inicialização. Manifesto não é assinatura. Nenhuma evidência local implica produção pronta.
