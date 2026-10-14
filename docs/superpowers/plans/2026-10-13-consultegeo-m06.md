# Consulte GEO M06 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans inline; uma revisão independente final.

**Goal:** montar módulos Consulte GEO e tornar interações públicas persistidas pelo workflow legíveis com ACL e versão corretas.

**Architecture:** migration de projeção/diretório; adapters do PostgreSQL e serializer; composição de handlers reais por flags e portas qualificadas do servidor.

**Tech Stack:** Node22/TypeScript/pg existente, PostgreSQL17 próprio, Supabase CLI2.120.0 qualificada, Web Request/Response e Chromium existentes.

**Spec:** docs/superpowers/specs/2026-10-13-consultegeo-m06-design.md.

## Global Constraints

- Base a930874, PR31 draft/branch codex/consultegeo-m02/worktree existente.
- Schema0.21, API/interface0.28; CLI cria arquivo014; preservar013 e prefixo anterior/candidatos.
- Ledger privado sem SELECT novo, zero backfill/seed/segredo/grant humano/env remoto.
- Resolver/directory somente server ports; ausência recusa, sem fallback de autorização.
- Flags padrão false; gate/sinal sticky até COMMIT; origem HTTPS configurada.

## Review Focus

- Corpo de resolução atual não substitui o texto histórico; IDs/ordem/revisão devem preservar cada evento original.
- Pessoa sem scope/conta/produto/recurso completo não pode descobrir texto/nota/metadata por função privada.
- Defaults de migration não podem dar a projeção ao publicador/worker; prefixo M05 segue imutável.
- Falha/fechamento durante waits não confirma writes; confirmação conhecida depois do COMMIT permanece conhecida.
- Flags/capabilities não substituem Auth/MFA/capability ou qualificação da origem; nenhum caminho recusado chama fallback antigo.

### Task1 — projeção PostgreSQL e adapters

**Files:** nova migration CLI, supabase/migrations.manifest.json; src/infrastructure/postgres.ts e public-workflow-read.ts, src/http/serialization.ts; database-security-contract.ts; scripts/consultegeo-upgrade.ts; testes readers/serialization e cenários nativos.

**Interfaces:** `createPostgresPublicWorkflowReader(client, principal)` com messages/events paginados; `createPostgresTicketResourceDirectory(pool)` metadata bounded; PostgreSQL `hdn_public_messages(uuid,timestamptz,uuid,integer)`, `hdn_public_events(uuid,boolean,timestamptz,uuid,integer)`, `hdn_ticket_directory(uuid)`. UOW normal/emprestada usa os leitores, preservando interfaces Store/Page.

- [x] Escrever negativos de DTO/ACK/cursor/identity/privacidade e observar RED; criar arquivo CLI e baseline13, registrar nome no ledger.
- [x] Implementar helpers/projeção/adapters e versão/contrato, manter prefixoM05 verificado na extensão; observar GREEN focais/tipos.
- [x] Acrescentar/executar PG17: interações públicas por evento, legacy/dedupe/cursor/ACL/revogação/zero grants; commit.

### Task2 — handlers e runtime

**Files:** src/http/support-workflow.ts; src/infrastructure/consultegeo-runtime.ts, runtime.ts/runtime-config.ts; netlify/functions/api.mts; suporte-admissão em support-workflow/configuration; docs/openapi.json, src/version.ts/.env.example; testes HTTP/runtime/navegador.

**Interfaces:** `createSupportWorkflowHttpHandler(options)`; `createConsulteGeoRuntimeHandlers({pool,authentication,rateLimiter,origin,flags,source?})`; fontes server-only com resolver+directory; runtime dispatcher recebe handler antigo somente para suas rotas, novas rotas sempre possuem dono.

- [x] Escrever RED de flags/gate/portas/ETag/key/origin/MFA/admissão e confirmação incerta; implementar composição real sem pools/transações aninhados.
- [x] Publicar contrato OpenAPI/capabilities de API0.28 e verificar montagem no handler Netlify, tipos/contratos/build; commit.
- [x] Exercitar HTTP integrado e browser próprio, CI integral original sem skips; corrigir pela causa.

### Task3 — revisão e entrega

**Files:** docs/142-CONSULTEGEO-RUNTIME-M06-2026-10-13.md, AGENTS/README/handoff, evidence/consultegeo-m06 e homologation, pacote local.

- [x] Revisão independente do delta; corrigir Critical/Important com negativos comprovados.
- [x] Qualificar a fonte final, registrar limites/origem/promoção, atualizar PR31 e pacote com hashes.

## Ledger

Pré-flight: a930874 limpo; dois CIs finais M05 aprovados (38455865535/38455857086). Código qualificado febce83/fingerprint cffaa123c:4384/385/184, prefixo13 intacto. Usuário pede continuar, mantendo escolhas delegadas e execução nesta conversa. M06 concretiza a próxima etapa informada; não requer outra autorização do mesmo desenvolvimento. Sem inspeção/alteração hospedada nesta fase. Spec/plano da montagem backend; UI completa permanece M09/M10. CLI oficial e Chromium já disponíveis; PG17 é o runner Linux próprio.

Task1/2 em execução: RED leitores/serializer e HTTP/montagem registrado em .local/m06-*-red.log; 44 focais GREEN, tipos/contratos em atualização. CLI014=20261013195704; prefixo13 salvo v020.json. Ruling: quando módulo workflow está ativo, todas as rotas de ticket pertencem ao handler scoped (coleção/intake ainda fechados), evitando seleção de fallback por falha de origem. PostgreSQL17/CI continua obrigatório antes de concluir.

Progress: 86 focais +66 transações aprovados; browser HTTPS/Chromium8 verificações desktop/mobile aprovado com estado/Auth sintéticos. CI1 RED:4409/4410 app (contagem94→97), PG instalação recusou anon ausente (0/238, hook cancelou filhos). Corrigidos sem provisionar papéis; CI2 em execução. Identidade com toJSON RED→GREEN; captura segura antes do pool. Namespace de defaults/rights reservado permanece conferido antes do marker. Sem avanço de produção.

CI2:e5e7cd1/38464343896 app4412/4412; PG381/389. Causa: timestamp6 com últimos3zeros deixou de normalizar recibos3 (negativo RED local reproduzido), e cenário de resolução tentava checklist da revisão anterior após retorno/reabertura. Normalização sem perda via canonicalInstant e reconfirmação nativa por revisão; nenhuma regra de segurança relaxada. Smoke de release atualiza0.28. Workflow M06 HTTP composto nativo e ACL já passaram neste runner.

Revisão independente única sobrea930874..3eebb33:1Important(directory sem CG),1Minor(MFA503),nenhumCritical. Final Ruling: MFA reclassificadoImportant, pois503 impede o fluxo existente de step-up e sugere retry a uma recusa403 acionável; negativo reproduziu503vs403 e fixpreserva403/zeroefeitos. Final Ruling: directory passa a exigir escopo CG atual antes de metadata; refresh do M08 deverá preceder lookup por canal privado de publicação, custo: requests recusados até snapshot atualizado. As exclusões M08/jornadaM09M10/M11/piloto são limites aceitos do incremento, sem prontidão de produção inferida. Fix pass único em andamento; negativo nativo directory acrescentado antes do fixSQL.

Final fix pass: nativo RED a99b3e6/38468447046 reproduziu Missing expected rejection para directory incompleto (PG388/390; app4418/4418 eUI192/192). Agora guard CG atual é acrescentado antes da projeção metadata; mesmos negativos revogado/expirado/incompleto seguem no runner. Evidência RED bruta/hash em evidence/consultegeo-m06/regressions. Source privada/ownerADMIN confirmada e auto-review permitiu atualização restrita após checagem, sem alteração de destino ou produção.

Task1 complete: SQL014/projeções/adapters/prefixo13 e catálogo97 qualificados, mesmoSQLscopedwrite/COMMIT. Task2 complete: factories reais/admissão/contrato26/browserHTTPS8 e CI integral, contagens exatas4418+390+192=5000, semfalhas/skips, commit47bee4e/fingerprintd424f1a200192c10f081c503fa99214034c01e5edd3748b9043e97eea7d64a20. Task3 complete: revisão única/fix pass ambosImportant resolvidos (directoryREDnativo→GREEN; MFA REDlocal→GREENintegral), evidência importada/rawhashverificado, relatório142/PR31draft/empacotamento. Não há minors deferred após reclassificação/solução. Não houve merge/deploy/operador remoto.
