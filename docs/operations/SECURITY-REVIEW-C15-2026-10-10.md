# C15 — revisão de segurança e estado observado

**10/10/2026, America/Sao_Paulo. Estado: revisão do autor, não parecer independente nem aceite de produção.**

## Fonte e observações reais

A base de código desta entrega é o pacote cumulativo C13/C14, SHA-256 `8256fc88a2af834d8b8c5cd1b3c6fdf2b931b3d71fb2450d4497b5a0fefd3f2e`, com 261 arquivos e 325 hashes internos conferidos. É um recorte, não um checkout completo. O PR26 foi consultado no GitHub e permanece draft em `f60baed8022b28e067a702b3dd51031e86983017`. A branch padrão permanece a base informada pelo PR; nenhum código remoto foi escrito nesta rodada.

O conector Supabase foi consultado para **advisors de segurança** do projeto HelpDesk `xaelbntjnvztznnpcvtm`. A resposta contém:

| Aviso | Nível | Observação e conduta |
|---|---|---|
| `auth_leaked_password_protection` | WARN | Proteção contra senhas vazadas desativada. Registro pendente de avaliação/configuração autorizada e teste de compatibilidade. Não foi ativada automaticamente. |
| `rls_enabled_no_policy` | INFO, 14 tabelas | Pode corresponder ao desenho privado com negação de acesso direto. Não equivale, sozinho, a exposição de dados, nem comprova segurança. Conferir privilégios, owners, helpers e RLS/FORCE no fluxo autorizado. |

Os 14 objetos informados: `helpdesk_audit.write_effects`; `helpdesk_auth.account_grants`, `human_scope_versions`, `integration_connections`, `integration_credentials`, `integration_sessions`, `principals`, `rate_limit_buckets`, `source_scope_bindings`, `workspace_memberships`; `helpdesk_core.product_instances`, `products`, `services`, `workspaces`.

O campo observado do advisor é `2026-10-11T00:07:44.245Z`, equivalente a 21:07:44.245 de 10/10/2026 em São Paulo. Isso não representa horário de homologação de todos os demais componentes.

A tentativa posterior de SELECT somente de metadados para verificar flags do papel, schema e RLS foi **bloqueada pela ferramenta**. Não produziu resultado SQL. Não foi repetida, alterada para escapar do bloqueio ou encaminhada a outro conector. Não houve DDL, leitura de credenciais ou mudança de configuração. A leitura de advisors não substitui essa inspeção pendente.

Referências de remediação fornecidas pelo próprio advisor:
- [Proteção de senha](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- [RLS habilitada sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Controles implementados e escopo da prova

O manifesto fechado vincula fonte, fingerprint, API/schema, configuração, provedores, destino, geração de recuperação, políticas e coortes. Um avaliador estrutural aponta evidência ausente/vencida/estrangeira/inconclusiva, sem conceder operação. O verificador Ed25519 recebe somente chaves públicas previamente configuradas, não chaves ou URLs do JSON do solicitante. Há provas opacas locais e checagem de revogação/expiração em cada uso.

**Assinatura prova a proveniência do atestado, não a verdade do teste declarado.** A autoridade emissora deve comprovar artefatos originais, execução real, revisores e aceites. Não há endpoint emissor, chave privada operacional ou certificado de produção nesta entrega. Os signatários e chaves dos testes são sintéticos. A política de signatários, custódia, rotação e segregação deve ser aprovada antes de montar esse mecanismo.

A composição do piloto é adicional à autorização de recursos existente. Compara dimensões persistidas do chamado, exige uma única linha completa da coorte e valida a prova durante a transação. O leitor SQL de root/piloto deve bloquear suas linhas até o COMMIT; não existe adapter PostgreSQL implementado nesta rodada. Não prometer atomicidade real a partir do modelo de teste.

## Achados corrigidos durante a revisão local

Recibos de recuperação com mesma revisão e conteúdo divergente agora conflitam. Chaves de intenção repetidas sob IDs diferentes na união de backup/ledger não são aceitas. Estados de piloto datados no futuro não ativam atendimento. Recibo administrativo não pode anunciar aceitação para uma preparação. Dimensões privadas de categoria/chamado precisam coincidir com a operação, sem depender de metadados livres do chamador. Pacotes exigem também evidências dos gates de anexos, aprovações e entrega, conforme dependências CG07/11/12.

As reproduções foram locais com módulos reais e componentes externos controlados. Não demonstram incidente ocorrido na produção.

## Pendências de segurança

Inspeção de privilégios efetivos, patch/migration integrado, atualização do banco, sessão/OIDC/SSO reais, scanners, fornecedores, fronteiras HTTP antigas, CSP/browser, custódia de chave, retenção e revisão independente continuam sem novo aceite. Nenhum INFO/WARN foi suprimido para aprovar o ciclo. Nenhum fator MFA, scope de Thiago ou global release flag foi alterado.
