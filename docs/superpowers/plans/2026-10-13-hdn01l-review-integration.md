# Revisão e integração HDN-01l

> Execução autorizada pelo usuário: revisar, corrigir, compatibilizar, melhorar, fazer commit, merge e publicar sem revisão do Claude. Implementação nesta sessão; revisão independente somente leitura.

**Objetivo:** incorporar o cumulativo verificado à PR30 e publicar a fonte completa aprovada, mantendo os requisitos operacionais reais.

**Base:** principal `6e069005beaa12d7cb55c77af92478c21f7526ca`; PR30 `a5b23a9143ecc367444a28e9b71d561fd325611c`. Patch03 validado no checkout completo. 215 hashes internos verificados.

**Arquitetura:** preservar serviço, resolvedor e executor existentes. Checklist opcional; templates draft, SQL candidato e store de workflow pendente não equivalem a montagem operacional. Não inventar bindings, diretórios ou concessões.

- [x] Conferir estado remoto, integridade e baseline; aplicar apenas patch03.
- [ ] Corrigir fingerprint: `scripts/homologation-core.mjs` deve incluir `profiles`; regressão em `tests/m1b-homologation.test.ts` deve invalidar evidência após inclusão, edição ou remoção de template.
- [ ] Compatibilizar build: copiar somente JS/CSS de checklist e helper compartilhado; regressão real de whitelist em `tests/forms-build.test.ts`, sem expor drafts, SQL, documentos ou fixtures.
- [ ] Revisar módulos e corrigir achados demonstrados com testes negativos antes da mudança.
- [ ] Executar scripts originais e CI integral Linux/Node22/PostgreSQL17/Chromium, incluindo 31 cenários SQL HDN e browser novo, sem skips.
- [ ] Conferir artifact/digest/commit/fingerprint/logs; importar evidência canônica da mesma fonte, preservar gates.
- [ ] Atualizar estado, handoff e PR30; confirmar fonte remota antes de merge e verificar publicação técnica/recursos estáticos/fronteira operacional.

**Foco de revisão:** replay após revogação, prazos e recusa antes de COMMIT, validação de evidência privada, retenção no DOM, dependências de build/fingerprint. Falhas de plataforma local são registradas; não alteram requisitos dos testes.
