/**
 * ticketService · v5.22.45
 *
 * Wrapper para o fluxo de chamado de implantação:
 *  - `submitForValidation(...)` chama a Edge Function `submit-for-validation`,
 *    que insere submission + ticket, envia 2 emails (equipe + responsável) e
 *    retorna `{ ticket_number, submission_id, email_sent_to, email_cc }`.
 *  - `loadByToken(token)` chama a RPC `get_submission_by_token` (review interno).
 *  - `updateStatusByToken(...)` chama a RPC `update_submission_status_by_token`.
 *
 * O `access_token` **nunca** é manipulado pelo Vuex do cliente. Ele vem na
 * URL `/r/:token` apenas no contexto do ReviewView (equipe).
 */

import { getSupabaseAsync, SUPABASE_CONFIGURED } from './supabaseClient';
import { getDraftAccessToken } from './setupDraftService';
import type {
  ClientStatusPayload,
  ReviewComment,
  TicketReviewPayload,
  TicketSubmissionResponse,
} from '../models/setup.models';

const EDGE_FUNCTION_NAME = 'submit-for-validation';

/* ------------------------------------------------------------------ */
/* Submit (cliente → equipe)                                           */
/* ------------------------------------------------------------------ */

export interface SubmitForValidationInput {
  draftId: string | null;
  technicalJson: unknown;
  clientMessage?: string;
}

export async function submitForValidation(
  input: SubmitForValidationInput,
): Promise<TicketSubmissionResponse> {
  if (!SUPABASE_CONFIGURED) {
    throw new Error('submit_failed: supabase_not_configured');
  }

  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('submit_failed: supabase_client_unavailable');
  if (!input.draftId) throw new Error('submit_failed: draft_required');
  const draftToken = getDraftAccessToken(input.draftId);
  if (!draftToken) throw new Error('submit_failed: draft_token_missing');

  const { data, error } = await sb.functions.invoke<TicketSubmissionResponse>(
    EDGE_FUNCTION_NAME,
    {
      body: {
        draftId: input.draftId,
        draftToken,
        technicalJson: input.technicalJson,
        clientMessage: input.clientMessage ?? '',
      },
    },
  );

  if (error) {
    type ErrorWithContext = { message?: string; context?: { body?: string } };
    const ctx = (error as ErrorWithContext)?.context?.body;
    let detail = '';
    if (typeof ctx === 'string') {
      try {
        detail = ` (${(JSON.parse(ctx) as { error?: string }).error ?? ctx})`;
      } catch {
        detail = ` (${ctx.slice(0, 200)})`;
      }
    }
    throw new Error(`submit_failed: ${error.message ?? 'unknown'}${detail}`);
  }
  if (!data || !data.ticket_number) {
    throw new Error('submit_failed: empty_response');
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Review (equipe — link gated por token)                              */
/* ------------------------------------------------------------------ */

export async function loadByToken(token: string): Promise<TicketReviewPayload> {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('get_submission_by_token', { p_token: token });
  if (error) throw new Error(`load_failed: ${error.message}`);
  if (!data) throw new Error('load_failed: empty_payload');

  return data as TicketReviewPayload;
}

export interface UpdateStatusInput {
  token: string;
  /** aceita aliases: 'validado', 'em_analise', 'enviado_validacao' */
  status: string;
  note?: string;
  reviewer?: string;
}

export interface UpdateStatusResponse {
  ok: boolean;
  status: string;
  updated_at: string;
}

export async function updateStatusByToken(
  input: UpdateStatusInput,
): Promise<UpdateStatusResponse> {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('update_submission_status_by_token', {
    p_token: input.token,
    p_status: input.status,
    p_note: input.note ?? null,
    p_reviewer: input.reviewer ?? null,
  });
  if (error) throw new Error(`update_failed: ${error.message}`);
  return data as UpdateStatusResponse;
}

/* ------------------------------------------------------------------ */
/* Comentários da review (v5.21)                                       */
/* ------------------------------------------------------------------ */

export interface AddReviewCommentInput {
  token: string;
  author: string;
  body: string;
  /** v5.22: true = comentário interno (não aparece para o cliente). */
  internalOnly?: boolean;
}

export async function addReviewComment(
  input: AddReviewCommentInput,
): Promise<ReviewComment> {
  if (!input.body || !input.body.trim()) {
    throw new Error('empty_body');
  }
  if (input.body.length > 2000) {
    throw new Error('body_too_long');
  }

  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('add_review_comment_by_token', {
    p_token: input.token,
    p_author: input.author ?? '',
    p_body: input.body,
    p_internal_only: input.internalOnly ?? false,
  });
  if (error) {
    const msg = error.message || 'unknown_error';
    throw new Error(`add_comment_failed: ${msg}`);
  }
  if (!data) throw new Error('add_comment_failed: empty_response');

  const result = data as ReviewComment & { submission_id?: string };

  // v5.22.34: notifica cliente fire-and-forget se comentário for PÚBLICO.
  // Internal-only NÃO dispara — cliente não vê esse comentário no /s/:token.
  // Migration 013 garante que o RPC retorna submission_id no payload.
  if (input.internalOnly !== true && result.submission_id) {
    void sb.functions
      .invoke('notify-team-comment', {
        body: {
          submission_id: result.submission_id,
          comment_body: input.body.slice(0, 600),
          team_author: input.author || '',
        },
      })
      .catch((err) => {
        // Comentário JÁ está persistido pela RPC. Email é nice-to-have.
        console.warn('[notify-team-comment] falhou:', err);
      });
  }

  return result as ReviewComment;
}

export async function listReviewComments(token: string): Promise<ReviewComment[]> {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('list_review_comments_by_token', {
    p_token: token,
  });
  if (error) throw new Error(`list_comments_failed: ${error.message}`);
  return (data ?? []) as ReviewComment[];
}

/* ------------------------------------------------------------------ */
/* Status público do cliente (v5.22 — rota /s/:token)                  */
/* ------------------------------------------------------------------ */

/** Carrega a página de status público pelo client_access_token. */
export async function loadClientStatus(token: string): Promise<ClientStatusPayload> {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('get_status_by_client_token', { p_token: token });
  if (error) throw new Error(`load_failed: ${error.message}`);
  if (!data) throw new Error('load_failed: empty_payload');

  return data as ClientStatusPayload;
}

export interface AddClientCommentInput {
  token: string;
  author: string;
  body: string;
  /**
   * v5.22.30 — Se true (default), dispara notify-client-comment como
   * fire-and-forget após o RPC OK. A Edge Function resolve internamente
   * ticket_number/obra_nome/etc via service role key — frontend só
   * precisa passar token + body. Falha do email NÃO falha o comentário.
   *
   * Pode passar false em testes locais sem RESEND_API_KEY configurada.
   */
  notifyTeam?: boolean;
}

/**
 * Cliente adiciona comentário pela página de status. SEMPRE registrado
 * com author_role='cliente' no servidor — frontend não pode fingir
 * que é equipe.
 *
 * v5.22.30 — Por default dispara notify-client-comment para a equipe
 * receber email. Fire-and-forget.
 */
export async function addClientComment(
  input: AddClientCommentInput,
): Promise<ReviewComment> {
  if (!input.body || !input.body.trim()) {
    throw new Error('empty_body');
  }
  if (input.body.length > 2000) {
    throw new Error('body_too_long');
  }

  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('add_review_comment_by_client_token', {
    p_token: input.token,
    p_author: input.author ?? '',
    p_body: input.body,
  });
  if (error) {
    const msg = error.message || 'unknown_error';
    throw new Error(`add_client_comment_failed: ${msg}`);
  }
  if (!data) throw new Error('add_client_comment_failed: empty_response');

  // v5.22.30 — Notifica equipe fire-and-forget. Sem await, sem
  // bloqueio do retorno. Edge Function resolve dados internamente.
  if (input.notifyTeam !== false) {
    void sb.functions
      .invoke('notify-client-comment', {
        body: {
          client_access_token: input.token,
          body_preview: input.body.slice(0, 600),
        },
      })
      .catch((err) => {
        // Log apenas — não interrompe nem mostra alerta ao usuário.
        // O comentário JÁ está persistido pela RPC anterior.
        console.warn('[notify-client-comment] falhou:', err);
      });
  }

  return data as ReviewComment;
}

/* ------------------------------------------------------------------ */
/* v5.22.6: Devolução pela equipe + reenvio pelo cliente               */
/* ------------------------------------------------------------------ */

/**
 * v5.22.6: equipe devolve a submissão com um motivo (≥20 chars). RPC
 * muda status, insere comentário público e retorna os dados necessários
 * para a Edge Function `notify-return` disparar email ao responsável.
 *
 * Em seguida, esta função chama a Edge Function para enviar o email.
 * Falhas no email NÃO desfazem a devolução (já registrada em banco).
 */
export interface ReturnSubmissionInput {
  /** access_token da equipe (vem da rota /r/:token) */
  token: string;
  reviewer: string;
  body: string;
}

export interface ReturnSubmissionResult {
  ok: boolean;
  ticket_number: string;
  email_sent_to: string[];
  email_error: string | null;
}

export async function returnSubmissionWithComment(
  input: ReturnSubmissionInput,
): Promise<ReturnSubmissionResult> {
  if (!input.body || input.body.trim().length < 20) {
    throw new Error('body_too_short');
  }
  if (input.body.length > 2000) {
    throw new Error('body_too_long');
  }

  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  // 1. RPC muda status + insere comentário
  const { data, error } = await sb.rpc('return_submission_with_comment', {
    p_token: input.token,
    p_reviewer: input.reviewer,
    p_body: input.body,
  });
  if (error) {
    throw new Error(`return_failed: ${error.message ?? 'unknown'}`);
  }
  if (!data) throw new Error('return_failed: empty_response');

  type ReturnRpcResult = {
    submission_id: string;
    ticket_number: string;
    client_access_token: string;
    email_cc: string[];
    obra_nome: string;
    reviewer: string;
    reason: string;
  };
  const rpc = data as ReturnRpcResult;

  // 2. Edge Function dispara email
  let emailSentTo: string[] = [];
  let emailError: string | null = null;
  try {
    const { data: edgeData, error: edgeErr } = await sb.functions.invoke('notify-return', {
      body: {
        ticket_number: rpc.ticket_number,
        client_access_token: rpc.client_access_token,
        obra_nome: rpc.obra_nome,
        reviewer: rpc.reviewer,
        reason: rpc.reason,
        email_cc: rpc.email_cc ?? [],
      },
    });
    if (edgeErr) {
      emailError = `notify_return_invoke_failed: ${edgeErr.message ?? 'unknown'}`;
    } else if (edgeData && typeof edgeData === 'object') {
      const d = edgeData as { ok?: boolean; sent_to?: string[]; error?: string };
      if (d.ok) {
        emailSentTo = d.sent_to ?? [];
      } else {
        emailError = d.error ?? 'notify_return_unknown_error';
      }
    }
  } catch (err) {
    emailError = `notify_return_exception: ${String(err).slice(0, 200)}`;
  }

  return {
    ok: true,
    ticket_number: rpc.ticket_number,
    email_sent_to: emailSentTo,
    email_error: emailError,
  };
}

/**
 * v5.22.6: cliente reenvia a submissão após edição (status devolvido →
 * em_validacao). Chamado depois que o cliente atualizou o technical_json
 * via `updateTechnicalJsonByClientToken`.
 */
export async function resubmitByClientToken(token: string): Promise<{
  ok: boolean;
  ticket_number: string;
  new_status: string;
}> {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('resubmit_by_client_token', { p_token: token });
  if (error) throw new Error(`resubmit_failed: ${error.message ?? 'unknown'}`);
  if (!data) throw new Error('resubmit_failed: empty_response');
  return data as { ok: boolean; ticket_number: string; new_status: string };
}

/**
 * v5.22.6: cliente atualiza technical_json durante devolução. Só funciona
 * se status = 'devolvido'. Não dispara emails.
 */
export async function updateTechnicalJsonByClientToken(
  token: string,
  technicalJson: unknown,
): Promise<{ ok: boolean; submission_id: string }> {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('update_technical_json_by_client_token', {
    p_token: token,
    p_json: technicalJson,
  });
  if (error) throw new Error(`update_tj_failed: ${error.message ?? 'unknown'}`);
  if (!data) throw new Error('update_tj_failed: empty_response');
  return data as { ok: boolean; submission_id: string };
}

/**
 * v5.22.9: equipe Consulte GEO atualiza o technical_json via review_token.
 *
 * - Preserva customer_input_original na primeira edição (RPC trata).
 * - Incrementa team_edits_count.
 * - Audit log automático ('team_edit_first' ou 'team_edit').
 * - p_actor é opcional; quando omitido cai em 'team_review' no servidor.
 *
 * Use em modo "save automático com debounce" (~800ms) — não chamar em cada
 * keypress.
 */
export async function updateTechnicalJsonByReviewToken(
  token: string,
  technicalJson: unknown,
  actor?: string,
): Promise<{
  submission_id: string;
  team_edits_count: number;
  first_edit: boolean;
}> {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('supabase_not_configured');

  const { data, error } = await sb.rpc('update_technical_json_by_review_token', {
    p_token: token,
    p_json: technicalJson,
    p_actor: actor ?? null,
  });
  if (error) throw new Error(`team_edit_failed: ${error.message ?? 'unknown'}`);
  if (!data) throw new Error('team_edit_failed: empty_response');
  return data as { submission_id: string; team_edits_count: number; first_edit: boolean };
}
