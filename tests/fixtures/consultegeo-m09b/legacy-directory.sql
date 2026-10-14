CREATE FUNCTION helpdesk_auth.hdni_draft_directory(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d helpdesk_core.hdni_drafts%rowtype;ctx jsonb;
BEGIN
 SELECT * INTO d FROM helpdesk_core.hdni_drafts WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target AND owner_id=helpdesk_auth.actor_id();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('principalId',helpdesk_auth.actor_id(),'workspaceId',d.workspace_id,'accountId',d.account_id,'bindingId',b.id,'bindingRevision',o.binding_revision,'accessRevision',o.access_revision,'manifestFingerprint',o.manifest_fingerprint,'operation','tickets.read','asOf',helpdesk_auth.hdn_workflow_iso(o.as_of),'expiresAt',helpdesk_auth.hdn_workflow_iso(o.expires_at),'refs',d.document->'refs') INTO ctx
 FROM helpdesk_auth.cg_resource_bindings b JOIN helpdesk_auth.cg_resource_observations o ON (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation)=(b.workspace_id,b.account_id,b.id,d.owner_id,'tickets.read')
 WHERE (b.workspace_id,b.account_id,b.connection_id,b.tenant_id)=(d.workspace_id,d.account_id,(d.document->'refs'->0->>'connectionId')::uuid,d.document->'refs'->0->>'tenantId');
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);IF d.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Draft expired' USING ERRCODE='HDI06';END IF;
 RETURN jsonb_build_object('accountId',d.account_id,'refs',d.document->'refs');
END$$;

