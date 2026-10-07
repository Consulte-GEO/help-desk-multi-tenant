# Bootstrap privado do primeiro administrador

**07/10/2026 — continuidade HD-P03 / preparação restrita HD-P05.** O diagnóstico do banco está aprovado (doc117); o workspace existente ainda não tinha administrador. O titular escolheu expressamente a pessoa humana já cadastrada, preservando seus escopos de leitura. Essa dependência precisa ser resolvida para configurar o atendimento, sem declarar M1 ou o backoffice M2 completos.

## Resultado e fronteira

`npm run bootstrap:plan -- arquivo.json` prepara uma transação offline para o **primeiro administrador de um workspace existente**. Não cria workspace, pessoa Auth, conta, produto, contrato ou credencial. Não tem endpoint HTTP nem executa SQL por conta própria. Normalmente, a aplicação continua conectando como `helpdesk_app`; esse login não pode aplicar o bootstrap.

O operador privado precisa de login de banco explicitamente privilegiado, no canal de provisionamento. Identificadores do arquivo são seletores, nunca prova de identidade ou autorização. O procedimento exige principal humano ativo, binding Auth exato e vínculo ativo com papel agent, nenhum administrador inicial ou bootstrap anterior e revisão de permissões esperada. Locks de workspace/principal/vínculo e do perfil serializam operações concorrentes.

O efeito é `agent → admin` somente naquele workspace. O teto de capacidades é copiado **exatamente** do perfil vigente; ausência continua vazia. A função privada existente registra nova revisão com a mesma lista, motivo, request ID e `changed_by=session_user`. Assim há proveniência do operador sem conceder tickets:write ou notas por causa do papel. Audit event, papel e revisão são confirmados na mesma transação; falha de qualquer parte desfaz tudo.

O audit event relaciona o beneficiário e o request ID; a revisão vinculada registra o operador de banco e o motivo. Isso é bootstrap por canal operacional, **não autenticação humana no Help Desk**. O recibo declara `human_auth_tested:false` e `capabilities_changed:false`. O papel admin dá acesso administrativo/visibilidade previstos pelo domínio; os escopos atuais continuam limitando ações de atendimento. MFA/backoffice continuam sendo entregas próprias.

Request ID e hash vinculam workspace, pessoa, binding, revisão e motivo. Repetir o mesmo plano recupera o recibo sem nova promoção/audit/revisão. Payload conflitante é recusado; revogação/inativação não é desfeita por replay. Outro request ID não reabre a janela de bootstrap. História inválida não é removida ou tratada como ausência.

## Preparação do operador

1. Conferir a pessoa escolhida com o titular e o mapping real no Auth, a atividade, vínculos e revisão atual. Não copiar IDs de exemplos ou associar por nomes semelhantes.
2. Salvar os seis campos de entrada em arquivo privado ignorado pelo Git: `workspace_id`, `principal_id`, `supabase_user_id`, `expected_scope_revision`, `request_id` e `reason`. Os quatro identificadores são UUIDs; motivo não contém credenciais.
3. Executar o comando em modo plano e conferir hash, alvo e SQL. O leitor limita a 16 KiB, UTF-8 estrito, arquivo regular e sem symlink. Flags de execução, senhas e campos extras são recusados.
4. Aplicar a transação somente no canal operacional autorizado da base de produção existente. Não passar esse SQL a `helpdesk_app`, browser, Data API ou pool de requests. Não há migration ou ampliação de grants.
5. Confirmar papel, revisão/lista idêntica e audit/request ID. Em resposta perdida, consultar/reaplicar **o mesmo** plano; não inventar outro request ID para recuperar confirmação.

Planos/recibos brutos de produção ficam privados. Evidência pública usa contagens e verificações sanitizadas, sem e-mail, IDs Auth, segredo ou corpo de configuração. `bootstrap:plan` não é CRUD de membros e não substitui os clientes de homologação já existentes.

## Código e verificação

- `src/application/first-admin-bootstrap.ts`: validação, namespace/hash e transação privada.
- `scripts/plan-first-admin.ts`: CLI offline; leitor seguro compartilhado com `scopes:plan` em `src/infrastructure/operational-json.ts`.
- `tests/first-admin-bootstrap.test.ts`, `tests/first-admin-cli.test.ts`: 24 testes focais aprovados. Delimitador/quoting e namespace exato têm regressões observadas antes da correção.
- `supabase/tests/first-admin-scenarios.ts`: oito cenários SQL registrados no mesmo runner descartável já existente: positivo/replay, login restrito, binding/revisão/inatividade, concorrência, namespace, revogação/conflito, rollback por auditoria e texto adversarial.

Typecheck, contratos, lock e onze migrations verificados; dependências e schema0.18 preservados. Aceite SQL/CI e aplicação em produção serão registrados depois da execução. O SQL destrutivo de fixtures permanece limitado ao cluster descartável do CI; nunca executar esse runner no Supabase de produção.

O gate de atendimento permanece fechado. Restam Auth real, M2M, cadastros comerciais/operacionais e percurso de atendimento, capacidade e restore. A escolha do primeiro atendimento é uma decisão separada da identidade do primeiro administrador.

## Evidência real do CI

Primeira execução [37611339338](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37611339338): aplicação1.482 e interface79 aprovadas; SQL218/223. O PostgreSQL identificou a diferença de tipos entre `audit_events.request_id` (texto) e `human_scope_versions.request_id` (UUID), impedindo o recibo. Corrigido convertendo UUID conhecido para texto, sem converter dados de auditoria potencialmente inválidos. A revisão também identificou uma ambiguidade entre variável e coluna `revision` no replay; a consulta foi qualificada. Nenhum teste ou condição de autorização foi removido.

Execução corrigida [37612760558](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37612760558), tentativa1, HEAD `18a63f5051b84246ac2a2c2ca72f09ebb4510a0a`, merge de teste `08971cde11ee264827ed3e115244cb2c9a8608c0`: **1.482/1.482 aplicação, 223/223 PostgreSQL e 79/79 interface**, zero falhas/skips. Lock, instalação, audit e validação de evidência aprovados. Revisão separada final sem novos achados.

Artefato verde `11478500661`, ZIP SHA256 `0dda7bb44bc32e6e0fbd9419066d4c3ff5cc8127a31593c20a885132649f96a1`; fingerprint `5661ad13aa0de843f55f0423d31f50b874a03a78f9a9b10f16f6862073a10c24`. Origem/run/commit/fingerprint e seis logs conferidos. Conjunto exato em `evidence/first-admin/ci-green` e gate canônico. O vermelho é histórico em `evidence/first-admin/ci-red`, ZIP SHA256 `25ef42232532fd306e0facb790e13292c2dbd6f160070d08813d05b2cd7b451d`. `platform_approved:false` permanece em todos os conjuntos; CI não é login humano nem liberação operacional.

## Integração e aplicação confirmadas em produção

[PR7](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/7) integrado em `95c1bfdd3c600d8de9cc83f1f79d13c9510e1049`, todos os checks finais aprovados ([run37613888817](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/37613888817)). Deploy de produção `6ac62d277b1d25000811d9a7` ready/publicado no site existente. Sem alterações nos onze SQLs históricos, schema0.18, grants da aplicação, Auth ou variáveis de runtime.

O plano privado de hash `eb5b5fdb7d3f19545d2430b15a21e4b57b70fc41cccca94718f0fab5661232fb` foi aplicado pelo canal administrativo à pessoa escolhida. Antes: papel agent, revisão1, dois escopos. Depois: papel admin, revisão2, **os mesmos `contexts:resolve` e `tickets:read`**, um audit de bootstrap. A nova revisão registra operador/motivo/correlação; não concede escrita de ticket/notas.

Reaplicação do mesmo plano em produção recuperou o mesmo recibo: revisão continua2, audit continua1. Consulta de privilégios confirmou `helpdesk_app` sem UPDATE em memberships e sem EXECUTE no setter de escopos. Contas e tickets permanecem0. Evidência pública sanitizada: [production-bootstrap.json](../evidence/first-admin/production-bootstrap.json); plano, seletores pessoais e recibos brutos continuam somente privados.

Esse resultado fecha o bootstrap inicial deste workspace, **não HD-P03/HD-P05 completos**. A pessoa já existia; não houve teste de senha/MFA, criação de credencial ou envio de e-mail. Próximo passo: primeiro atendimento real/cadastros com política definida, percurso de Auth/Function e M2M; manter gate fechado até os aceites. A pergunta sobre suporte interno versus cliente GeoLab/outro atendimento não muda o administrador escolhido nem autoriza usar fixtures como contrato real.
