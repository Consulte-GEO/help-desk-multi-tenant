/** Reviewed catalogue contract for schema 0.20.0, promoted Consulte GEO modules.
 * Metadata checks do NOT attest to function/policy/constraint expressions.
 * Not generated at runtime, not accepted from HTTP, never used for auto-repair.
 */
export const DATABASE_SECURITY_CONTRACT = {
  "schemaVersion": "0.20.0",
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
      "name": "helpdesk_audit.hdn_cfg_commits",
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
        "version",
        "updated_at",
        "priority",
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
      "signature": "helpdesk_auth.cg_invalidate_resource_grant()",
      "definer": true,
      "execute": false
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
      "table": "helpdesk_audit.write_effects",
      "name": "complete_write_effect",
      "function": "helpdesk_audit.require_write_effect()",
      "type": 5,
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
      "schemas": [],
      "functions": []
    }
  ]
} as const;
