# Help Desk M1-R17 — Handoff e backlog

Ler PROJECT_HELP_DESK.md, README/AGENTS, handoff upstream R9 e docs93–96. Base remota observada: `78bbb00112331531168ae24600604cb7f3148770`. R10–R17 continuam locais; autorizações históricas não concedem autorização para operações externas atuais.

## O que retomar
A suíte PostgreSQL principal registra seis testes novos através de `supabase/tests/hosted-acceptance-scenarios.ts`. O helper em `tests/fixtures/postgres-acceptance-effects.ts` só observa/compara resultados, não abre conexões e não possui CLI. A fixture SQL faz opt-in/loopback novamente e herda o guard de banco fresco da suíte existente. Não extrair esse preparo para o Supabase hospedado.

A aplicação local passou em1.389 testes;14novos do observador. Há215SQL escritos, dos quais6novos, sem execução nesta rodada.35HTTP em memória passaram;browser/instalação/audit/typecheck padrão/gate não aprovados. Typecheck suplementar passou; não é a toolchain oficial.

## Ordem de execução
| Prioridade | Tarefa | Saída necessária |
|---|---|---|
| P0-INTEGRAR | Reconciliar R10–R17 com HEAD real | Uma variante do patch, sem sobrescrever alterações concorrentes |
| P0-CI | Executar com lock/toolchain oficial | Instalação, audit,typecheck,1.389 aplicação,215PostgreSQL17,71HTTP/browser da mesma fonte |
| P0-SQL-REVIEW | Conferir os seis cenários novos | Todos executados, nenhum skip; diagnósticos sem conteúdo privado; efeitos/recibos exatos |
| P0-INDEPENDENTE | Revisar os incrementos | Revisão por outro executor; SQL novo está escrito e não validado pelo banco aqui |
| P0-PRODUCAO | Validar diretamente em produção | Site e base HelpDesk existentes; isolamento entre contas e workspaces preservado |
| P0-ACEITACAO | Rodar R10/R11/R12/R15/R16 no destino | Login/M2M,gravações,replay,recusas e efeitos correlacionados com evidência própria |
| P0-OPS | Function/TLS,concorrência,carga,restore/governança | Aceite operacional,residência,RPO/RTO; não usar flags para simular aceite |
| M2 | Administração genérica | Somente após fechar M1 por evidências |

## Integração e riscos
R9 sem os incrementos locais: `helpdesk-m1-r10-r17.patch`. R16 EXATO: `helpdesk-m1-r17-only.patch`. Aplicar apenas um. Checkouts intermediários exigem reconciliação. Fonte de recuperação não substitui checkout/história upstream.

Os testes SQL próprios geram tickets e outbox no banco descartável; nenhum consumidor de notificações deve estar conectado. O snapshot cobre o workspace inteiro, mas não tabelas de Auth/rate limit nem outros workspaces. Erro HTTP negativo não é prova de ausência de efeitos: comparar antes/depois. Um teste de leitura não deve consumir dados de outras execuções. Recibos e request_ids são conferidos em memória, não impressos.

O teste de reexecução usa as mesmas chaves e a mesma fixture. Não regenerar executionId para fazer passar um reenvio, não apagar recibos nem alterar migrations antigas. O cliente HTTP mantém flags operacionais falsas mesmo quando o observador SQL passar.

Fingerprint: `3819e2205d51535df464faff626c7cfed1969d5d979a81d98aa5d7b5d1248df8`. Commit local no manifesto. Nenhuma escrita remota nesta rodada.
