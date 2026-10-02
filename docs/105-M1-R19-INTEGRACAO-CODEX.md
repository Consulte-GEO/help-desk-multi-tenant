# Integração R19 — 02/10/2026

Autorização atual do usuário: revisar, corrigir, fazer commit, merge e publicar, dispensando revisão do Claude. Não representa aceite operacional do M1.

Base GitHub e local: 78bbb00112331531168ae24600604cb7f3148770. ZIP SHA-256: 505294f6b457740a2c368ec3c5dfd4c7e07b837d992dff751ad65fa1eab3e2ab.

A inspeção before recusou file_mismatch em AGENTS, README, docs02, docs04 e docs05: a base documental do pacote não coincide com os registros publicados do R9. Os demais arquivos do patch passaram em git apply --check. Aplicado o patch excluindo somente esses cinco documentos; originais publicados arquivados byte a byte em docs/history/r9-published-20261002 antes da reconciliação com os documentos R19. Não houve sobrescrita do checkout original nem reescrita do histórico Git.

Inspeção after aprovada: 81 arquivos; fingerprint executável 66b19776e652a210ebc819e49dac7650bb27eae00c269b8c186ab55e90d84491. Onze migrations e lock preservados. npm ci --ignore-scripts aprovado; audit da instalação: zero vulnerabilidades. CI Linux executará a homologação completa da fonte commitada, pois Docker não está instalado neste Windows. Resultados posteriores serão registrados separadamente.

M1 permanece aberto até evidências de Auth/M2M hospedados, capacidade, restauração, governança e aceite. Release gate operacional não deve ser aberto apenas por CI aprovado. M2 não iniciado.

## Resultado verificado

CI Linux 37002422134, commit 1f94a0643c84db29a6b0c960e4e083809af81c4b: lock, instalação, audit, aplicação 1417/1417, PostgreSQL17 215/215 e interface 71/71 aprovados, zero skips/TODO/cancelamentos. Uma única execução b1859234-5751-4967-b7fa-70fea689b61d; logs e relatório baixados sem alteração. Fingerprint original confirmado. check:homologation local aprovado contra esses logs.

Windows Node24.20: 1392/1417, 25 falhas de premissas Linux, symlink EPERM, OpenSSL ausente e dois timeouts de CLI sob carga; comandos de CLI repetidos isoladamente passaram. Não se trata de aprovação Windows. Falhas preservadas em evidence/m1-r19-codex/windows-verify-failed.log.

Revisão independente por agente Codex: nenhum achado acionável confirmado; typecheck e 69 testes focados aprovados. Claude dispensado pela autorização atual.

Preview Netlify inicial 6abf99091ab7050008fab9ab falhou pelo gate da evidência histórica R9, antes de incorporar o relatório CI R19. Gate não foi removido ou enfraquecido.
