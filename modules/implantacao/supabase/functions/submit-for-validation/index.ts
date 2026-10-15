// =====================================================================
// supabase/functions/submit-for-validation/index.ts · v5.22.45
//
// Recebe a submission do frontend, gera ticket, dispara 2 emails via
// Resend (equipe com link de revisão, responsável com link de status
// read-only) e retorna o número do chamado.
//
// O access_token NUNCA é retornado para o frontend — ele só existe no
// email enviado à equipe. O client_access_token também só existe no
// email enviado ao responsável.
//
// Mudanças v5.22.5 (em relação à v5.22.3):
//   - Rate limit por IP (10 submits / 10 min) ADICIONAL ao rate
//     limit por draftId. Resolve achado #9: bypass via draftId=null.
//   - expires_at setado em now() + 90 dias para tokens da equipe E
//     do cliente. Resolve achado #3: tokens vivendo para sempre.
//
// Mudanças v5.22.3:
//   - CORS preflight com echo dinâmico de Access-Control-Request-Headers
//     (resolve bloqueio por header x-app-env injetado pelo supabase-js).
//
// Mudanças v5.22:
//   - Captura client_access_token no ticket.
//   - Email do responsável agora inclui botão "Acompanhar status" para
//     a página read-only em /s/<client_access_token>.
//   - Nova env opcional CLIENT_STATUS_URL_BASE (com fallback inteligente).
//
// Secrets esperadas (configurar via `supabase secrets set`):
//   RESEND_API_KEY            — chave Resend
//   NOTIFICATION_RECIPIENTS   — csv de emails da equipe
//                               (ex: thiago@consultegeo.com.br)
//                               (separe múltiplos com vírgula)
//   EMAIL_FROM                — remetente (ex: Implantação Consulte GEO
//                               <noreply@pozzo.dev>)
//   REVIEW_URL_BASE           — base do link da equipe
//                               (ex: https://setup.consultegeo.org/r/)
//   CLIENT_STATUS_URL_BASE    — (opcional) base do link de status do cliente.
//                               Se ausente, inferido como
//                               REVIEW_URL_BASE.replace('/r/', '/s/').
//
// Vars automáticas do Supabase Functions runtime:
//   SUPABASE_URL              — url do projeto
//   SUPABASE_SERVICE_ROLE_KEY — chave admin (NUNCA exposta)
//
// Deploy:  supabase functions deploy submit-for-validation
// Local:   supabase functions serve submit-for-validation --no-verify-jwt
// =====================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/* ------------------------------------------------------------------ */
/* CORS — v5.22.3: lista expandida + echo dinâmico no preflight        */
/* ------------------------------------------------------------------ */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Lista base com headers conhecidos. O OPTIONS handler abaixo ecoa
  // dinamicamente qualquer header solicitado pelo navegador, então essa
  // lista é apenas fallback se a request não declarar nada.
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, ' +
    'x-app-env, x-app-name, x-supabase-api-version, x-requested-with',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/* ------------------------------------------------------------------ */
/* Tipos do payload                                                    */
/* ------------------------------------------------------------------ */

interface SubmitPayload {
  draftId: string | null;
  draftToken: string | null;
  technicalJson: Record<string, unknown>;
  clientMessage?: string;
}

interface TechnicalJsonShape {
  metadata?: {
    projectName?: string;
    createdBy?: { nome?: string; email?: string };
    [k: string]: unknown;
  };
  customerInput?: {
    dadosBasicos?: {
      obraNome?: string;
      clienteNome?: string;
      obraEndereco?: string;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  technicalMapping?: {
    unidadeGrupos?: unknown[];
    unidadeTipos?: unknown[];
    unidades?: unknown[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MAX_PAYLOAD_BYTES = 1_000_000; // 1 MB
const RATE_LIMIT_DRAFT_SECONDS = 60; // 1 submit / 60s por draftId
const RATE_LIMIT_IP_WINDOW_SECONDS = 600; // 10 minutos
const RATE_LIMIT_IP_MAX = 10; // max 10 submits por IP em 10 min
const TOKEN_TTL_DAYS = 90; // tokens expiram em 90 dias

function envOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v || !v.trim()) {
    throw new Error(`missing_env: ${name}`);
  }
  return v.trim();
}

function envOptional(name: string): string {
  return (Deno.env.get(name) ?? '').trim();
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * v5.22.14: lista canônica de destinatários da equipe Consulte GEO.
 *
 * Política:
 *   - "atendimento@consultegeo.com.br" é destinatário PERMANENTE — sempre
 *     incluído. É o endereço institucional de atendimento e não pode ser
 *     esquecido em nenhuma submissão.
 *   - "NOTIFICATION_RECIPIENTS" (env var, CSV) acrescenta destinatários
 *     adicionais — útil para incluir membros específicos do time durante
 *     piloto ou tickets de alta prioridade.
 *   - "NOTIFICATION_RECIPIENTS_DISABLE_DEFAULT=true" (opcional) permite
 *     desabilitar o atendimento@ caso um dia precise testar isolado.
 *
 * Garante dedup case-insensitive e ignora emails inválidos.
 */
function buildTeamRecipients(): string[] {
  const DEFAULT_TEAM_EMAIL = 'atendimento@consultegeo.com.br';
  const disableDefault = envOptional('NOTIFICATION_RECIPIENTS_DISABLE_DEFAULT')
    .toLowerCase() === 'true';

  const fromEnv = parseCsv(envOptional('NOTIFICATION_RECIPIENTS'));
  const list: string[] = [];
  if (!disableDefault) list.push(DEFAULT_TEAM_EMAIL);
  for (const e of fromEnv) list.push(e);

  // Dedup case-insensitive preservando ordem do primeiro aparecimento
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of list) {
    const norm = e.toLowerCase().trim();
    if (!seen.has(norm) && isValidEmail(e)) {
      seen.add(norm);
      out.push(e.trim());
    }
  }
  return out;
}

function isValidEmail(s: string | undefined): boolean {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isValidUuid(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(s.trim());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * v5.22.5: extrai melhor estimativa do IP do cliente. Em ordem de
 * preferência: x-forwarded-for (proxy headers), x-real-ip, cf-connecting-ip
 * (Cloudflare), fly-client-ip (Fly.io). Se nada disponível, retorna
 * 'unknown' — submits sem IP identificável caem todos no mesmo bucket.
 */
function getClientIp(req: Request): string {
  const headers = req.headers;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    // x-forwarded-for é uma lista separada por vírgula:
    // "ip_cliente, ip_proxy1, ip_proxy2". O primeiro é o cliente real.
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return (
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    headers.get('fly-client-ip') ||
    'unknown'
  );
}

/* ------------------------------------------------------------------ */
/* Templates de email                                                  */
/* ------------------------------------------------------------------ */

interface EmailContext {
  ticketNumber: string;
  obraNome: string;
  obraCodigo: string;
  clienteNome: string;
  responsavelNome: string;
  responsavelEmail: string;
  countEstruturas: number;
  countPecas: number;
  countConcretos: number;
  clientMessage: string;
  reviewUrl: string;
  clientStatusUrl: string;
  submittedAt: string;
}

function emailEquipeHtml(c: EmailContext): string {
  const msgBlock = c.clientMessage
    ? `<p><strong>Observação do cliente:</strong></p>
       <blockquote style="border-left:4px solid #C5117E;padding:8px 12px;margin:8px 0;background:#fafafa;color:#333">
         ${escapeHtml(c.clientMessage).replace(/\n/g, '<br>')}
       </blockquote>`
    : '';
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#121a36;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="color:#0E1B40;margin:0 0 8px">Nova solicitação de implantação</h2>
  <p style="color:#6d6a62;font-family:'Courier New',monospace;font-size:13px;letter-spacing:.1em;margin:0 0 24px">
    CHAMADO ${escapeHtml(c.ticketNumber)}
  </p>

  <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
    <tr><td style="padding:6px 0;color:#6d6a62;width:140px">Obra:</td><td style="padding:6px 0"><strong>${escapeHtml(c.obraNome)}</strong></td></tr>
    ${c.obraCodigo ? `<tr><td style="padding:6px 0;color:#6d6a62">Código:</td><td style="padding:6px 0">${escapeHtml(c.obraCodigo)}</td></tr>` : ''}
    ${c.clienteNome ? `<tr><td style="padding:6px 0;color:#6d6a62">Cliente:</td><td style="padding:6px 0">${escapeHtml(c.clienteNome)}</td></tr>` : ''}
    ${c.responsavelNome ? `<tr><td style="padding:6px 0;color:#6d6a62">Responsável:</td><td style="padding:6px 0">${escapeHtml(c.responsavelNome)}${c.responsavelEmail ? ` &lt;${escapeHtml(c.responsavelEmail)}&gt;` : ''}</td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#6d6a62">Recebido em:</td><td style="padding:6px 0">${escapeHtml(c.submittedAt)}</td></tr>
  </table>

  <h3 style="color:#0E1B40;margin:24px 0 8px">Resumo técnico</h3>
  <ul style="margin:0 0 24px;padding-left:20px;color:#121a36">
    <li>${c.countEstruturas} estrutura(s) cadastradas</li>
    <li>${c.countPecas} peças/pavimentos gerados</li>
    <li>${c.countConcretos} concreto(s) cadastrados</li>
  </ul>

  ${msgBlock}

  <div style="margin:32px 0;text-align:center">
    <a href="${escapeHtml(c.reviewUrl)}"
       style="display:inline-block;background:#C5117E;color:#fff;padding:14px 28px;text-decoration:none;border-radius:12px;font-weight:700">
      Abrir tela de validação
    </a>
  </div>

  <p style="color:#6d6a62;font-size:12px;margin-top:32px;border-top:1px solid #e7e2d8;padding-top:16px">
    Esta mensagem foi enviada automaticamente pelo sistema Implantação Consulte GEO.
    O link acima dá acesso à validação completa — não encaminhe a quem não deva acessar.
    Link expira em ${TOKEN_TTL_DAYS} dias.
  </p>
</body></html>`;
}

function emailEquipeText(c: EmailContext): string {
  const lines = [
    `Nova solicitação de implantação - ${c.ticketNumber}`,
    '',
    `Obra: ${c.obraNome}`,
  ];
  if (c.obraCodigo) lines.push(`Código: ${c.obraCodigo}`);
  if (c.clienteNome) lines.push(`Cliente: ${c.clienteNome}`);
  if (c.responsavelNome) {
    lines.push(`Responsável: ${c.responsavelNome}${c.responsavelEmail ? ` <${c.responsavelEmail}>` : ''}`);
  }
  lines.push(`Recebido em: ${c.submittedAt}`);
  lines.push('');
  lines.push('Resumo técnico:');
  lines.push(`  - ${c.countEstruturas} estrutura(s)`);
  lines.push(`  - ${c.countPecas} peças/pavimentos`);
  lines.push(`  - ${c.countConcretos} concreto(s)`);
  if (c.clientMessage) {
    lines.push('');
    lines.push('Observação do cliente:');
    lines.push(c.clientMessage);
  }
  lines.push('');
  lines.push(`Tela de validação: ${c.reviewUrl}`);
  lines.push(`(link expira em ${TOKEN_TTL_DAYS} dias)`);
  lines.push('');
  lines.push('---');
  lines.push('Mensagem automática · Implantação Consulte GEO');
  return lines.join('\n');
}

function emailResponsavelHtml(c: EmailContext): string {
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#121a36;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="color:#0E1B40;margin:0 0 8px">Solicitação recebida</h2>
  <p style="color:#6d6a62;font-family:'Courier New',monospace;font-size:13px;letter-spacing:.1em;margin:0 0 24px">
    CHAMADO ${escapeHtml(c.ticketNumber)}
  </p>

  <p>Olá ${c.responsavelNome ? escapeHtml(c.responsavelNome) : 'tudo bem'},</p>

  <p>
    A solicitação de implantação da obra
    <strong>${escapeHtml(c.obraNome || 'sem nome')}</strong>
    foi recebida pela equipe Consulte GEO.
  </p>

  <table style="border-collapse:collapse;width:100%;margin:24px 0">
    <tr><td style="padding:6px 0;color:#6d6a62;width:140px">Chamado:</td><td style="padding:6px 0"><strong>${escapeHtml(c.ticketNumber)}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#6d6a62">Status:</td><td style="padding:6px 0">Em análise</td></tr>
    <tr><td style="padding:6px 0;color:#6d6a62">Recebido em:</td><td style="padding:6px 0">${escapeHtml(c.submittedAt)}</td></tr>
  </table>

  <div style="margin:32px 0;text-align:center">
    <a href="${escapeHtml(c.clientStatusUrl)}"
       style="display:inline-block;background:#0E1B40;color:#fff;padding:14px 28px;text-decoration:none;border-radius:12px;font-weight:700">
      Acompanhar status do chamado
    </a>
    <p style="color:#6d6a62;font-size:12px;margin-top:12px">
      Use o link acima para ver atualizações de status e trocar mensagens
      com a equipe Consulte GEO. A página é exclusiva deste chamado.
      Link expira em ${TOKEN_TTL_DAYS} dias.
    </p>
  </div>

  <p style="color:#6d6a62;font-size:12px;margin-top:32px;border-top:1px solid #e7e2d8;padding-top:16px">
    Esta mensagem foi enviada automaticamente. Para contato direto com a
    equipe, use seu canal habitual com a Consulte GEO citando o número
    do chamado acima.
  </p>
</body></html>`;
}

function emailResponsavelText(c: EmailContext): string {
  const lines = [
    `Solicitação recebida - ${c.ticketNumber}`,
    '',
    `Olá ${c.responsavelNome || 'tudo bem'},`,
    '',
    `A solicitação de implantação da obra "${c.obraNome || 'sem nome'}" foi recebida pela equipe Consulte GEO.`,
    '',
    `Chamado: ${c.ticketNumber}`,
    'Status: Em análise',
    `Recebido em: ${c.submittedAt}`,
    '',
    'Acompanhar status:',
    `  ${c.clientStatusUrl}`,
    `(link expira em ${TOKEN_TTL_DAYS} dias)`,
    '',
    'Use o link acima para ver atualizações de status e trocar mensagens com a equipe.',
    '',
    '---',
    'Mensagem automática · Implantação Consulte GEO',
    'Para contato direto com a equipe, use o canal habitual citando o chamado acima.',
  ];
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Resend client                                                       */
/* ------------------------------------------------------------------ */

interface ResendSendArgs {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

async function resendSend(a: ResendSendArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (a.to.length === 0) {
    return { ok: false, error: 'no_recipients' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${a.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: a.from,
        to: a.to,
        subject: a.subject,
        html: a.html,
        text: a.text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `resend_${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    return { ok: false, error: `resend_exception: ${String(err).slice(0, 200)}` };
  }
}

/* ------------------------------------------------------------------ */
/* Handler principal                                                   */
/* ------------------------------------------------------------------ */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // v5.22.3: echo dinâmico dos headers solicitados no preflight.
    // O navegador manda `Access-Control-Request-Headers: a, b, c` listando
    // os headers que o request real terá. Em vez de manter allowlist fixa
    // (que quebra quando supabase-js adiciona header novo como x-app-env),
    // refletimos exatamente o que foi pedido. Origin: '*' já libera
    // qualquer domínio; o gate de segurança real é o `apikey`.
    const requestedHeaders = req.headers.get('access-control-request-headers');
    const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
    if (requestedHeaders) {
      responseHeaders['Access-Control-Allow-Headers'] = requestedHeaders;
    }
    return new Response(null, { status: 204, headers: responseHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  /* 1. Lê e valida payload */
  const raw = await req.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return json({ error: 'payload_too_large', limit_bytes: MAX_PAYLOAD_BYTES }, 413);
  }
  let payload: SubmitPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!payload || typeof payload !== 'object' || !payload.technicalJson) {
    return json({ error: 'missing_technicalJson' }, 400);
  }
  if (payload.clientMessage && payload.clientMessage.length > 1000) {
    return json({ error: 'client_message_too_long', limit: 1000 }, 400);
  }
  if (!isValidUuid(payload.draftId) || !isValidUuid(payload.draftToken)) {
    return json({ error: 'draft_identity_required' }, 400);
  }

  /* 2. Lê env */
  let supabaseUrl: string;
  let serviceKey: string;
  let resendApiKey: string;
  let notificationRecipients: string[];
  let emailFrom: string;
  let reviewUrlBase: string;
  let clientStatusUrlBase: string;
  try {
    supabaseUrl = envOrThrow('SUPABASE_URL');
    serviceKey  = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
    resendApiKey = envOrThrow('RESEND_API_KEY');
    // v5.22.14: atendimento@consultegeo.com.br é destinatário permanente.
    // NOTIFICATION_RECIPIENTS (CSV) agora é OPCIONAL — pode estar vazia
    // que o atendimento@ continua recebendo. Antes era envOrThrow e bloqueava.
    notificationRecipients = buildTeamRecipients();
    if (notificationRecipients.length === 0) {
      throw new Error('missing_env: no team recipient — atendimento@ default was disabled and NOTIFICATION_RECIPIENTS is empty');
    }
    emailFrom   = envOrThrow('EMAIL_FROM');
    reviewUrlBase = envOrThrow('REVIEW_URL_BASE');
    clientStatusUrlBase = envOptional('CLIENT_STATUS_URL_BASE')
      || reviewUrlBase.replace(/\/r\/?$/, '/s/');
  } catch (err) {
    return json({ error: String(err).replace(/^Error:\s*/, '') }, 500);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // V8: service_role ignora RLS, portanto a Edge valida explicitamente a
  // dupla id/token antes de qualquer leitura, INSERT ou envio de email.
  const { data: ownedDraft, error: draftErr } = await sb
    .from('setup_drafts')
    .select('id, status, locked_at')
    .eq('id', payload.draftId as string)
    .eq('access_token', payload.draftToken as string)
    .maybeSingle();
  if (draftErr) {
    return json({ error: 'draft_validation_failed', detail: draftErr.message }, 500);
  }
  if (!ownedDraft) {
    return json({ error: 'draft_token_invalid' }, 403);
  }
  if (ownedDraft.locked_at || !['rascunho', 'devolvido'].includes(ownedDraft.status)) {
    return json({ error: 'draft_not_submittable' }, 409);
  }

  /* 3a. v5.22.5: Rate-limit POR IP (10 submits / 10 min)
   * Independente de draftId. Protege contra spam de tickets via
   * draftId=null que escapava do rate limit antigo (achado #9). */
  const clientIp = getClientIp(req);
  if (clientIp !== 'unknown') {
    const ipCutoff = new Date(
      Date.now() - RATE_LIMIT_IP_WINDOW_SECONDS * 1000,
    ).toISOString();
    const { count: ipCount, error: ipErr } = await sb
      .from('setup_audit_events')
      .select('*', { count: 'exact', head: true })
      .eq('actor', `ip:${clientIp}`)
      .eq('action', 'ticket.created')
      .gte('timestamp', ipCutoff);
    if (ipErr) {
      // Erro de query não bloqueia — fail open para não derrubar serviço
      // por glitch transitório.
      console.warn(`[rate-limit-ip] check failed: ${ipErr.message}`);
    } else if ((ipCount ?? 0) >= RATE_LIMIT_IP_MAX) {
      return json({
        error: 'rate_limited_ip',
        retry_after_seconds: RATE_LIMIT_IP_WINDOW_SECONDS,
        limit_max: RATE_LIMIT_IP_MAX,
        limit_window_seconds: RATE_LIMIT_IP_WINDOW_SECONDS,
      }, 429);
    }
  }

  /* 3b. Rate-limit por draftId (1 submit / 60s) — comportamento antigo */
  if (payload.draftId) {
    const cutoff = new Date(Date.now() - RATE_LIMIT_DRAFT_SECONDS * 1000).toISOString();
    const { data: recent, error: recentErr } = await sb
      .from('setup_submissions')
      .select('id')
      .eq('draft_id', payload.draftId)
      .gte('submitted_at', cutoff)
      .limit(1);
    if (recentErr) {
      return json({ error: 'rate_limit_check_failed', detail: recentErr.message }, 500);
    }
    if (recent && recent.length > 0) {
      return json({ error: 'rate_limited', retry_after_seconds: RATE_LIMIT_DRAFT_SECONDS }, 429);
    }
  }

  /* 4. Extrai dados úteis do snapshot */
  const tj = payload.technicalJson as TechnicalJsonShape;
  const obraNome = tj.customerInput?.dadosBasicos?.obraNome ?? '';
  const obraCodigo = (tj.metadata?.projectName as string | undefined) ?? '';
  const clienteNome = tj.customerInput?.dadosBasicos?.clienteNome ?? '';
  const responsavelNome = tj.metadata?.createdBy?.nome ?? '';
  const responsavelEmail = tj.metadata?.createdBy?.email ?? '';
  const countEstruturas = tj.technicalMapping?.unidadeGrupos?.length ?? 0;
  const countPecas = tj.technicalMapping?.unidades?.length ?? 0;
  const countConcretos = Array.isArray((tj.technicalMapping as { concretos?: unknown[] })?.concretos)
    ? ((tj.technicalMapping as { concretos: unknown[] }).concretos.length)
    : 0;

  /* 5. INSERT setup_submissions */
  const { data: submInserted, error: submErr } = await sb
    .from('setup_submissions')
    .insert({
      draft_id: payload.draftId,
      status: 'enviado',
      obra_codigo: obraCodigo,
      obra_nome: obraNome,
      technical_json: payload.technicalJson,
    })
    .select('id, submitted_at')
    .single();
  if (submErr || !submInserted) {
    return json({ error: 'submission_insert_failed', detail: submErr?.message }, 500);
  }

  /* 6. Reserva número do chamado (sequence via RPC) */
  const { data: seqVal, error: seqErr } = await sb.rpc('nextval_ticket');
  if (seqErr || typeof seqVal !== 'number') {
    await sb.from('setup_submissions').delete().eq('id', submInserted.id);
    return json({
      error: 'ticket_seq_failed',
      detail: seqErr?.message ?? `unexpected_type: ${typeof seqVal}`,
    }, 500);
  }
  const year = new Date().getFullYear();
  const ticketNumber = `CG-${year}-${String(seqVal).padStart(6, '0')}`;

  /* 7. INSERT setup_tickets — v5.22.5: agora com expires_at (90 dias) */
  const cc = isValidEmail(responsavelEmail) ? [responsavelEmail.trim()] : [];
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: ticketInserted, error: tkErr } = await sb
    .from('setup_tickets')
    .insert({
      submission_id: submInserted.id,
      ticket_number: ticketNumber,
      // access_token e client_access_token usam default gen_random_uuid()
      expires_at: expiresAt,
      email_recipients: notificationRecipients,
      email_cc: cc,
      client_message: payload.clientMessage || null,
    })
    .select('id, access_token, client_access_token, created_at')
    .single();
  if (tkErr || !ticketInserted) {
    await sb.from('setup_submissions').delete().eq('id', submInserted.id);
    return json({ error: 'ticket_insert_failed', detail: tkErr?.message }, 500);
  }

  /* 8. UPDATE setup_drafts (lock). Revalida token/status para fechar a janela
   * entre a leitura inicial e a criação do ticket. Em caso de corrida/falha,
   * remove os registros parciais antes de qualquer email. */
  const { data: lockedDraft, error: lockErr } = await sb
    .from('setup_drafts')
    .update({ locked_at: new Date().toISOString(), locked_by_submission: submInserted.id })
    .eq('id', payload.draftId as string)
    .eq('access_token', payload.draftToken as string)
    .is('locked_at', null)
    .in('status', ['rascunho', 'devolvido'])
    .select('id')
    .maybeSingle();
  if (lockErr || !lockedDraft) {
    await sb.from('setup_tickets').delete().eq('id', ticketInserted.id);
    await sb.from('setup_submissions').delete().eq('id', submInserted.id);
    return json({ error: 'draft_lock_failed', detail: lockErr?.message }, 409);
  }

  /* 9. Envio dos 2 emails via Resend */
  const reviewUrl = reviewUrlBase + ticketInserted.access_token;
  const clientStatusUrl = clientStatusUrlBase + ticketInserted.client_access_token;
  const submittedAt = new Date(submInserted.submitted_at).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  const ctx: EmailContext = {
    ticketNumber,
    obraNome: obraNome || '(sem nome)',
    obraCodigo,
    clienteNome,
    responsavelNome,
    responsavelEmail,
    countEstruturas,
    countPecas,
    countConcretos,
    clientMessage: payload.clientMessage ?? '',
    reviewUrl,
    clientStatusUrl,
    submittedAt,
  };

  // Email 1: equipe (com link de validação)
  const resEquipe = await resendSend({
    apiKey: resendApiKey,
    from: emailFrom,
    to: notificationRecipients,
    subject: `[Chamado ${ticketNumber}] Implantação · ${ctx.obraNome}`,
    html: emailEquipeHtml(ctx),
    text: emailEquipeText(ctx),
  });

  // Email 2: responsável (com link de status read-only)
  let resResp: { ok: boolean; id?: string; error?: string } = { ok: true };
  if (cc.length > 0) {
    resResp = await resendSend({
      apiKey: resendApiKey,
      from: emailFrom,
      to: cc,
      subject: `[Chamado ${ticketNumber}] Sua solicitação foi recebida`,
      html: emailResponsavelHtml(ctx),
      text: emailResponsavelText(ctx),
    });
  }

  /* 10. UPDATE setup_tickets com resultado do envio */
  const emailError = !resEquipe.ok
    ? `equipe: ${resEquipe.error}`
    : !resResp.ok
    ? `responsavel: ${resResp.error}`
    : null;
  await sb
    .from('setup_tickets')
    .update({
      email_sent_at: resEquipe.ok ? new Date().toISOString() : null,
      email_error: emailError,
    })
    .eq('id', ticketInserted.id);

  /* 11. Audit event — v5.22.5: actor inclui ip para suportar rate limit */
  await sb.from('setup_audit_events').insert({
    draft_id: payload.draftId,
    submission_id: submInserted.id,
    actor: clientIp !== 'unknown' ? `ip:${clientIp}` : 'system',
    action: 'ticket.created',
    entity: 'setup_tickets',
    source: 'edge_function',
    after: {
      ticket_number: ticketNumber,
      email_equipe_ok: resEquipe.ok,
      email_responsavel_ok: resResp.ok,
      email_error: emailError,
      client_ip: clientIp,
      expires_at: expiresAt,
    },
  });

  /* 12. Retorna SEM o access_token e SEM o client_access_token */
  return json({
    ok: true,
    ticket_number: ticketNumber,
    submission_id: submInserted.id,
    email_sent_to: resEquipe.ok ? notificationRecipients : [],
    email_cc: resResp.ok ? cc : [],
    email_error: emailError,
  }, 200);
});
