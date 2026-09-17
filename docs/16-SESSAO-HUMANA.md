# Help Desk v0.12.0 — sessão humana na interface

**Escopo:** HD-103/HD-105; continuação da lacuna documentada na revisão v0.11. Código local, não homologação Supabase/Netlify. API/interface 0.12.0, schema candidato0.9.0; nenhuma migration, alteração Auth ou MFA.

## 1. Problema anterior e mudança

A interface anterior usava o access_token recebido no login até falhar; descartava o refresh_token e a ação Sair só limpava a tela. Uma resposta atrasada de login também precisava de controle de geração próprio. Este incremento separa transporte, ciclo da identidade e envio de operações de negócio em três módulos. A API de backend não foi convertida em um proxy de senhas nem passou a decidir papéis pelos metadados do JWT.

`web/human-auth.js`: transporte limitado ao domínio HTTPS oficial configurado e aos três caminhos password, refresh_token e logout?scope=local; aceita somente chave publicável, não service/secret key.

`web/human-session.js`: estado privado em memória, geração da identidade, rotação compartilhada, pausa explícita, saída e descarte de respostas antigas.

`web/session-fetch.js`: obtém credencial válida antes de uma requisição /v1 no mesmo domínio e envia essa operação uma única vez. Headers de autorização/workspace são definidos pelo contexto, não sobrescritos pelo chamador.

## 2. Comportamento funcional

| Situação | Resultado |
|---|---|
| Login por senha | Captura e-mail/senha/workspace antes da espera; limpa o campo senha; valida resposta; só mostra atendimento após `/me`. |
| Credenciais repetidas durante login | Não inicia duas sessões: ação em andamento pode ser cancelada. |
| Token ainda válido | Usa a sessão existente. |
| Próximo da expiração | Renova sob demanda antes do próximo envio, até 60s antes; margem limitada à metade da validade restante recebida para evitar renovação imediata de tokens curtos. |
| Várias operações simultâneas | Compartilham uma rotação pendente. Cada operação de negócio continua independente e é enviada uma vez. |
| Falha transitória de renovação | Pausa novas requisições; preserva rascunho da identidade atual; requer Tentar renovar ou Sair. |
| Retomada manual | Renova a identidade; não repete chamado, mensagem ou alteração. O usuário revisa e confirma a operação. |
| Resposta incompatível/identidade recusada | Não instala os tokens; limpa a sessão local quando a rotação não é confiável. |
| 401 do token atual | Encerra o estado local, sem retry da operação. Um 401 atrasado de token já substituído não apaga o token novo. |
| Saída | Limpa tela/rascunhos imediatamente, solicita encerramento local ao provedor e informa confirmed/unconfirmed/not_requested conforme o resultado real do transporte. |
| Saída com login/rotação pendente | Aguarda essa única operação limitada; tenta encerrar o token mais recente recebido, sem reinstalá-lo. Falha é não confirmada. |
| Novo login antes da saída antiga terminar | A conclusão antiga não substitui nem apaga a nova identidade. |

A existência da sessão humana não comprova vínculo com o Help Desk. O backend continua validando identidade e resolvendo principal/grants atuais em suas requisições. `auth_user_id` e principal do Help Desk continuam IDs diferentes. A rotação não restaura uma associação revogada.

## 3. Limites de rede e dados

Transporte de identidade: teto de cinco segundos para fetch e leitura, corpo decodificado até 64 KiB, UTF-8/JSON estritos, expiração e tokens com formato/tamanho limitados. O timer cancela também a leitura pendente do corpo. Content-Length é comparado com bytes somente sem codificação de conteúdo: o navegador pode descomprimir gzip antes da leitura. Ambos os corpos comprimido declarado e decodificado continuam limitados; não há aceite de corpo ilimitado.

A resposta é projetada para access token, refresh token, expiração e ID de usuário. Claims/metadados de papéis não autorizam. Validação sintática de JWT no cliente **não verifica assinatura**; isso é responsabilidade do backend/provedor. URLs externas para o envio de chamados e redirects são recusados; as opções de fetch não enviam cookies nem referrer.

Tokens ficam somente na memória da página e não são escritos pelo módulo em localStorage, sessionStorage ou cookies. A senha só existe na chamada de login, não no snapshot do estado. O refresh token não é retornado pelo snapshot nem pela autorização destinada à API. Isso não é proteção contra um JavaScript comprometido na mesma origem; não substitui CSP/XSS nem controles do navegador.

Recarregar ou fechar a página perde essa memória e requer outro login. Não há promessa de logout remoto em close/crash. Não existe renovação contínua em aba ociosa nem comunicação/sincronização entre abas.

## 4. Saída no provedor NÃO é invalidação imediata de todo JWT

O pedido usa explicitamente `scope=local`, não global nem others. A intenção é encerrar apenas a sessão atual. O transporte só chama a saída de confirmada diante de HTTP 204.

**Limitação documentada pelo Supabase:** access tokens já emitidos podem continuar válidos até `exp` depois de revogar os refresh tokens. O backend deste incremento não possui nova denylist nem consulta adicional a `auth.sessions`. Assim, não alegar revogação instantânea de um bearer copiado. A janela e eventuais requisitos administrativos precisam ser definidos e homologados antes de produção. Vínculos de autorização continuam sendo consultados separadamente.

Se o provedor estiver indisponível, o usuário vê claramente que os dados locais foram removidos mas o encerramento remoto não foi confirmado. Requisições que já foram enviadas não são canceladas por esse logout. Um 503/erro de rede depois de uma mutação continua sendo resultado incerto: preservar Idempotency-Key e consultar o recurso. Uma falha de identidade **antes** do envio recebe `requestSent=false`, e os formulários de prioridade/atribuição informam que nada foi enviado.

## 5. Integração e regressões

`web/app.js` integra login/cancelar/Sair, aviso de pausa, retomada explícita e a fronteira API. `index.html` oferece status acessível e controles; `styles.css` usa os tokens de estilo existentes; build e demo servem os módulos. A demonstração continua usando identidades fictícias, não dispara Auth externo nem anuncia uma autenticação real.

Os 43 testes novos compreendem:23 de estado/API,15 de transporte e5 de loopback com **provedor sintético e resolução SQL controlada**. Os cinco HTTP novos estão incluídos nos 753 testes locais, não são testes Supabase. Verificam também a tradução AuthID→principal e a recusa por perda de vínculo após refresh. Um teste conserva propositalmente um JWT emitido após logout no provedor sintético para impedir a falsa promessa de revogação imediata.

A suíte DOM adicional possui5 verificações. Carrega o HTML/módulos reais por navegação normal, simula identidade por fetch injetado e respostas de API; não altera políticas do navegador nem CSP. Não é ensaio de CORS/TLS/Supabase. Tanto ela quanto a suíte DOM anterior bloquearam no page.goto nesta sessão. Não houve validação visual, foco, teclado, mobile ou integração DOM aprovada.

## 6. Fora deste incremento

Não há cadastro/convite administrativo, recuperação/troca de senha, MFA novo, SSO/PKCE/passkey, CAPTCHA, persistência de sessão, logout global, suporte incorporado, criação de pessoas, alterações de Auth settings ou permissões de banco. Fluxos e políticas de MFA/CAPTCHA que o ambiente exigir continuam sendo condições de homologação, não são desativados por este código. Tokens/credenciais M2M anteriores não foram alterados.

## 7. Fontes externas verificadas em 17/09/2026

- Supabase Signing out: `https://supabase.com/docs/guides/auth/signout` — escopo local/global/others e validade de access tokens após saída.
- Supabase User sessions: `https://supabase.com/docs/guides/auth/sessions` — rotação/uso de refresh tokens, expiração e implicações de relógios.
- Contrato oficial Auth: `https://raw.githubusercontent.com/supabase/auth/master/openapi.yaml` — token por password/refresh e logout204.

São referências de implementação, não evidência de que o projeto remoto responde da mesma forma. Nenhuma conta real foi usada. Antes da publicação, validar contrato instalado, política de sessão, expiração, relógios, erro do provedor, live grants, CSP/CORS e revogação real.
