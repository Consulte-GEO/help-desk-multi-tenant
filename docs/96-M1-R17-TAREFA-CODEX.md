# Tarefa Codex — integrar e validar Help Desk M1-R17

Leia PROJECT_HELP_DESK.md, README/AGENTS, o handoff upstream R9 e docs93–96. Não acrescentar funcionalidades M2 para substituir a execução de banco pendente. Preservar core genérico, versões contratuais, isolamento, histórico e migrations imutáveis.

## 1. Base
```bash
git status --short
git branch --show-current
git rev-parse HEAD
```
Compare com HEAD atual no GitHub, sem presumir que ainda é `78bbb00112331531168ae24600604cb7f3148770`. Use branch local isolada. Confira hashes originais/finais do manifesto. O pacote não autoriza push/PR/merge/deploy, mudanças remotas de schema, usuários, MFA, segredos, dados ou gate.

R9 sem R10–R16:
```bash
git apply --check /CAMINHO/DO/PACOTE/helpdesk-m1-r10-r17.patch
git apply /CAMINHO/DO/PACOTE/helpdesk-m1-r10-r17.patch
```
R16 exato: substitua pelo `helpdesk-m1-r17-only.patch`. Não aplicar ambos. Checkouts intermediários/alterados devem ser reconciliados, nunca forçados. `changes/` não é o repositório completo.

## 2. Executar a toolchain travada e as suítes
```bash
npm ci --ignore-scripts
npm run check:lock
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```
Exigir1.389 aplicação,215PostgreSQL17 (199principais+16upgrade) e71HTTP/browser sem skips. Use Docker LOCAL com banco descartável; o runner prepara `helpdesk_test`. Não apontar a suíte SQL para Supabase. Native só com engine explicitamente escolhido, binários autorizados e usuário não-root conforme o runner existente. Não enfraquecer checks ou alterar registry para simular aprovação.

## 3. Revisão dirigida dos seis testes R17
Os testes já são registrados por `rls.test.ts`; não há novo runner.

Conferir: provider humano sintético mapeia AuthUID distinto do principal; `resolve_human`, `exchange_key`, `resolve_session` e operações de domínio usam o login restrito; admin só prepara/observa. As oito coleções são obtidas no mesmo SELECT. GETs, resolução, replay e recusas não deixam efeitos persistentes no recorte. Ao fim há exatamente dois novos tickets, duas mensagens, cinco eventos/outboxes/write_effects/recibos, nenhuma nota e nenhum audit_event novo.

A perda simulada de resposta deve ocorrer APÓS o handler efetivamente concluir a mutação. A nova invocação recupera as mesmas chaves. Não alegar que isso simula falha de COMMIT (há testes separados para esse caso). Revisar preservação das fixtures da conta B, dos snapshots privados, autores e correlação dos request_ids da primeira escrita. Não imprimir JSON privado nos asserts.

Se falhar no banco, preservar logs sanitizados, localizar causa em SQL/fixture/cliente e corrigir com regressão antes/depois. Os seis cenários estavam escritos e tipados, mas NÃO executados em banco na entrega; não presumir que passam.

## 4. Evidência e publicação
A evidência do R9 ou dos testes Node não aprova os215SQL atuais. Produzir logs novos vinculados ao fingerprint/commit do checkout integrado. O workflow existente prepara evidências isoladas por tentativa.

Não usar `recovery/source.tar.gz` para sobrescrever o repositório. Ele é somente uma recuperação em pasta nova sem histórico Git, dependências ou evidência de homologação.

Aceitação hospedada exige autorização atual separada e ambiente/fixtures/outbox/canais isolados. Os clientes e seus hashes/intenções não mudaram no R17. Não transformar sua execução em aprovação de Auth real, entrega externa, carga ou restore. Atualizar estado/handoff/backlog com o que foi implementado, testado localmente, executado em PostgreSQL, testado em navegador, publicado, homologado e operacional.
