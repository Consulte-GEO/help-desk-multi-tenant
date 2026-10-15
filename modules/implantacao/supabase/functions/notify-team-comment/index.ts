// =====================================================================
// supabase/functions/notify-team-comment/index.ts · v5.22.34
//
// Notifica o cliente quando a equipe Consulte GEO posta um
// comentário PÚBLICO em um chamado. Espelho inverso de
// notify-client-comment (que avisa equipe quando cliente posta).
//
// Acionado por:
//   - ReviewView.onAddComment (equipe em /r/:token)
//   - AdminDashboardView.onSendPublicComment (admin no painel /admin)
//
// Payload (mínimo):
//   {
//     submission_id: "uuid",
//     comment_body: "primeiros 600 chars do corpo",
//     team_author: "thiago@consultegeo.com.br" (opcional, default 'Equipe Consulte GEO')
//   }
//
// Por que submission_id em vez de client_access_token?
//   Equipe NÃO tem acesso direto ao client_access_token no UI dela.
//   O painel admin trabalha com submission_id; ReviewView trabalha
//   com access_token (de equipe). Submission_id é o denominador
//   comum: ambos os contextos têm acesso.
//
// Por que apenas comentários PÚBLICOS disparam notify?
//   - internal_only=true em setup_review_comments = notas internas,
//     cliente NÃO vê → não notificar
//   - internal_only=false = comentário visível em /s/:token → notificar
//   - Frontend é responsável por chamar apenas quando o comentário
//     é público (RPC add_review_comment_by_token e RPC
//     add_review_comment_as_admin já inserem com internal_only=false)
//
// Por que fire-and-forget?
//   Mesma razão que notify-client-comment: o comentário JÁ está
//   persistido pela RPC. Email cair não desfaz a confirmação ao
//   admin/equipe. UX preservada.
//
// Secrets esperadas:
//   RESEND_API_KEY
//   EMAIL_FROM
//   CLIENT_STATUS_URL_BASE (ou inferida de REVIEW_URL_BASE)
//   SUPABASE_URL                 (injetado automaticamente)
//   SUPABASE_SERVICE_ROLE_KEY    (injetado automaticamente)
//
// Deploy: supabase functions deploy notify-team-comment --no-verify-jwt
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

interface CommentPayload {
  submission_id?: string;
  comment_body?: string;
  team_author?: string;
}

interface SubmissionContext {
  submission_id: string;
  ticket_number: string;
  obra_nome: string;
  responsavel_nome: string;
  client_access_token: string;
  email_recipients: string[];
  email_cc: string[];
}

async function resolveSubmissionContext(
  supabaseUrl: string,
  serviceRoleKey: string,
  submissionId: string,
): Promise<SubmissionContext | null> {
  try {
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Resolve ticket pelo submission_id (1:1)
    const { data: ticket, error: tErr } = await sb
      .from('setup_tickets')
      .select('ticket_number, client_access_token, email_recipients, email_cc')
      .eq('submission_id', submissionId)
      .maybeSingle();
    if (tErr || !ticket) return null;

    const ticketRow = ticket as {
      ticket_number: string;
      client_access_token: string;
      email_recipients: string[];
      email_cc: string[];
    };

    // Sem token de cliente NÃO podemos linkar para /s/:token.
    // Aborta — email sem link de retorno é confuso.
    if (!ticketRow.client_access_token) return null;

    // 2) Resolve obra_nome + responsavel_nome via submissions
    const { data: subm } = await sb
      .from('setup_submissions')
      .select('obra_nome, technical_json')
      .eq('id', submissionId)
      .maybeSingle();
    const submRow = (subm as {
      obra_nome?: string;
      technical_json?: { metadata?: { createdBy?: { nome?: string } } };
    } | null) || {};

    return {
      submission_id: submissionId,
      ticket_number: ticketRow.ticket_number,
      obra_nome: submRow.obra_nome || '(sem nome)',
      responsavel_nome: submRow.technical_json?.metadata?.createdBy?.nome || '',
      client_access_token: ticketRow.client_access_token,
      email_recipients: Array.isArray(ticketRow.email_recipients)
        ? ticketRow.email_recipients
        : [],
      email_cc: Array.isArray(ticketRow.email_cc) ? ticketRow.email_cc : [],
    };
  } catch {
    return null;
  }
}

interface ResendSendArgs {
  to: string[];
  cc?: string[];
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
    const body: Record<string, unknown> = {
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    };
    if (args.cc && args.cc.length > 0) body.cc = args.cc;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return { ok: false, error: `resend_${res.status}: ${errBody.slice(0, 200)}` };
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
  responsavelNome: string;
  teamAuthor: string;
  commentBody: string;
  statusUrl: string;
}): string {
  // Visual alinhado com notify-return + notify-client-comment.
  // Diferença: header destaca "RESPOSTA DA EQUIPE" para o cliente
  // saber rapidamente que é interação humana, não automação.
  return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Nova resposta da equipe Consulte GEO</title>
</head>
<body style="margin:0;padding:24px;background:#f7f6f2;font-family:-apple-system,system-ui,sans-serif;color:#111">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
         style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
    <tr>
      <td style="padding:20px 24px;background:#182863;color:#fff">
        <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;opacity:0.7">Consulte GEO · Implantação</div>
        <div style="font-size:18px;font-weight:600;margin-top:4px">Resposta da equipe Consulte GEO</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <p style="margin:0 0 12px;font-size:15px">
          ${p.responsavelNome ? `Olá ${escapeHtml(p.responsavelNome)}, a` : 'A'}
          equipe Consulte GEO acaba de responder no chamado
          <strong>${escapeHtml(p.ticketNumber)}</strong>.
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#666">
          Obra: ${escapeHtml(p.obraNome)}
        </p>

        <div style="margin:16px 0;padding:14px 16px;background:#f7f6f2;border-left:3px solid #182863;border-radius:4px">
          <div style="font-size:13px;color:#666;margin-bottom:6px">
            Mensagem da equipe${p.teamAuthor ? ` (${escapeHtml(p.teamAuthor)})` : ''}:
          </div>
          <div style="font-size:14px;white-space:pre-wrap;color:#111">${escapeHtml(p.commentBody)}</div>
        </div>

        <p style="margin:20px 0 0;font-size:14px">
          Acesse o chamado para ver o histórico completo e responder:
        </p>
        <p style="margin:8px 0 0">
          <a href="${escapeHtml(p.statusUrl)}"
             style="display:inline-block;padding:10px 18px;background:#c5117e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
            Abrir chamado ${escapeHtml(p.ticketNumber)}
          </a>
        </p>
        <p style="margin:18px 0 0;font-size:12px;color:#999">
          Você está recebendo este email porque é responsável pelo chamado
          de implantação ${escapeHtml(p.ticketNumber)} no Consulte GEO.
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
  responsavelNome: string;
  teamAuthor: string;
  commentBody: string;
  statusUrl: string;
}): string {
  const greeting = p.responsavelNome ? `Olá ${p.responsavelNome},` : 'Olá,';
  return [
    greeting,
    ``,
    `A equipe Consulte GEO respondeu no chamado ${p.ticketNumber}.`,
    ``,
    `Obra: ${p.obraNome}`,
    p.teamAuthor ? `Autor da resposta: ${p.teamAuthor}` : '',
    ``,
    `Mensagem:`,
    p.commentBody,
    ``,
    `Ver chamado: ${p.statusUrl}`,
  ].filter(Boolean).join('\n');
}

/**
 * v5.22.34: resolve a URL base para `/s/:token`.
 * Aceita CLIENT_STATUS_URL_BASE explícita ou infere de
 * REVIEW_URL_BASE (substituindo /r por /s).
 */
function resolveStatusBase(): string {
  const explicit = envOptional('CLIENT_STATUS_URL_BASE');
  if (explicit) return explicit.replace(/\/$/, '');
  const review = envOptional('REVIEW_URL_BASE');
  if (review) {
    // /r/ → /s/
    return review.replace(/\/$/, '').replace(/\/r$/, '/s');
  }
  // Último fallback: domínio em produção
  return 'https://setup.consultegeo.org/s';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let apiKey: string;
  let emailFrom: string;
  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    apiKey = envOrThrow('RESEND_API_KEY');
    emailFrom = envOrThrow('EMAIL_FROM');
    supabaseUrl = envOrThrow('SUPABASE_URL');
    serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  } catch (err) {
    return json({ ok: false, error: String(err).replace(/^Error:\s*/, '') }, 500);
  }
  const statusBase = resolveStatusBase();

  let payload: CommentPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!payload.submission_id || !isValidUuid(payload.submission_id)) {
    return json({ ok: false, error: 'invalid_submission_id' }, 400);
  }
  if (!payload.comment_body || payload.comment_body.length === 0) {
    return json({ ok: false, error: 'comment_body_required' }, 400);
  }

  const commentBody = payload.comment_body.slice(0, 600);
  const teamAuthor = (payload.team_author || '').slice(0, 100);

  const ctx = await resolveSubmissionContext(supabaseUrl, serviceRoleKey, payload.submission_id);
  if (!ctx) {
    // Não acha submission OU ticket sem client_access_token.
    // Retorna 404 mas frontend ignora (fire-and-forget).
    return json({ ok: false, error: 'submission_not_found_or_no_client_token' }, 404);
  }

  // Destinatários: responsavel principal + CCs do ticket original.
  // Se array estiver vazio (raro mas possível), aborta.
  if (ctx.email_recipients.length === 0) {
    return json({
      ok: false,
      error: 'no_recipients',
      submission_id: ctx.submission_id,
    }, 422);
  }

  const statusUrl = `${statusBase}/${ctx.client_access_token}`;

  const subject = `[${ctx.ticket_number}] Equipe Consulte GEO respondeu · ${ctx.obra_nome.slice(0, 60)}`;
  const html = buildHtml({
    ticketNumber: ctx.ticket_number,
    obraNome: ctx.obra_nome,
    responsavelNome: ctx.responsavel_nome,
    teamAuthor,
    commentBody,
    statusUrl,
  });
  const text = buildText({
    ticketNumber: ctx.ticket_number,
    obraNome: ctx.obra_nome,
    responsavelNome: ctx.responsavel_nome,
    teamAuthor,
    commentBody,
    statusUrl,
  });

  const resendResult = await resendSend({
    to: ctx.email_recipients,
    cc: ctx.email_cc.length > 0 ? ctx.email_cc : undefined,
    from: emailFrom,
    subject,
    html,
    text,
    apiKey,
  });

  // Audit best-effort
  try {
    const sbAudit = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await sbAudit.from('setup_audit_events').insert({
      submission_id: ctx.submission_id,
      actor: 'edge_function:notify-team-comment',
      action: resendResult.ok ? 'notify_client_team_comment_sent' : 'notify_client_team_comment_failed',
      entity: 'setup_review_comments',
      source: 'edge_function',
      after: {
        ticket_number: ctx.ticket_number,
        recipients: ctx.email_recipients,
        cc: ctx.email_cc,
        team_author: teamAuthor,
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
    email_sent_to: ctx.email_recipients,
    email_cc: ctx.email_cc,
    submission_id: ctx.submission_id,
  }, resendResult.ok ? 200 : 502);
});
