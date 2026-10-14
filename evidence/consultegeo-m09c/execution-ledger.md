# SDD ledger — plan: docs/superpowers/plans/2026-10-13-consultegeo-m09c.md

Base ca40dfcef5a372e40f5cc1c58053c68d06b77b50; worktree existente e limpo. Baseline M09b CI38493917973 source b4a6c90 fingerprint5b6636ac confirmado anteriormente; nenhuma alteração inicial.
Pre-flight: Task1 store→Task2 runtime: mesma interface emprestada e intenção original no commit; Task2 source→Task3 evidência: homologação usa suites originais e fingerprint. Sem conflito.
Ruling: executar decisões técnicas e plano inline sem nova reconfirmação — autorização persistente do usuário — custo: desenho técnico deve permanecer revisável no PR draft.
Ruling: reutilizar outbox ticket.created existente como fila de email, sem segundo dispatcher — conserva GeoLab/Resend e evita duplicação — custo: envio real aguarda M11.
Ruling: reservar apenas lock no allocator e persistir contador na criação — preview/allocator isolado não deixa protocolo órfão — custo: serialização breve das aberturas por workspace.
Ruling: helpers de ledger adaptados a Python/PowerShell em Windows — scripts shell anteriores incompatíveis — custo: bookkeeping manual verificado por CI e revisão independente.
Task 1: in_progress; brief=spec e Task1 do plano; BASE=ca40dfc.
Task1/2 implementação: de89364,86 focais aprovados, typecheck0/manifest16/contracts31/secrets/build aprovados. Qualificação nativa pendente; sem declaração de complete antes de CI.
CI38499957694 primeira rodada: app4493/4494,SQL402/405. Causas: docs/openapi gerado fora do commit, fixture com coluna id em vez de template_id/sha256, suite registrada duas vezes pelo helper rerun, upgrade-test não aplicava16. Corrigidas; nova rodada de89364. Nenhuma redução/skip de gate.
Ruling: preservar trim e contagem UTF16 do domínio no SQL e limitar createdAt ao formato UTC emitido pelo servidor — evitar rejeitar texto astral ou aceitar recibo não relível — custo: cliente SQL privado deve usar timestamp UTC canônico.
Task3: revisão independente única solicitada sobre range completo; CI/entrega em progresso.

Task1: store RED2/6→GREEN6/6, interface/pinned-profile/domínio/http focais86/86; SQL nativo aguarda CI. Task2: HTTP RED4/4→GREEN4/4; contracts31, secrets/build aprovados; native qualification pendente.
Ruling: transportar intenção original como quarto argumento do escritor, preservando envelope histórico key/hash/result — regressões de replay revelaram retenção acidental do input no recibo — custo: adaptadores duráveis devem receber esse argumento explicitamente.

Ruling: exigir preparação do contador com último protocolo legado verificado, sem assumir CG10001 — captura12264 não prova fronteira atual — custo: preparo privado obrigatório antes da primeira abertura real.
Final: Ruling: qualificação real M08 segue em seu incremento — origem/identidade autoritativas ausentes não podem ser substituídas por nomes/emails/fixtures — custo: atendimento permanece fechado até os contratos reais.
Final: Ruling: instalação hospedada segue o processo próprio — testes PG17 descartáveis não são promoção do schema — custo: migration/código/calendário/contador ainda precisam de ativação compatível.
Final: Ruling: montagem da UI segue próxima composição autorizada — backend qualificado não torna as cinco ações operacionais — custo: jornada ainda não aparece no app hospedado.
Final: Ruling: envio real de email segue M11 — outbox atômica não comprova entrega Resend — custo: pending permanece fila até worker/provedor/webhooks qualificados.
Final: revisão única independente0Critical/2Important/0Minor; ambos Important aceitos. Não houve segunda revisão.
Final: fixed mínimo Unicode — subject-red/green e nativo😀a rejeitado/😀ab aceito RED→GREEN; core preservado.
Final: fixed efeitos persistidos — mutadores de prioridade/clocks/answers/contador nativos RED→GREEN; digest deferido e releitura integral.
Qualificação: ambiguidade request_id nativa RED→GREEN; erro draft_expired emprestado expiry-red7→expiry-green66; fixture de expiração antes de lock_timeout real com espera observada.
CI38505825900 attempt1: app4496/PG419 aprovados; navegador timeout notes-retry. Recusa não ocultada, tentativa preservada. Nenhum gate alterado.
Task 1: complete (ca40dfc..1486611; CI38505830238, PostgreSQL419/419, aplicação4496/4496; ACK/supressão/mutadores/forja/CAS/concurrência/TTL/replay e prefixos aprovados).
Task 2: complete (mesmo range/CI; interface206/206, tipos/contratos/build originais aprovados; capabilities/flags preservadas).
Task 3: complete (CI38505830238, fonted3b476bfe377f5ade9d6107448363ce1d0f30307, fingerprintd50ffef9b3565a7ae1cc33913c7199c6d6834a5e7c5e4acea9efa2de63e28ee6; seis logs/hash/inventário verificados, relatório145/matriz/revisão e entrega incremental preparados).
Final: minor (deferred): nenhum.
