# UX08 — Acesso, retorno e feedback de sessão
Objetivo: aplicar a identidade Consulte GEO aos estados de entrada/retorno e melhorar foco/feedback sem mudar autenticação ou ativar recursos avançados.
Base: cumulativo UX07; controlador principal 604478e. M02 avançou e deve ser reconciliada antes da publicação.

## Limites
Login simples permanece e-mail, senha, Entrar. Nenhum novo reset/MFA/troca de conta exposto. Não ler valores de senha para a apresentação. Transportes, autorização, cookies, tokens, storage de credenciais, nonce, state e permissões não são modificados. O tema continua a única preferência persistida.
Mensagens de falha de login simples são escolhidas por códigos conhecidos; nunca usar texto arbitrário do erro recebido. Mensagens de sessão preservam conteúdo do controlador e não comandam reenvios.
Foco só acompanha navegação que torna o controle anterior invisível; não saltar por atualização da sessão ou mensagem. Não modificar hidden/inert/disabled dos controles principais.
Callback: adaptar o mount existente sem importar esse módulo no app principal (sua importação limpa URL). Montagem e consumo do código continuam explícitos. Não criar rota nova. Código inválido/expirado/recusado: nova entrada na origem, não retry automático. Cancelar destrói o controlador e respostas tardias são descartadas. Após adoção de sessão, cancelar o retorno não substitui logout do portal.
Diálogos avançados: revisar CSS somente em fixture com dados fictícios. Nunca retirar hidden/inert do pacote final.

## Entregas
`access-feedback.js/.d.ts`: funções puras de mensagens/fases, sem leitura de erro livre.
`access-experience.js/.d.ts`: realce, mensagens por campo de validade nativa e retorno de foco, ciclo de vida descartável; bridge opcional no app.
`access-experience.css`: login, sessão, retorno e diálogos preservados em claro/escuro.
`geo-auth-callback.js/.d.ts`: mesma API de montagem e controlador original protegido.
Testes Node de mapeamento/ausência de segredo, regressões do controlador GEO, testes Chromium dos estados reais de apresentação com transportes fictícios. Aplicador cumulativo com checkpoints e hooks reversíveis.

## Critérios
Sem liberação de controles por estética. Sem senha/código/nonce/token em DOM auxiliar, logs ou URLs novas. Sem requests ao apenas montar; uma confirmação de callback por código. Erros locais não mudam validação Auth. Fontes de formulário móveis >=16 px; alvos >=44 px; reflow em 320/390/768/1024/1440 px. Clear/dispose deve remover rótulos e listeners próprios e não destruir atributos do host.
Referência de acessibilidade: W3C WCAG 2.2, Understanding SC4.1.3, consultada em13/10/2026: mudanças de estado devem ser anunciáveis sem receber foco. Não constitui certificação WCAG.
