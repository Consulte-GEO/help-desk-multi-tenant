# Handoff — Help Desk M1-R2 / 28-09-2026

## Leia primeiro

`PROJECT_HELP_DESK.md`, `docs/24-M1-R2-RUNTIME-PREFLIGHT.md`, `docs/25-M1-R2-ESTADO-E-EVIDENCIAS.md`, `docs/27-M1-R2-BACKLOG.md`, `docs/28-M1-R2-TAREFA-CODEX.md`, README/AGENTS e docs04/05 atuais do **checkout remoto**. As cópias remotas desses últimos arquivos não são substituídas por este pacote.

## Fonte

Base remota reinspecionada: `b9481b9fabde2fd9c442e44099bc17608b59571a`, branch `codex/m1-reproducibilidade`. Snapshot local equivalente apenas para código/config/testes: `9f2e21c1c39c11eb9aceb32349954b84fb9ef830`. O manifesto registra o commit local final e preimages dos arquivos. Não usar a história Git recuperada para sobrescrever ou force-push no remoto.

Não voltar ao ZIP v0.19 antigo: ele não contém os avanços reais de dependências/CI/banco/configuração do destino. API/interface0.19, schema0.18; 11 migrations e lock intactos.

## Entregue localmente

Validador puro compartilhado com erro seguro; CLI offline/conectada sob opt-in; TLS confirmado antes de SQL; conexão exclusiva READ ONLY com guards existentes; rollback/descarte/encerramento obrigatórios; relatórios sem segredos vinculados ao código. Não há endpoint público, concessão de capacidades, login alternativo ou mudança na liberação do atendimento.

**1.099 testes locais aprovados. 204 SQL escritos, zero SQL executado nesta rodada. 35 HTTP aprovados, zero browser aprovado nesta rodada.** Typecheck global suplementar aprovado; instalação padrão, audit e typecheck padrão não aprovados aqui. O gate deve reprovar até nova evidência completa.

## Próxima execução

1. Conferir HEAD/branch/worktree, comparar com b948, preservar alterações concorrentes e aplicar somente o delta revisado; `git apply --check` antes de `git apply`.
2. Revisar o lock e executar `npm ci --ignore-scripts`, `npm run verify`, `npm audit --audit-level=high` em ambiente com registry autorizado. Não gerar lock alternativo nem usar tipos globais como substituto.
3. Executar `npm run test:db:local` em PostgreSQL17 descartável, confirmando **204** casos e integridade dos onze SQL. Não usar Supabase hospedado como fallback. Não retirar assertions de grant/rollback.
4. Executar `npm run test:ui:local`, confirmando 35 HTTP +36 browser; depois `npm run homologate:local` e `npm run check:homologation`. Registrar falhas/skip como bloqueio, nunca alterar logs antigos para acomodar fingerprint.
5. Após autorização de destino, executar o preflight conectado em ambiente administrativo controlado e com o login restrito real. Não imprimir ambiente ou connection string. Validar TLS/certificado, rollback e encerramento; registrar modo/source/hash e limitações.
6. Elaborar/executar validação **dentro** da Function e percurso Auth/M2M real em ambiente de homologação autorizado. Este incremento não fornece endpoint interno nem autoriza abri-lo. Não ativar `HELPDESK_RELEASE_APPROVED` em produção apenas para contornar o teste.
7. Prosseguir com capacidade/abuso, restore, residência, RPO/RTO, revisão independente e aprovação operacional. M2 somente depois do fechamento do M1.

## Cuidados de integração

As onze migrations já constam no Supabase sob timestamps de execução distintos dos IDs nos nomes. Conferir o mapeamento histórico; não reaplicar nem usar migration repair automaticamente. Não transformar os avisos de RLS sem policy de tabelas privadas deliberadamente fechadas em grants públicos.

A CLI `--connect` faz consulta real: exige autorização atual. `success:true` não homologa o produto; `production_approved`, `operational`, `auth_tested` e `hosted_function_tested` permanecem false. O export inferior exige conexão ociosa própria e nunca entra numa transação de atendimento.

Sem autorização nova, limitar esta continuação a código, testes descartáveis e documentos. Push/PR/deploy/usuários/secrets/migrations remotas são operações separadas.
