-- Fragment for the reviewed 0.26 -> 0.27 migration, within its owned transaction.
-- No BEGIN/COMMIT/schema marker, production execution or coverage start here.
-- Columns start NULL. Existing receipts/snapshots are not backfilled.
ALTER TABLE helpdesk_integration.hdn_notification_native_receipts
 ADD COLUMN event_type text CHECK(event_type IS NULL OR event_type ~ '^email\.[a-z][a-z0-9_]*$');
ALTER TABLE helpdesk_integration.hdn_notification_records
 ADD COLUMN recipient_address text CHECK(recipient_address IS NULL OR length(recipient_address) BETWEEN 3 AND 254),
 ADD COLUMN accepted_at timestamptz CHECK(accepted_at IS NULL OR isfinite(accepted_at));
CREATE INDEX hdn_email_monitor_native_intent_type
 ON helpdesk_integration.hdn_notification_native_receipts(intent_id,event_type,occurred_at,event_id)
 WHERE intent_id IS NOT NULL;

-- Preserve the qualified delivery reducer. Its replacement handles independent
-- telemetry before delegating delivery to the unchanged 0.25 implementation.
ALTER FUNCTION helpdesk_auth.hdn_notification_apply_native(uuid,text,text)
 RENAME TO hdn_notification_apply_native_v025;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_apply_native_v025(uuid,text,text)
 FROM PUBLIC,helpdesk_app,helpdesk_notification_worker;
CREATE FUNCTION helpdesk_auth.hdn_notification_apply_native(target uuid,event_key text,at_text text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 receipt helpdesk_integration.hdn_notification_native_receipts%rowtype;
 r jsonb;result jsonb;stamp timestamptz:=helpdesk_auth.hdn_notification_stamp(at_text);
 qualified boolean;affected integer;
BEGIN
 PERFORM helpdesk_auth.hdn_notification_worker();
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-notification-ledger-v1',0));
 SELECT * INTO STRICT receipt FROM helpdesk_integration.hdn_notification_native_receipts
  WHERE event_id=event_key FOR UPDATE;
 SELECT record INTO STRICT r FROM helpdesk_integration.hdn_notification_records WHERE id=target FOR UPDATE;
 IF receipt.intent_id IS NOT NULL OR stamp<helpdesk_auth.hdn_notification_stamp(r->>'updatedAt')
  OR r->>'providerMessageId' IS DISTINCT FROM receipt.provider_message_id::text
  OR (r->>'attempts')::integer<1 OR r->>'state' NOT IN ('accepted','delivered','failed','unknown')
  OR receipt.occurred_at>stamp OR extract(epoch FROM receipt.occurred_at)*1000000 NOT BETWEEN 1 AND 9007199254740991 THEN
  RAISE EXCEPTION 'Native correlation mismatch' USING ERRCODE='HDN03';
 END IF;
 qualified:=receipt.occurred_at>=helpdesk_auth.hdn_notification_stamp(r->'intent'->>'createdAt');
 IF receipt.event_type IN ('email.opened','email.clicked') THEN
  IF receipt.outcome IS NOT NULL THEN RAISE EXCEPTION 'Telemetry cannot change delivery' USING ERRCODE='HDN03';END IF;
  -- Receipt is the independent immutable fact; do not touch state, revision,
  -- providerSequence, providerEventAt, updatedAt or delivery audit.
  UPDATE helpdesk_integration.hdn_notification_native_receipts
   SET intent_id=target,disposition=CASE WHEN qualified THEN 'applied' ELSE 'attention' END
   WHERE event_id=event_key AND intent_id IS NULL;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Telemetry receipt effect missing' USING ERRCODE='HDN03';END IF;
  RETURN r;
 END IF;
 result:=helpdesk_auth.hdn_notification_apply_native_v025(target,event_key,at_text);
 -- A verified email.sent is acceptance evidence, even if its callback arrived
 -- after a later delivery/failure and the delivery reducer keeps that state.
 IF receipt.event_type='email.sent' AND receipt.outcome='accepted' AND qualified THEN
  UPDATE helpdesk_integration.hdn_notification_records
   SET accepted_at=CASE WHEN accepted_at IS NULL THEN receipt.occurred_at ELSE least(accepted_at,receipt.occurred_at) END
   WHERE id=target;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Acceptance fact missing' USING ERRCODE='HDN02';END IF;
 END IF;
 RETURN result;
END$$;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_apply_native(uuid,text,text)
 FROM PUBLIC,helpdesk_app,helpdesk_notification_worker;

-- The existing worker RPC retains its exact signature. New runtimes include
-- eventType; old runtimes may still submit the exact 0.25 envelope during rollout.
CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_native(ev jsonb,at_text text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 prior helpdesk_integration.hdn_notification_native_receipts%rowtype;
 target uuid;r jsonb;stamp timestamptz:=helpdesk_auth.hdn_notification_stamp(at_text);
 event_time timestamptz;native_type text:=ev->>'eventType';expected_outcome text;affected integer;
BEGIN
 PERFORM helpdesk_auth.hdn_notification_worker();
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-notification-ledger-v1',0));
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(ev,ARRAY['eventId','eventHash','providerMessageId','occurredAt','outcome'],ARRAY['eventType']),false)
  OR jsonb_typeof(ev->'eventId') IS DISTINCT FROM 'string' OR ev->>'eventId' !~ '^msg_[A-Za-z0-9_-]{1,156}$'
  OR jsonb_typeof(ev->'eventHash') IS DISTINCT FROM 'string' OR ev->>'eventHash' !~ '^[a-f0-9]{64}$'
  OR jsonb_typeof(ev->'providerMessageId') IS DISTINCT FROM 'string' OR ev->>'providerMessageId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR jsonb_typeof(ev->'occurredAt') IS DISTINCT FROM 'string'
  OR jsonb_typeof(ev->'outcome') NOT IN ('string','null')
  OR ev->'outcome'<>'null'::jsonb AND ev->>'outcome' NOT IN ('accepted','delivered','failed')
  OR ev ? 'eventType' AND (jsonb_typeof(ev->'eventType') IS DISTINCT FROM 'string' OR native_type !~ '^email\.[a-z][a-z0-9_]*$') THEN
  RAISE EXCEPTION 'Native receipt invalid' USING ERRCODE='HDN03';
 END IF;
 IF native_type IS NOT NULL THEN
  expected_outcome:=CASE native_type WHEN 'email.sent' THEN 'accepted' WHEN 'email.delivered' THEN 'delivered'
   WHEN 'email.failed' THEN 'failed' WHEN 'email.bounced' THEN 'failed' WHEN 'email.suppressed' THEN 'failed' ELSE NULL END;
  IF expected_outcome IS DISTINCT FROM ev->>'outcome' THEN RAISE EXCEPTION 'Native type outcome mismatch' USING ERRCODE='HDN03';END IF;
 END IF;
 event_time:=helpdesk_auth.hdn_notification_stamp(ev->>'occurredAt');
 IF event_time>stamp OR stamp>clock_timestamp()+interval '1 second'
  OR extract(epoch FROM event_time)*1000000 NOT BETWEEN 1 AND 9007199254740991 THEN
  RAISE EXCEPTION 'Native occurrence unqualified' USING ERRCODE='HDN03';
 END IF;
 SELECT * INTO prior FROM helpdesk_integration.hdn_notification_native_receipts WHERE event_id=ev->>'eventId' FOR UPDATE;
 IF FOUND THEN
  IF prior.event_hash<>ev->>'eventHash' OR prior.provider_message_id<>(ev->>'providerMessageId')::uuid
   OR prior.occurred_at<>event_time OR prior.outcome IS DISTINCT FROM ev->>'outcome'
   OR prior.event_type IS NOT NULL AND native_type IS NOT NULL AND prior.event_type<>native_type THEN
   RAISE EXCEPTION 'Native event conflict' USING ERRCODE='HDN03';
  END IF;
  -- NULL means unknown type for an already stored legacy receipt, not another
  -- type. A rollout replay remains a no-op and never backfills old observations.
  RETURN jsonb_build_object('eventId',prior.event_id,'disposition',prior.disposition,'intentId',prior.intent_id);
 END IF;
 INSERT INTO helpdesk_integration.hdn_notification_native_receipts
  (event_id,event_hash,provider_message_id,occurred_at,outcome,received_at,disposition,event_type)
  VALUES(ev->>'eventId',ev->>'eventHash',(ev->>'providerMessageId')::uuid,event_time,ev->>'outcome',stamp,'unmatched',native_type);
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Native receipt missing' USING ERRCODE='HDN03';END IF;
 SELECT id INTO target FROM helpdesk_integration.hdn_notification_records
  WHERE record->>'providerMessageId'=ev->>'providerMessageId' AND record->>'state' IN ('accepted','delivered','failed','unknown') FOR UPDATE;
 IF target IS NOT NULL THEN r:=helpdesk_auth.hdn_notification_apply_native(target,ev->>'eventId',at_text);END IF;
 SELECT * INTO STRICT prior FROM helpdesk_integration.hdn_notification_native_receipts WHERE event_id=ev->>'eventId';
 RETURN jsonb_build_object('eventId',prior.event_id,'disposition',prior.disposition,'intentId',prior.intent_id);
END$$;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_native(jsonb,text)
 FROM PUBLIC,helpdesk_app;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_notification_native(jsonb,text) TO helpdesk_notification_worker;

-- Preserve all original state/lease/CAS/audit/recipient/template checks and late
-- correlation in the base save. Snapshot columns live outside the frozen JSON.
ALTER FUNCTION helpdesk_auth.hdn_notification_save(uuid,jsonb,bigint,jsonb,text)
 RENAME TO hdn_notification_save_v025;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_save_v025(uuid,jsonb,bigint,jsonb,text)
 FROM PUBLIC,helpdesk_app,helpdesk_notification_worker;
CREATE FUNCTION helpdesk_auth.hdn_notification_save(target uuid,delivery_next jsonb,expected bigint,audit jsonb,contact_hash text)
 RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 current_record jsonb;result jsonb;recipient jsonb;snapshot_address text;affected integer;
 kind text:=audit->>'type';stamp timestamptz:=helpdesk_auth.hdn_notification_stamp(delivery_next->>'updatedAt');
BEGIN
 current_record:=helpdesk_auth.hdn_notification_lock(target);
 IF kind='delivery.send_started' THEN
  -- This is the send-time authority, under the same original ledger/record and
  -- authority/contact locks. Never query today's Auth address for old sends.
  recipient:=helpdesk_auth.hdn_notification_recipient(current_record->'intent');
  IF contact_hash IS NULL OR contact_hash<>helpdesk_auth.hdni_digest(recipient->'address') THEN
   RAISE EXCEPTION 'Recipient changed' USING ERRCODE='HDN04';
  END IF;
  SELECT recipient_address INTO STRICT snapshot_address FROM helpdesk_integration.hdn_notification_records WHERE id=target;
  IF snapshot_address IS NOT NULL AND snapshot_address IS DISTINCT FROM recipient->>'address' THEN
   RAISE EXCEPTION 'Recipient snapshot changed' USING ERRCODE='HDN04';
  END IF;
 END IF;
 result:=helpdesk_auth.hdn_notification_save_v025(target,delivery_next,expected,audit,contact_hash);
 IF kind='delivery.send_started' THEN
  UPDATE helpdesk_integration.hdn_notification_records SET recipient_address=recipient->>'address'
   WHERE id=target AND (recipient_address IS NULL OR recipient_address=recipient->>'address');
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Recipient snapshot effect missing' USING ERRCODE='HDN02';END IF;
 ELSIF kind='delivery.send_observed' AND delivery_next->>'state'='accepted' THEN
  -- The base may already have advanced result to delivered by correlating a
  -- pre-ACK callback. The input's validated ACK is still acceptance evidence.
  UPDATE helpdesk_integration.hdn_notification_records
   SET accepted_at=CASE WHEN accepted_at IS NULL THEN stamp ELSE least(accepted_at,stamp) END WHERE id=target;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Acceptance snapshot effect missing' USING ERRCODE='HDN02';END IF;
 END IF;
 RETURN result;
END$$;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_save(uuid,jsonb,bigint,jsonb,text)
 FROM PUBLIC,helpdesk_app;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_notification_save(uuid,jsonb,bigint,jsonb,text) TO helpdesk_notification_worker;

-- Root migration must register both *_v025 functions as private non-callable
-- helpers in the exact database contract. Worker callable inventory stays 13.
-- Native receipts require disposition='applied' for opened/clicked projections;
-- invalid chronology is attention, unsupported events remain ignored. Correlation
-- continues to use only the persisted provider message ID, including late ACK.

-- Supabase client roles may be absent in an owned vanilla PostgreSQL cluster.
-- Revoke them when present, without creating roles or weakening the catalogue.
DO $email_native_clients$ DECLARE client_role text;BEGIN
 FOR client_role IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_apply_native_v025(uuid,text,text),helpdesk_auth.hdn_notification_apply_native(uuid,text,text),helpdesk_auth.hdn_notification_native(jsonb,text),helpdesk_auth.hdn_notification_save_v025(uuid,jsonb,bigint,jsonb,text),helpdesk_auth.hdn_notification_save(uuid,jsonb,bigint,jsonb,text) FROM %I',client_role);
 END LOOP;
END$email_native_clients$;
