# Handoff — M1 validado em CI / 28-09-2026

Leia PROJECT_HELP_DESK.md, README.md, AGENTS.md e docs/04-ESTADO-E-EVIDENCIAS.md. Base94d8276; rodada07cbeef; branchcodex/m1-reproducibilidade. Código validado c7aa0aff9d33bd05f0248ac904ecbc834204f986, run36477734874. Commit de documentação/evidência é posterior e não altera fingerprint.

1045 aplicação,201 PostgreSQL17 (185RLS+16upgrade),71HTTP/browser passaram sem skips. Lock/ci/audit, typecheck/contratos/build e gate aprovados. Logs reais assinados apenas por hash local (não são atestação de plataforma), screenshots e histórico de falhas preservados. Revisão independente da rodada sem achados.

API/interface0.19.0, schema0.18.0,11migrations intactas; SDKNetlify6.0.0,pg8.16.3,Node>=22.16 <25. Não modificar SQL histórico.

Próximos passos:
1. Confirmar HEAD/branch e remoto, preservar mudanças concorrentes. Origin local ainda é bundle de recuperação; pushes usam URL GitHub explícita.
2. Verificar deploy Netlify após publicar evidências. Manter verify:release e não ligar HELPDESK_RELEASE_APPROVED sem homologação real.
3. Windows: oito falhas ambientais permanecem; usar Linux para suíte completa. EOL antigo do checkout difere de extração limpa. Relatório CI corresponde ao código Git limpo, não normalizar hashes artificialmente.
4. Completar Auth/M2M no destino, pooler/TLS, carga/restore e aprovação operacional antes de encerrar M1/M2. Provedor browser é sintético; PostgreSQL foi descartável no runner.
5. Push na branch e deploy neste site foram explicitamente autorizados pelo usuário nesta conversa. Migration remota/usuários/MFA/secrets/buckets/dados externos não foram autorizados e não foram alterados.

Último pacote completo antigo: bundle de M1 em07cbeef; a fonte mais recente é a branch GitHub e este handoff. Não recomeçar pelo ZIPv0.19.0 anterior.

## Resultado de publicação — 20:23 UTC

Deploy Netlify `6abacc45ec4ca0832ffe6aeb`: **ready**, contexto production, publicado 28/09/2026 às20:21:45UTC. Fonte enviada: extração limpa do commit `9ea9851e6e8d448654fcbb0a04caf950983bde74`, com código validado em c7aa0af. Upload via MCP; commit_ref remoto nulo é esperado nesse mecanismo. Build verify:release preservado.

Site: https://helpdesk-consultegeo.netlify.app
Logs: https://app.netlify.com/projects/helpdesk-consultegeo/deploys/6abacc45ec4ca0832ffe6aeb

Frontend200; Functionapi publicada em Node22; GET/v1/config retorna503/release_gate_closed. **DEPLOYADO, ainda não OPERACIONAL nem HOMOLOGADO para atendimento real.** Não houve ativação do gate de runtime, alteração de secrets/usuários ou migration remota. Evidências compactas e smoke em evidence/m1-ci-20260928/netlify-*.json. Próxima etapa exige ambiente e operações de backend explicitamente autorizados; não basta ligar a flag.

## Provisionamento autorizado — 28/09/2026, 20:49 UTC

O usuário autorizou explicitamente as11migrations e o vínculo ao workspace. Aplicadas no Supabase HelpDesk (xaelbntjnvztznnpcvtm), PostgreSQL17.6: schema0.18.0,25tabelas com ENABLE/FORCE RLS,11registros de migration. O MCP atribuiu novos timestamps de execução; os nomes preservam o identificador original. Mapeamento completo em evidence/m1-ci-20260928/supabase-provisioning.json. Não executar novamente com timestamps locais nem usar migration repair automaticamente.

Workspace Consulte GEO: e57d6844-f5df-4d82-a4cf-6c85b3be7c9e. Vínculo humano confirmado pela função resolve_human; papel agent, capabilities iniciais contexts:resolve/tickets:read,sem grants de contas. Não concede administração nem escrita. Usuário Auth existente preservado; nenhuma senha/MFA/secret alterada.

Advisors:14informativos de RLS sem policies em tabelas privadas deliberadamente fechadas; não adicionar policies públicas para silenciar. Um aviso Auth de proteção contra senhas vazadas desativada: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection — configuração não alterada nesta autorização.

Migrations históricas locais intactas; não houve mudança funcional de código. Asserções remotas de schema/RLS/vínculo aprovadas, mas não equivalem aos201testes descartáveis nem a login ponta a ponta. Backend Netlify/credenciais e release gate permanecem pendentes. A autorização desta rodada substitui somente a restrição histórica referente a aplicar migrations e cadastrar este vínculo.
