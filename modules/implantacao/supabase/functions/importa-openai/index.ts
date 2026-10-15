// ============================================================================
// supabase/functions/importa-openai/index.ts  ·  v5.22.42
// Proxy server-side da IA do Copilot de Importação de Planilhas (/importa).
// A chave OpenAI fica SOMENTE no servidor (Deno.env), nunca no cliente público
// em setup.consultegeo.org/importa. É o modo padrão de IA da página ("proxy").
//
// Deploy:
//   supabase functions deploy importa-openai --no-verify-jwt
// Segredo (NUNCA commitar):
//   supabase secrets set OPENAI_API_KEY=sk-...
//
// Contrato: POST body igual ao /v1/chat/completions da OpenAI
//   { model, messages, temperature?, max_tokens?, response_format? }
// Resposta: passthrough do JSON da OpenAI (o cliente lê choices[0].message.content),
// ou { error } com status 4xx/5xx.
//
// Segurança aplicada aqui:
//   - somente POST; payload limitado (~1,5 MB) — o copilot envia só grupos ambíguos;
//   - model validado por regex e allowlist ampliável via env EXTRA_MODELS
//     (lista separada por vírgula) — modelos novos entram sem redeploy;
//   - messages saneadas: apenas role/content string, máx. 24 mensagens;
//   - max_tokens teto 8000; temperature forçada ao intervalo [0,1];
//   - CORS restrito aos domínios do produto (+ localhost para dev).
// ============================================================================

const ALLOWED_MODELS = new Set([
  'gpt-5.6', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4', 'gpt-5.4-mini',
]);
const MODEL_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const DEFAULT_MODEL = 'gpt-5.6';

const ALLOWED_ORIGINS = new Set([
  'https://setup.consultegeo.org',
  'http://localhost:5173',
  'http://localhost:4173',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://setup.consultegeo.org';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
}

function json(obj: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(origin), 'content-type': 'application/json' },
  });
}

function resolveModel(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!MODEL_RE.test(s)) return DEFAULT_MODEL;
  if (ALLOWED_MODELS.has(s)) return s;
  const extra = (Deno.env.get('EXTRA_MODELS') ?? '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  if (extra.includes(s)) return s;
  // IDs gpt-* novos são aceitos (a página permite "outro modelo"); demais caem no default.
  if (/^gpt-/i.test(s)) return s;
  return DEFAULT_MODEL;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);

  try {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return json({ error: 'OPENAI_API_KEY ausente no servidor. Configure: supabase secrets set OPENAI_API_KEY=sk-...' }, 500, origin);

    const rawBody = await req.text();
    if (rawBody.length > 1_500_000) return json({ error: 'payload acima do limite' }, 413, origin);

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); } catch { return json({ error: 'JSON inválido' }, 400, origin); }

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages = rawMessages
      .slice(0, 24)
      .map((m) => {
        const mm = m as Record<string, unknown>;
        const role = mm.role === 'system' || mm.role === 'assistant' ? mm.role : 'user';
        return { role, content: String(mm.content ?? '').slice(0, 400_000) };
      })
      .filter((m) => m.content.length > 0);
    if (!messages.length) return json({ error: 'campo messages obrigatório' }, 400, origin);

    const temperature = Math.min(1, Math.max(0, Number(body.temperature ?? 0.1) || 0));
    const maxTokens = Math.min(8000, Math.max(64, Number(body.max_tokens ?? 5000) || 5000));
    const wantsJson = (body.response_format as Record<string, unknown> | undefined)?.type === 'json_object';

    const payload: Record<string, unknown> = {
      model: resolveModel(body.model),
      temperature,
      max_tokens: maxTokens,
      messages,
    };
    if (wantsJson) payload.response_format = { type: 'json_object' };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return json({ error: 'IA ' + r.status + ': ' + t.slice(0, 220) }, 502, origin);
    }

    // Passthrough: o cliente lê choices[0].message.content como na API oficial.
    const data = await r.json();
    return json(data, 200, origin);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500, origin);
  }
});
