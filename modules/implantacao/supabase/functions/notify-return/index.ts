// =====================================================================
// supabase/functions/notify-return/index.ts · v5.22.6
//
// Dispara email para o responsável quando a equipe Consulte GEO devolve
// uma submissão. O frontend chama a RPC `return_submission_with_comment`
// que muda status + insere comentário; e DEPOIS chama esta Edge Function
// para enviar o email.
//
// Payload esperado:
//   {
//     ticket_number: "CG-2026-000001",
//     client_access_token: "uuid",
//     obra_nome: "...",
//     reviewer: "Thiago Costa",
//     reason: "texto do motivo (>=20 chars)",
//     email_cc: ["responsavel@empresa.com"]
//   }
//
// Secrets esperadas (já configuradas para submit-for-validation):
//   RESEND_API_KEY
//   EMAIL_FROM
//   CLIENT_STATUS_URL_BASE (ou inferida via REVIEW_URL_BASE → /s/)
//
// Deploy: supabase functions deploy notify-return
// =====================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

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
  return (Deno.env.get(name) ?? '').trim();
}
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function parseCsv(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}
function isValidEmail(s: string | undefined): boolean {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
/**
 * v5.22.14: mesma política do submit-for-validation —
 * atendimento@consultegeo.com.br é destinatário permanente da equipe.
 * NOTIFICATION_RECIPIENTS é OPCIONAL e adiciona destinatários.
 * NOTIFICATION_RECIPIENTS_DISABLE_DEFAULT=true desabilita o atendimento@.
 *
 * Em notify-return o email principal vai para o cliente (p.email_cc).
 * A equipe é incluída em CC para deixar trilha do que foi devolvido,
 * sem que o cliente veja os endereços internos.
 */
function buildTeamRecipientsCc(): string[] {
  const DEFAULT_TEAM_EMAIL = 'atendimento@consultegeo.com.br';
  const disableDefault = envOptional('NOTIFICATION_RECIPIENTS_DISABLE_DEFAULT')
    .toLowerCase() === 'true';
  const fromEnv = parseCsv(envOptional('NOTIFICATION_RECIPIENTS'));
  const list: string[] = [];
  if (!disableDefault) list.push(DEFAULT_TEAM_EMAIL);
  for (const e of fromEnv) list.push(e);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of list) {
    const norm = e.toLowerCase().trim();
    if (!seen.has(norm) && isValidEmail(e)) {
      seen.add(norm); out.push(e.trim());
    }
  }
  return out;
}

interface ReturnPayload {
  ticket_number: string;
  client_access_token: string;
  obra_nome: string;
  reviewer: string;
  reason: string;
  email_cc: string[];
}

function htmlBody(p: ReturnPayload, clientStatusUrl: string): string {
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#121a36;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="color:#0E1B40;margin:0 0 8px">Solicitação devolvida para ajustes</h2>
  <p style="color:#6d6a62;font-family:'Courier New',monospace;font-size:13px;letter-spacing:.1em;margin:0 0 24px">
    CHAMADO ${escapeHtml(p.ticket_number)}
  </p>

  <p>Olá,</p>
  <p>
    A equipe Consulte GEO revisou sua solicitação de implantação da obra
    <strong>${escapeHtml(p.obra_nome || 'sem nome')}</strong> e
    identificou pontos que precisam de ajuste antes de prosseguir.
  </p>

  <p><strong>Comentário da equipe ${p.reviewer ? `(${escapeHtml(p.reviewer)})` : ''}:</strong></p>
  <blockquote style="border-left:4px solid #C5117E;padding:8px 12px;margin:8px 0;background:#fafafa;color:#333">
    ${escapeHtml(p.reason).replace(/\n/g, '<br>')}
  </blockquote>

  <div style="margin:32px 0;text-align:center">
    <a href="${escapeHtml(clientStatusUrl)}"
       style="display:inline-block;background:#0E1B40;color:#fff;padding:14px 28px;text-decoration:none;border-radius:12px;font-weight:700">
      Abrir cadastro para edição
    </a>
    <p style="color:#6d6a62;font-size:12px;margin-top:12px">
      Edite os dados conforme o comentário acima e clique em
      "Reenviar para validação" no final.
    </p>
  </div>

  <p style="color:#6d6a62;font-size:12px;margin-top:32px;border-top:1px solid #e7e2d8;padding-top:16px">
    Mensagem automática · Implantação Consulte GEO. Em caso de dúvida,
    use o canal habitual com a equipe citando o chamado acima.
  </p>
</body></html>`;
}

function textBody(p: ReturnPayload, clientStatusUrl: string): string {
  return [
    `Solicitação devolvida - ${p.ticket_number}`,
    '',
    `Obra: ${p.obra_nome || 'sem nome'}`,
    '',
    `Comentário da equipe${p.reviewer ? ` (${p.reviewer})` : ''}:`,
    p.reason,
    '',
    'Abrir cadastro para edição:',
    `  ${clientStatusUrl}`,
    '',
    'Edite os dados conforme o comentário e clique em "Reenviar para validação" no final.',
    '',
    '---',
    'Mensagem automática · Implantação Consulte GEO',
  ].join('\n');
}

async function resendSend(args: {
  apiKey: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (args.to.length === 0) return { ok: false, error: 'no_recipients' };
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
    const responseBody = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `resend_${res.status}: ${JSON.stringify(responseBody).slice(0, 200)}` };
    return { ok: true, id: responseBody.id };
  } catch (err) {
    return { ok: false, error: `resend_exception: ${String(err).slice(0, 200)}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const requestedHeaders = req.headers.get('access-control-request-headers');
    const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
    if (requestedHeaders) {
      responseHeaders['Access-Control-Allow-Headers'] = requestedHeaders;
    }
    return new Response(null, { status: 204, headers: responseHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let p: ReturnPayload;
  try { p = await req.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  if (!p?.ticket_number || !p?.client_access_token || !p?.reason) {
    return json({ error: 'missing_fields' }, 400);
  }
  if (!Array.isArray(p.email_cc) || p.email_cc.length === 0) {
    // Sem destinatário, retorna ok sem enviar nada (defensivo)
    return json({ ok: true, skipped: 'no_recipient' }, 200);
  }

  let resendApiKey: string;
  let emailFrom: string;
  let baseUrl: string;
  try {
    resendApiKey = envOrThrow('RESEND_API_KEY');
    emailFrom = envOrThrow('EMAIL_FROM');
    const review = envOrThrow('REVIEW_URL_BASE');
    baseUrl = envOptional('CLIENT_STATUS_URL_BASE') || review.replace(/\/r\/?$/, '/s/');
  } catch (err) {
    return json({ error: String(err).replace(/^Error:\s*/, '') }, 500);
  }

  const clientStatusUrl = baseUrl + p.client_access_token;
  // v5.22.14: equipe Consulte GEO (atendimento@ + NOTIFICATION_RECIPIENTS)
  // entra em CC para deixar trilha sem expor endereços internos ao cliente.
  const teamCc = buildTeamRecipientsCc();
  // Dedup também contra os destinatários do cliente, evitando enviar 2x
  // se acaso o atendimento@ estiver listado como contato da obra.
  const clientLower = new Set(p.email_cc.map((e) => e.toLowerCase()));
  const teamCcFiltered = teamCc.filter((e) => !clientLower.has(e.toLowerCase()));

  const res = await resendSend({
    apiKey: resendApiKey,
    from: emailFrom,
    to: p.email_cc,
    cc: teamCcFiltered.length > 0 ? teamCcFiltered : undefined,
    subject: `[Chamado ${p.ticket_number}] Devolvido para ajustes`,
    html: htmlBody(p, clientStatusUrl),
    text: textBody(p, clientStatusUrl),
  });

  return json({
    ok: res.ok,
    email_id: res.id,
    error: res.error,
    sent_to: res.ok ? p.email_cc : [],
    cc_team: res.ok ? teamCcFiltered : [],
  }, res.ok ? 200 : 500);
});
