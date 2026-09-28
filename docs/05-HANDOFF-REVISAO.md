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
