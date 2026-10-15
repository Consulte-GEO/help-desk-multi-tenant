/** Exact owned PG17 inventory from run38762865884. Promotion acceptance requires corrected behavior and fresh CI. */
import {DATABASE_SECURITY_QUERY} from './database-security.ts';
export const REGISTRATION_SECURITY_CONTRACT = {
  "schemaVersion": "0.26.0",
  "schemas": [
    "helpdesk_auth",
    "helpdesk_core",
    "helpdesk_integration",
    "helpdesk_audit"
  ],
  "tables": [
    {
      "name": "helpdesk_audit.audit_events",
      "read": false,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_audit.cg_initial_receipts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.cg_local_receipts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdn_cfg_commits",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdn_notification_audit",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdn_workflow_commits",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdni_draft_commits",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdni_receipts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdnr_challenges",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdnr_openings",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.hdnr_receipts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_audit.write_effects",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.account_grants",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_local_accounts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_local_permissions",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_local_registries",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_local_works",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_bindings",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_connections",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_grant_refs",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_grant_sets",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_observations",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_publication_ledger",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_publication_states",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.cg_resource_publishers",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.hdn_cfg_capabilities",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.hdn_cfg_registries",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.hdnr_grants",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.hdnr_rosters",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.human_scope_versions",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.integration_connections",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.integration_credentials",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.integration_sessions",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.principals",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.rate_limit_buckets",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.source_scope_bindings",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_auth.workspace_memberships",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.accounts",
      "read": true,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.cg_ticket_resource_refs",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.cg_ticket_resource_sets",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.contract_versions",
      "read": true,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.coverages",
      "read": true,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_cfg_catalog",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_cfg_versions",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_execution_audit",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_execution_bindings",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_execution_receipts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_execution_snapshots",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_execution_templates",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_workflow_profiles",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdn_workflow_state",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdni_drafts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdni_protocol_counters",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdni_snapshots",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdnr_forms",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdnr_invitations",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdnr_policies",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.hdnr_profiles",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.internal_notes",
      "read": true,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_core.product_instances",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.products",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.services",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.support_contracts",
      "read": true,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_core.ticket_events",
      "read": true,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_core.ticket_messages",
      "read": true,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_core.tickets",
      "read": true,
      "insert": true,
      "updates": [
        "status",
        "priority",
        "version",
        "updated_at",
        "assigned_to"
      ]
    },
    {
      "name": "helpdesk_core.workspaces",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.api_idempotency_keys",
      "read": false,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hda02_bindings",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hda02_drafts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hda02_grants",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hda02_inbox",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hda02_jobs",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hda02_operations",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hda02_snapshots",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_attempts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_events",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_native_receipts",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_plans",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_private_sources",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_queue_rosters",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_records",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_routes",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdn_notification_templates",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.hdnr_sources",
      "read": false,
      "insert": false,
      "updates": []
    },
    {
      "name": "helpdesk_integration.outbox_events",
      "read": false,
      "insert": true,
      "updates": []
    }
  ],
  "functions": [
    {
      "signature": "helpdesk_audit.bind_effect_event()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_audit.bind_effect_outbox()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_audit.record_conversation_effect()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_audit.record_ticket_effect()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_audit.require_write_effect()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.actor_id()",
      "definer": false,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.can_read_ticket(uuid, uuid, uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_fixed_resource_namespace()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_guard_publication_ledger()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_guard_resource_observation()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_initial_bind_checklist()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_initial_operation(text, text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_initial_receipt_immutable()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_invalidate_resource_grant()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_assert_current(jsonb)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_base_intake_scope(jsonb)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_base_ticket_allowed(uuid, uuid, uuid, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_immutable_receipt()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_manifest()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_operator()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_prepare_ticket_collection()",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_local_provision(text, text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_read_access(uuid, text, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_local_refresh(uuid, text, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_request_contexts()",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_local_require_receipt()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_local_ticket_directory(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_local_ticket_summary(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_lock_ticket_scope(uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_publication_append(text, text, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_publication_open(text, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_publication_replace(text, text, text, text, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_publication_target(text, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_require_publication_receipt()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.cg_ticket_resource_allowed(uuid, uuid, uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.cg_unscoped_product(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.consume_rate_limits(jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.exchange_key(text, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.guard_human_scope_version()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.has_account(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.has_scope(uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hda02_apply(jsonb, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hda02_assert_operation(uuid, uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_authorize(jsonb)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_canonical_walk(jsonb, integer)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_configuration(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_event_id(uuid, uuid, uuid)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_hash(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_immutable()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_inbox_admission()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_instant(timestamp with time zone)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_integer(jsonb, bigint)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_job_admission()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_keys(jsonb, text[])",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_lock_scope(jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hda02_next(jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hda02_operation(jsonb, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hda02_operation_admission()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_reauthorize(jsonb)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_receipt(jsonb, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hda02_ref(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_refs(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_snapshot(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_storage_version()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_text(jsonb, integer)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_transition(jsonb, jsonb, jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_uuid(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda02_worker_target()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hda06_review_target(uuid, boolean)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_authorize(text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_checklist_text(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_commit(jsonb, text, text, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_compile(jsonb, jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_date(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_final_admission()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_form_id(uuid, text, text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_int(jsonb, bigint, bigint)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_object(jsonb, text[], text[])",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_receipt(text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_record(helpdesk_core.hdn_cfg_versions)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_registry()",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_singleline(jsonb, integer)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_state()",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_string(jsonb, integer)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_text(jsonb, integer)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_valid_definition(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_valid_form(jsonb, jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_version_guard()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_cfg_workspace()",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_checklist_contract()",
      "definer": false,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_checklist_evidence(uuid, text[])",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_checklist_receipt(uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_checklist_ticket(uuid, boolean)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_commit_support_workflow(uuid, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_execution_immutable()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_guard_workflow_message()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_guard_workflow_state()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_guard_workflow_transition()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_legacy_terminal_update(uuid, uuid, uuid, text, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_lock_execution_checklist(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_lock_execution_checklist_resolution(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_mark_execution_checklist(uuid, jsonb, text, text, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_notification_apply_native(uuid, text, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_approver(uuid, uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_attention(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_notification_authorize(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_claim(text, text, text, integer)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_event(uuid, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_facts(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_facts_v024(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_facts_wave2_public(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_facts_wave2_team(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_immutable()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_internal_person(uuid, uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_lock(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_native(jsonb, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_plan(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_project_internal()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_recipient(jsonb)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_routing(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_save(uuid, jsonb, bigint, jsonb, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_save_event(uuid, text, text)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_source(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_sources(integer)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_stamp(text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_template(text, integer)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_valid_intent(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_valid_members(uuid[], integer)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_valid_record(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_worker()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_notification_write_plan(uuid, jsonb, jsonb)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_public_events(uuid, boolean, timestamp with time zone, uuid, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_public_messages(uuid, timestamp with time zone, uuid, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_read_support_workflow(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_require_workflow_commit()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_scoped_workflow_commit(uuid, uuid, uuid, integer, integer, text, text, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_support_workflow_receipt(uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_ticket_directory(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_valid_execution_template(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_verify_workflow_assignee(uuid, uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdn_workflow_canonical(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_workflow_completion(uuid, text, jsonb, timestamp with time zone)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_workflow_digest(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdn_workflow_iso(timestamp with time zone)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_allocate_protocol(jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_answers(jsonb, jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_authorize_receipt(jsonb, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_canonical(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_catalog(jsonb, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_coverages(jsonb, uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_create(jsonb, jsonb, integer, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_digest(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_draft(jsonb, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_draft_directory(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_draft_values(jsonb, jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_due(jsonb, text, text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_guard_commit()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_guard_draft()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_initial_clocks(jsonb, uuid, uuid, text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_lock_scope(jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_opening_effect()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_opening_guard()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_profile(jsonb, uuid, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_profile_document(jsonb, uuid)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_profile_document_v024(jsonb, uuid)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_profile_v024(jsonb, uuid, integer)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_receipt(jsonb, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_refs_key(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_require_commit()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_resource_text(text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_save_draft(jsonb, jsonb, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdni_trim(text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdni_utf16(text)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_aggregate(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_authority_publish()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_authority_read(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_challenge(jsonb, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_challenge_complete()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_commit_approval(jsonb, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_commit_invitation(jsonb, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_commit_revision(jsonb, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_context(uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_diff(jsonb, jsonb, text, boolean, boolean, integer)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_grant(uuid, text, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_invitation(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_invitation_guard()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_invitation_receipt(text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_landing(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_opening_complete()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_operator(uuid, uuid, uuid, uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_pending_invitation(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_pending_opening_allowed(uuid, uuid, uuid, uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_profile_pin()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_receipt(text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_receipt_complete()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_route(uuid, jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_scope_hash(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_scoped_revision(uuid, uuid, uuid, integer, integer, text, text, uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_target_hash(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_valid_policy(jsonb)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.hdnr_view(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.hdnr_view_capability(uuid, text, jsonb)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.human_scopes(uuid, uuid)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.is_human()",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.is_operator(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.limit_active_sessions()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.limit_idempotency_records()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.list_human_workspaces(uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.locked_coverages(uuid, uuid, uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.lookup_idempotency(text, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.maintain_ephemeral(boolean, integer)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.product_allowed(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.resolve_human(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.resolve_session(text, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.revoke_session(text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.schema_version()",
      "definer": false,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.set_human_scopes(uuid, uuid, text[], integer, text, uuid)",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.support_contexts(uuid, uuid, uuid, uuid, text, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.workspace_id()",
      "definer": false,
      "execute": true
    },
    {
      "signature": "helpdesk_core.cg_guard_ticket_resource_ref()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_core.cg_guard_ticket_resource_set()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_core.guard_ticket_assignment()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_core.guard_ticket_priority()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_core.guard_ticket_transition()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_core.guard_ticket_update()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_core.reject_published_version_change()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_core.require_assignment_event()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_core.require_initial_outbox()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_core.require_priority_outbox()",
      "definer": true,
      "execute": false
    }
  ],
  "triggers": [
    {
      "table": "helpdesk_audit.cg_initial_receipts",
      "name": "cg_initial_receipt_immutable",
      "function": "helpdesk_auth.cg_initial_receipt_immutable()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.cg_local_receipts",
      "name": "cg_local_receipt_immutable",
      "function": "helpdesk_auth.cg_local_immutable_receipt()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdn_cfg_commits",
      "name": "hdn_cfg_commit_immutable",
      "function": "helpdesk_auth.hdn_execution_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdn_cfg_commits",
      "name": "hdn_cfg_final_admission",
      "function": "helpdesk_auth.hdn_cfg_final_admission()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_audit.hdn_notification_audit",
      "name": "hdn_notification_audit_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_complete_workflow_commit",
      "function": "helpdesk_auth.hdn_require_workflow_commit()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commit_immutable",
      "function": "helpdesk_auth.hdn_execution_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdni_draft_commits",
      "name": "hdni_commit_immutable",
      "function": "helpdesk_auth.hdni_guard_commit()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "cg_initial_bind_checklist",
      "function": "helpdesk_auth.cg_initial_bind_checklist()",
      "type": 5,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_opening_complete",
      "function": "helpdesk_auth.hdni_opening_effect()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipt_immutable",
      "function": "helpdesk_auth.hdni_opening_guard()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenge_complete",
      "function": "helpdesk_auth.hdnr_challenge_complete()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_opening_complete",
      "function": "helpdesk_auth.hdnr_opening_complete()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_opening_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipt_complete",
      "function": "helpdesk_auth.hdnr_receipt_complete()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "complete_write_effect",
      "function": "helpdesk_audit.require_write_effect()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_auth.cg_local_accounts",
      "name": "cg_local_account_receipt",
      "function": "helpdesk_auth.cg_local_require_receipt()",
      "type": 29,
      "deferred": true
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permission_receipt",
      "function": "helpdesk_auth.cg_local_require_receipt()",
      "type": 29,
      "deferred": true
    },
    {
      "table": "helpdesk_auth.cg_local_registries",
      "name": "cg_local_registry_receipt",
      "function": "helpdesk_auth.cg_local_require_receipt()",
      "type": 29,
      "deferred": true
    },
    {
      "table": "helpdesk_auth.cg_local_works",
      "name": "cg_local_work_receipt",
      "function": "helpdesk_auth.cg_local_require_receipt()",
      "type": 29,
      "deferred": true
    },
    {
      "table": "helpdesk_auth.cg_resource_bindings",
      "name": "cg_fixed_binding",
      "function": "helpdesk_auth.cg_fixed_resource_namespace()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.cg_resource_connections",
      "name": "cg_fixed_connection",
      "function": "helpdesk_auth.cg_fixed_resource_namespace()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_refs",
      "name": "cg_invalidate_grant_refs",
      "function": "helpdesk_auth.cg_invalidate_resource_grant()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_immutable_resource_observation",
      "function": "helpdesk_auth.cg_guard_resource_observation()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_ledger",
      "name": "cg_immutable_publication_ledger",
      "function": "helpdesk_auth.cg_guard_publication_ledger()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_publication_receipt_required",
      "function": "helpdesk_auth.cg_require_publication_receipt()",
      "type": 21,
      "deferred": true
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_authority_publication",
      "function": "helpdesk_auth.hdnr_authority_publish()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_authority_publication",
      "function": "helpdesk_auth.hdnr_authority_publish()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_history_immutable",
      "function": "helpdesk_auth.guard_human_scope_version()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_revision_guard",
      "function": "helpdesk_auth.guard_human_scope_version()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_auth.integration_sessions",
      "name": "integration_session_quota",
      "function": "helpdesk_auth.limit_active_sessions()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_refs",
      "name": "cg_guard_ticket_ref",
      "function": "helpdesk_core.cg_guard_ticket_resource_ref()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_sets",
      "name": "cg_guard_ticket_set",
      "function": "helpdesk_core.cg_guard_ticket_resource_set()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "immutable_contract_version",
      "function": "helpdesk_core.reject_published_version_change()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_version_guard",
      "function": "helpdesk_auth.hdn_cfg_version_guard()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdn_execution_audit",
      "name": "hdn_audit_immutable",
      "function": "helpdesk_auth.hdn_execution_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdn_execution_bindings",
      "name": "hdn_binding_immutable",
      "function": "helpdesk_auth.hdn_execution_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdn_execution_receipts",
      "name": "hdn_receipt_immutable",
      "function": "helpdesk_auth.hdn_execution_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_template_immutable",
      "function": "helpdesk_auth.hdn_execution_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdn_workflow_profiles",
      "name": "hdn_workflow_profile_immutable",
      "function": "helpdesk_auth.hdn_execution_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdn_workflow_state",
      "name": "hdn_workflow_state_identity",
      "function": "helpdesk_auth.hdn_guard_workflow_state()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_draft_effect",
      "function": "helpdesk_auth.hdni_require_commit()",
      "type": 21,
      "deferred": true
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_draft_identity",
      "function": "helpdesk_auth.hdni_guard_draft()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdni_snapshots",
      "name": "hdni_snapshot_immutable",
      "function": "helpdesk_auth.hdni_opening_guard()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdnr_invitations",
      "name": "hdnr_invitation_guard",
      "function": "helpdesk_auth.hdnr_invitation_guard()",
      "type": 31,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_authority_publication",
      "function": "helpdesk_auth.hdnr_authority_publish()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_authority_publication",
      "function": "helpdesk_auth.hdnr_authority_publish()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profile_pin",
      "function": "helpdesk_auth.hdnr_profile_pin()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "record_note_effect",
      "function": "helpdesk_audit.record_conversation_effect()",
      "type": 5,
      "deferred": false
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "bind_write_effect_event",
      "function": "helpdesk_audit.bind_effect_event()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "hdn_notification_project_internal",
      "function": "helpdesk_auth.hdn_notification_project_internal()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "hdn_guard_structured_message",
      "function": "helpdesk_auth.hdn_guard_workflow_message()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "record_message_effect",
      "function": "helpdesk_audit.record_conversation_effect()",
      "type": 5,
      "deferred": false
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "authorized_ticket_assignment",
      "function": "helpdesk_core.guard_ticket_assignment()",
      "type": 23,
      "deferred": false
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "authorized_ticket_priority",
      "function": "helpdesk_core.guard_ticket_priority()",
      "type": 19,
      "deferred": false
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "authorized_ticket_transition",
      "function": "helpdesk_core.guard_ticket_transition()",
      "type": 19,
      "deferred": false
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "hdn_guard_workflow_transition",
      "function": "helpdesk_auth.hdn_guard_workflow_transition()",
      "type": 19,
      "deferred": false
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "immutable_ticket_context",
      "function": "helpdesk_core.guard_ticket_update()",
      "type": 19,
      "deferred": false
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "record_ticket_effect",
      "function": "helpdesk_audit.record_ticket_effect()",
      "type": 21,
      "deferred": false
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_assignment_event",
      "function": "helpdesk_core.require_assignment_event()",
      "type": 17,
      "deferred": true
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_initial_outbox",
      "function": "helpdesk_core.require_initial_outbox()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_priority_outbox",
      "function": "helpdesk_core.require_priority_outbox()",
      "type": 17,
      "deferred": true
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idempotency_record_quota",
      "function": "helpdesk_auth.limit_idempotency_records()",
      "type": 7,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hda02_drafts",
      "name": "hda02_draft_immutable",
      "function": "helpdesk_auth.hda02_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_complete",
      "function": "helpdesk_auth.hda02_inbox_admission()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_immutable",
      "function": "helpdesk_auth.hda02_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_job_complete",
      "function": "helpdesk_auth.hda02_job_admission()",
      "type": 29,
      "deferred": true
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operation_complete",
      "function": "helpdesk_auth.hda02_operation_admission()",
      "type": 21,
      "deferred": true
    },
    {
      "table": "helpdesk_integration.hda02_snapshots",
      "name": "hda02_snapshot_immutable",
      "function": "helpdesk_auth.hda02_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdn_notification_attempts",
      "name": "hdn_notification_attempt_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdn_notification_events",
      "name": "hdn_notification_event_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdn_notification_plans",
      "name": "hdn_notification_plan_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_source_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_roster_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_route_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdn_notification_templates",
      "name": "hdn_notification_template_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_history_immutable",
      "function": "helpdesk_auth.hdn_notification_immutable()",
      "type": 27,
      "deferred": false
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "bind_write_effect_outbox",
      "function": "helpdesk_audit.bind_effect_outbox()",
      "type": 7,
      "deferred": false
    }
  ],
  "constraints": [
    {
      "table": "helpdesk_audit.audit_events",
      "name": "audit_events_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.audit_events",
      "name": "audit_events_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.audit_events",
      "name": "audit_events_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.cg_initial_receipts",
      "name": "cg_initial_receipts_command_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.cg_initial_receipts",
      "name": "cg_initial_receipts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.cg_initial_receipts",
      "name": "cg_initial_receipts_request_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.cg_initial_receipts",
      "name": "cg_initial_receipts_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.cg_local_receipts",
      "name": "cg_local_receipts_command_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.cg_local_receipts",
      "name": "cg_local_receipts_decision_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.cg_local_receipts",
      "name": "cg_local_receipts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.cg_local_receipts",
      "name": "cg_local_receipts_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.cg_local_receipts",
      "name": "cg_local_receipts_workspace_id_registry_revision_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdn_cfg_commits",
      "name": "hdn_cfg_commits_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdn_cfg_commits",
      "name": "hdn_cfg_commits_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdn_cfg_commits",
      "name": "hdn_cfg_commits_workspace_id_actor_id_intent_key_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdn_cfg_commits",
      "name": "hdn_cfg_commits_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdn_cfg_commits",
      "name": "hdn_cfg_final_admission",
      "type": "t"
    },
    {
      "table": "helpdesk_audit.hdn_notification_audit",
      "name": "hdn_notification_audit_intent_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdn_notification_audit",
      "name": "hdn_notification_audit_intent_id_revision_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdn_notification_audit",
      "name": "hdn_notification_audit_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdn_notification_audit",
      "name": "hdn_notification_audit_type_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_complete_workflow_commit",
      "type": "t"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_core_type_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_from_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_intent_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_intent_key_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_workspace_id_account_id_ticket_id_acto_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_workspace_id_account_id_ticket_id_to_v_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdn_workflow_commits",
      "name": "hdn_workflow_commits_workspace_id_profile_version_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdni_draft_commits",
      "name": "hdni_draft_commits_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdni_draft_commits",
      "name": "hdni_draft_commits_draft_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdni_draft_commits",
      "name": "hdni_draft_commits_pk",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdni_draft_commits",
      "name": "hdni_draft_commits_revision_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_opening_complete",
      "type": "t"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_actor_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_draft_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_draft_uk",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_intent_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_pk",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_revision_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_sequence_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_sequence_uk",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_snapshot_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_ticket_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdni_receipts",
      "name": "hdni_receipts_ticket_uk",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenge_complete",
      "type": "t"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenges_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenges_challenge_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenges_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenges_generation_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenges_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenges_target_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_challenges",
      "name": "hdnr_challenges_workspace_id_account_id_ticket_id_invitati_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_opening_complete",
      "type": "t"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_openings_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_openings_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_openings_profile_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_openings_snapshot_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_openings_ticket_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_openings_workspace_id_account_id_profile_version_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdnr_openings",
      "name": "hdnr_openings_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipt_complete",
      "type": "t"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_action_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_created_at_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_intent_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_intent_key_check",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_workspace_id_account_id_ticket_id_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.hdnr_receipts",
      "name": "hdnr_receipts_workspace_id_actor_id_intent_key_key",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "complete_write_effect",
      "type": "t"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effect_data_shape",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effect_event_unique",
      "type": "u"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effect_kind",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effect_source_kind",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effect_ticket_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effect_version_positive",
      "type": "c"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effects_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_audit.write_effects",
      "name": "write_effects_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.account_grants",
      "name": "account_grants_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.account_grants",
      "name": "account_grants_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.account_grants",
      "name": "account_grants_role_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.account_grants",
      "name": "account_grants_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_local_accounts",
      "name": "cg_local_account_receipt",
      "type": "t"
    },
    {
      "table": "helpdesk_auth.cg_local_accounts",
      "name": "cg_local_accounts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_local_accounts",
      "name": "cg_local_accounts_workspace_id_account_id_binding_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_local_accounts",
      "name": "cg_local_accounts_workspace_id_binding_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.cg_local_accounts",
      "name": "cg_local_accounts_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permission_receipt",
      "type": "t"
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permissions_operation_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permissions_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permissions_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permissions_role_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permissions_work_ids_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_local_permissions",
      "name": "cg_local_permissions_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_local_registries",
      "name": "cg_local_registries_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_local_registries",
      "name": "cg_local_registries_decision_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_local_registries",
      "name": "cg_local_registries_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_local_registries",
      "name": "cg_local_registries_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_local_registries",
      "name": "cg_local_registries_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_local_registries",
      "name": "cg_local_registry_receipt",
      "type": "t"
    },
    {
      "table": "helpdesk_auth.cg_local_works",
      "name": "cg_local_work_receipt",
      "type": "t"
    },
    {
      "table": "helpdesk_auth.cg_local_works",
      "name": "cg_local_works_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_local_works",
      "name": "cg_local_works_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_local_works",
      "name": "cg_local_works_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_bindings",
      "name": "cg_resource_bindings_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_bindings",
      "name": "cg_resource_bindings_tenant_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_bindings",
      "name": "cg_resource_bindings_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_bindings",
      "name": "cg_resource_bindings_workspace_id_connection_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_bindings",
      "name": "cg_resource_bindings_workspace_id_connection_id_tenant_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.cg_resource_connections",
      "name": "cg_resource_connections_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_connections",
      "name": "cg_resource_connections_workspace_id_product_instance_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_refs",
      "name": "cg_resource_grant_refs_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_refs",
      "name": "cg_resource_grant_refs_resource_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_refs",
      "name": "cg_resource_grant_refs_resource_type_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_refs",
      "name": "cg_resource_grant_refs_workspace_id_account_id_binding_id__fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_expected_count_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_operation_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_source_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_grant_sets",
      "name": "cg_resource_grant_sets_workspace_id_account_id_binding_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_access_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_binding_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_expected_count_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_grant_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_manifest_fingerprint_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_observations",
      "name": "cg_resource_observations_workspace_id_account_id_binding_i_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_ledger",
      "name": "cg_resource_publication_ledge_workspace_id_account_id_bind_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_ledger",
      "name": "cg_resource_publication_ledger_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_ledger",
      "name": "cg_resource_publication_ledger_publication_key_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_ledger",
      "name": "cg_resource_publication_ledger_receipt_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_publication_receipt_required",
      "type": "t"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_state_workspace_id_account_id_bind_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_command_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_grant_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_previous_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_snapshot_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_snapshot_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publication_states",
      "name": "cg_resource_publication_states_target_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publishers",
      "name": "cg_resource_publishers_manifest_fingerprint_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.cg_resource_publishers",
      "name": "cg_resource_publishers_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.cg_resource_publishers",
      "name": "cg_resource_publishers_workspace_id_connection_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_approved_by_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_capability_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_policy_ref_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_reason_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_capabilities",
      "name": "hdn_cfg_capabilities_workspace_id_principal_id_capability_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_registries",
      "name": "hdn_cfg_registries_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_registries",
      "name": "hdn_cfg_registries_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdn_cfg_registries",
      "name": "hdn_cfg_registries_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_capability_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_reason_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_work_ids_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdnr_grants",
      "name": "hdnr_grants_workspace_id_request_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_approver_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_reason_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_work_ids_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_workspace_id_account_id_profile_version_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.hdnr_rosters",
      "name": "hdnr_rosters_workspace_id_request_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_reason_size",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_revision_positive",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_shape",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_versions_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_versions_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.human_scope_versions",
      "name": "human_scope_versions_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.integration_connections",
      "name": "integration_connections_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.integration_connections",
      "name": "integration_connections_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.integration_connections",
      "name": "integration_connections_principal_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.integration_connections",
      "name": "integration_connections_scopes_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.integration_connections",
      "name": "integration_connections_workspace_id_product_instance_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.integration_credentials",
      "name": "credential_hash_hex",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.integration_credentials",
      "name": "integration_credentials_key_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.integration_credentials",
      "name": "integration_credentials_key_hash_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.integration_credentials",
      "name": "integration_credentials_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.integration_credentials",
      "name": "integration_credentials_workspace_id_connection_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.integration_sessions",
      "name": "integration_sessions_credential_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.integration_sessions",
      "name": "integration_sessions_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.integration_sessions",
      "name": "integration_sessions_token_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.integration_sessions",
      "name": "session_hash_hex",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.principals",
      "name": "principals_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.principals",
      "name": "principals_kind_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.principals",
      "name": "principals_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.principals",
      "name": "principals_supabase_user_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.rate_limit_buckets",
      "name": "rate_limit_buckets_bucket_key_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.rate_limit_buckets",
      "name": "rate_limit_buckets_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.rate_limit_buckets",
      "name": "rate_limit_buckets_policy_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.rate_limit_buckets",
      "name": "rate_limit_buckets_used_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.source_scope_bindings",
      "name": "source_scope_bindings_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.source_scope_bindings",
      "name": "source_scope_bindings_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.source_scope_bindings",
      "name": "source_scope_bindings_workspace_id_connection_id_account_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_auth.source_scope_bindings",
      "name": "source_scope_bindings_workspace_id_connection_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.workspace_memberships",
      "name": "workspace_memberships_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_auth.workspace_memberships",
      "name": "workspace_memberships_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_auth.workspace_memberships",
      "name": "workspace_memberships_role_check",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.workspace_memberships",
      "name": "workspace_memberships_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.accounts",
      "name": "accounts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.accounts",
      "name": "accounts_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_refs",
      "name": "cg_ticket_resource_refs_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_refs",
      "name": "cg_ticket_resource_refs_resource_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_refs",
      "name": "cg_ticket_resource_refs_resource_type_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_refs",
      "name": "cg_ticket_resource_refs_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_sets",
      "name": "cg_ticket_resource_sets_expected_count_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_sets",
      "name": "cg_ticket_resource_sets_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_sets",
      "name": "cg_ticket_resource_sets_workspace_id_account_id_binding_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.cg_ticket_resource_sets",
      "name": "cg_ticket_resource_sets_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "contract_versions_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "contract_versions_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "contract_versions_policy_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "contract_versions_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "contract_versions_workspace_id_contract_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "contract_versions_workspace_id_contract_id_version_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "policy_size_limit",
      "type": "c"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverages_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverages_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverages_workspace_id_account_id_product_instance_id_servi_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverages_workspace_id_contract_version_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverages_workspace_id_product_id_product_instance_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverages_workspace_id_product_id_service_code_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_cfg_catalog",
      "name": "hdn_cfg_catalog_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_cfg_catalog",
      "name": "hdn_cfg_catalog_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_catalog",
      "name": "hdn_cfg_catalog_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_check1",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_check2",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_content_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_created_by_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_definition_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_published_by_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_status_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_cfg_versions",
      "name": "hdn_cfg_versions_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_audit",
      "name": "hdn_execution_audit_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_audit",
      "name": "hdn_execution_audit_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_execution_audit",
      "name": "hdn_execution_audit_workspace_id_account_id_ticket_id_tick_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_audit",
      "name": "hdn_execution_audit_workspace_id_account_id_ticket_id_ticke_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.hdn_execution_bindings",
      "name": "hdn_execution_bindings_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_execution_bindings",
      "name": "hdn_execution_bindings_profile_version_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_bindings",
      "name": "hdn_execution_bindings_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_bindings",
      "name": "hdn_execution_bindings_workspace_id_template_id_template_v_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_receipts",
      "name": "hdn_execution_receipts_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_receipts",
      "name": "hdn_execution_receipts_audit_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_receipts",
      "name": "hdn_execution_receipts_intent_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_receipts",
      "name": "hdn_execution_receipts_key_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_receipts",
      "name": "hdn_execution_receipts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_execution_receipts",
      "name": "hdn_execution_receipts_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_snapshots",
      "name": "hdn_execution_snapshots_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_snapshots",
      "name": "hdn_execution_snapshots_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_execution_snapshots",
      "name": "hdn_execution_snapshots_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_snapshots",
      "name": "hdn_execution_snapshots_ticket_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_snapshots",
      "name": "hdn_execution_snapshots_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_document_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_document_check1",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_sha256_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_template_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_execution_templates",
      "name": "hdn_execution_templates_workspace_id_template_id_version_sh_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.hdn_workflow_profiles",
      "name": "hdn_workflow_profiles_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_workflow_profiles",
      "name": "hdn_workflow_profiles_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_workflow_profiles",
      "name": "hdn_workflow_profiles_version_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_workflow_profiles",
      "name": "hdn_workflow_profiles_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_workflow_state",
      "name": "hdn_workflow_state_approval_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_workflow_state",
      "name": "hdn_workflow_state_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdn_workflow_state",
      "name": "hdn_workflow_state_resolution_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdn_workflow_state",
      "name": "hdn_workflow_state_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdn_workflow_state",
      "name": "hdn_workflow_state_workspace_id_profile_version_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_draft_effect",
      "type": "t"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_drafts_account_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_drafts_configuration_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_drafts_document_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_drafts_owner_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_drafts_pk",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_drafts_revision_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdni_drafts",
      "name": "hdni_drafts_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdni_protocol_counters",
      "name": "hdni_counter_pk",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdni_protocol_counters",
      "name": "hdni_counter_sequence_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdni_protocol_counters",
      "name": "hdni_counter_workspace_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdni_snapshots",
      "name": "hdni_snapshots_document_ck",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdni_snapshots",
      "name": "hdni_snapshots_pk",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdni_snapshots",
      "name": "hdni_snapshots_ticket_fk",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_check1",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_source_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_workspace_id_account_id_ticket_id_receipt_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_forms",
      "name": "hdnr_forms_workspace_id_account_id_ticket_id_source_version_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.hdnr_invitations",
      "name": "hdnr_invitations_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_invitations",
      "name": "hdnr_invitations_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdnr_invitations",
      "name": "hdnr_invitations_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_invitations",
      "name": "hdnr_invitations_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_invitations",
      "name": "hdnr_invitations_workspace_id_account_id_ticket_id_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.hdnr_invitations",
      "name": "hdnr_invitations_workspace_id_account_id_ticket_id_receipt_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_policies_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_policies_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_policies_reason_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_policies_recorded_at_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_policies_sha256_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_policies_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_policies",
      "name": "hdnr_policies_workspace_id_request_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_configuration_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_configuration_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_reason_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_recorded_at_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_required_for_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_schema_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_work_ids_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_workspace_id_account_id_form_id_form_version_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_workspace_id_account_id_policy_version_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_workspace_id_configuration_id_configuration__fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.hdnr_profiles",
      "name": "hdnr_profiles_workspace_id_request_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "internal_notes_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "internal_notes_body_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "internal_notes_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "internal_notes_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.product_instances",
      "name": "product_instances_environment_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.product_instances",
      "name": "product_instances_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.product_instances",
      "name": "product_instances_workspace_id_product_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.product_instances",
      "name": "product_instances_workspace_id_product_id_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.products",
      "name": "products_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.products",
      "name": "products_workspace_id_code_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.products",
      "name": "products_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.services",
      "name": "services_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.services",
      "name": "services_workspace_id_product_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.support_contracts",
      "name": "support_contracts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.support_contracts",
      "name": "support_contracts_status_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.support_contracts",
      "name": "support_contracts_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "assignment_event_shape",
      "type": "c"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "event_visibility_kind",
      "type": "c"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "hdn_notification_project_internal",
      "type": "t"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "priority_event_shape",
      "type": "c"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "ticket_events_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "ticket_events_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "ticket_events_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "ticket_messages_actor_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "ticket_messages_actor_type_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "ticket_messages_body_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "ticket_messages_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "ticket_messages_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "contract_snapshot_size_limit",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_assignment_event",
      "type": "t"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_initial_outbox",
      "type": "t"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_priority_outbox",
      "type": "t"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_assigned_to_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_contract_snapshot_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_created_by_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_description_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_priority_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_status_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_subject_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_workspace_id_account_id_product_instance_id_servic_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "tickets_workspace_id_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_core.workspaces",
      "name": "workspaces_name_check",
      "type": "c"
    },
    {
      "table": "helpdesk_core.workspaces",
      "name": "workspaces_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "api_idempotency_keys_key_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "api_idempotency_keys_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "api_idempotency_keys_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "api_idempotency_keys_request_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "api_idempotency_keys_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idempotency_lifetime_order",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idempotency_result_size",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idempotency_ticket_ref",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_bindings",
      "name": "hda02_bindings_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_bindings",
      "name": "hda02_bindings_check1",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_bindings",
      "name": "hda02_bindings_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hda02_bindings",
      "name": "hda02_bindings_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_bindings",
      "name": "hda02_bindings_workspace_id_account_id_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_integration.hda02_bindings",
      "name": "hda02_bindings_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_drafts",
      "name": "hda02_drafts_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_drafts",
      "name": "hda02_drafts_document_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_drafts",
      "name": "hda02_drafts_draft_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_drafts",
      "name": "hda02_drafts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hda02_drafts",
      "name": "hda02_drafts_workspace_id_operation_id_input_revision_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_drafts",
      "name": "hda02_drafts_workspace_id_operation_id_job_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_grants",
      "name": "hda02_grants_permissions_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_grants",
      "name": "hda02_grants_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hda02_grants",
      "name": "hda02_grants_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_grants",
      "name": "hda02_grants_workspace_id_binding_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_command_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_complete",
      "type": "t"
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_workspace_id_account_id_binding_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_inbox",
      "name": "hda02_inbox_workspace_id_account_id_operation_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_job_complete",
      "type": "t"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_check1",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_check2",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_check3",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_document_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_status_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_workspace_id_operation_id_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_integration.hda02_jobs",
      "name": "hda02_jobs_workspace_id_operation_id_input_revision_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_current_job",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_current_snapshot",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operation_complete",
      "type": "t"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operations_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operations_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operations_queue_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operations_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operations_workspace_id_account_id_binding_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operations_workspace_id_account_id_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_integration.hda02_operations",
      "name": "hda02_operations_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hda02_snapshots",
      "name": "hda02_snapshots_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_snapshots",
      "name": "hda02_snapshots_input_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hda02_snapshots",
      "name": "hda02_snapshots_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hda02_snapshots",
      "name": "hda02_snapshots_workspace_id_operation_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_attempts",
      "name": "hdn_notification_attempts_attempt_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_attempts",
      "name": "hdn_notification_attempts_intent_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_attempts",
      "name": "hdn_notification_attempts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_attempts",
      "name": "hdn_notification_attempts_request_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_events",
      "name": "hdn_notification_events_event_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_events",
      "name": "hdn_notification_events_intent_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_events",
      "name": "hdn_notification_events_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_native_receipts",
      "name": "hdn_notification_native_receipts_disposition_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_native_receipts",
      "name": "hdn_notification_native_receipts_event_hash_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_native_receipts",
      "name": "hdn_notification_native_receipts_event_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_native_receipts",
      "name": "hdn_notification_native_receipts_intent_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_native_receipts",
      "name": "hdn_notification_native_receipts_outcome_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_native_receipts",
      "name": "hdn_notification_native_receipts_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_plans",
      "name": "hdn_notification_plans_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_plans",
      "name": "hdn_notification_plans_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sour_workspace_id_account_id_tick_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sour_workspace_id_parent_event_id__key",
      "type": "u"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sour_workspace_id_parent_event_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sources_assigned_principal_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sources_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sources_created_at_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sources_kind_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sources_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_private_sources",
      "name": "hdn_notification_private_sources_source_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_queue_rosters_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_queue_rosters_check1",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_queue_rosters_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_queue_rosters_reason_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_queue_rosters_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_queue_rosters_workspace_id_account_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_queue_rosters",
      "name": "hdn_notification_queue_rosters_workspace_id_request_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_integration.hdn_notification_records",
      "name": "hdn_notification_records_channel_id_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_records",
      "name": "hdn_notification_records_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_records",
      "name": "hdn_notification_records_event_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_records",
      "name": "hdn_notification_records_event_id_recipient_id_channel_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_integration.hdn_notification_records",
      "name": "hdn_notification_records_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_records",
      "name": "hdn_notification_records_recipient_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_records",
      "name": "hdn_notification_records_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_audience_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_cohort_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_effective_after_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_expires_at_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_revision_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_template_id_template_version_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_routes",
      "name": "hdn_notification_routes_workspace_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdn_notification_templates",
      "name": "hdn_notification_templates_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_templates",
      "name": "hdn_notification_templates_check1",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_templates",
      "name": "hdn_notification_templates_check2",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdn_notification_templates",
      "name": "hdn_notification_templates_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_sources_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_sources_created_at_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_sources_kind_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_sources_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_sources_source_version_check",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_sources_workspace_id_account_id_ticket_id_receipt_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.hdnr_sources",
      "name": "hdnr_sources_workspace_id_receipt_id_key",
      "type": "u"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "assignment_outbox_forbidden",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "outbox_events_pkey",
      "type": "p"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "outbox_events_workspace_id_account_id_ticket_id_fkey",
      "type": "f"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "priority_outbox_shape",
      "type": "c"
    }
  ],
  "policies": [
    {
      "table": "helpdesk_audit.audit_events",
      "name": "audit_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_core.accounts",
      "name": "account_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "contract_version_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverage_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverage_scope_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "cg_note_resource_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "cg_note_resource_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "note_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "note_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "note_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.internal_notes",
      "name": "note_scope_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_core.support_contracts",
      "name": "contract_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "cg_event_resource_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "cg_event_resource_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "event_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "event_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "event_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "priority_event_operator",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "cg_message_resource_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "cg_message_resource_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "message_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "message_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "message_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "cg_ticket_resource_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "cg_ticket_resource_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "cg_ticket_resource_update",
      "permissive": false,
      "command": "w"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_scope_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_scope_update",
      "permissive": false,
      "command": "w"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_update",
      "permissive": true,
      "command": "w"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idem_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idem_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idem_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idem_scope_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "cg_outbox_resource_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "outbox_insert",
      "permissive": true,
      "command": "a"
    }
  ],
  "roles": [
    {
      "name": "helpdesk_resource_publisher",
      "schemas": [
        "helpdesk_auth"
      ],
      "functions": [
        "helpdesk_auth.cg_publication_append(text, text, text)",
        "helpdesk_auth.cg_publication_open(text, text)",
        "helpdesk_auth.cg_publication_replace(text, text, text, text, text)"
      ]
    },
    {
      "name": "helpdesk_notification_worker",
      "schemas": [
        "helpdesk_auth"
      ],
      "functions": [
        "helpdesk_auth.hdn_notification_authorize(uuid)",
        "helpdesk_auth.hdn_notification_claim(text, text, text, integer)",
        "helpdesk_auth.hdn_notification_event(uuid, text)",
        "helpdesk_auth.hdn_notification_lock(uuid)",
        "helpdesk_auth.hdn_notification_native(jsonb, text)",
        "helpdesk_auth.hdn_notification_plan(uuid)",
        "helpdesk_auth.hdn_notification_routing(uuid)",
        "helpdesk_auth.hdn_notification_save(uuid, jsonb, bigint, jsonb, text)",
        "helpdesk_auth.hdn_notification_save_event(uuid, text, text)",
        "helpdesk_auth.hdn_notification_source(uuid)",
        "helpdesk_auth.hdn_notification_sources(integer)",
        "helpdesk_auth.hdn_notification_template(text, integer)",
        "helpdesk_auth.hdn_notification_write_plan(uuid, jsonb, jsonb)"
      ]
    },
    {
      "name": "helpdesk_registration_worker",
      "schemas": [
        "helpdesk_auth"
      ],
      "functions": [
        "helpdesk_auth.hda02_apply(jsonb, jsonb)",
        "helpdesk_auth.hda02_lock_scope(jsonb)",
        "helpdesk_auth.hda02_next(jsonb)",
        "helpdesk_auth.hda02_operation(jsonb, uuid)",
        "helpdesk_auth.hda02_receipt(jsonb, uuid)",
        "helpdesk_auth.hda02_storage_version()",
        "helpdesk_auth.hda02_worker_target()"
      ]
    }
  ]
} as const;
/** Preserve the base query bytes used by historical migration compilers. */
export const REGISTRATION_SECURITY_QUERY=DATABASE_SECURITY_QUERY.replace('(select count(*) from expected_roles)=2','(select count(*) from expected_roles)=3');
