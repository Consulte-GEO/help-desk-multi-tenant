# Consulte GEO M05 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: usar superpowers:executing-plans nesta conversa; TDD por tarefa, uma revisão independente final.

**Goal:** upgrade transacional, íntegro e homologado do schema Consulte GEO 0.19.0 para 0.20.0.

**Architecture:** migration única criada pela CLI e compilada dos seis candidatos com receita de origem; contrato estático de catálogo e papéis estendido; cenários nativos exercitam a migration promovida.

**Tech Stack:** Node22/TypeScript, pg existente, PostgreSQL17 descartável, Supabase CLI2.120.0 oficial com checksum verificado. Nenhuma dependência nova no produto.

**Spec:** docs/superpowers/specs/2026-10-13-consultegeo-m05-design.md.

## Global Constraints

- Base392fdd2, branch codex/consultegeo-m02, PR31 draft e worktree existente.
- Preservar doze migrations/candidatos byte a byte; adicionar a migration criada pela CLI em supabase/migrations.
- Schema0.20.0, API/interface0.27.0; sem runtime novo, hosted, segredos, grant a pessoas ou envio real.
- Seis componentes na ordem scope → observation → publication → checklist → workflow → configuration.
- Tudo transacional; zero dados iniciais de negócio, rollback em falha; worker reservado sem operações de entrega.

## Review Focus

- Instalação parcial ou concorrente deve recusar/serializar, sem mudar marcador antecipadamente.
- Papel existente inseguro deve recusar; papel seguro existente conserva LOGIN/credencial.
- Dados antigos e ACL/scopes devem permanecer exatos após upgrade, inclusive recibos históricos.
- Readiness deve rejeitar permissões por coluna/role/helper e drift de objetos, sem auto-reparo.
- Fonte de candidato alterada não pode gerar evidência válida para a migration antiga.

### Task 1 — receita e migration

**Files:** scripts/consultegeo-upgrade.ts, tests/consultegeo-upgrade.test.ts, supabase/consultegeo-upgrade.manifest.json, supabase/migrations.manifest.json, nova migration da CLI.

**Interfaces:** `compileConsulteGeoUpgrade(components: readonly {file:string;sha256:string;sql:string}[]): string`; `verifyConsulteGeoUpgrade(root:string): Promise<{schemaVersion:string;file:string;sha256:string}>`. Recebem somente arquivos locais qualificados e retornam SQL/recibo, sem executar SQL ou auto-reparar.

- [x] Escrever negativos/positivo do compiler/verifier: seis componentes completos e ordenados, guard exato, hash/arquivo adulterado, prefixo12, versão013 e SQL esperado; observar RED.
- [x] Gerar o arquivo vazio com CLI migration new consultegeo_m05_upgrade; registrar nome exato no ledger. Implementar transformação fechada, prólogo/epílogo transacional e receita; preencher arquivo/manifest e observar GREEN.
- [x] Conferir check:migrations, tipos e diffs/hashes; commit.

### Task 2 — readiness e homologação nativa

**Files:** src/infrastructure/database-security-contract.ts, database-security.ts, postgres.ts, portal-read-store.ts; tests/m1i-readiness.test.ts e fixtures pertinentes; supabase/tests/rls.test.ts, upgrade.test.ts e cenários CG/HDN/M02/M04.

**Interfaces:** contrato 0.20.0 completo; `assertDatabaseSecurity` mantém assinatura/consulta metadata; flags incluem papéis separados. Instalação dos cenários exige a migration, não fallback de candidato.

- [x] Escrever RED dos papéis e schema novo; adaptar cenários para exigir objetos promovidos. Acrescentar cenários nativos de rollback/reaplicação/seed zero/papel perigoso e captura revisável do inventário.
- [x] Atualizar contrato explícito e readiness/fixtures, preservando todos os checks anteriores. Provar instalação fresca + upgrade com dados antigos pelo CI original PG17; corrigir falhas pela causa; commit.
- [x] Rodar aplicação/tipos/contratos/build e CI integral; observar GREEN sem skips.

### Task 3 — revisão e entrega

**Files:** docs/141-CONSULTEGEO-UPGRADE-M05-2026-10-13.md, AGENTS.md, README.md, evidence/consultegeo-m05, evidence/homologation, entrega local M05.

**Interfaces:** PR31 cumulativo em draft; report e logs do mesmo source fingerprint; pacote sobre base392fdd2 com hashes verificados.

- [x] Solicitar revisão independente do delta M05 após testes; corrigir Critical/Important com regressões e qualificar a fonte final.
- [x] Registrar procedimento de promoção/retorno, ausência de instalação hospedada e próximos M06/M08/M11; atualizar PR31, evidências e pacote; verificar source/hash/ZIP.

## Ledger

Pré-flight: branch limpa em392fdd2; M04 qualificou4360/370/184, source8e6c9170, e ambos CIs finais392fdd2 aprovados. CLI oficial2.120.0 em.local/m05-cli, checksum da release verificado; migration new --help conferido. Skill Supabase/changelog/docs consultados. Continuidade autorizada e decisões de produto delegadas: execução inline do recorte M05 acima, sem novo pedido de autorização do mesmo desenvolvimento.


Task1: CLI criou 20261013181408_consultegeo_m05_upgrade.sql.18 negativos/positivos observados RED→GREEN; check:migrations13/schema0.20 e check:consultegeo-upgrade aprovados; typecheck aprovado após corrigir inferência dos arrays frozen. Migration gerada159934bytes/hash6fb5bf249a9ff64dfcd55cb6cca80f6f8f25af3a85f640ab4bf8c3289e321f95. CLI precisou executar fora da restrição de filesystem para seu arquivo normal de estado/telemetria, sem destino SQL remoto. Ruling: papéis existentes com direitos privados extras também recusam o upgrade; não remover concessões existentes silenciosamente — evita adotar identidades inseguras e preserva credencial/LOGIN do papel seguro.


Retificação Task1: a63f351 foi registrado antes de ler um erro residual de callback implicit-any; corrigido em09ddf56, tipos reexecutados e aprovados. Task2: primeiro CI38448101051 instalou a migration e capturou inventário0.20, mas aprovou4378/4384app e351/370PG por contrato/expectativas anteriores ainda incompatíveis; não é homologação final. Extensão revisada contra o baseline:48 tabelas,94 funções,39 triggers,257 constraints,38 policies;23 tabelas novas sem DML direto,20 helpers novos executáveis pelo app e dez policies adicionais restritivas. Todos os privilégios/helpers/triggers/policies/constraints anteriores comparados e preservados.126 focais atuais aprovados, tipos/checks offline aprovados. Ruling: preservar a ordem declarada das colunas de UPDATE do baseline, comparando o conjunto contra catálogo nativo; não usar ordem física de coluna como mudança de permissão. Native M05 acrescenta rollback de instalação, reaplicação, partial/wrong-schema/papel inseguro, preservação de LOGIN/credencial e sessão real de worker sem autoridade de domínio; aguardando CI.


Fechamento Task2/Task3: CI38453749955 / febce83 aprovou4384 aplicação,385PG17 e184interface, zero skips. Fingerprint cffaa123ce2f9f1ed2c1594a49b083863efe6fb0d43c2f1075ae15afb64d3457; importado e check:homologation aprovado. I1 defaultACL observado RED4277dba/CI38452159544 (382/384PG): antigo upgrade aceitou o default incompatível. Corrigidos admissão de defaults e limites efetivos antes do marcador; novos negativos HDU05/HDU06 e todos os outros casos passaram no PG17. Revisão final sem Critical/Important restantes. Migration final163253bytes/hash23aae798d34cf5c4d6e96478761dfb2e5208dc071fd886f2ab56d78e12d83b1a. Checkpoints locais126focais e54após correção; tipos/recipe/manifest aprovados. Relatório141 e pacote próprioM05 registram procedimento, evidência e próximos blocos; PR31 mantido draft. Nenhuma aplicação hospedada ou entrega real.

Ruling: contagem de tabelas CG amplia seis→dez na composição promovida, mantendo FORCE RLS/PUBLIC denial em todas; o fixture checklist sem workflow deve recusar mensagem genérica HDW07 e comprovar rollback, conforme writerM02. Não foi removido o guard para reproduzir o comportamento de um checkpoint parcial. Ruling: defaults automáticos não-owner recusam admissão; efetivos de publicador/worker conferidos novamente antes do marker/COMMIT, sem auto-reparo do default.
