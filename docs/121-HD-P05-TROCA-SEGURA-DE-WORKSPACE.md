# HD-P05 — troca segura de workspace

A seleção no login estava entregue, mas a interface não oferecia troca de operação depois da confirmação de `/me`. Esta fatia usa o encerramento local de sessão e a nova autenticação já existentes, sem transferir tokens ou escopos entre workspaces.

O botão **Trocar workspace** está disponível depois da validação do próprio perfil, inclusive com atendimento bloqueado. Um diálogo explica que os dados e rascunhos locais serão removidos. Cancelar preserva o contexto; confirmar encerra a sessão atual e exige nova entrada para escolher outra operação. O campo de UUID é limpo para permitir descoberta automática dos vínculos ativos.

Enquanto houver envio em andamento ou abertura de chamado sem confirmação, a troca é recusada. A confirmação revalida a geração e o contexto que abriram o diálogo. O encerramento usa `clearSession` e as fronteiras existentes de geração/epoch; respostas antigas não podem repovoar o novo contexto. Trocar não repete mutações nem revoga credenciais ou outras sessões do provedor.

Se o provedor não confirmar logout, a tela mantém o aviso explícito: os dados locais foram removidos, mas tokens emitidos podem continuar válidos até expirar. Não substituir esse aviso por sucesso fictício. Uma nova autenticação e `/me` continuam necessários para o workspace seguinte.

API/interface0.20.1; schema0.19.0,12 migrations,25 tabelas e19 operações permanecem. Nenhuma migration, grant, scope, cadastro, segredo ou MFA foi alterado. Gate de atendimento permanece fechado.

## Verificação e limites

O teste de navegador falhou antes da implementação pela ausência do botão de troca. Cenários cobrem cancelamento com rascunho preservado, limpeza e nova autenticação em outro workspace, logout não confirmado e recusa durante envio sem apagar o rascunho ou repetir o request. O provedor e as respostas API desses cenários são sintéticos; não representam aceite humano real de produção.

Revisão independente encontrou motivo de transição e textos antigos remanescentes no DOM. A regressão reproduziu o problema antes da correção; `clearSession` agora zera esses campos, opções de transição, contagens/filtros e o aviso/timer antigo. A revisão final não encontrou novos achados. Os15 cenários de sessão humana no navegador passaram localmente.

CI Linux [37634260762](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37634260762) aprovado: 1.536/1.536 aplicação,229/229 PostgreSQL e89/89 interface, zero falhas/skips. Lock, instalação limpa, audit, typecheck, contratos, migrations e build passaram. Artefato11486814781, SHA256 `52b66fbb4807bda5c4dd1161dcc1ce49585183c6dca6909feeb64a8d5145c33c`; source CI `ce318853f63d4e4ae89952abd810a48270c2d7e5`, fingerprint `36d8310c9f5d65fe272c387e7422b3eac60db4f922ff0e8714686e637a134774`. Logs íntegros em `evidence/workspace-change/ci-green`, evidência canônica conferida contra a fonte atual.

Windows:23 falhas de plataforma já conhecidas e um timeout adicional de subprocesso na suíte geral. O grupo dos dez casos de caminho inseguro passou na reexecução isolada, sem alterar timeout/teste. A aprovação integral é a do CI Linux, não da suíte Windows.

Merge e implantação serão registrados após execução. Esta entrega não comprova Auth/M2M reais, configuração do primeiro atendimento, capacidade ou restore e não encerra M1 ou a administração HD-P05.
