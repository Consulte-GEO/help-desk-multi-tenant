# Consulte GEO M04 plano de implementação

> **For agentic workers:** usar superpowers:executing-plans nesta conversa, com TDD e revisão independente do incremento ao final.

**Goal:** configuração e publicação versionada de formulários, workflow, checklist e SLA Consulte GEO.

**Architecture:** conjunto por família, validação e compilação puras, publisher transacional restrito, HTTP/editor opcionais sobre a base existente.

**Tech Stack:** TypeScript/Node22, PostgreSQL17/pg existente, Web Request/Response, renderer dinâmico existente. Sem dependência nova.

**Spec:** docs/superpowers/specs/2026-10-13-consultegeo-m04-design.md.

## Global Constraints

Preservar doze migrations, Auth/grants, gate e produção. Reutilizar worktree/branch do PR31, base fe1ecad. Não publicar configuração hospedada nesta etapa de engenharia. Remetente/segredo Resend seguem privados. M05/M06/M08/M11 mantêm as dependências operacionais.

## Review Focus

- Coleção inteira e derivados validados antes de escolher/publicar uma entrada.
- Publicação e replay reautorizam admin/capability atuais, com MFA no servidor.
- Calendário com horizonte/feriados explícitos; nenhum offset presumido ou prazo fictício.
- Mutação concorrente/ACK malformado não confirma efeitos parciais.
- Chamado mantém versão publicada exata mesmo após sucessora/restauração.

### Task 1: definição e compilação Consulte GEO

Files: src/integrations/consultegeo/configuration.ts, profiles/consultegeo/configuration-drafts.v1.json, tests/consultegeo-configuration.test.ts.
Interfaces: parseConsulteGeoConfiguration(raw), compileConsulteGeoConfiguration(definition, registry), createConsulteGeoConfigurationDraft(service, id, version, calendar).

- [ ] Escrever negativos e observar RED; implementar definição restrita, templates por ação e compilador calendário/artefatos.
- [ ] Testar reaproveitamento de formulário/checklist/calendário e tipos; commit.

### Task 2: publisher e PostgreSQL restrito

Files: src/application/consultegeo-configuration.ts, src/infrastructure/consultegeo-configuration-store.ts, supabase/candidates/hdn_consultegeo_configuration.sql, supabase/tests/consultegeo-configuration-scenarios.ts, registrar; testes publisher/store.
Interfaces: createConsulteGeoConfigurationAdministration({store,clock}), createPostgresConsulteGeoConfigurationStore(pool), transaction com snapshots e admission.

- [ ] Escrever RED de save/publish/restore/replay/CAS/ACL/rollback/ACK e reader exato.
- [ ] Implementar publisher, receipt e candidate; escrever/executar cenários PG17 no workflow original; commit.

### Task 3: HTTP e editor

Files: src/http/consultegeo-configuration.ts, web/consultegeo-configuration.js, testes HTTP/editor/browser fixture e documentação140.
Interfaces: handler opcional e mountConsulteGeoConfigurationEditor(root,{definition,submit}), sem ativação no runtime fechado.

- [ ] Escrever RED de limites/ETag/key/origin/proof e estado de edição/confirmação/incerto.
- [ ] Implementar prévia por ação, resumo de SLA/workflow/checklist, publicação explícita e nova versão.
- [ ] Verificar browser desktop/mobile, suíte/CI integral e revisão independente; corrigir achados, atualizar PR31 e entrega.

## Registro

Pré-flight: PR31 aberto/draft, fe1ecad limpo, os dois CIs finais aprovados; reutilizado worktree existente. Usuário escolheu desenvolvimento por aqui e já delegou decisões do produto. Spec/plano documentam a execução autorizada; não é necessária outra aprovação do mesmo recorte. Windows sem PG17 nativo: validar pelo CI Linux original, sem relaxar guard ou usar produção como laboratório.
