# Relatório local de reconciliação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Steps use checkbox syntax for tracking.

**Goal:** Disponibilizar relatório privado reproduzível dos planejadores de recuperação existentes.

**Architecture:** Um agregador puro valida os quatro arrays com os planejadores C15 e retorna somente contagens/hashes. Um CLI lê cópias locais limitadas pelo leitor existente e publica uma única saída após sucesso integral.

**Tech Stack:** TypeScript, Node22–24, node:test; nenhuma dependência nova.

**Spec:** `docs/implementation/RECONCILIACAO-RECUPERACAO-2026-10-17.md`.

## Global Constraints

- 2 MiB por arquivo, 1.000 elementos por array, quatro caminhos distintos e instante UTC explícito.
- Sem rede, banco, escrita, restore, reenvio, ativação ou mudanças dos planejadores existentes.
- Sem dados privados no stdout/stderr; exit0 não autoriza produção.
- Formato C12/C15, sem adaptação implícita do ledger nativo/Resend.
- Preservar MFA/Novo GEO adiados, scanner cancelado e ausência de modelos técnicos.

## Review Focus

- Entradas de papéis trocados ou export nativo: recusar tudo sem stdout parcial.
- Links físicos, aliases de diretório e caminho repetido: recusar antes de publicar.
- Confirmação atual e tombstone antigo: conservar regras existentes, sem autorização por inferência.
- Strings privadas válidas/invalidas: nenhum dado ou caminho no relatório/erro.
- Relatório vazio ou hashes iguais: flags continuam negando autoridade e liberação.

## Task 1 — Agregador e CLI, um contrato de relatório

Interfaces: `summarizeRecoveryReconciliation(backup,current,restored,tombstones,at)` recebe unknown e string; `main(args)` retorna Promise<number>. Saída fechada e congelada; leitor `readPrivateKnowledgeJson` sem alterações.

- [x] Escrever testes de agregado/privacidade/imutabilidade e CLI real (gramática, arquivos, links, falha atômica, limites, help/import).
- [x] Executar RED: falha por módulo/CLI ainda ausente, com asserção explícita da interface esperada.
- [x] Implementar `src/domain/recovery-reconciliation-report.ts`, `scripts/recovery-reconcile.ts` e script npm `recovery:reconcile`.
- [x] Executar GREEN e regressões dos planejadores/inventário/leitor; esperado zero falhas.
- [x] Documentar uso/limites no runbook; registrar publicação73 e provas finais preservadas.
- [x] Verificar tipos, contratos, lock, segredos e build; commit do código.
- [x] Revisão independente somente leitura; corrigir achados relevantes com RED/GREEN.
- [x] Publicar branch/PR de revisão, preservar CI integral fonte e merge e conferir prévia. Sem merge/publicação do novo recorte.
