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
