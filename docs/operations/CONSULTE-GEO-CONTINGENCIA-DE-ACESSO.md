# Contingência de acesso — preparação CG-02b

**08/10/2026 — runbook candidato.** Não substitui procedimento aprovado, não nomeia responsáveis e não autoriza acesso privilegiado, reset de MFA, restauração ou liberação de atendimento.

## Falha comum de login ou MFA

Confirmar mensagem e horário sem coletar credenciais, chave, QR ou link privado. Distinguir erro de senha/expiração, MFA solicitado, ausência de vínculo e indisponibilidade do Auth. Pedir nova autenticação no próprio provedor quando aplicável. Nunca orientar remoção de fator ou alteração de permissões para eliminar um 401/403/503.

Sem fator confirmado, o setup legítimo da própria conta permanece separado de ações administrativas. Com fator pendente, retomar somente o fluxo suportado; ele não concede AAL2. A solicitação de recuperação não confirma existência de conta nem entrega de e-mail. A recuperação privada não cria vínculo ou amplia scopes.

## Suspeita de comprometimento

Interromper ações sensíveis e registrar somente IDs técnicos não secretos, horário e estado do incidente. Encerrar sessão local; o encerramento global existente depende do provedor e não torna imediatamente inválido todo access token já emitido. Não afirmar revogação completa sem evidência. Uma ação de revogação de vínculo ou contenção deve ter autorização e trilha próprias; este documento não a executa.

## Perda de todos os fatores ou indisponibilidade de administrador

Manter a ação protegida negada. Não repetir bootstrap, não remover fatores por SQL, não promover o solicitante por e-mail e não compartilhar senha. Escalar ao responsável de segurança/identidade após ele ser formalmente designado. O procedimento de prova de identidade, recuperação de fator e sucessão precisa ser definido/aprovado antes do piloto. Enquanto faltar, registrar o bloqueio como pendência operacional, não como recuperação concluída.

## Indisponibilidade do provedor ou do banco

Manter negação segura e preservar rascunhos somente nos limites da sessão/audiência implementados. Não trocar automaticamente para demo, alterar projeto Supabase ou apontar a suíte SQL descartável à produção. Diagnóstico hospedado usa o site/projeto existentes e os runners oficiais; nunca criar credenciais ou recursos cloud para contornar uma falha.

Preflight e smoke sem credenciais verificam fronteiras técnicas, não autenticam um usuário real. Restore não deve ser executado sobre produção por impulso. Banco, objetos, configuração, segredos e outbox exigem procedimento próprio com aprovação e ensaio.

## Retomada

Registrar origem do incidente, escopo, autorização, ações efetivamente realizadas, evidências e limitações. Revalidar identidade/vínculos e os guards pertinentes; uma prova administrativa antiga não é reutilizável. Somente o escopo expressamente aceito pode ser reaberto. Ainda não há owner, prazo/SLO ou RPO/RTO aprovados neste documento.
