# Integração R05 e revisão do checkout completo

Base dcf5607652281bb688f366e6a4f05e07eb698d31. Autorização direta em 15/10/2026 para corrigir, melhorar, commitar, mesclar e publicar sem Claude.

- [x] Conferir 285 hashes do pacote e aplicar cumulativo único em branch isolada.
- [x] Compatibilizar módulos TypeScript com Vue/Vite e lock reais; executar todos os gates legados e novos.
- [x] Corrigir vulnerabilidades de dependências com menor atualização compatível; repetir build e auditoria.
- [x] Revisão independente de integridade, persistência, recuperação e UI; teste negativo antes de cada correção.
- [x] Qualificar PG17 descartável, Vuex real, build vue-router e ensaios de navegador em CI Linux. Nenhum SKIP conta como aceite.
- [x] Registrar evidências e pendências; criar PR, mesclar após CI e verificar Netlify.

Manter módulos reais existentes, preservar originais e semântica/unidades, nunca simular sessão no produto, manter SQL como candidato até qualificação própria. Não registrar binding sem autoridade/backend/storage reais. Publicação técnica não é conclusão IMP-02.

Registro: typecheck integral reproduziu TS5097 e ES2020 sem Object.hasOwn. Correção: permitir imports .ts apenas no noEmit e biblioteca ES2022 suportada pelos navegadores atuais, preservando target existente. Audit inicial: seis vulnerabilidades (cinco altas). Vite 5 exige atualização para linha 6 corrigida; plugin-vue 5.2.4 suporta ambas. Esta manutenção de segurança substitui a referência histórica à linha Vite 5 no CLAUDE.md.

Resultado: PR13 integrado/publicado, evidência em IMPLEMENTATION-REPORT-V20-REVISAO-CODEX.md. A jornada autenticada completa com portas reais continua pendente, explicitamente fora da liberação técnica desta integração.
