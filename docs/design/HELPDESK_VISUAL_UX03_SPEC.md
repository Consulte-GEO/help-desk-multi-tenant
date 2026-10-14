# UX03 — abertura guiada e formulários dinâmicos

Data: 13/10/2026. Continuação solicitada pelo usuário do plano UX02.

## Escopo
Abertura existente em create-dialog: contexto autorizado → relato → revisão. Os mesmos controles, handlers e política de cobertura continuam no controlador. A revisão de apresentação nunca é autorização, e nenhuma nova consulta/escrita de negócio é introduzida. Recuperar abertura conserva a intenção original. Módulo visual ausente mantém o fluxo legado.

Formulário dinâmico opcional: erros associados aos controles e resumo com foco; rótulos humanos para linhas; auxílio e limites; seleção Sim/Não com ausência explícita, mantendo boolean no payload. Condicionais e re-render estrutural preservam foco/caret quando o mesmo campo ainda existe. Parser, versão, limites, visibilidade de audiência e shape de snapshot preservados. Não montar campos internos no DOM do cliente, nem publicar novos módulos opcionais por consequência de tema.

## Decisões
Sem framework novo, sem bibliotecas de produto, sem alteração de API/banco/auth/gate. Não copiar fontes. Fechar o modal continua a política do controlador: novo pedido não enviado é descartado; intenção pendente se mantém na sessão. Não persistir respostas em localStorage/sessionStorage/URL. Re-render de condicionais pode recriar controles, mas deve restaurar foco e seleção; resolução assíncrona não toma foco que o usuário moveu para fora.

## Limites
G0 de checkout integral e homologação continua obrigatório antes de publicação. Bancada de apresentação não substitui E2E/Auth/PostgreSQL. Referência principal 604478e; UX01/UX02 ainda não observadas integradas remotamente nesta rodada.
