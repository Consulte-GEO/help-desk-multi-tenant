# HD-P06 — Concluir recuperação com link direto do provedor

Entrega limitada à conclusão por link recebido do provedor, copiado antes de abri-lo. Não solicita e-mail, não altera SMTP/templates/redirects e não implementa callback automático ou PKCE nesta fatia. Link consumido/aberto pode exigir outro link. O botão só existe após composição válida do Auth e durante signed_out.

O parser aceita somente HTTPS/origin configurada, /auth/v1/verify, tipo recovery único e um token/token_hash limitado. Credenciais de URL, fragmentos, PKCE, outros tipos, caminhos, campos ou parâmetros duplicados são recusados antes de request. Redirect_to do link nunca é seguido nem transmitido. POST /verify envia apenas token_hash e type recovery; o serviço valida o token e sua política. Não tratar metadata da URL/JWT como autorização.

Credenciais retornadas passam pelo envelope limitado e higiene sub/exp da mesma identidade. Ficam somente no pending privado recovering_password, nunca em install(), proof(), workspace, discovery, /me ou estado observável. Todos os logins e pedidos de negócio ficam bloqueados durante esse contexto. Fatores confirmados exigem TOTP owned antes do PUT; outros tipos sem TOTP fecham recuperação, sem remover/resetar MFA ou ampliar scopes.

PUT /user envia apenas password com o bearer privado, valida mesmo user.id e respeita a política live. Ao enviar, qualquer resultado encerra o contexto e pede nova entrada. Timeout/resposta perdida é alteração desconhecida e nunca repetida automaticamente; recusa também exige novo contexto/link para nova tentativa. Senha/link/código limpos no despacho/fechamento. Logout usa o bearer mais novo após resultado tardio ou canal privado de cleanup; cancelamento segura nova entrada até a operação/logoff terminar.

Credenciais navegadas na URL não são adotadas; parâmetros/fragmentos reconhecidos são removidos da barra antes da inicialização do Auth e o usuário recebe orientação genérica. Isso não apaga registros de uma query que já chegou ao servidor. Não solicitar nem testar link real, OTP ou senha de ninguém nesta entrega.

## Decisões e custos

Somente link direto implícito, sem PKCE/callback/envio de e-mail: custa copiar o link antes de abri-lo e obter outro quando consumido. MFA é preservado e confirmado antes de nova senha; autenticador perdido exige contingência no provedor. Operação de senha enviada termina a recuperação mesmo em recusa; nova tentativa precisa de contexto novo. A alteração corretiva de texto mfa_enrollment_exists agora orienta ao botão Adicionar outro autenticador.

Referências primárias consultadas em08/10: [verifyOTP](https://supabase.com/docs/reference/javascript/auth-verifyotp), [resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [Auth verify](https://github.com/supabase/auth/blob/master/internal/api/verify.go) e [UserUpdate](https://github.com/supabase/auth/blob/master/internal/api/user.go). Fonte corrente tem recuperação/sessão especial e política de senha; não prova a versão/configuração real implantada. Recovery/magiclink podem compartilhar mecanismo de token no provedor; a aplicação aceita somente intenção recovery e continua sem conceder acesso operacional.

## Evidência e estado

Onze testes iniciais observados RED/GREEN; dois adicionais de cleanup/MFA tardio ampliam cobertura.15 novos passam;43 focais antes da última correção e65 focais aprovados na revisão independente. Important: bare token sem type não era removido da URL, reproduzido RED e corrigido GREEN; teste cobre query/fragmento. Minor registrado para continuidade: recusa de recovery_password ainda usa mensagem de troca normal citando senha atual; o contexto fecha corretamente sem envio repetido. Interface115/115 aprovada (35HTTP,39demo,41human), três novos cenários. Novo módulo incluído na whitelist exata de assets loopback depois de falha de loading observada. Tipos/contratos/lock/migrations/scan passaram; build local teve EPERM em dist e passou no retry, sem critérios alterados. Windows1644/1621/23 mantém as limitações conhecidas. Linux e publicação pendentes. Provedor sintético; nenhum e-mail/link/OTP/senha real enviado/verificado/alterado.

API/interface candidata0.24.0, schema0.19.0,12 migrations,25 tabelas e19 operações. Sem migration/API Help Desk nova. Atendimento fechado; pedido de e-mail, callback/PKCE, SMTP/recuperação/MFA reais e política administrativa permanecem pendentes. Não declarar HD-P06/M1 concluído por esta fatia.
