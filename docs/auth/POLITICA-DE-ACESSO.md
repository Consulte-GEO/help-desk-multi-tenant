# Política de acesso — Help Desk Consulte GEO

**Estado:** preparação técnica CG-02b, 08/10/2026. As restrições explicitamente previstas no plano são preservadas; este documento não aprova responsáveis, alçadas, coorte, SLA, custos ou recuperação operacional. Não é autorização para abrir o atendimento.

## 1. Identidade, vínculo e capacidade são verificações diferentes

A equipe mantém Supabase Auth no projeto HelpDesk existente. O backend valida o bearer exato em `/auth/v1/user`, limita a resposta a 64 KiB, usa timeout de cinco segundos e recusa redirects. Em seguida, consulta o vínculo vivo no workspace pelos helpers privados. Scopes, papéis e contas vêm desse vínculo, nunca de e-mail, `user_metadata`, labels ou parâmetros do browser.

Workspace, conta, produto/instância, contrato/versão, tenant GEO e obra permanecem distintos. O conector Novo GEO e suas identidades externas dependem do contrato CG-01 e das entregas CG-03/05; esta política não inventa issuer, subject, endpoint ou identidade por e-mail.

Os scopes de Thiago continuam `contexts:resolve` e `tickets:read`. Papel admin e MFA não acrescentam `tickets:write`, `notes:read`, `notes:write` ou capabilities administrativas. Nenhuma mudança de grant, factor, configuração Auth ou release flag faz parte desta entrega.

## 2. Acesso comum e configuração da própria conta

O fluxo comum continua permitindo que uma pessoa sem fator confirmado entre conforme seus vínculos e configure o primeiro autenticador. Um fator pendente não comprova MFA. Havendo fator confirmado no catálogo vivo, o bearer validado precisa conter AAL2 válido e o mesmo subject confirmado pelo Auth. Catálogo malformado ou indisponibilidade não viram aprovação.

Configuração inicial, recuperação privada de senha e consulta da própria segurança não são gestão de usuários ou de permissões. Não impor a nova prova administrativa a esses caminhos e não bloquear o primeiro setup exigindo um fator que ainda não existe. Os requisitos do provedor para senha, confirmação e recuperação continuam preservados.

Fechar a configuração remove os dados de provisionamento da interface e zera o raster do QR pelo fluxo existente. Pode permanecer um fator pendente no provedor. Não remover fatores para satisfazer um teste. Não prometer apagamento físico da RAM, do histórico do sistema operacional ou de cópias feitas pelo usuário.

## 3. Ações administrativas: preparação obrigatória, não backoffice publicado

Foi preparado `createAuthentication(...).withAdministrativeAssurance(request, callback)` no backend. O método não tem rota HTTP nesta entrega. Ele exige, em sequência:

1. Bearer humano, recusando chaves e sessões M2M sem consultar seus vínculos.
2. Validação do bearer exato e fatores atuais pelo Auth; pelo menos um fator confirmado e AAL2 vigente associado ao mesmo subject. Sem fator ou somente fator pendente: negar.
3. Resolução viva do principal/workspace e papel admin. Metadata do token não promove um agente a administrador.
4. Prova `VerifiedAdministrativeAssurance` opaca, vinculada à instância exata do principal, ao snapshot dos seus campos e à validade da sessão durante o callback aguardado.

`assertAdministrativeAssurance(principal, proof)` recusa boolean, JSON fabricado, cópia da prova, outra instância de principal, mudança de campos e prova encerrada. A prova não contém token ou dados pessoais serializáveis. Expiração, relógio inválido/retrocedendo ou alteração observada do contexto invalidam permanentemente a prova; restaurar os valores não a ressuscita. O encerramento ocorre também quando o callback falha. Nenhuma operação é repetida automaticamente.

**Essa prova NÃO concede uma capability administrativa.** No CG-04, cada comando ainda precisa verificar sua capability explícita, revogação, recurso/conta/workspace, alçada e versão na própria transação, usando os guards/quotas/TLS/role já existentes. Ausência de grant equivale a nenhum acesso. Não aceitar um `verified: true` enviado pelo frontend.

O callback é um escopo interno de validação, não um lugar para ignorar autorização transacional. Não reter trabalho assíncrono depois de sua conclusão. O método reconsulta Auth e vínculos em cada invocação; não promete revogação distribuída instantânea de uma requisição já em andamento. Mudanças após a consulta exigem a revalidação do comando e da transação futura.

Nesta preparação o papel admin é uma condição adicional conservadora. Se CG-04 aprovar capabilities administrativas para outros papéis, a mudança requer revisão explícita; não ampliar a condição silenciosamente.

## 4. Chave e QR de provisionamento

A interface informa que chave e QR são secretos e permitem gerar códigos de acesso. O aviso antecede os dados e é associado ao canvas e à chave por `aria-describedby`. Não compartilhar, enviar em chamados, copiar para logs ou transmitir capturas de tela. A equipe de suporte não precisa desses dados.

Continuam proibidos QR remoto, segredo em URL, `data-secret`, localStorage, clipboard automático e uso de SVG/URI retornados pelo provedor sem o tratamento local existente. O aviso não substitui a limpeza do DOM/canvas; ela deve continuar passando na suíte humana de navegador.

## 5. Recusas e indisponibilidade

| Situação | Conduta |
|---|---|
| Bearer inválido/expirado | 401; nova autenticação legítima. |
| MFA insuficiente no fluxo comum | 403 `mfa_required`; não ampliar grants. |
| Assurance administrativa ausente/inválida | 403 `administrative_assurance_required`; nenhuma ação protegida. |
| Vínculo ausente | 403 `membership_required`; não inferir acesso por e-mail. |
| Auth indisponível, limitado ou resposta inválida | 503 `auth_unavailable`; sem fallback para demo ou identidade local. |
| Principal privado incompatível | 503 `invalid_principal`; corrigir origem, não reduzir validação. |

Mensagens, relatórios e logs não devem incluir bearer, chave TOTP, QR, senha, link de recuperação ou payload privado do provedor. Erros de relógio da prova administrativa são substituídos por recusa segura.

## 6. Contingência e decisões ainda pendentes

Perda de autenticador, comprometimento e ausência de administrador acessível seguem o runbook `../operations/CONSULTE-GEO-CONTINGENCIA-DE-ACESSO.md`. Não existe reset administrativo automático de MFA nesta entrega. Não cadastrar pessoa por e-mail informado, repetir bootstrap, adotar conta compartilhada ou desligar MFA/gates para recuperar acesso.

Ainda precisam de indicação e aceite: responsáveis por suporte/segurança/continuidade; procedimento e alçadas para comprovação de identidade e sucessão; recuperação real de fatores; canais/SMTP/domínios; tolerância de requisições em voo; backups/restauração/RPO/RTO; contrato Novo GEO e coorte. Até essas decisões, a operação correspondente continua pendente, não implicitamente aprovada.

## 7. Evidências e limites

O RED/GREEN local cobre o método real de autenticação com transporte Auth e SQL sintéticos, incluindo negações antes de consulta e callback. Isso não é homologação de Auth real ou de um futuro comando administrativo no PostgreSQL. Os testes integrais do commit devem vir do CI existente. A atualização de evidência canônica e revisão independente precedem integração; a liberação operacional depende dos demais CG aplicáveis.

Referência do requisito: plano de implantação fornecido pelo usuário, CG-02 e interface de CG-04. Referência técnica externa consultada: documentação oficial Supabase, `https://supabase.com/docs/guides/auth/auth-mfa`, seção Enforce rules for MFA logins; `https://supabase.com/docs/guides/auth/sessions`. A consulta a changelog.md não foi concluída pelo leitor web (tipo de conteúdo não aceito); não foi inferida compatibilidade de uma atualização de biblioteca. Nenhuma dependência foi atualizada.
