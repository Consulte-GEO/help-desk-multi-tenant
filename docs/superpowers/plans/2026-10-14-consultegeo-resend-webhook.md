# Webhook nativo Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar eventos nativos Resend antes de correlacionar entrega no ledger privado.

**Architecture:** Verificador do corpo bruto Svix separado do relay normalizado existente. Resultado mínimo com marca privada mantém ID do evento, hash, ID da mensagem, instante e resultado; nenhuma identidade de chamado será aceita do payload. Correlação durável e montagem HTTP são etapas da operação do worker, posterior à promoção do banco.

**Tech Stack:** Node22 crypto, TypeScript, HMAC SHA256, UTF8 estrito.

**Spec:** docs/superpowers/specs/2026-10-14-consultegeo-operacao.md; https://resend.com/docs/webhooks/verify-webhooks-requests; https://resend.com/docs/webhooks/event-types

## Global Constraints

- Teste real somente para destinatário explicitamente autorizado.
- Não copiar credenciais do GeoLab.
- Timeout/ACK incerto não autoriza reenvio com chave nova.
- Não consultar conjuntos amplos de segredos.

## Review Focus

- Corpo reserializado, header duplicado ou assinatura não canônica deve recusar.
- Evento válido de outro tipo não deve confirmar entrega.
- ID de mensagem ausente ou inválido não deve correlacionar evento.
- Segredo antigo durante rotação deve ser aceito apenas se configurado explicitamente.
- Endereço, assunto, tags e conteúdo do payload não devem aparecer no resultado ou erro.

### Task 1: Verificador nativo

**Files:** Create src/integrations/notifications/resend-events.ts; tests/resend-events.test.ts.

**Interfaces:** Consumes Headers and raw Uint8Array with svix-id/svix-timestamp/svix-signature. Produces createResendDeliveryEvents({secrets,maxAgeSeconds,clock}).verify(headers,bytes) and requireVerifiedResendEvent(value), a server-only branded minimal event. Event outcome accepted/delivered/failed or null for ignored signed types; native ordering not invented here.

- [ ] Write tests for valid sent/delivered/bounced/failed, ignored opened/delayed/domain, mutation/replay/UTF8/header/config/rotation/privacy and forged brand.
- [ ] Run node --experimental-strip-types --test tests/resend-events.test.ts; observe RED.
- [ ] Implement bounded raw Svix HMAC verification and strict minimum native event fields. Validate native email UUID and canonical timestamp, preserve original bytes hash.
- [ ] Run focal tests and TypeScript; observe GREEN. Keep endpoint unmounted until durable correlation is qualified.
- [ ] Commit task together with root operational qualification after independent review.
