# Arquivos protegidos e manutenção de branches

O MCP tem uma política deliberadamente limitada. Negação de escrita deve produzir um encaminhamento técnico com responsável, sem contorno de nomes ou extensão de arquivo.

## SQL, dependências e configurações

São exemplos de trabalho do mantenedor: migrations/RLS/SQL, funções Netlify, scripts, dependências/lock, autenticação/permissões, workflows e instruções de agentes. Arquivos acima dos limites do MCP seguem o mesmo caminho ou uma sessão Claude Code autorizada.

A issue/handoff deve apontar o ID do produto, a revisão recebida, o contrato público e de persistência afetado, comportamento atual/esperado e testes necessários. O mantenedor implementa o recorte no fluxo externo e o submete à revisão pertinente. Uma proposta textual de contrato não é autorização para executar SQL; não salvar SQL disfarçado de outro arquivo para atravessar a política.

Quando o recorte depender de uma alteração administrativa, preferir integrar essa dependência primeiro e criar uma nova branch da base atual. O MCP atual cria a branch da padrão viva; não oferece seleção arbitrária de base ou PR empilhado. Coordenar dependências evita duplicar implementações.

## Base avançou ou há conflito

1. Parar a gravação baseada no HEAD antigo e registrar branch/SHA/operação.
2. O mantenedor compara base, branch e alterações concorrentes em checkout próprio. Não há resolução automática ou force push pelo MCP.
3. Incorporar a base ou resolver o conflito pelo processo Git aprovado, preservando autoria e conteúdo de terceiros; manter branch própria registrada quando aplicável.
4. O colega relê o HEAD e os arquivos afetados, revisa o lote e executa nova validação. A resolução de conflito é uma mudança que precisa de evidência nova.

## Resultado incerto

Timeout não prova ausência de commit ou PR. Consultar `consultar_operacao` com a chave original e grants atuais. O mantenedor confere o efeito existente e reconcilia o recibo. Não repetir o POST, abrir novo PR ou usar nova chave para a mesma intenção por conveniência.

## Integração e publicação

O revisor confere a fonte exata e seus checks. Novo commit invalida a aprovação anterior conforme as regras aplicadas. O mantenedor executa merge, publicação e migration/configuração apenas no escopo autorizado, registrando ambiente/recibo e aceite próprio. Regras configuradas no GitHub e isolamento no Netlify precisam de prova no provedor; este roteiro não ativa essas proteções.
