-- Email monitoring V2 query fragment. Compose after the telemetry fragment.
-- No publication/cohort start is inferred from installation time.
CREATE TABLE helpdesk_integration.hdn_email_monitor_settings(
 singleton boolean PRIMARY KEY CONSTRAINT hdn_email_monitor_settings_singleton_check CHECK(singleton),
 opened_started_at timestamptz CONSTRAINT hdn_email_monitor_settings_opened_started_at_check CHECK(opened_started_at IS NULL OR isfinite(opened_started_at)),
 clicked_started_at timestamptz CONSTRAINT hdn_email_monitor_settings_clicked_started_at_check CHECK(clicked_started_at IS NULL OR isfinite(clicked_started_at))
);
INSERT INTO helpdesk_integration.hdn_email_monitor_settings(singleton) VALUES(true);
ALTER TABLE helpdesk_integration.hdn_email_monitor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_integration.hdn_email_monitor_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON helpdesk_integration.hdn_email_monitor_settings FROM PUBLIC,helpdesk_app,helpdesk_notification_worker;
CREATE INDEX hdn_email_monitor_event ON helpdesk_integration.hdn_notification_records(workspace_id,event_id,id DESC);

-- Only private, already-authorized, minimized rows reach this pure aggregator.
CREATE FUNCTION helpdesk_auth.hdn_email_monitor_summary(rows jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 WITH f AS (SELECT value AS x FROM jsonb_array_elements(rows)),
 counts AS (SELECT count(*) AS n,
 count(*) FILTER(WHERE x->>'sentAt' IS NOT NULL) AS sent,
 count(*) FILTER(WHERE x->>'deliveredAt' IS NOT NULL) AS delivered,
 count(*) FILTER(WHERE x->>'openedAt' IS NOT NULL) AS opened,
 count(*) FILTER(WHERE x->>'clickedAt' IS NOT NULL) AS clicked,
 count(*) FILTER(WHERE (x->>'deliveryEligible')::boolean) AS de,
 count(*) FILTER(WHERE (x->>'openEligible')::boolean) AS oe,
 count(*) FILTER(WHERE (x->>'clickEligible')::boolean) AS ce,
 count(*) FILTER(WHERE (x->>'attention')::boolean) AS attention FROM f)
 SELECT jsonb_build_object(
 'sent',jsonb_build_object('count',CASE WHEN de=0 AND sent=0 THEN NULL ELSE sent END,'eligible',de,'total',n),
 'delivered',jsonb_build_object('count',CASE WHEN de=0 AND delivered=0 THEN NULL ELSE delivered END,'eligible',de,'total',n),
 'opened',jsonb_build_object('count',CASE WHEN oe=0 AND opened=0 THEN NULL ELSE opened END,'eligible',oe,'total',n),
 'clicked',jsonb_build_object('count',CASE WHEN ce=0 AND clicked=0 THEN NULL ELSE clicked END,'eligible',ce,'total',n),
 'states',(SELECT jsonb_object_agg(state,(SELECT count(*) FROM f WHERE x->>'state'=state)) FROM unnest(ARRAY['pending','retry_wait','leased','sending','unknown','accepted','delivered','failed','suppressed']) state),
 'attention',attention) FROM counts
$$;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_email_monitor_summary(jsonb) FROM PUBLIC,helpdesk_app,helpdesk_notification_worker;

CREATE FUNCTION helpdesk_auth.hdn_email_monitor(request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();
 full_address boolean;mode text:=request->>'mode';f jsonb:=request->'filter';
 target uuid;intent_target uuid;page_at timestamptz;page_id uuid;as_of timestamptz;
 lower_at timestamptz;upper_at timestamptz;account_filter uuid;work_filter text;
 state_filter text;kind_filter text;query_filter text;recipient_filter text;bound integer;
 result jsonb;
BEGIN
 -- app.* only selects context: live persisted identity, scopes, operator and
 -- exact ticket/work authority are all independently required below.
 IF session_user<>'helpdesk_app' OR w IS NULL OR who IS NULL
 OR NOT coalesce(helpdesk_auth.is_human(),false)
 OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
 OR NOT EXISTS(SELECT 1 FROM helpdesk_auth.principals p WHERE p.id=who AND p.active AND p.kind='human')
 OR NOT (EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships m WHERE m.workspace_id=w AND m.principal_id=who AND m.active)
 OR EXISTS(SELECT 1 FROM helpdesk_auth.account_grants g WHERE g.workspace_id=w AND g.principal_id=who AND g.active))
 THEN RAISE EXCEPTION 'Email monitoring denied' USING ERRCODE='42501';END IF;
 SELECT EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships m WHERE m.workspace_id=w AND m.principal_id=who AND m.active AND m.role='admin') INTO full_address;
 IF jsonb_typeof(request) IS DISTINCT FROM 'object' OR request-'mode'-'filter'-'eventId'-'intentId'-'after'-'asOf'<>'{}'::jsonb
 OR mode IS NULL OR mode NOT IN ('collection','delivery','recipient') OR jsonb_typeof(f) IS DISTINCT FROM 'object'
 OR f-'limit'-'cursor'-'from'-'to'-'accountId'-'workId'-'kind'-'status'-'q'-'recipient'<>'{}'::jsonb
 THEN RAISE EXCEPTION 'Invalid email monitor query' USING ERRCODE='22023';END IF;
 bound:=coalesce((f->>'limit')::integer,25);
 state_filter:=coalesce(f->>'status','all');kind_filter:=f->>'kind';query_filter:=f->>'q';recipient_filter:=f->>'recipient';work_filter:=f->>'workId';
 IF bound NOT BETWEEN 1 AND 50 OR state_filter NOT IN ('all','queue','attention','pending','retry_wait','leased','sending','unknown','accepted','delivered','failed','suppressed')
 OR recipient_filter IS NOT NULL AND NOT full_address
 OR query_filter IS NOT NULL AND (length(query_filter) NOT BETWEEN 2 AND 200 OR query_filter ~ '[[:cntrl:]]')
 OR recipient_filter IS NOT NULL AND (length(recipient_filter) NOT BETWEEN 3 AND 254 OR recipient_filter ~ '[[:cntrl:]]')
 OR work_filter IS NOT NULL AND (length(work_filter) NOT BETWEEN 1 AND 200 OR work_filter ~ '[[:cntrl:]]')
 OR f->>'cursor' IS NOT NULL
 THEN RAISE EXCEPTION 'Invalid email monitor filter' USING ERRCODE='22023';END IF;
 target:=(request->>'eventId')::uuid;intent_target:=(request->>'intentId')::uuid;
 IF mode='collection' AND (target IS NOT NULL OR intent_target IS NOT NULL) OR mode='delivery' AND (target IS NULL OR intent_target IS NOT NULL) OR mode='recipient' AND (target IS NULL OR intent_target IS NULL)
 THEN RAISE EXCEPTION 'Invalid email monitor target' USING ERRCODE='22023';END IF;
 as_of:=helpdesk_auth.hdn_notification_stamp(request->>'asOf');
 IF as_of IS NULL OR NOT isfinite(as_of) OR as_of>clock_timestamp() THEN RAISE EXCEPTION 'Invalid email monitor instant' USING ERRCODE='22023';END IF;
 lower_at:=CASE WHEN f->>'from' IS NULL THEN NULL ELSE helpdesk_auth.hdn_notification_stamp(f->>'from') END;
 upper_at:=CASE WHEN f->>'to' IS NULL THEN NULL ELSE helpdesk_auth.hdn_notification_stamp(f->>'to') END;account_filter:=(f->>'accountId')::uuid;
 IF lower_at IS NOT NULL AND upper_at IS NOT NULL AND lower_at>=upper_at THEN RAISE EXCEPTION 'Invalid email monitor period' USING ERRCODE='22023';END IF;
 IF request->'after' IS NOT NULL AND request->'after'<>'null'::jsonb THEN
  IF jsonb_typeof(request->'after')<>'object' OR (request->'after')-'at'-'id'<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid email monitor position' USING ERRCODE='22023';END IF;
  page_at:=helpdesk_auth.hdn_notification_stamp(request->'after'->>'at');page_id:=(request->'after'->>'id')::uuid;
  IF page_at IS NULL OR page_id IS NULL OR mode='recipient' THEN RAISE EXCEPTION 'Invalid email monitor position' USING ERRCODE='22023';END IF;
 END IF;
 PERFORM helpdesk_auth.cg_local_prepare_ticket_collection();
 -- Preserve the current persisted privacy decision through this transaction.
 -- The local registry preparation runs first, matching its registry -> scopes
 -- -> identity lock order. Re-read after locking: an earlier admin lookup must
 -- not survive a concurrent role demotion that left ticket access intact.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||who::text,0));
 PERFORM 1 FROM helpdesk_auth.principals p WHERE p.id=who FOR SHARE;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships m WHERE m.workspace_id=w AND m.principal_id=who FOR SHARE;
 PERFORM 1 FROM helpdesk_auth.account_grants g WHERE g.workspace_id=w AND g.principal_id=who FOR SHARE;
 IF NOT coalesce(helpdesk_auth.is_human(),false) OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
 OR NOT EXISTS(SELECT 1 FROM helpdesk_auth.principals p WHERE p.id=who AND p.active AND p.kind='human')
 THEN RAISE EXCEPTION 'Email monitoring denied' USING ERRCODE='42501';END IF;
 SELECT EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships m WHERE m.workspace_id=w AND m.principal_id=who AND m.active AND m.role='admin') INTO full_address;
 IF recipient_filter IS NOT NULL AND NOT full_address THEN RAISE EXCEPTION 'Invalid email monitor filter' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM helpdesk_integration.hdn_email_monitor_settings WHERE singleton FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Email monitor coverage unavailable' USING ERRCODE='HDM01';
 END IF;
 WITH
 authorized AS MATERIALIZED (
  SELECT r.id,r.event_id,r.ticket_id,r.intent,r.record,r.recipient_address,r.accepted_at,
   o.created_at AS communication_at,r.intent->>'protocol' AS protocol,
   left(regexp_replace(t.subject,'[[:cntrl:]]',' ','g'),240) AS subject,r.intent->>'kind' AS kind
  FROM helpdesk_integration.hdn_notification_records r
  JOIN helpdesk_core.tickets t ON (t.workspace_id,t.account_id,t.id)=(r.workspace_id,r.account_id,r.ticket_id)
  JOIN LATERAL (
   -- Workflow team and review events deliberately have no public outbox.
   -- Match the immutable source in the exact intent namespace; no grouping by
   -- subject/address, no use of planning time, no call to the worker writer.
   SELECT src.created_at FROM (
    SELECT review.created_at,1 AS priority FROM helpdesk_integration.hdnr_sources review
     WHERE (review.workspace_id,review.account_id,review.ticket_id,review.id)=(r.workspace_id,r.account_id,r.ticket_id,r.event_id)
    UNION ALL SELECT team.created_at,2 FROM helpdesk_integration.hdn_notification_private_sources team
     WHERE (team.workspace_id,team.account_id,team.ticket_id,team.id)=(r.workspace_id,r.account_id,r.ticket_id,r.event_id)
    UNION ALL SELECT public_event.created_at,3 FROM helpdesk_integration.outbox_events public_event
     WHERE (public_event.workspace_id,public_event.account_id,public_event.ticket_id,public_event.id)=(r.workspace_id,r.account_id,r.ticket_id,r.event_id)
   ) src ORDER BY src.priority LIMIT 1
  ) o ON true
  WHERE r.workspace_id=w AND r.channel_id='resend'
   AND coalesce(helpdesk_auth.is_operator(r.workspace_id,r.account_id),false)
   AND coalesce(helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by),false)
   AND coalesce(helpdesk_auth.cg_ticket_resource_allowed(r.workspace_id,r.account_id,r.ticket_id,'tickets.read'),false)
   AND (account_filter IS NULL OR r.account_id=account_filter)
   AND (work_filter IS NULL OR EXISTS(SELECT 1 FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(r.workspace_id,r.account_id,r.ticket_id) AND x.resource_type='work' AND x.resource_id=work_filter))
   AND (target IS NULL OR r.event_id=target)
   AND o.created_at<=as_of
   AND (lower_at IS NULL OR o.created_at>=lower_at) AND (upper_at IS NULL OR o.created_at<upper_at)
   AND (kind_filter IS NULL OR r.intent->>'kind'=kind_filter)
   AND (query_filter IS NULL OR strpos(lower(r.intent->>'protocol'),lower(query_filter))>0 OR strpos(lower(t.subject),lower(query_filter))>0)
   AND (recipient_filter IS NULL OR full_address AND strpos(lower(r.recipient_address),lower(recipient_filter))>0)
 ),
 receipt_facts AS MATERIALIZED (
  SELECT a.id,
   min(n.occurred_at) FILTER(WHERE n.outcome='accepted' AND n.disposition IN ('applied','ignored')) AS sent_at,
   min(n.occurred_at) FILTER(WHERE n.outcome='delivered' AND n.disposition IN ('applied','ignored')) AS delivered_at,
   min(n.occurred_at) FILTER(WHERE n.event_type='email.opened' AND n.disposition='applied') AS opened_at,
   min(n.occurred_at) FILTER(WHERE n.event_type='email.clicked' AND n.disposition='applied') AS clicked_at
  FROM authorized a LEFT JOIN helpdesk_integration.hdn_notification_native_receipts n
   ON n.intent_id=a.id AND n.provider_message_id::text=a.record->>'providerMessageId'
   AND n.occurred_at>=helpdesk_auth.hdn_notification_stamp(a.intent->>'createdAt')
   AND n.occurred_at<=as_of AND n.received_at<=as_of
  GROUP BY a.id
 ),
 facts AS MATERIALIZED (
  SELECT a.*,a.record->>'state' AS state,coalesce((a.record->>'attention')::boolean,false) OR a.record->>'state'='unknown'
   OR EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_native_receipts alert
    WHERE alert.intent_id=a.id AND alert.provider_message_id::text=a.record->>'providerMessageId'
     AND alert.disposition='attention' AND alert.received_at<=as_of) AS attention,
   CASE WHEN a.accepted_at<=as_of THEN least(a.accepted_at,n.sent_at) ELSE n.sent_at END AS sent_at,
   n.delivered_at,n.opened_at,n.clicked_at,
   a.recipient_address IS NOT NULL AS delivery_eligible,
   coalesce(helpdesk_auth.hdn_notification_stamp(a.intent->>'createdAt')>=s.opened_started_at,false) AS open_eligible,
   coalesce(helpdesk_auth.hdn_notification_stamp(a.intent->>'createdAt')>=s.clicked_started_at,false) AS click_eligible,
   CASE WHEN a.recipient_address IS NULL OR a.recipient_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[A-Za-z]{2,63}$' THEN 'Destinatário indisponível'
    WHEN full_address THEN a.recipient_address
    ELSE left(split_part(a.recipient_address,'@',1),1)||'***@'||left(split_part(a.recipient_address,'@',2),1)||'***.'||substring(a.recipient_address FROM '\.([A-Za-z]{2,63})$') END AS recipient_display
  FROM authorized a JOIN receipt_facts n ON n.id=a.id
  CROSS JOIN helpdesk_integration.hdn_email_monitor_settings s WHERE s.singleton
 ),
 filtered AS MATERIALIZED (
  SELECT z.*,jsonb_build_object('state',z.state,'attention',z.attention,'sentAt',z.sent_at,'deliveredAt',z.delivered_at,'openedAt',z.opened_at,'clickedAt',z.clicked_at,'deliveryEligible',z.delivery_eligible,'openEligible',z.open_eligible,'clickEligible',z.click_eligible) AS summary_fact
  FROM facts z WHERE state_filter='all' OR state_filter='queue' AND z.state IN ('pending','retry_wait','leased','sending') OR state_filter='attention' AND (z.attention OR z.state IN ('failed','suppressed')) OR z.state=state_filter
 ),
 groups AS MATERIALIZED (
  SELECT event_id,ticket_id,communication_at,min(protocol) AS protocol,min(subject) AS subject,min(kind) AS kind,count(*) AS total,
   helpdesk_auth.hdn_email_monitor_summary(jsonb_agg(summary_fact ORDER BY id)) AS summary
  FROM filtered GROUP BY event_id,ticket_id,communication_at
 ),
 snapshot AS (
  -- Includes facts/revisions beyond asOf too: a change during pagination must
  -- invalidate the cursor, including callbacks that do not advance record.revision.
  SELECT helpdesk_auth.hdni_digest(jsonb_build_object('workspace',w,'actor',who,'full',full_address,
   'settings',(SELECT to_jsonb(s) FROM helpdesk_integration.hdn_email_monitor_settings s WHERE s.singleton),
   'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'intent',a.intent,'record',a.record,'address',a.recipient_address,'acceptedAt',a.accepted_at,'sourceAt',a.communication_at,'subject',a.subject,
    'receipts',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.event_id) FROM helpdesk_integration.hdn_notification_native_receipts n WHERE n.intent_id=a.id),'[]'::jsonb),
    'audit',coalesce((SELECT jsonb_agg(jsonb_build_object('revision',history.revision,'type',history.type,'at',history.at) ORDER BY history.revision) FROM helpdesk_audit.hdn_notification_audit history WHERE history.intent_id=a.id),'[]'::jsonb),
    'attempts',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.attempt) FROM helpdesk_integration.hdn_notification_attempts b WHERE b.intent_id=a.id),'[]'::jsonb)) ORDER BY a.id) FROM authorized a),'[]'::jsonb))) AS hash
 ),
 page_groups AS (
  SELECT * FROM groups g WHERE page_at IS NULL OR (g.communication_at,g.event_id)<(page_at,page_id)
  ORDER BY g.communication_at DESC,g.event_id DESC LIMIT bound+1
 ),
 page_recipients AS (
  SELECT * FROM filtered z WHERE page_at IS NULL OR (z.communication_at,z.id)<(page_at,page_id)
  ORDER BY z.communication_at DESC,z.id DESC LIMIT bound+1
 ),
 recipient_result AS (
  SELECT z.id,jsonb_build_object('id',z.id,'eventId',z.event_id,'recipientDisplay',z.recipient_display,'visibility',CASE WHEN full_address THEN 'full' ELSE 'masked' END,'state',z.state,'attention',z.attention,
   'reason',CASE WHEN z.record->>'lastReason' ~ '^[a-z][a-z0-9_]{0,119}$' THEN z.record->>'lastReason' ELSE NULL END,
   'nextAttemptAt',CASE WHEN z.record->>'nextAttemptAt' IS NOT NULL THEN helpdesk_auth.hdn_workflow_iso(helpdesk_auth.hdn_notification_stamp(z.record->>'nextAttemptAt')) ELSE NULL END,
   'timeline',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',h.kind,'occurredAt',helpdesk_auth.hdn_workflow_iso(h.at),'receivedAt',CASE WHEN h.received IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(h.received) END) ORDER BY h.at,h.kind) FROM (
    SELECT 'communication'::text AS kind,z.communication_at AS at,NULL::timestamptz AS received
    UNION ALL SELECT 'queued',helpdesk_auth.hdn_notification_stamp(z.intent->>'createdAt'),NULL
    UNION ALL SELECT 'accepted',z.sent_at,NULL WHERE z.sent_at IS NOT NULL
    UNION ALL SELECT 'delivered',z.delivered_at,NULL WHERE z.delivered_at IS NOT NULL
    UNION ALL SELECT 'opened',z.opened_at,NULL WHERE z.opened_at IS NOT NULL
    UNION ALL SELECT 'clicked',z.clicked_at,NULL WHERE z.clicked_at IS NOT NULL
    -- A terminal synchronous refusal has no provider callback. Its current
    -- send_observed audit revision proves when FAILED was persisted. Never
    -- relabel an arbitrary updatedAt after a later reconciliation as failure.
    UNION ALL SELECT 'failed',failure.at,NULL
     FROM helpdesk_audit.hdn_notification_audit failure
     WHERE failure.intent_id=z.id AND z.state='failed' AND z.record->>'providerMessageId' IS NULL
      AND failure.revision=(z.record->>'revision')::bigint AND failure.type='delivery.send_observed'
      AND failure.at=helpdesk_auth.hdn_notification_stamp(z.record->>'updatedAt')
      AND failure.at>=helpdesk_auth.hdn_notification_stamp(z.intent->>'createdAt') AND failure.at<=as_of
    UNION ALL SELECT first_receipt.kind,first_receipt.occurred_at,first_receipt.received_at FROM (
     SELECT DISTINCT ON(coalesce(n.event_type,'provider.'||n.outcome)) coalesce(n.event_type,'provider.'||n.outcome) AS kind,n.occurred_at,n.received_at
      FROM helpdesk_integration.hdn_notification_native_receipts n WHERE n.intent_id=z.id AND n.provider_message_id::text=z.record->>'providerMessageId'
      AND n.disposition IN ('applied','ignored','attention') AND n.occurred_at>=helpdesk_auth.hdn_notification_stamp(z.intent->>'createdAt') AND n.occurred_at<=as_of AND n.received_at<=as_of
      AND (n.outcome IS NOT NULL OR n.event_type IN ('email.opened','email.clicked') AND n.disposition='applied')
      ORDER BY coalesce(n.event_type,'provider.'||n.outcome),n.occurred_at,n.event_id
    ) first_receipt
   ) h),'[]'::jsonb),
   'attempts',coalesce((SELECT jsonb_agg(jsonb_build_object('number',b.attempt,'startedAt',helpdesk_auth.hdn_workflow_iso(b.started_at)) ORDER BY b.attempt) FROM helpdesk_integration.hdn_notification_attempts b WHERE b.intent_id=z.id AND b.started_at<=as_of),'[]'::jsonb))
   ||CASE WHEN full_address THEN jsonb_build_object('providerMessageId',z.record->'providerMessageId','template',jsonb_build_object('id',z.intent->'templateId','version',z.intent->'templateVersion','hash',z.intent->'templateHash')) ELSE '{}'::jsonb END AS dto
  FROM filtered z WHERE z.id=intent_target
 )
 SELECT jsonb_build_object('asOf',helpdesk_auth.hdn_workflow_iso(as_of),'snapshotHash',s.hash)||
 CASE mode
 WHEN 'collection' THEN jsonb_build_object('total',(SELECT count(*) FROM groups),'items',coalesce((SELECT jsonb_agg(jsonb_build_object('eventId',g.event_id,'ticketId',g.ticket_id,'protocol',g.protocol,'subject',g.subject,'kind',g.kind,'createdAt',helpdesk_auth.hdn_workflow_iso(g.communication_at),'total',g.total,'summary',g.summary) ORDER BY g.communication_at DESC,g.event_id DESC) FROM page_groups g),'[]'::jsonb))
 WHEN 'delivery' THEN (SELECT jsonb_build_object('eventId',g.event_id,'ticketId',g.ticket_id,'protocol',g.protocol,'subject',g.subject,'kind',g.kind,'createdAt',helpdesk_auth.hdn_workflow_iso(g.communication_at),'total',g.total,'summary',g.summary,
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',z.id,'recipientDisplay',z.recipient_display,'visibility',CASE WHEN full_address THEN 'full' ELSE 'masked' END,'state',z.state,'attention',z.attention,
   'badge',CASE WHEN z.attention THEN CASE WHEN z.state='unknown' THEN 'Resultado desconhecido' ELSE 'Requer atenção' END WHEN z.state='failed' THEN 'Falhou' WHEN z.state='suppressed' THEN 'Suprimido'
    WHEN z.delivered_at IS NOT NULL THEN CASE WHEN z.clicked_at IS NOT NULL THEN 'Clicou' WHEN z.opened_at IS NOT NULL THEN 'Aberto*' ELSE 'Entregue' END
    WHEN z.sent_at IS NOT NULL THEN 'Saiu' WHEN z.state='pending' THEN 'Na fila' WHEN z.state='retry_wait' THEN 'Aguardando nova tentativa' ELSE 'Em envio' END,
   'sentAt',CASE WHEN z.sent_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(z.sent_at) END,
   'deliveredAt',CASE WHEN z.delivered_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(z.delivered_at) END,
   'openedAt',CASE WHEN z.opened_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(z.opened_at) END,
   'clickedAt',CASE WHEN z.clicked_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(z.clicked_at) END,
   'openAvailability',CASE WHEN z.opened_at IS NOT NULL THEN 'observed' WHEN z.open_eligible THEN 'not_observed' ELSE 'not_collected' END,
   'clickAvailability',CASE WHEN z.clicked_at IS NOT NULL THEN 'observed' WHEN z.click_eligible THEN 'not_observed' ELSE 'not_collected' END) ORDER BY z.communication_at DESC,z.id DESC) FROM page_recipients z),'[]'::jsonb)) FROM groups g WHERE g.event_id=target)
 WHEN 'recipient' THEN (SELECT r.dto FROM recipient_result r)
 END INTO result FROM snapshot s;
 IF result IS NULL THEN RAISE EXCEPTION 'Email communication unavailable' USING ERRCODE='P0002';END IF;
 RETURN result;
END$$;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_email_monitor(jsonb) FROM PUBLIC,helpdesk_app,helpdesk_notification_worker;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_email_monitor(jsonb) TO helpdesk_app;
DO $email_monitor_clients$ DECLARE r text;BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_resource_publisher','helpdesk_maintenance'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON helpdesk_integration.hdn_email_monitor_settings FROM %I',r);
   EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdn_email_monitor(jsonb),helpdesk_auth.hdn_email_monitor_summary(jsonb) FROM %I',r);
  END IF;
 END LOOP;
END$email_monitor_clients$;
