# Inventário local de recuperação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conferir bytes e estrutura dos seis componentes de uma bancada privada com manifesto reproduzível.

**Architecture:** Adaptador de filesystem limitado gera linhas opacas para o digest existente. CLI explícita separa inventário, comparação e erro, sem efeitos sobre os dados ou produção.

**Tech Stack:** Node22+, TypeScript, filesystem/crypto nativos; sem dependência nova.

**Spec:** `docs/implementation/INVENTARIO-RECUPERACAO-2026-10-16.md`.

## Global Constraints

Somente leitura local; seis diretórios obrigatórios;10.000 entradas/256MiB/12 níveis/30s; stdout sem dados privados; formato fechado1; não autoriza restore/envio/acesso; PR70 separado; decisões adiadas preservadas.

## Review Focus

- Alteração de mesmo tamanho precisa afetar o hash, mesmo com nomes iguais.
- Diretórios vazios, nomes e remoções precisam participar do inventário.
- Links, aliases, arquivos especiais e alterações detectadas falham integralmente.
- Limites são globais e incluem o percurso, não somente o digest final.
- Erro de manifesto ou CLI não imprime entrada/caminho nem manifesto parcial.

## Tarefa1 — inventário real e CLI

**Files:** criar `src/infrastructure/recovery-files.ts`, `scripts/recovery-inventory.ts`, `tests/recovery-files.test.ts`, `tests/recovery-inventory-cli.test.ts`; modificar package.json e runbook.

**Interfaces:** `inventoryRecoveryFiles(root:string, options?:{maxEntries?:number,maxBytes?:number,timeoutMs?:number,signal?:AbortSignal}):Promise<RecoveryInventory>`; CLI `main(args?:string[]):Promise<number>` com flags `--root`, `--expected`, `--help`.

- [ ] Testes negativos/positivos com arquivos reais temporários; executar RED antes da implementação.
- [ ] Implementar leitura em blocos, identidade estável, limites, digest opaco e CLI fechada; executar GREEN.
- [ ] Documentar preparação/uso/saída/limites e teste de import sem efeito; repetir focais do planejador/composição, tipos/contratos/build/lock/secrets.
- [ ] Commit da fonte, draft PR independente de PR70, CI integral e revisão independente somente leitura.
- [ ] Preservar relatório/logs originais e qualificar preview; atualizar estado/documentação e deixar PR pronto, sem merge/publicação.

## Registro de execução

Ruling: execução direta neste chat, conforme pedido para continuar; aprovação final não é repetida para planejamento. A integração do novo PR continua separada da implementação autorizada.
