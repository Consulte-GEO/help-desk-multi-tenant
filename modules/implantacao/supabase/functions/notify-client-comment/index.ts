// =====================================================================
// supabase/functions/notify-client-comment/index.ts · v5.22.30
//
// Notifica a equipe Consulte GEO quando o cliente envia um comentário
// via /s/:token. Antes da v5.22.30 essa ação era silenciosa: o
// comentário ficava no banco e só era visto quando a equipe entrava
// no painel admin (ou abria /r/:token).
//
// Chamada pelo frontend ClientStatusView.onAddClientComment APÓS a
// RPC add_review_comment_by_client_token retornar sucesso.
// Fire-and-forget: se o email falhar, o comentário não é perdido
// (já foi persistido).
//
// Payload mínimo do frontend:
//   { client_access_token: "uuid", body_preview: "...primeiros 600 chars" }
//
// Por que NÃO recebemos ticket_number/obra_nome/etc do payload?
//   O frontend cliente em /s/:token NÃO tem submission_id exposto
//   (RPC get_status_by_client_token não retorna). A Edge Function
//   resolve internamente via SERVICE_ROLE_KEY que tem privilégio
//   para SELECT em setup_tickets + setup_submissions.
//
//   Vantagens:
//   - Sem migration nova (RPC existente intocada)
//   - Payload menor — frontend só passa o que já tem
//   - Defesa: cliente não pode forjar ticket_number alheio
//
// Por que fire-and-forget do frontend?
//   - Resend pode ter rate limit / outage transiente
//   - O comentário JÁ está persistido pela RPC anterior
//   - Email é "nice to have"
//
// Secrets esperadas:
//   RESEND_API_KEY               (mesmo das outras Edge Functions)
//   EMAIL_FROM                   (mesmo)
//   REVIEW_URL_BASE              (mesmo, ex.: https://setup.consultegeo.org/r)
//   SUPABASE_URL                 (injetado automaticamente)
//   SUPABASE_SERVICE_ROLE_KEY    (injetado automaticamente)
//
// Variável opcional:
//   NOTIFICATION_RECIPIENTS  → CSV de emails (default: atendimento@consultegeo.com.br)
//
// Deploy: supabase functions deploy notify-client-comment --no-verify-jwt
// =====================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, ' +
    'x-app-env, x-app-name, x-supabase-api-version, x-requested-with',
  'Access-Control-Max-Age': '86400',
};

const ATENDIMENTO_DEFAULT = 'atendimento@consultegeo.com.br';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function envOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v || !v.trim()) throw new Error(`missing_env: ${name}`);
  return v.trim();
}

function envOptional(name: string): string {
  return (Deno.env.get(name) || '').trim();
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTeamRecipients(): string[] {
  const csv = envOptional('NOTIFICATION_RECIPIENTS');
  const set = new Set<string>();
  set.add(ATENDIMENTO_DEFAULT);
  if (csv) {
    for (const raw of csv.split(',')) {
      const email = raw.trim().toLowerCase();
      if (email && email.includes('@')) set.add(email);
    }
  }
  return Array.from(set);
}

interface CommentPayload {
  client_access_token?: string;
  body_preview?: string;
}

/** Dados resolvidos via service role key */
interface TicketContext {
  submission_id: string;
  ticket_number: string;
  obra_nome: string;
  responsavel_nome: string;
  access_token: string;  // token de equipe (/r/:token) para link no email
}

async function resolveTicketContext(
  supabaseUrl: string,
  serviceRoleKey: string,
  clientAccessToken: string,
): Promise<TicketContext | null> {
  try {
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // 1) Resolve ticket pelo client_access_token.
    // HOTFIX v5.22.31: setup_tickets NÃO tem coluna `payload`.
    // Removida da query.
    const { data: ticket, error: tErr } = await sb
      .from('setup_tickets')
      .select('submission_id, ticket_number, access_token')
      .eq('client_access_token', clientAccessToken)
      .maybeSingle();
    if (tErr || !ticket) return null;

    const ticketRow = ticket as {
      submission_id: string;
      ticket_number: string;
      access_token: string;
    };

    // 2) Resolve obra_nome + responsavel_nome via submissions.
    // HOTFIX v5.22.31: setup_submissions NÃO tem coluna
    // `responsavel_nome` direta. Vem de technical_json -> metadata
    // -> createdBy -> nome (mesma extração que o RPC
    // get_status_by_client_token usa).
    const { data: subm } = await sb
      .from('setup_submissions')
      .select('obra_nome, technical_json')
      .eq('id', ticketRow.submission_id)
      .maybeSingle();
    const submRow = (subm as {
      obra_nome?: string;
      technical_json?: {
        metadata?: { createdBy?: { nome?: string } };
      };
    } | null) || {};

    const responsavelNome =
      submRow.technical_json?.metadata?.createdBy?.nome || '';

    return {
      submission_id: ticketRow.submission_id,
      ticket_number: ticketRow.ticket_number,
      obra_nome: submRow.obra_nome || '(sem nome)',
      responsavel_nome: responsavelNome,
      access_token: ticketRow.access_token,
    };
  } catch {
    return null;
  }
}

interface ResendSendArgs {
  to: string[];
  subject: string;
  html: string;
  text: string;
  from: string;
  apiKey: string;
}

async function resendSend(args: ResendSendArgs): Promise<{
  ok: boolean;
  email_id?: string;
  error?: string;
}> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `resend_${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, email_id: (data as { id?: string }).id };
  } catch (err) {
    return { ok: false, error: `network: ${String(err).slice(0, 200)}` };
  }
}

function buildHtml(p: {
  ticketNumber: string;
  obraNome: string;
  clientAuthor: string;
  bodyPreview: string;
  reviewUrl: string;
}): string {
  return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Novo comentário do cliente</title>
</head>
<body style="margin:0;padding:24px;background:#f7f6f2;font-family:-apple-system,system-ui,sans-serif;color:#111">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
         style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
    <tr>
      <td style="padding:20px 24px;background:#182863;color:#fff">
        <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;opacity:0.7">Consulte GEO · Implantação</div>
        <div style="font-size:18px;font-weight:600;margin-top:4px">Novo comentário do cliente</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <p style="margin:0 0 12px;font-size:15px">
          <strong>${escapeHtml(p.clientAuthor || 'O responsável pelo chamado')}</strong>
          enviou uma nova mensagem no chamado
          <strong>${escapeHtml(p.ticketNumber)}</strong>.
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#666">Obra: ${escapeHtml(p.obraNome || '(sem nome)')}</p>

        <div style="margin:16px 0;padding:14px 16px;background:#f7f6f2;border-left:3px solid #c5117e;border-radius:4px">
          <div style="font-size:13px;color:#666;margin-bottom:6px">Trecho da mensagem:</div>
          <div style="font-size:14px;white-space:pre-wrap;color:#111">${escapeHtml(p.bodyPreview)}</div>
        </div>

        <p style="margin:20px 0 0;font-size:14px">Responder pelo painel de validação:</p>
        <p style="margin:8px 0 0">
          <a href="${escapeHtml(p.reviewUrl)}"
             style="display:inline-block;padding:10px 18px;background:#c5117e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
            Abrir chamado ${escapeHtml(p.ticketNumber)}
          </a>
        </p>
        <p style="margin:18px 0 0;font-size:12px;color:#999">
          Ou acesse o painel de gestão em
          <a href="https://setup.consultegeo.org/admin" style="color:#666">/admin</a>
          para ver todas as conversas.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(p: {
  ticketNumber: string;
  obraNome: string;
  clientAuthor: string;
  bodyPreview: string;
  reviewUrl: string;
}): string {
  return [
    `Novo comentário do cliente no chamado ${p.ticketNumber}.`,
    ``,
    `Obra: ${p.obraNome || '(sem nome)'}`,
    `Autor: ${p.clientAuthor || '(responsável)'}`,
    ``,
    `Trecho da mensagem:`,
    p.bodyPreview,
    ``,
    `Responder: ${p.reviewUrl}`,
    `Painel: https://setup.consultegeo.org/admin`,
  ].join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  // Validação de envs
  let apiKey: string;
  let emailFrom: string;
  let reviewBase: string;
  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    apiKey = envOrThrow('RESEND_API_KEY');
    emailFrom = envOrThrow('EMAIL_FROM');
    reviewBase = envOrThrow('REVIEW_URL_BASE');
    supabaseUrl = envOrThrow('SUPABASE_URL');
    serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  } catch (err) {
    return json({ ok: false, error: String(err).replace(/^Error:\s*/, '') }, 500);
  }

  // Payload
  let payload: CommentPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!payload.client_access_token || !isValidUuid(payload.client_access_token)) {
    return json({ ok: false, error: 'invalid_client_access_token' }, 400);
  }
  if (!payload.body_preview || payload.body_preview.length === 0) {
    return json({ ok: false, error: 'body_preview_required' }, 400);
  }

  const bodyPreview = payload.body_preview.slice(0, 600);

  // Resolve contexto via service role
  const ctx = await resolveTicketContext(supabaseUrl, serviceRoleKey, payload.client_access_token);
  if (!ctx) {
    return json({ ok: false, error: 'ticket_not_found_or_invalid_token' }, 404);
  }

  // Link aponta para /r/:token (token da EQUIPE) — admin pode ver
  // o chamado completo, não a visão limitada do cliente. O frontend
  // só conhece o client_access_token, mas a Edge Function pode usar
  // o access_token via service role.
  const reviewUrl = `${reviewBase.replace(/\/$/, '')}/${ctx.access_token}`;

  const recipients = buildTeamRecipients();

  const subject = `[${ctx.ticket_number}] Cliente enviou mensagem · ${ctx.obra_nome.slice(0, 60)}`;
  const html = buildHtml({
    ticketNumber: ctx.ticket_number,
    obraNome: ctx.obra_nome,
    clientAuthor: ctx.responsavel_nome,
    bodyPreview,
    reviewUrl,
  });
  const text = buildText({
    ticketNumber: ctx.ticket_number,
    obraNome: ctx.obra_nome,
    clientAuthor: ctx.responsavel_nome,
    bodyPreview,
    reviewUrl,
  });

  const resendResult = await resendSend({
    to: recipients,
    from: emailFrom,
    subject,
    html,
    text,
    apiKey,
  });

  // Audit best-effort (não bloqueia o retorno se falhar)
  try {
    const sbAudit = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await sbAudit.from('setup_audit_events').insert({
      submission_id: ctx.submission_id,
      actor: 'edge_function:notify-client-comment',
      action: resendResult.ok ? 'notify_team_client_comment_sent' : 'notify_team_client_comment_failed',
      entity: 'setup_review_comments',
      source: 'edge_function',
      after: {
        ticket_number: ctx.ticket_number,
        recipients,
        error: resendResult.error,
      },
    });
  } catch {
    /* silencioso */
  }

  return json({
    ok: resendResult.ok,
    email_id: resendResult.email_id,
    error: resendResult.error,
    email_sent_to: recipients,
    submission_id: ctx.submission_id,
  }, resendResult.ok ? 200 : 502);
});
