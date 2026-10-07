# Tarefa executável — integrar e validar Help Desk M1-R12

## Objetivo
Integrar a aceitação de gravações idempotentes sobre o R9 já integrado ou R11 exato, mantendo M1 aberto até evidências reais. Não desenvolver telas M2 nem mudar as permissões do core para fazer a aceitação passar.

## 1. Base e integração
Ler `PROJECT_HELP_DESK.md`, `README.md`, `AGENTS.md`, documentação 64 e documentos 73–76. Reinspecionar remoto; a referência observada foi 78bbb00112331531168ae24600604cb7f3148770. Conferir o SHA-256 externo do ZIP e manifest.json. Criar branch local de revisão e preservar alterações concorrentes.

Escolher UMA variante:
- R9 sem R10/R11: helpdesk-m1-r10-r12.patch.
- R11 exato: helpdesk-m1-r12-only.patch.

```bash
git status --short
git rev-parse HEAD
git apply --check <PACOTE>/<PATCH_ESCOLHIDO>
git apply <PACOTE>/<PATCH_ESCOLHIDO>
git diff --check
```

Falha de aplicabilidade exige reconciliação. Não usar force-push, --reject ou overwrite de changes/ como reparo. Não reaplicar R2–R9 nem migrations remotas.

## 2. Verificações
```bash
npm ci --ignore-scripts
npm run typecheck
npm run check:migrations
npm run check:lock
npm test
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Critério mínimo desta fonte: 1.320 testes de aplicação, 209 testes PostgreSQL 17 e 71 checks HTTP/browser, sem skips/cancelados/TODO e mesmo fingerprint. Usar Linux/CI apto e PostgreSQL descartável; não Supabase de produção como fallback. Typecheck global suplementar não substitui a toolchain travada. Guardar logs das falhas. Não preencher latest.json com relatórios sintéticos.

## 3. Preparar fixture de homologação — somente com autorização atual
Reutilizar a fixture R10 com as 4 sessões e controles positivos. Conferir o Supabase efetivo, o deploy imutável/commit e os canais de notificação/outbox; o permalink não isola o banco sozinho. O solicitante A precisa `contexts:resolve`, `tickets:read` e `tickets:write`; o agente A precisa também `tickets:write`, além da leitura de notas exigida no R10. Não conceder automaticamente novos acessos. Nenhum usuário, contrato, conta ou grant é criado pelo cliente.

Copiar examples/hosted-write.fixture.json para arquivo local fora do Git. Preencher `readFixture` como no R10, `coverageId` com a cobertura autorizada de A e `executionId` com um UUID novo gerado UMA VEZ para esta intenção. Guardar esse arquivo antes de iniciar. Não trocar `executionId` após falha para "tentar de novo". Não usar dados reais de atendimento.

O exemplo é fictício: não representa ambiente provisionado e não deve ser executado sem substituição/revisão. Seus IDs de chamados/cobertura devem corresponder aos controles sintéticos existentes.

## 4. Plano sem rede
```bash
npm run --silent test:hosted:write -- --config <FIXTURE_JSON>
```
Resultado esperado: `planned`, transporte `none`, 28 controles de preflight + 18 passos `not_run`. Revisar `origin`, `execution_id`, `keys` e `config_sha256`. Esse hash é da configuração JSON lógica canônica; não é o hash do ZIP nem dos bytes brutos do arquivo.

## 5. Sessões
Fornecer apenas pelo mecanismo seguro do executor, sem logs/chat/Git:

| Variável | Conteúdo |
| --- | --- |
| HELPDESK_TEST_HUMAN_A | JWT curto do solicitante A |
| HELPDESK_TEST_HUMAN_B | JWT curto do solicitante B |
| HELPDESK_TEST_AGENT_A | JWT curto do agente A |
| HELPDESK_TEST_M2M_SESSION_A | Sessão M2M curta de A |

R11 encerra suas próprias sessões e não as exporta. Obter sessões novas apropriadas para R10/R12; não reutilizar tokens revogados. Nunca fornecer `service_role`, chave Supabase secreta ou chave M2M de longa duração (`hd_key_…`) neste cliente.

## 6. Execução com autorização específica de gravações
```bash
npm run --silent test:hosted:write -- --config <FIXTURE_JSON> --execute --allow-ticket-mutations --confirm-origin <ORIGEM_EXATA_DO_PLANO> --confirm-config-sha256 <HASH_DO_PLANO>
```

Sem confirmações, não há execução. O comando utiliza dados sintéticos fixos derivados de executionId: um chamado, uma mensagem pública e mudança normal→high pelo agente. As chamadas de replay/conflito são deliberadas e sequenciais. Não há exclusão automática, mudança de credenciais ou liberação de runtime.

Guardar o relatório sanitizado em pasta de evidência da rodada. Resultado esperado: `passed`, transporte `https`, 28 controles prévios aprovados e 18 etapas aprovadas, nenhuma mutação unknown. Campos operational/platform_approved/atomicity_verified/contract_snapshot_verified/outbox_delivery_tested/postgres_tested continuam `false`. Não alterar esses campos manualmente.

Uma execução gera eventos/outbox no ambiente de produção e pode ativar consumidores habilitados. Identificar esses efeitos no plano e no relatório, preservando dados e configuração do serviço.

## 7. Falha e recuperação
Qualquer falha bloqueia novos envios. resultado `unknown` exige revisão do relatório e das chaves. Somente uma nova invocação deliberada, com a MESMA configuração e principais, pode recuperar pela mesma chave enquanto a retenção idempotente estiver intacta. Verificar TTL/limpeza antes. Se houver `idempotency_expired`, purga, alteração de cobertura/acesso ou colisão, parar e reconciliar o recurso; jamais gerar nova chave automaticamente. Não limpar cache ou excluir chamados para fazer o teste passar.

GET atual e recibo histórico são diferentes: ao final o ticket está na versão 3/high, mas replay de criação continua versão 1/normal. Se outra operação externa alterou esse ticket, a suíte deve reprovar, não sobrescrever silenciosamente.

## 8. Encerramento
Revisar diffs, evidências e riscos com revisor independente. Informar base/commit/branch, resultado CI, 209 testes PG reais, navegador, destino e contagens efetivamente executadas. Validar em tarefa separada os efeitos DB/outbox e concorrência hospedada. Depois continuar ciclo completo de autenticação, M2M com escrita, demais comandos, capacidade e restauração e aceite M1.

Push/PR/merge/deploy, credenciais, usuários, grants, migrations remotas e gate precisam de autorização atual da tarefa. Este documento não concede essa autorização.
