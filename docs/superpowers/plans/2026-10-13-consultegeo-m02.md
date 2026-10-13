# Consulte GEO M02 e comunicação plano de implementação

> **For agentic workers:** executar com superpowers:executing-plans nesta conversa, em tarefas com testes antes das mudanças e uma revisão independente do diff completo ao final.

**Goal:** concluir o incremento de workflow M02/M03 e preparar política e comunicação Consulte GEO com Resend.

**Architecture:** preservar executor/outbox do Help Desk; integrar o SQL candidato e adaptar o canal existente. Configuração e comunicação são específicas da Consulte GEO.

**Tech Stack:** TypeScript, Node22, PostgreSQL17, pg do lock existente, Web Fetch, HTML de e-mail em tabelas.

**Spec:** `docs/superpowers/specs/2026-10-13-consultegeo-m02-design.md`.

## Global Constraints

Migrations, permissões, Auth e gate atuais preservados. Não usar banco hospedado como laboratório. Sem SDK/dependência nova ou envio real nesta verificação. Remetente/chave ficam em configuração privada. Referência de origem: M02 V4 na base 604478e, com hashes conferidos.

## Review Focus

- Mudança de versão sem mudança de status: entradas antigas e SQL direto devem obedecer ao perfil vinculado.
- Retorno do cliente e transferência: autorização atual e cobertura integral, sem ampliação de grant.
- Idempotência incerta: nenhum retry de envio por timeout/ACK perdido.
- Marca e conteúdo: escaping, fontes de sistema, ausência de nota/PII/placeholder jurídico e um CTA autorizado.
- Política por serviço: prioridades, dias úteis e limites de planilha inequívocos, sem calendário publicado presumido.

## Task 1: integrar M02 e fechar ciclo persistido

**Files:** `src/infrastructure/support-workflow-store.ts`, `supabase/candidates/hdn_support_workflow.sql`, `supabase/tests/support-workflow-scenarios.ts`, registrar existente; `src/domain/support-workflow.ts`, `src/infrastructure/legacy-transition-guard.ts` e testes relacionados.

**Interfaces:** consome `SupportWorkflowTransaction`, `decideSupportTransition`, executor e leitor de checklist; produz `createDurablePostgresSupportWorkflow` com o mesmo cliente e helpers SQL.

- [ ] Copiar os dois testes novos e observar RED por writer ausente; executar baseline focal existente.
- [ ] Integrar exatamente o delta V4, sem reaplicar PR30.
- [ ] Escrever negativos e positivos para cliente retornando de waiting_customer, closed-reopen, transferência qualificada e mensagem antiga em perfil/estado protegido; observar RED.
- [ ] Implementar compatibilidade estreita de domínio/writer/SQL, preservando transação e recibo. Nenhuma GUC isolada concede permissão.
- [ ] Executar focais/tipos e CI PG17; corrigir causas demonstradas e conferir todos os comandos anunciados.
- [ ] Registrar evidência e commit do incremento.

## Task 2: política operacional Consulte GEO

**Files:** criar `src/integrations/consultegeo/service-policy.ts`, `profiles/consultegeo/operational-policy.v1.json` e `tests/consultegeo-service-policy.test.ts`.

**Interfaces:** produz seleção tipada de serviço/prioridade, política imutável e limites de implantação; não publica perfil nem concede papel.

- [ ] Escrever testes dos prazos exatos da especificação, prioridade inválida, configuração imutável e XLSX/CSV versus DWG/macros; observar RED.
- [ ] Implementar política versionada de produto e mapping para os papéis existentes.
- [ ] Executar testes e typecheck; documentar que publisher/clock/Storage reais ainda montam essa política.
- [ ] Registrar evidência e commit.

## Task 3: Resend e Email Kit Consulte GEO

**Files:** evoluir `src/integrations/notifications/templates.ts`; criar `src/integrations/notifications/resend-channel.ts`, testes de canal e marca, exemplos privados em `evidence/consultegeo-m02/email-preview/` e documento do contrato.

**Interfaces:** implementa `NotificationChannel.send(message, signal)` e `lookup(intent, signal)`; mantém `renderNotification(intent, template, portalOrigin)` e seu contrato/hash.

- [ ] Escrever RED para renderer de marca/table/CTA/escape, configuração restrita do canal, ACK válido, erro tipado, timeout/5xx/ACK malformado e ausência de prova de lookup.
- [ ] Implementar renderer de tabelas e Resend com fetch limitado, sem retry e sem segredos nos erros. Adaptar referência visual, não scripts do anexo.
- [ ] Executar focais e inspeção Chromium desktop/mobile, sem enviar mensagem real.
- [ ] Rodar os gates integrais adequados, revisão independente do branch e CI original. Registrar pendências de montagem/produção sem declarar canal operacional.
- [ ] Commit e PR draft revisável, mantendo produção/gate intactos.

## Registro de execução

Pré-flight: Task1 produz evento e recibo; Task3 consome NotificationIntent derivado do outbox existente, sem acoplar o renderer ao ledger privado. Task2 produz configuração para publicação futura; nenhuma tarefa considera o JSON como perfil instalado. Decisões do usuário e execução nesta conversa autorizam este plano refinado.

Ruling: ferramenta nativa de worktree não resolve o SHA no Git da pasta pai; usado Git worktree do repositório real em `.local/consultegeo-m02`, diretório já ignorado. Windows não tem PG17/Docker/WSL; o PostgreSQL será qualificado pelo workflow original Linux, sem remover o guard do runner.
