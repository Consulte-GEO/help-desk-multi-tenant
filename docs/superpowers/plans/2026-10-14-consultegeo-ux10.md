# Consulte GEO UX10 — plano de integração

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** integrar a apresentação UX01–UX10 sobre a M09c qualificada, revisar a composição e avançar o consumo autorizado da jornada.
**Architecture:** componentes e transporte atuais, delta visual conferido por hash e hosts explícitos; writers/flags/migrations preservados.
**Tech Stack:** JavaScript/TypeScript estrito, Node22, Playwright Chromium, PostgreSQL17 na CI original.
**Spec:** docs/superpowers/specs/2026-10-14-consultegeo-ux10-design.md.

## Global Constraints
API0.30/schema0.23 e16 migrations preservados. Nenhuma fixture emdist, whitelist recalculada, migração remota, grant/segredo ou email real. Não copiar reference-only. Atendimento fechado até portas/aceite próprios.

## Review Focus
Intenção ambígua durante navegação; conteúdo privado residual após saída; callback assíncrono recebido por contexto novo; foco/teclado e temas emmobile; assets/build/CSP e contrato operacional ausentes apesar de bancada verde.

### Task 1: reconciliação e integração visual
Files: web/ e scripts/tests/docs autorizados pelo manifesto; app com24 transformações; evidence/consultegeo-ux10/preflight.json.
Interfaces: callbacks DynamicFormOptions.onChange(answers) versus IntakeUiOptions.onChange(snapshot); mountConsulteGeoRequest e configuração preservados.
- [x] Executar verificador upstream sem escrita e auditoria de hashes; esperado recusa dos três metadados evoluídos, bases visuais iguais.
- [x] Instalar apenas tests/ux10-compatibility.test.ts e executar RED contra a base operacional.
- [x] Portar payloads133/app integral com confirmação de bases/receita, preservando contratos; executar GREEN de UX e módulos operacionais.
- [x] Executar typecheck/build/contracts/secrets/integration:check/assets originais; corrigir erros reais sem retirar asserções; commit.

### Task 2: composição e continuação da jornada autorizada
Files: host corrente e componente/adapter consultegeo; testes browser/HTTP originais e UX fornecidos. Escolher entrada compatível após ler os contratos atuais.
Interfaces: createSessionFetch(path sem/v1), catálogo com context/configurations autorizados, draft revision/TTL e recibo17campos M09c.
- [x] Conferir todas as bancadas globais e visuais no checkout integral; esperado nenhum erro ou falsa montagem.
- [x] Exercitar primeira jornada com adaptadores atuais e backend de teste autorizado; retomada/contexto tardio/replay/descarte têm testes negativos antes de novos hooks.
- [x] Se contexto da origem não existir no host, manter recusa e registrar dependência; não usar vínculos fictícios no produto. Corrigir somente lacunas demonstradas da composição autorizada.
- [x] Executar testes relevantes e commit da composição.

### Task 3: qualificação/revisão/entrega e plano
Files: relatório146, requisitos UX10, evidência canônica, ledger e ZIP cumulativo.
Interfaces: fonte/fingerprint novo versus seis logs/inventário PG17; única revisão final por contexto independente.
- [x] CI original completa, PG17/upgrade/prefixos e interface; conservar todo diagnóstico de falha.
- [x] Revisão única e fix pass RED/GREEN, suíte completa aprovada; registrar todos rulings/custos/minors.
- [ ] Atualizar PR31 draft, evidência, plano com capacidades e dependências exatas, pacote verificado. Preservar worktree; arquivar/deletar só scratch desta execução.
