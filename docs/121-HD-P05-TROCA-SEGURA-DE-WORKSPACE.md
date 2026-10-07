# HD-P05 — troca segura de workspace

A seleção no login estava entregue, mas a interface não oferecia troca de operação depois da confirmação de `/me`. Esta fatia usa o encerramento local de sessão e a nova autenticação já existentes, sem transferir tokens ou escopos entre workspaces.

O botão **Trocar workspace** está disponível depois da validação do próprio perfil, inclusive com atendimento bloqueado. Um diálogo explica que os dados e rascunhos locais serão removidos. Cancelar preserva o contexto; confirmar encerra a sessão atual e exige nova entrada para escolher outra operação. O campo de UUID é limpo para permitir descoberta automática dos vínculos ativos.

Enquanto houver envio em andamento ou abertura de chamado sem confirmação, a troca é recusada. A confirmação revalida a geração e o contexto que abriram o diálogo. O encerramento usa `clearSession` e as fronteiras existentes de geração/epoch; respostas antigas não podem repovoar o novo contexto. Trocar não repete mutações nem revoga credenciais ou outras sessões do provedor.

Se o provedor não confirmar logout, a tela mantém o aviso explícito: os dados locais foram removidos, mas tokens emitidos podem continuar válidos até expirar. Não substituir esse aviso por sucesso fictício. Uma nova autenticação e `/me` continuam necessários para o workspace seguinte.

API/interface0.20.1; schema0.19.0,12 migrations,25 tabelas e19 operações permanecem. Nenhuma migration, grant, scope, cadastro, segredo ou MFA foi alterado. Gate de atendimento permanece fechado.

## Verificação e limites

O teste de navegador falhou antes da implementação pela ausência do botão de troca. Cenários cobrem cancelamento com rascunho preservado, limpeza e nova autenticação em outro workspace, logout não confirmado e recusa durante envio sem apagar o rascunho ou repetir o request. O provedor e as respostas API desses cenários são sintéticos; não representam aceite humano real de produção.

CI completo, revisão, merge e implantação serão registrados após execução. Esta entrega não comprova Auth/M2M reais, configuração do primeiro atendimento, capacidade ou restore e não encerra M1 ou a administração HD-P05.
