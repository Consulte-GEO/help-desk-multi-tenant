CREATE FUNCTION helpdesk_auth.hdni_allocate_protocol(ctx jsonb) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE next_value bigint;
BEGIN PERFORM helpdesk_auth.hdni_lock_scope(ctx);IF ctx->>'operation'<>'tickets.write' THEN RAISE EXCEPTION 'Write scope denied' USING ERRCODE='HDI01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(helpdesk_auth.workspace_id()::text||':intake-protocol',0));
 SELECT last_sequence+1 INTO next_value FROM helpdesk_core.hdni_protocol_counters WHERE workspace_id=helpdesk_auth.workspace_id() FOR UPDATE;next_value:=coalesce(next_value,10001);
 IF next_value>999999999999999999 THEN RAISE EXCEPTION 'Protocol exhausted' USING ERRCODE='HDI08';END IF;PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN next_value::text;
END$$;
