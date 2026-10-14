# UX05 — Administração Consulte GEO

## Escopo aprovado na continuidade da UX04
Adaptar membros, configurações genéricas e editor técnico de formulários à identidade existente. Trabalho local, sem push, deploy, migração, alterações de usuários ou ativação de recursos opcionais.

## Arquitetura
Primitivos de apresentação em `web/admin-ui.js` e estilos restritos a `.hd-admin`. Manter integralmente o controller de membros e o bloco do controller de configurações. Alterar somente mounts/render e a organização visual do editor; não alterar contratos de requisição e estados de gravação. UI de cada componente é filha do host, preservando suas classes e atributos.

## Decisões
- Membros: tabela única com leitura empilhada no celular; estados por texto e tom; identificar pessoas pelo ID recebido, sem nomes/e-mails fictícios. Dialog nativo, IDs únicos, feedback de validação no modal e retorno de foco.
- Configuração: oito tipos existentes, lista e edição separadas por dialog; campos relacionais permanecem IDs; situação contratual usa rótulos PT-BR e valores originais. Versão publicada não tem ação de edição. Motivo obrigatório; sem alteração na decisão do servidor ou recuperação de recusa.
- Editor: definição JSON, prévia, diferenças e confirmação em seções distintas. Seleção de operação reduz botões simultâneos. Prévia pública por padrão; prévia interna é apenas simulação no editor já autorizado. Preparar não envia; confirmar é ação separada. Resultado incerto permite somente conciliar a mesma intenção.
- Não persistir dados, não fornecer resolver ou endpoint inexistente, não chamar rede ao montar.
- Feedback claro, controles >=44px, teclado/Escape, claro/escuro/automático,320–1440px. Tokens herdados, sem fontes remotas.

## Limites a manter explícitos
O controller atual descarta o diálogo após recusa autoritativa; não prometer retenção de motivo nesse caso. O editor JSON continua técnico, sem construtor drag-and-drop. Somente cópia seletiva; suíte integral/PG/Auth/HTTP/CI/produção exigem G0.
