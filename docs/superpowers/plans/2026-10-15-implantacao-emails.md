# E-mails do Apoio Implantação — execução

**Goal:** ativar os e-mails usando a infraestrutura existente, conforme autorização expressa do titular.
**Spec:** `docs/superpowers/specs/2026-10-15-implantacao-emails.md`.
**Architecture:** addon privado de outbox para IMP, transporte/configuração/worker/webhook compartilhados; sem adulterar o ledger CG.
**Tech:** Node22, TypeScript, PostgreSQL17, Vue3, Netlify Functions e Resend existentes.

- [x] SQL e qualificação nativa local: addon, resolução de público vivo, fila/lease/CAS/receipts, callbacks e testes com logins restritos. Linux/Unix socket pendente de CI.
- [x] Runtime do worker e webhook: transporte existente, composição isolada com chamados, orçamento e observação sem segredos.
- [x] Backend API: enfileiramento atômico das operações reais, status autenticado, idempotência, compatibilidade notify-* e testes negativos.
- [x] Frontend: feedback honesto de fila/aceitação/entrega e consulta de status; nenhum sucesso falso nem retry silencioso após incerteza.
- [ ] Revisão independente e correções; CI completa, PG17 e navegador.
- [ ] Commit/PR/merge, addon qualificado, publicação e checkpoint real, preservando histórico concorrente.

Ruling: manter ledger de email IMP em addon separado porque o ledger CG exige ticket/protocolo de atendimento; reutilizar os mecanismos de envio e agendamento, sem criar outro provedor ou infraestrutura cobrada.
Ruling: não realizar envio de teste real sem destinatário autorizado específico. A ativação será comprovada por configuração/worker/SQL e ensaios sintéticos; entrega real depende de evento legítimo posterior.

Validação local:55 testes focais de API/runtime/shell,26 jornadas reais em Chromium, tipos e build aprovados. Implementador SQL reportou49 checks PostgreSQL17.11 em cluster próprio Windows (20 originais+29 e-mail), com remoção do cluster. A suíte integral local Windows executou5827 testes:5761 passaram e66 falharam em dependências/plataforma de symlink, socket Unix, TLS, processo Linux e Python ausente; não constitui homologação completa. O gate Linux permanece obrigatório e produzirá o recibo canônico.

Revisão independente corrigiu projeção de estado interno da fila, atualização da lista ao reativar a aba E-mails, confirmação prematura no modal e resultado operacional do cron. Caso um estágio falhe, ambos ainda executam e o resultado final sinaliza503. Regressão RED/GREEN do cron14/14. O compartilhamento também passou a montar os modais com Teleport defer, suportado pelo Vue3.5 instalado, após falha real de navegador.

## Task 1: Addon e qualificação SQL

Implementar supabase/addons/implantacao/*implementation_email*.sql, supabase/tests/implementation-email-native-suite.mjs e ampliar scripts/qualify-implementation-support-native.mjs. Contratos do spec; preservar core e addon inicial. Escrever primeiro testes nativos de isolamento, público, dedupe, leases, recuperação, quotas, recepção e ACL. Preparar role worker apenas no cluster próprio. Não aplicar SQL remoto.

## Task 2: Worker e callback

Criar src/infrastructure/implementation-email-runtime.ts, testes e compor netlify/functions/notification-worker.mts sem bloquear o trabalho do núcleo. Reusar configuração/transporte e adicionar tratamento de callback verificado somente após o core retornar unmatched.

## Task 3: Operações e status

Root implementa interfaces transacionais em implementation-support.ts, status HTTP, enfileiramento atômico e compatibilidade notify-*; fixtures e testes negativos.

## Task 4: Interface

Atualizar frontend/support e componentes/serviços relevantes para fila e status com termos corretos e sem falha enganosa.

## Task 5: Revisão e homologação

Revisão independente de segurança, execução de focais, tipos/build, CI integral e qualificação addon/browser.

## Task 6: Ativação e publicação

Aplicar apenas addon qualificado, preservar segredos e workers, merge/publish autorizados, verificar HTTPS/cron/configuração sem email de teste.
