/**
 * setupShareService · v5.22.45
 *
 * Wrapper para a Edge Function `share-draft-link`, que envia o link
 * compartilhável do rascunho por fragmento seguro (#draft=:id&token=:token) via Resend.
 *
 * Complementa o botão "Copiar link" da v5.22.24 — útil quando o
 * usuário quer formalizar a passagem da tarefa (ex.: estagiário →
 * engenheiro, escritório → obra).
 *
 * Sem credenciais, o service falha de forma explícita. A aplicação nunca
 * confirma envio de email nem gera evidência falsa de compartilhamento.
 */

import { getSupabaseAsync, SUPABASE_CONFIGURED } from './supabaseClient';
import { getDraftAccessToken } from './setupDraftService';

const EDGE_FUNCTION_NAME = 'share-draft-link';

export interface ShareDraftLinkInput {
  draftId: string;
  recipientEmail: string;
  recipientName?: string;
  senderName?: string;
  message?: string;
}

export interface ShareDraftLinkResponse {
  ok: boolean;
  email_status?: string;
  /** Quando ok=true, Identificador legado; fila não comprova entrega. */
  email_id?: string;
  /** Quando ok=false, código de erro legível. */
  error?: string;
  /** Email para o qual o link foi enviado (se ok=true). */
  sent_to?: string | null;
}

/** Validação client-side antes de gastar uma chamada à Edge. */
function validateInput(input: ShareDraftLinkInput): string | null {
  if (!input.draftId) return 'draftId obrigatório';
  if (!input.recipientEmail) return 'email obrigatório';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail.trim())) {
    return 'email inválido';
  }
  if (input.message && input.message.length > 2000) {
    return 'mensagem muito longa (máx. 2000 caracteres)';
  }
  return null;
}

/**
 * Envia o link compartilhável por email.
 *
 * Lança erro se input é inválido (chama valido localmente).
 * Devolve resposta estruturada em caso de falha do servidor — o
 * caller decide se mostra ao usuário.
 */
export async function shareDraftLink(
  input: ShareDraftLinkInput,
): Promise<ShareDraftLinkResponse> {
  const validationError = validateInput(input);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  if (!SUPABASE_CONFIGURED) {
    return { ok: false, error: 'supabase_not_configured' };
  }

  const sb = await getSupabaseAsync();
  if (!sb) {
    return { ok: false, error: 'supabase_client_unavailable' };
  }
  const draftToken = getDraftAccessToken(input.draftId);
  if (!draftToken) {
    return { ok: false, error: 'draft_token_missing' };
  }

  try {
    const { data, error } = await sb.functions.invoke<ShareDraftLinkResponse>(
      EDGE_FUNCTION_NAME,
      {
        body: {
          draftId: input.draftId,
          draftToken,
          recipientEmail: input.recipientEmail.trim(),
          recipientName: input.recipientName?.trim() || undefined,
          senderName: input.senderName?.trim() || undefined,
          message: input.message?.trim() || undefined,
        },
      },
    );

    if (error) {
      // Padrão herdado de ticketService — tenta extrair detalhe do body.
      type ErrorWithContext = { message?: string; context?: { body?: string } };
      const ctx = (error as ErrorWithContext)?.context?.body;
      let detail = '';
      if (typeof ctx === 'string') {
        try {
          const parsed = JSON.parse(ctx) as { error?: string };
          detail = parsed.error || '';
        } catch {
          detail = ctx.slice(0, 200);
        }
      }
      const message = (error as ErrorWithContext)?.message || 'edge_function_error';
      return {
        ok: false,
        error: detail ? `${message}: ${detail}` : message,
      };
    }

    if (!data) {
      return { ok: false, error: 'empty_response' };
    }
    return data;
  } catch (err) {
    return {
      ok: false,
      error: `exception: ${String(err).slice(0, 200)}`,
    };
  }
}
