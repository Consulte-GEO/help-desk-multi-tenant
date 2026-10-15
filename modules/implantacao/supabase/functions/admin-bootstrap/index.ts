// =====================================================================
// supabase/functions/admin-bootstrap/index.ts · v5.22.28
//
// Cria os dois usuários admin iniciais (thiago@ e atendimento@).
// Idempotente: rodar várias vezes não cria duplicatas, mas também
// NÃO reseta senha se o usuário já existir.
//
// Por que Edge Function e não migration?
//  - auth.users precisa ser manipulada via supabase-js admin client
//    com Service Role Key. Migrations SQL diretas em auth.* não são
//    suportadas oficialmente (pode quebrar entre versões do Supabase).
//
// Por que NÃO chamada do frontend?
//  - Service Role Key tem privilege total — JAMAIS pode ir pro
//    bundle do navegador. A Edge Function isola.
//
// Como rodar (uma vez, do terminal do Thiago):
//
//   1. Deploy:
//      supabase functions deploy admin-bootstrap \
//                          --project-ref yglcnirbnbwjqpvalqif \
//                          --no-verify-jwt
//
//   2. Setar a senha-shared-secret pra prevenir abuso público:
//      supabase secrets set ADMIN_BOOTSTRAP_SECRET="<um-token-aleatório>" \
//                          --project-ref yglcnirbnbwjqpvalqif
//
//   3. Invocar (substituir o token):
//      curl -X POST https://yglcnirbnbwjqpvalqif.supabase.co/functions/v1/admin-bootstrap \
//           -H "Authorization: Bearer SEU_ADMIN_BOOTSTRAP_SECRET" \
//           -H "Content-Type: application/json"
//
//   4. Output devolve as senhas geradas. ANOTAR — não há jeito de
//      recuperar depois (Supabase só guarda hash).
//
// Resposta de sucesso:
//   {
//     "ok": true,
//     "users": [
//       { "email": "thiago@consultegeo.com.br", "password": "...", "created": true|false },
//       { "email": "atendimento@consultegeo.com.br", "password": "...", "created": true|false }
//     ]
//   }
//
// Se created=false, o usuário já existia. O `password` retornado
// nesse caso é uma string vazia (não temos como recuperar do hash).
// =====================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ADMINS = [
  { email: 'thiago@consultegeo.com.br',       label: 'Thiago Costa' },
  { email: 'atendimento@consultegeo.com.br',  label: 'Atendimento Consulte GEO' },
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-env, x-app-name',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function envOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v || !v.trim()) throw new Error(`missing_env: ${name}`);
  return v.trim();
}

/**
 * Senha forte: 20 caracteres incluindo upper/lower/digit/symbol.
 * Usa Web Crypto (presente no Deno) — não Math.random.
 */
function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';     // sem I e O (confundem)
  const lower = 'abcdefghijkmnpqrstuvwxyz';     // sem l e o
  const digit = '23456789';                      // sem 0 e 1
  const symbol = '!@#$%&*+=?';
  const all = upper + lower + digit + symbol;
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  // Garante pelo menos 1 de cada categoria nas primeiras 4 posições,
  // depois preenche aleatório
  const chars: string[] = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digit[bytes[2] % digit.length],
    symbol[bytes[3] % symbol.length],
  ];
  for (let i = 4; i < 20; i++) chars.push(all[bytes[i] % all.length]);
  // Fisher-Yates shuffle pra não ter padrão previsível nos 4 primeiros
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  // Authorization via shared-secret. Sem isso, qualquer um na internet
  // poderia chamar a function e bootstrappar usuários.
  let bootstrapSecret: string;
  try {
    bootstrapSecret = envOrThrow('ADMIN_BOOTSTRAP_SECRET');
  } catch (err) {
    return json({ ok: false, error: String(err).replace(/^Error:\s*/, '') }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (bearer !== bootstrapSecret) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  // Service Role Key necessário para criar usuários via admin API
  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    supabaseUrl = envOrThrow('SUPABASE_URL');
    serviceRoleKey = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
  } catch (err) {
    return json({ ok: false, error: String(err).replace(/^Error:\s*/, '') }, 500);
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: Array<{
    email: string;
    password: string;
    created: boolean;
    error?: string;
  }> = [];

  for (const admin of ADMINS) {
    try {
      // 1. Tenta listar para detectar existente
      const { data: list, error: listErr } = await sb.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (listErr) {
        results.push({
          email: admin.email,
          password: '',
          created: false,
          error: `list_failed: ${listErr.message}`,
        });
        continue;
      }
      const existing = (list?.users || []).find(
        (u) => (u.email || '').toLowerCase() === admin.email.toLowerCase(),
      );

      if (existing) {
        // Já existe — não reseta senha. Apenas garante que app_metadata.is_admin esteja true.
        const hasFlag = (existing.app_metadata as Record<string, unknown> | undefined)?.is_admin === true;
        if (!hasFlag) {
          await sb.auth.admin.updateUserById(existing.id, {
            app_metadata: { ...(existing.app_metadata as Record<string, unknown>), is_admin: true },
          });
        }
        results.push({ email: admin.email, password: '', created: false });
        continue;
      }

      // 2. Cria novo usuário com senha gerada
      const password = generateStrongPassword();
      const { error: createErr } = await sb.auth.admin.createUser({
        email: admin.email,
        password,
        email_confirm: true, // Sem fluxo de confirmação por email
        app_metadata: {
          is_admin: true,
          source: 'admin-bootstrap',
          label: admin.label,
        },
        user_metadata: { display_name: admin.label },
      });

      if (createErr) {
        results.push({
          email: admin.email,
          password: '',
          created: false,
          error: `create_failed: ${createErr.message}`,
        });
        continue;
      }

      results.push({ email: admin.email, password, created: true });
    } catch (err) {
      results.push({
        email: admin.email,
        password: '',
        created: false,
        error: `exception: ${String(err).slice(0, 200)}`,
      });
    }
  }

  const allOk = results.every((r) => !r.error);
  return json(
    {
      ok: allOk,
      users: results,
      note:
        'Anote as senhas dos usuários com created=true — não há jeito de recuperar depois. ' +
        'Para resetar senha de um usuário existente, use o Dashboard ou supabase auth admin update-user.',
    },
    allOk ? 200 : 500,
  );
});
