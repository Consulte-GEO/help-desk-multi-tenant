# Contratos de acesso Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Execução no agente principal; revisão final independente somente leitura.

**Goal:** Qualificar o contrato das três rotas existentes de descoberta e sessão curta, sem alterar autoridade.

**Architecture:** Validador OpenAPI offline sobre respostas do handler core e adaptador de autenticação real com fontes sintéticas. Declarações limitadas de cabeçalhos e teto de catálogo, preservando o runtime.

**Tech Stack:** TypeScript/Node22, OpenAPI3.1.1, Ajv2020 existentes; Python somente no auxiliar de geração já existente.

**Spec:** `docs/implementation/CONTRATOS-ACESSO-2026-10-17.md`.

## Global Constraints

Sem mudança de login/MFA, grants, migration, dependência, capacidade, segredo ou dado produtivo. Gerador e JSON corrente devem concordar, sem reordenar o contrato integral. HD-002 permanece parcial; fontes sintéticas não são aceite Auth produtivo.

## Review Focus

Catálogo excedente nunca vira resultado parcial; sessão não vaza chave/hash/campos privados;204 não contém corpo;429/503 preservam prazo e correlação; erro do gate não copia valores inválidos. Cobrir cada condição em testes do recorte.

### Task 1: Contrato das rotas de acesso

Files: criar `tests/openapi-access-responses.test.ts`; modificar `scripts/response_headers_openapi.py` e `docs/openapi.json` somente no recorte. Reutilizar `scripts/openapi-response.ts`, `src/http/handler.ts` e `src/infrastructure/authentication.ts`.

- [x] Escrever cenários positivos/negativos da composição e mutantes de cabeçalhos/limite sobre respostas próprias; observar RED por lacuna real no contrato antes de alterá-lo.
- [x] Declarar cabeçalhos obrigatórios de privacidade/correlação e Retry-After nos status adequados; declarar50 opções no catálogo, preservando serializers e runtime.
- [x] Executar GREEN e regressões de contratos/sessões/descoberta, tipos, contratos formais, lock, segredos e build.
- [ ] Revisão independente final; corrigir achados com regressão quando aplicável.
- [ ] Commit/PR próprio, CI fonte/merge, relatório e seis logs originais por fingerprint, preview final conferido e handoff atualizado. Não inferir autorização de merge do novo PR a partir da autorização74/75.
