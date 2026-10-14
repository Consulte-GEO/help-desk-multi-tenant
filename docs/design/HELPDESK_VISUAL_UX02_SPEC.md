# UX02 — caixa, filtros e conversa

Continuação aprovada pelo usuário após o plano UX01, em 13/10/2026.

## Objetivo e invariantes
Priorizar a conversa na identidade Consulte GEO, mantendo núcleo multi-produto/multi-contrato. Nenhuma mudança de API, Auth, scopes, SQL, gate, lógica de idempotência ou conteúdo dos rascunhos. Nenhum deploy nesta rodada.

## Desenho
Estado explícito e efêmero de apresentação em `web/inbox-view-state.js`. A ponte `web/inbox-workspace.js` recebe eventos de leitura do controlador existente. Não deduz autorização do estado visual; nunca faz fetch nem persiste identificadores. Carregamento via import dinâmico opcional, para falha do asset não impedir login/controle legado.

Até 1100px: lista e detalhe em vistas alternativas. Só uma escolha explícita abre detalhe móvel; seleção automática não navega. Botão Voltar cancela apenas intenção de navegação, preserva o carregamento e o rascunho do controlador. Resposta tardia não reabre detalhe. Foco/rolagem retornam à lista. Desktop mantém duas colunas. Refresh e mutação no mesmo chamado não roubam foco. Troca de identidade limpa navegação.

Busca e ações Aplicar/Limpar ficam visíveis. Situação, prioridade e responsabilidade ficam em disclosure nativo. Resumo utiliza somente filtros efetivos recebidos do controlador, não valores não enviados. Campo editado sem aplicar ganha mensagem própria. Acesso à responsabilidade continua controlado pelo atributo do controlador; não é liberado pelo disclosure.

Mudança de situação, atribuição e prioridade movem-se, como os MESMOS nós, para seção secundária depois do compositor. Não clonar/resetar forms ou handlers. Mensagens operacionais têm aviso descobrível e abrem a seção quando chegam; recolher nunca apaga rascunhos. Sem ações autorizadas, o grupo não aparece. Nota interna recebe aviso textual anterior ao campo, além do aviso já existente.

O texto de estágio deixa de confundir demonstração com produção. Não declara homologação nem prontidão operacional. A disponibilidade deriva do estado atual fornecido pelo app.

## Verificação
RED/GREEN do estado; browser real dos módulos e HTML com adaptador de dados fictícios (declarado, não E2E); regressão visual UX01; fixture do controlador real `detail` com respostas controladas como gate de integração ainda pendente; verificações do aplicador e preservação. G0 completo, PostgreSQL, Auth real, CSP e publicação continuam gates no checkout integral.
