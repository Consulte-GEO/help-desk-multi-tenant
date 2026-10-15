-- ============================================================================
-- 20260903_026_ocr_laudo_telemetria.sql · Implantação Consulte GEO V13
-- Telemetria, auditoria por campo e rate limit do OCR de laudos.
--
-- Numerada contra o ledger vivo consultado em 03/09/2026:
-- última migration aplicada = 20260810_025_harden_search_path_and_external_cache_rls.
--
-- Princípios:
--   * nenhuma imagem, texto integral ou valor de cliente é persistido;
--   * tabelas fechadas por RLS;
--   * escrita somente por RPC SECURITY DEFINER chamada pela Edge Function;
--   * leitura administrativa somente para JWT com public.is_admin();
--   * confirmações armazenam hashes e vereditos, não o conteúdo dos campos.
-- ============================================================================

begin;

create table if not exists public.ocr_laudo_leitura (
    id                      uuid primary key default gen_random_uuid(),
    client_token            uuid not null unique default gen_random_uuid(),
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now(),
    arquivo_hash            text not null check (arquivo_hash ~ '^[a-f0-9]{64}$'),
    nome_arquivo_hash       text check (nome_arquivo_hash is null or nome_arquivo_hash ~ '^[a-f0-9]{64}$'),
    sessao_hash             text not null check (sessao_hash ~ '^[a-f0-9]{64}$'),
    origem_hash             text not null check (origem_hash ~ '^[a-f0-9]{64}$'),
    pagina                  integer not null check (pagina between 1 and 10000),
    paginas_total           integer not null check (paginas_total between 1 and 10000),
    perfil                  text not null default 'generico' check (perfil in ('generico','polimix','concrelab','prisma','auto')),
    status                  text not null check (status in ('sucesso','parcial','sem_resultado','erro','recusado')),
    pipeline_version        text not null,
    prompt_version          text not null,
    modelo_primario         text not null,
    modelo_retry            text,
    detail_primario         text not null check (detail_primario in ('low','high','original')),
    detail_retry            text check (detail_retry is null or detail_retry in ('low','high','original')),
    passes                  smallint not null default 2 check (passes between 1 and 3),
    usou_retry              boolean not null default false,
    chamadas_openai         smallint not null default 0 check (chamadas_openai between 0 and 6),
    duracao_ms              integer check (duracao_ms is null or duracao_ms >= 0),
    bytes_imagem            integer check (bytes_imagem is null or bytes_imagem >= 0),
    largura_px              integer check (largura_px is null or largura_px > 0),
    altura_px               integer check (altura_px is null or altura_px > 0),
    blur_score              numeric,
    contrast_score          numeric,
    legibilidade_modelo_a   numeric check (legibilidade_modelo_a is null or legibilidade_modelo_a between 0 and 1),
    legibilidade_modelo_b   numeric check (legibilidade_modelo_b is null or legibilidade_modelo_b between 0 and 1),
    legibilidade_calculada  numeric check (legibilidade_calculada is null or legibilidade_calculada between 0 and 1),
    resultados              integer not null default 0 check (resultados >= 0),
    campos_avaliados        integer not null default 0 check (campos_avaliados >= 0),
    campos_valor            integer not null default 0 check (campos_valor >= 0),
    campos_ausentes         integer not null default 0 check (campos_ausentes >= 0),
    campos_ilegiveis        integer not null default 0 check (campos_ilegiveis >= 0),
    divergencias            integer not null default 0 check (divergencias >= 0),
    confidence_high         integer not null default 0 check (confidence_high >= 0),
    confidence_medium       integer not null default 0 check (confidence_medium >= 0),
    confidence_low          integer not null default 0 check (confidence_low >= 0),
    input_tokens            integer check (input_tokens is null or input_tokens >= 0),
    cached_input_tokens     integer check (cached_input_tokens is null or cached_input_tokens >= 0),
    output_tokens           integer check (output_tokens is null or output_tokens >= 0),
    reasoning_tokens        integer check (reasoning_tokens is null or reasoning_tokens >= 0),
    codigos_validacao       jsonb not null default '[]'::jsonb,
    diagnostico             jsonb not null default '{}'::jsonb,
    confirmado_at           timestamptz,
    campos_confirmados      integer not null default 0 check (campos_confirmados >= 0),
    campos_corrigidos       integer not null default 0 check (campos_corrigidos >= 0),
    campos_rejeitados       integer not null default 0 check (campos_rejeitados >= 0),
    constraint ocr_laudo_codigos_array check (jsonb_typeof(codigos_validacao) = 'array'),
    constraint ocr_laudo_diagnostico_object check (jsonb_typeof(diagnostico) = 'object')
);

create table if not exists public.ocr_laudo_leitura_campo (
    id                  bigint generated always as identity primary key,
    leitura_id          uuid not null references public.ocr_laudo_leitura(id) on delete cascade,
    created_at          timestamptz not null default now(),
    resultado_indice    integer not null check (resultado_indice >= 0),
    campo               text not null check (char_length(campo) between 1 and 80),
    estado_ocr          text not null check (estado_ocr in ('valor','ausente','ilegivel')),
    confianca           numeric check (confianca is null or confianca between 0 and 1),
    concordou           boolean not null default false,
    flag                text check (flag is null or flag in ('incerto','divergente','retry','alias_generico','validacao')),
    veredito            text check (veredito is null or veredito in ('acertou','corrigiu','faltou','sobrou','rejeitou')),
    valor_ocr_hash      text check (valor_ocr_hash is null or valor_ocr_hash ~ '^[a-f0-9]{64}$'),
    valor_final_hash    text check (valor_final_hash is null or valor_final_hash ~ '^[a-f0-9]{64}$'),
    confirmado_at       timestamptz,
    unique (leitura_id, resultado_indice, campo)
);

create table if not exists public.ocr_laudo_rate_limit (
    actor_key       text not null,
    bucket_start    timestamptz not null,
    calls           integer not null default 0 check (calls >= 0),
    updated_at      timestamptz not null default now(),
    primary key (actor_key, bucket_start)
);

create index if not exists ix_ocr_laudo_leitura_created
    on public.ocr_laudo_leitura(created_at desc);
create index if not exists ix_ocr_laudo_leitura_arquivo
    on public.ocr_laudo_leitura(arquivo_hash, pagina, created_at desc);
create index if not exists ix_ocr_laudo_leitura_status
    on public.ocr_laudo_leitura(status, created_at desc);
create index if not exists ix_ocr_laudo_campo_campo_veredito
    on public.ocr_laudo_leitura_campo(campo, veredito, created_at desc);
create index if not exists ix_ocr_laudo_rate_limit_updated
    on public.ocr_laudo_rate_limit(updated_at);

alter table public.ocr_laudo_leitura enable row level security;
alter table public.ocr_laudo_leitura_campo enable row level security;
alter table public.ocr_laudo_rate_limit enable row level security;

-- Fechado por padrão: cliente e anon não leem nem escrevem tabelas diretamente.
revoke all on public.ocr_laudo_leitura from public, anon, authenticated;
revoke all on public.ocr_laudo_leitura_campo from public, anon, authenticated;
revoke all on public.ocr_laudo_rate_limit from public, anon, authenticated;
revoke all on sequence public.ocr_laudo_leitura_campo_id_seq from public, anon, authenticated;

-- Administrador autenticado pode consultar os dados técnicos, sempre sob RLS.
drop policy if exists ocr_laudo_leitura_admin_select on public.ocr_laudo_leitura;
create policy ocr_laudo_leitura_admin_select
    on public.ocr_laudo_leitura for select to authenticated
    using (public.is_admin());

drop policy if exists ocr_laudo_campo_admin_select on public.ocr_laudo_leitura_campo;
create policy ocr_laudo_campo_admin_select
    on public.ocr_laudo_leitura_campo for select to authenticated
    using (public.is_admin());

grant select on public.ocr_laudo_leitura to authenticated;
grant select on public.ocr_laudo_leitura_campo to authenticated;

-- Reserva atômica de quota em duas dimensões: origem/IP e sessão.
-- Os dois contadores são verificados e incrementados na MESMA transação; não existe
-- consumo parcial quando um dos limites é excedido. As chaves chegam HMAC-SHA256.
create or replace function public.ocr_laudo_reservar_quota(
    p_origin_key text,
    p_session_key text,
    p_units integer default 1,
    p_origin_limit integer default 240,
    p_session_limit integer default 120
)
returns table(
    allowed boolean,
    origin_used integer,
    session_used integer,
    remaining integer,
    retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_origin_key text;
    v_session_key text;
    v_units integer;
    v_origin_limit integer;
    v_session_limit integer;
    v_bucket timestamptz;
    v_origin_used integer;
    v_session_used integer;
begin
    v_origin_key := left(lower(btrim(coalesce(p_origin_key, ''))), 160);
    v_session_key := left(lower(btrim(coalesce(p_session_key, ''))), 160);
    v_units := greatest(1, least(6, coalesce(p_units, 1)));
    v_origin_limit := greatest(1, least(10000, coalesce(p_origin_limit, 240)));
    v_session_limit := greatest(1, least(10000, coalesce(p_session_limit, 120)));
    if v_origin_key = '' or v_session_key = ''
       or v_origin_key = v_session_key
       or v_origin_key !~ '^[a-z0-9:._-]+$'
       or v_session_key !~ '^[a-z0-9:._-]+$' then
        raise exception using errcode = '22023', message = 'actor_keys_invalid';
    end if;

    v_bucket := date_trunc('hour', now());

    -- V15 — purga oportunista: a tabela de quota crescia sem TTL. Roda em ~1% das
    -- chamadas para não pagar o custo em toda reserva.
    if random() < 0.01 then
        delete from public.ocr_laudo_rate_limit
         where bucket_start < now() - interval '3 days';
    end if;

    insert into public.ocr_laudo_rate_limit(actor_key, bucket_start, calls, updated_at)
    values
      (v_origin_key, v_bucket, 0, now()),
      (v_session_key, v_bucket, 0, now())
    on conflict (actor_key, bucket_start) do nothing;

    -- Ordem estável de lock evita deadlock quando duas requisições chegam simultaneamente.
    perform actor_key
      from public.ocr_laudo_rate_limit
     where bucket_start = v_bucket
       and actor_key in (v_origin_key, v_session_key)
     order by actor_key
     for update;

    select calls into v_origin_used
      from public.ocr_laudo_rate_limit
     where actor_key = v_origin_key and bucket_start = v_bucket;
    select calls into v_session_used
      from public.ocr_laudo_rate_limit
     where actor_key = v_session_key and bucket_start = v_bucket;

    if v_origin_used + v_units > v_origin_limit
       or v_session_used + v_units > v_session_limit then
        return query select false, v_origin_used, v_session_used,
            greatest(0, least(v_origin_limit - v_origin_used, v_session_limit - v_session_used)),
            greatest(1, extract(epoch from (v_bucket + interval '1 hour' - now()))::integer);
        return;
    end if;

    update public.ocr_laudo_rate_limit
       set calls = calls + v_units, updated_at = now()
     where bucket_start = v_bucket
       and actor_key in (v_origin_key, v_session_key);
    v_origin_used := v_origin_used + v_units;
    v_session_used := v_session_used + v_units;

    return query select true, v_origin_used, v_session_used,
        greatest(0, least(v_origin_limit - v_origin_used, v_session_limit - v_session_used)),
        greatest(1, extract(epoch from (v_bucket + interval '1 hour' - now()))::integer);
end;
$function$;

revoke all on function public.ocr_laudo_reservar_quota(text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.ocr_laudo_reservar_quota(text, text, integer, integer, integer) to service_role;

-- Registro de uma leitura por página, sem conteúdo do laudo.
create or replace function public.ocr_laudo_registrar_leitura(
    p_arquivo_hash text,
    p_nome_arquivo_hash text,
    p_sessao_hash text,
    p_origem_hash text,
    p_pagina integer,
    p_paginas_total integer,
    p_perfil text,
    p_status text,
    p_pipeline_version text,
    p_prompt_version text,
    p_modelo_primario text,
    p_modelo_retry text,
    p_detail_primario text,
    p_detail_retry text,
    p_passes integer,
    p_usou_retry boolean,
    p_chamadas_openai integer,
    p_duracao_ms integer,
    p_bytes_imagem integer,
    p_largura_px integer,
    p_altura_px integer,
    p_blur_score numeric,
    p_contrast_score numeric,
    p_legibilidade_modelo_a numeric,
    p_legibilidade_modelo_b numeric,
    p_legibilidade_calculada numeric,
    p_resultados integer,
    p_campos_avaliados integer,
    p_campos_valor integer,
    p_campos_ausentes integer,
    p_campos_ilegiveis integer,
    p_divergencias integer,
    p_confidence_high integer,
    p_confidence_medium integer,
    p_confidence_low integer,
    p_input_tokens integer,
    p_cached_input_tokens integer,
    p_output_tokens integer,
    p_reasoning_tokens integer,
    p_codigos_validacao jsonb,
    p_diagnostico jsonb,
    p_campos jsonb default '[]'::jsonb
)
returns table(leitura_id uuid, client_token uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_id uuid;
    v_token uuid;
begin
    if coalesce(p_arquivo_hash, '') !~ '^[a-f0-9]{64}$'
       or coalesce(p_sessao_hash, '') !~ '^[a-f0-9]{64}$'
       or coalesce(p_origem_hash, '') !~ '^[a-f0-9]{64}$' then
        raise exception using errcode = '22023', message = 'telemetry_hash_invalid';
    end if;

    insert into public.ocr_laudo_leitura(
        arquivo_hash, nome_arquivo_hash, sessao_hash, origem_hash,
        pagina, paginas_total, perfil, status, pipeline_version, prompt_version,
        modelo_primario, modelo_retry, detail_primario, detail_retry,
        passes, usou_retry, chamadas_openai, duracao_ms, bytes_imagem,
        largura_px, altura_px, blur_score, contrast_score,
        legibilidade_modelo_a, legibilidade_modelo_b, legibilidade_calculada,
        resultados, campos_avaliados, campos_valor, campos_ausentes,
        campos_ilegiveis, divergencias, confidence_high, confidence_medium,
        confidence_low, input_tokens, cached_input_tokens, output_tokens,
        reasoning_tokens, codigos_validacao, diagnostico
    ) values (
        lower(p_arquivo_hash), nullif(lower(p_nome_arquivo_hash), ''), lower(p_sessao_hash), lower(p_origem_hash),
        p_pagina, p_paginas_total, coalesce(nullif(p_perfil, ''), 'generico'), p_status,
        left(p_pipeline_version, 80), left(p_prompt_version, 80),
        left(p_modelo_primario, 80), left(nullif(p_modelo_retry, ''), 80),
        p_detail_primario, nullif(p_detail_retry, ''),
        greatest(1, least(3, coalesce(p_passes, 2))), coalesce(p_usou_retry, false),
        greatest(0, least(6, coalesce(p_chamadas_openai, 0))), greatest(0, p_duracao_ms),
        greatest(0, p_bytes_imagem), nullif(greatest(0, p_largura_px), 0), nullif(greatest(0, p_altura_px), 0),
        p_blur_score, p_contrast_score, p_legibilidade_modelo_a, p_legibilidade_modelo_b,
        p_legibilidade_calculada, greatest(0, coalesce(p_resultados, 0)),
        greatest(0, coalesce(p_campos_avaliados, 0)), greatest(0, coalesce(p_campos_valor, 0)),
        greatest(0, coalesce(p_campos_ausentes, 0)), greatest(0, coalesce(p_campos_ilegiveis, 0)),
        greatest(0, coalesce(p_divergencias, 0)), greatest(0, coalesce(p_confidence_high, 0)),
        greatest(0, coalesce(p_confidence_medium, 0)), greatest(0, coalesce(p_confidence_low, 0)),
        greatest(0, p_input_tokens), greatest(0, p_cached_input_tokens), greatest(0, p_output_tokens),
        greatest(0, p_reasoning_tokens),
        case when jsonb_typeof(coalesce(p_codigos_validacao, '[]'::jsonb)) = 'array'
             then coalesce(p_codigos_validacao, '[]'::jsonb) else '[]'::jsonb end,
        case when jsonb_typeof(coalesce(p_diagnostico, '{}'::jsonb)) = 'object'
                  and pg_column_size(coalesce(p_diagnostico, '{}'::jsonb)) <= 16384
             then coalesce(p_diagnostico, '{}'::jsonb) else '{}'::jsonb end
    ) returning id, ocr_laudo_leitura.client_token into v_id, v_token;

    insert into public.ocr_laudo_leitura_campo(
        leitura_id, resultado_indice, campo, estado_ocr, confianca, concordou, flag
    )
    select v_id,
           greatest(0, least(10000, coalesce((x->>'resultado')::integer, 0))),
           left(btrim(coalesce(x->>'campo', '')), 80),
           case when x->>'estado' in ('valor','ausente','ilegivel') then x->>'estado' else 'ilegivel' end,
           case when (x->>'confianca')::numeric between 0 and 1 then (x->>'confianca')::numeric else null end,
           coalesce((x->>'concordou')::boolean, false),
           case when x->>'flag' in ('incerto','divergente','retry','alias_generico','validacao') then x->>'flag' end
      from jsonb_array_elements(
          case when jsonb_typeof(coalesce(p_campos, '[]'::jsonb)) = 'array' then coalesce(p_campos, '[]'::jsonb) else '[]'::jsonb end
      ) x
     where btrim(coalesce(x->>'campo', '')) <> ''
     -- V15 — 12 campos x 600 linhas. Acima disso a página não é revisável na
     -- tela de qualquer forma; o teto fica documentado em vez de implícito.
     limit 7200
    on conflict (leitura_id, resultado_indice, campo) do nothing;

    return query select v_id, v_token;
end;
$function$;

revoke all on function public.ocr_laudo_registrar_leitura(
    text,text,text,text,integer,integer,text,text,text,text,text,text,text,text,
    integer,boolean,integer,integer,integer,integer,integer,numeric,numeric,
    numeric,numeric,numeric,integer,integer,integer,integer,integer,integer,
    integer,integer,integer,integer,integer,integer,integer,jsonb,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function public.ocr_laudo_registrar_leitura(
    text,text,text,text,integer,integer,text,text,text,text,text,text,text,text,
    integer,boolean,integer,integer,integer,integer,integer,numeric,numeric,
    numeric,numeric,numeric,integer,integer,integer,integer,integer,integer,
    integer,integer,integer,integer,integer,integer,integer,jsonb,jsonb,jsonb
) to service_role;

-- Confirmação humana. Recebe somente hashes e vereditos calculados pela Edge Function.
create or replace function public.ocr_laudo_registrar_confirmacao(
    p_client_token uuid,
    p_campos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_id uuid;
    v_total integer;
    v_corrigidos integer;
    v_rejeitados integer;
begin
    select id into v_id
      from public.ocr_laudo_leitura
     where client_token = p_client_token
       and created_at >= now() - interval '30 days'
     for update;
    if v_id is null then
        raise exception using errcode = '42501', message = 'ocr_reading_token_invalid';
    end if;

    with dados as (
        select greatest(0, least(10000, coalesce((x->>'resultado')::integer, 0))) as resultado,
               left(btrim(coalesce(x->>'campo','')), 80) as campo,
               case when x->>'veredito' in ('acertou','corrigiu','faltou','sobrou','rejeitou') then x->>'veredito' end as veredito,
               case when coalesce(x->>'valor_ocr_hash','') ~ '^[a-f0-9]{64}$' then x->>'valor_ocr_hash' end as ocr_hash,
               case when coalesce(x->>'valor_final_hash','') ~ '^[a-f0-9]{64}$' then x->>'valor_final_hash' end as final_hash
          from jsonb_array_elements(
              case when jsonb_typeof(coalesce(p_campos, '[]'::jsonb)) = 'array' then coalesce(p_campos, '[]'::jsonb) else '[]'::jsonb end
          ) x
         where btrim(coalesce(x->>'campo','')) <> ''
         limit 4000
    )
    update public.ocr_laudo_leitura_campo c
       set veredito = d.veredito,
           valor_ocr_hash = d.ocr_hash,
           valor_final_hash = d.final_hash,
           confirmado_at = now()
      from dados d
     where c.leitura_id = v_id
       and c.resultado_indice = d.resultado
       and c.campo = d.campo
       and d.veredito is not null;

    select count(*),
           count(*) filter (where veredito in ('corrigiu','faltou','sobrou')),
           count(*) filter (where veredito = 'rejeitou')
      into v_total, v_corrigidos, v_rejeitados
      from public.ocr_laudo_leitura_campo
     where leitura_id = v_id and veredito is not null;

    update public.ocr_laudo_leitura
       set confirmado_at = now(), updated_at = now(),
           campos_confirmados = coalesce(v_total, 0),
           campos_corrigidos = coalesce(v_corrigidos, 0),
           campos_rejeitados = coalesce(v_rejeitados, 0)
     where id = v_id;

    -- A confirmação é mutação e também entra no audit trail append-only do produto.
    -- Não persiste valores nem hashes de campos: somente contagens e o id técnico da leitura.
    insert into public.setup_audit_events(actor, action, entity, before, after, source)
    values (
        'cliente_ocr',
        'ocr_laudo_confirmacao',
        'ocr_laudo_leitura:' || v_id::text,
        null,
        jsonb_build_object(
            'campos_confirmados', coalesce(v_total, 0),
            'campos_corrigidos', coalesce(v_corrigidos, 0),
            'campos_rejeitados', coalesce(v_rejeitados, 0)
        ),
        'laudo-vision'
    );

    return jsonb_build_object(
        'ok', true,
        'campos_confirmados', coalesce(v_total, 0),
        'campos_corrigidos', coalesce(v_corrigidos, 0),
        'campos_rejeitados', coalesce(v_rejeitados, 0)
    );
end;
$function$;

revoke all on function public.ocr_laudo_registrar_confirmacao(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ocr_laudo_registrar_confirmacao(uuid, jsonb) to service_role;

create or replace view public.v_ocr_laudo_auditoria
with (security_invoker = true)
as
select
    l.id, l.created_at, l.pagina, l.paginas_total, l.perfil, l.status,
    l.pipeline_version, l.prompt_version, l.modelo_primario, l.modelo_retry,
    l.detail_primario, l.detail_retry, l.passes, l.usou_retry,
    l.chamadas_openai, l.duracao_ms, l.bytes_imagem, l.largura_px, l.altura_px,
    l.blur_score, l.contrast_score, l.legibilidade_calculada,
    l.resultados, l.campos_avaliados, l.campos_valor, l.campos_ausentes,
    l.campos_ilegiveis, l.divergencias, l.input_tokens, l.cached_input_tokens,
    l.output_tokens, l.reasoning_tokens, l.codigos_validacao,
    l.confirmado_at, l.campos_confirmados, l.campos_corrigidos, l.campos_rejeitados,
    q.acertou, q.corrigiu, q.faltou, q.sobrou, q.rejeitou,
    case when l.campos_confirmados > 0
         then round(100.0 * q.acertou::numeric / l.campos_confirmados, 1)
         else null end as acerto_confirmado_pct,
    case when l.campos_confirmados > 0
         then round(100.0 * (q.corrigiu + q.sobrou)::numeric / l.campos_confirmados, 1)
         else null end as false_fill_pct,
    case when l.campos_confirmados > 0
         then round(100.0 * q.faltou::numeric / l.campos_confirmados, 1)
         else null end as omissao_pct,
    case when l.campos_confirmados > 0
         then round(100.0 * q.rejeitou::numeric / l.campos_confirmados, 1)
         else null end as rejeicao_pct
from public.ocr_laudo_leitura l
left join lateral (
    select
        count(*) filter (where c.veredito = 'acertou')::integer as acertou,
        count(*) filter (where c.veredito = 'corrigiu')::integer as corrigiu,
        count(*) filter (where c.veredito = 'faltou')::integer as faltou,
        count(*) filter (where c.veredito = 'sobrou')::integer as sobrou,
        count(*) filter (where c.veredito = 'rejeitou')::integer as rejeitou
    from public.ocr_laudo_leitura_campo c
    where c.leitura_id = l.id
) q on true;

revoke all on public.v_ocr_laudo_auditoria from public, anon;
grant select on public.v_ocr_laudo_auditoria to authenticated;

comment on table public.ocr_laudo_leitura is
    'Telemetria sem conteúdo do OCR de laudos: uma linha por página processada.';
comment on table public.ocr_laudo_leitura_campo is
    'Qualidade por campo do OCR de laudos. Persiste estado, confiança, veredito e hashes, nunca o conteúdo.';
comment on table public.ocr_laudo_rate_limit is
    'Rate limit transacional do proxy laudo-vision por chave irreversivelmente hasheada.';
comment on view public.v_ocr_laudo_auditoria is
    'Auditoria administrativa do OCR de laudos. security_invoker=true; inclui false fill, omissão e rejeição separadamente; RLS das tabelas-base exige is_admin().';

commit;

-- Rollback manual, nesta ordem:
-- begin;
-- drop view if exists public.v_ocr_laudo_auditoria;
-- drop function if exists public.ocr_laudo_registrar_confirmacao(uuid, jsonb);
-- drop function if exists public.ocr_laudo_registrar_leitura(text,text,text,text,integer,integer,text,text,text,text,text,text,text,text,integer,boolean,integer,integer,integer,integer,integer,numeric,numeric,numeric,numeric,numeric,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,jsonb,jsonb,jsonb);
-- drop function if exists public.ocr_laudo_reservar_quota(text, text, integer, integer, integer);
-- drop table if exists public.ocr_laudo_leitura_campo;
-- drop table if exists public.ocr_laudo_leitura;
-- drop table if exists public.ocr_laudo_rate_limit;
-- commit;
