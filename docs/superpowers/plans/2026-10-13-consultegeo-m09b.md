# Consulte GEO M09b — plano executado

Execução inline com superpowers:executing-plans; uma revisão independente final. Spec: docs/superpowers/specs/2026-10-13-consultegeo-m09b-design.md.

Escopo ajustado e comunicado: M09b qualifica catálogo autorizado e GET/PUT de rascunho; abertura, protocolo, snapshot, recibo e event/outbox seguem M09c. Custo: uma nova qualificação antes de montar o envio. Não existe writer parcial de ticket nesta entrega.

## Task1 — perfil publicado e admissão (concluída)

- [x] Perfil M04 publicado fornece prioridade e SLA fixos, sem impacto sintético.
- [x] Admissão atravessa resolver e transação; não cancela uma confirmação de COMMIT já recebida.
- [x] Casos negativos observados e implementação validada;49/49 focais, tipos aprovados; commit180a38d.

## Task2 — catálogo e stores nativos (concluída)

- [x] CLI criou migration15; prefixo14 e seis candidatos M05 preservados.
- [x] Catálogo público após contexto humano/conta/produto/serviço/obras atual e completo.
- [x] Dono, conta, obras, formulário, versão e expiração fixados; CAS/replay, auditoria atômica, locks consistentes.
- [x] Tabelas privadas ENABLE/FORCE RLS, sem direitos diretos; parser obrigatório sticky e cliente emprestado sem escape.
- [x] SQL/driver diagnosticados por42P01/42703/22P02; tipos dos seletores preservam strings, sem coerção.
- [x] Fonte atual no directory; controle real da definição anterior com rollback demonstra recusa, versão atual retoma.
- [x] PostgreSQL17 original403/403; contrato50/112/42/269/38 confrontado com inventário nativo.

## Task3 — HTTP/runtime e entrega (concluída)

- [x] Três operações adicionadas ao OpenAPI0.29 (29total); flagsfalse, HTTPS, auth/MFA, taxa e admissão atéCOMMIT.
- [x] Origem ausente recusa e envio não passa ao legado; sem montagem fake de anexos/on-behalf.
- [x] MFA403 preservada, RED→GREEN; uma revisão final e rodada única de correções, semCritical/Important pendentes.
- [x] CI original38493917973 integral:4487/403/206, zero fail/skip/cancel; fonteb4a6c90, fingerprint5b6636ac.
- [x] Relatório144, seislogs originais, inventário e regressões preservados; PR31 permanece draft. Pacote incremental será conferido por SHA256.

M09c: abertura atômica com protocolo, referência CG selada, snapshot publicado fixado, estado inicial, evento/audit/outbox e recibo/reconciliação. Primeiro caso: Incluir usuário; evidências reais dependem de M08/M11. Nenhum merge/deploy/instalação hospedada ou envio deemail foi executado.
