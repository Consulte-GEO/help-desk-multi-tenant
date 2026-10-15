// =====================================================================
// supabase/functions/share-draft-link/index.ts · v5.22.45
//
// Envia por email o link de um rascunho com id+token no fragmento para
// um colega ou para o próprio usuário em outra máquina. Complementa o botão
// "Copiar link" — útil quando o usuário quer formalizar a
// passagem da tarefa (estagiário → engenheiro, escritório → obra).
//
// Payload esperado:
//   {
//     draftId: "uuid",                  // obrigatório
//     draftToken: "uuid",               // obrigatório; posse do rascunho
//     recipientEmail: "alguem@empresa.com",  // obrigatório
//     recipientName?: "João Silva",     // opcional
//     senderName?: "Thiago",            // opcional, p/ "enviado por X"
//     message?: "Continue daqui."       // opcional, texto livre
//   }
//
// Resposta de sucesso:
//   { ok: true, email_id: "re_xxx", sent_to: "alguem@empresa.com" }
//
// Resposta de erro:
//   { ok: false, error: "código_legível: detalhe" }
//
// Secrets esperadas (mesmas das outras funções):
//   RESEND_API_KEY                — chave do Resend
//   EMAIL_FROM                    — ex.: "Consulte GEO <noreply@pozzo.dev>"
//   APP_URL_BASE (ou SETUP_URL_BASE) — ex.: "https://setup.consultegeo.org"
//     Fallback: deriva de REVIEW_URL_BASE removendo "/r/"
//
// Boas práticas reusadas do notify-return:
//   - CORS completo + tratamento de OPTIONS
//   - Validação defensiva de payload
//   - escapeHtml para evitar injection no HTML do email
//   - Erro estruturado em caso de falha do Resend
//
// Auditoria: este endpoint NÃO escreve em setup_audit_events
// diretamente — o frontend faz o log via `addAuditLocal({acao:
// 'link_compartilhado_email', ...})` que entra no flush habitual.
// Mantém a separação: a Edge Function é só o canal de email.
//
// Deploy: supabase functions deploy share-draft-link
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
  return (Deno.env.get(name) ?? '').trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isValidEmail(s: string | undefined): boolean {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isValidUuid(s: string | undefined): boolean {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

interface SharePayload {
  draftId: string;
  draftToken: string;
  recipientEmail: string;
  recipientName?: string;
  senderName?: string;
  message?: string;
}

function resolveAppUrl(): string {
  // Preferência: APP_URL_BASE → SETUP_URL_BASE → deriva de REVIEW_URL_BASE.
  const app = envOptional('APP_URL_BASE');
  if (app) return app.replace(/\/+$/, '');
  const setup = envOptional('SETUP_URL_BASE');
  if (setup) return setup.replace(/\/+$/, '');
  const review = envOptional('REVIEW_URL_BASE');
  if (review) {
    // ex.: "https://setup.consultegeo.org/r/" → "https://setup.consultegeo.org"
    return review.replace(/\/r\/?$/, '').replace(/\/+$/, '');
  }
  // Último recurso defensivo — não deveria acontecer em prod
  return 'https://setup.consultegeo.org';
}

function buildLink(appUrlBase: string, draftId: string, draftToken: string): string {
  const fragment = new URLSearchParams({ draft: draftId, token: draftToken });
  return `${appUrlBase}/#${fragment.toString()}`;
}

function htmlBody(p: SharePayload, link: string): string {
  const greeting = p.recipientName
    ? `Olá, ${escapeHtml(p.recipientName)}!`
    : 'Olá!';
  const senderLine = p.senderName
    ? `<p>${escapeHtml(p.senderName)} compartilhou com você um cadastro de obra em andamento no <strong>Implantação Consulte GEO</strong>.</p>`
    : `<p>Alguém compartilhou com você um cadastro de obra em andamento no <strong>Implantação Consulte GEO</strong>.</p>`;
  const messageBlock = (p.message && p.message.trim())
    ? `<p><strong>Mensagem:</strong></p>
       <blockquote style="border-left:4px solid #C5117E;padding:8px 12px;margin:8px 0;background:#fafafa;color:#333">
         ${escapeHtml(p.message).replace(/\n/g, '<br>')}
       </blockquote>`
    : '';

  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#121a36;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="color:#0E1B40;margin:0 0 8px">Cadastro de obra compartilhado com você</h2>
  <p style="color:#6d6a62;font-family:'Courier New',monospace;font-size:13px;letter-spacing:.1em;margin:0 0 24px">
    IMPLANTAÇÃO CONSULTE GEO
  </p>

  <p>${greeting}</p>
  ${senderLine}
  ${messageBlock}

  <div style="margin:32px 0;text-align:center">
    <a href="${escapeHtml(link)}"
       style="display:inline-block;background:#0E1B40;color:#fff;padding:14px 28px;text-decoration:none;border-radius:12px;font-weight:700">
      Abrir cadastro
    </a>
    <p style="color:#6d6a62;font-size:12px;margin-top:12px">
      O link abre o cadastro exatamente no ponto em que foi deixado.
      Você pode continuar de onde quem te enviou parou.
    </p>
  </div>

  <p style="color:#6d6a62;font-size:11px;margin-top:24px">
    Se o botão não funcionar, copie e cole no navegador:<br>
    <span style="word-break:break-all">${escapeHtml(link)}</span>
  </p>

  <p style="color:#6d6a62;font-size:12px;margin-top:32px;border-top:1px solid #e7e2d8;padding-top:16px">
    Mensagem automática · Implantação Consulte GEO. Se você recebeu
    este email por engano, pode ignorá-lo — o link só dá acesso ao
    cadastro deste rascunho específico.
  </p>
</body></html>`;
}

function textBody(p: SharePayload, link: string): string {
  const greeting = p.recipientName ? `Olá, ${p.recipientName}!` : 'Olá!';
  const senderLine = p.senderName
    ? `${p.senderName} compartilhou com você um cadastro de obra em andamento no Implantação Consulte GEO.`
    : 'Alguém compartilhou com você um cadastro de obra em andamento no Implantação Consulte GEO.';
  const messageBlock = (p.message && p.message.trim())
    ? `\nMensagem:\n${p.message}\n`
    : '';
  return [
    'Cadastro de obra compartilhado com você',
    'IMPLANTAÇÃO CONSULTE GEO',
    '',
    greeting,
    senderLine,
    messageBlock,
    'Abrir cadastro:',
    `  ${link}`,
    '',
    'O link abre o cadastro exatamente no ponto em que foi deixado.',
    '',
    '---',
    'Mensagem automática · Implantação Consulte GEO',
  ].join('\n');
}

async function resendSend(args: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
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
    if (args.replyTo) body.reply_to = args.replyTo;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const responseBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: `resend_${res.status}: ${JSON.stringify(responseBody).slice(0, 200)}`,
      };
    }
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
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let p: SharePayload;
  try {
    p = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // Validações de payload
  if (!p?.draftId || !isValidUuid(p.draftId)) {
    return json({ ok: false, error: 'invalid_draft_id' }, 400);
  }
  if (!p?.draftToken || !isValidUuid(p.draftToken)) {
    return json({ ok: false, error: 'invalid_draft_token' }, 400);
  }
  if (!p?.recipientEmail || !isValidEmail(p.recipientEmail)) {
    return json({ ok: false, error: 'invalid_recipient_email' }, 400);
  }

  // Limita tamanho da mensagem opcional para evitar abuso
  if (p.message && p.message.length > 2000) {
    return json({ ok: false, error: 'message_too_long' }, 400);
  }
  if (p.recipientName && p.recipientName.length > 200) {
    return json({ ok: false, error: 'recipient_name_too_long' }, 400);
  }
  if (p.senderName && p.senderName.length > 200) {
    return json({ ok: false, error: 'sender_name_too_long' }, 400);
  }

  // Envs obrigatórias
  let resendApiKey: string;
  let emailFrom: string;
  let supabaseUrl: string;
  let serviceKey: string;
  try {
    resendApiKey = envOrThrow('RESEND_API_KEY');
    emailFrom = envOrThrow('EMAIL_FROM');
    supabaseUrl = envOrThrow('SUPABASE_URL');
    serviceKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  } catch (err) {
    return json({ ok: false, error: String(err).replace(/^Error:\s*/, '') }, 500);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: ownedDraft, error: draftErr } = await sb
    .from('setup_drafts')
    .select('id, status, locked_at')
    .eq('id', p.draftId)
    .eq('access_token', p.draftToken)
    .maybeSingle();
  if (draftErr) {
    return json({ ok: false, error: `draft_validation_failed: ${draftErr.message}` }, 500);
  }
  if (!ownedDraft) {
    return json({ ok: false, error: 'draft_token_invalid' }, 403);
  }
  if (ownedDraft.locked_at || !['rascunho', 'devolvido'].includes(ownedDraft.status)) {
    return json({ ok: false, error: 'draft_not_shareable' }, 409);
  }

  const appUrl = resolveAppUrl();
  const link = buildLink(appUrl, p.draftId, p.draftToken);

  const subject = p.senderName
    ? `${p.senderName} compartilhou um cadastro de obra com você`
    : 'Cadastro de obra compartilhado com você';

  const res = await resendSend({
    apiKey: resendApiKey,
    from: emailFrom,
    to: [p.recipientEmail.trim()],
    subject,
    html: htmlBody(p, link),
    text: textBody(p, link),
  });

  return json({
    ok: res.ok,
    email_id: res.id,
    error: res.error,
    sent_to: res.ok ? p.recipientEmail.trim() : null,
  }, res.ok ? 200 : 500);
});
