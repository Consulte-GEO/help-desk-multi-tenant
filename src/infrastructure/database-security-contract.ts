/** Reviewed catalogue contract for schema 0.9.0.
 * Metadata checks do NOT attest to function/policy/constraint expressions.
 * Not generated at runtime, not accepted from HTTP, never used for auto-repair.
 */
export const DATABASE_SECURITY_CONTRACT = {
  "schemaVersion": "0.9.0",
  "schemas": [
    "helpdesk_auth",
    "helpdesk_core",
    "helpdesk_integration",
    "helpdesk_audit"
  ],
  "tables": [
    {
      "name": "helpdesk_core.workspaces",
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
      "name": "helpdesk_auth.account_grants",
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
      "name": "helpdesk_core.product_instances",
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
      "name": "helpdesk_auth.integration_connections",
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
      "name": "helpdesk_core.ticket_messages",
      "read": true,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_core.internal_notes",
      "read": true,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_core.ticket_events",
      "read": true,
      "insert": true,
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
    },
    {
      "name": "helpdesk_audit.audit_events",
      "read": false,
      "insert": true,
      "updates": []
    },
    {
      "name": "helpdesk_auth.rate_limit_buckets",
      "read": false,
      "insert": false,
      "updates": []
    }
  ],
  "functions": [
    {
      "signature": "helpdesk_auth.actor_id()",
      "definer": false,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.workspace_id()",
      "definer": false,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.is_human()",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.has_account(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.is_operator(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.product_allowed(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.can_read_ticket(uuid, uuid, uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.resolve_human(uuid, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.exchange_key(text, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.resolve_session(text, uuid)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.locked_coverages(uuid, uuid, uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_core.reject_published_version_change()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_core.guard_ticket_update()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_core.require_initial_outbox()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.has_scope(uuid, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_core.guard_ticket_transition()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.consume_rate_limits(jsonb)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.limit_active_sessions()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.lookup_idempotency(text, text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.limit_idempotency_records()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.maintain_ephemeral(boolean, integer)",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_auth.schema_version()",
      "definer": false,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.revoke_session(text)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_auth.support_contexts(uuid, uuid, uuid, uuid, text, integer)",
      "definer": true,
      "execute": true
    },
    {
      "signature": "helpdesk_core.guard_ticket_priority()",
      "definer": false,
      "execute": false
    },
    {
      "signature": "helpdesk_core.require_priority_outbox()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_core.guard_ticket_assignment()",
      "definer": true,
      "execute": false
    },
    {
      "signature": "helpdesk_core.require_assignment_event()",
      "definer": true,
      "execute": false
    }
  ],
  "policies": [
    {
      "table": "helpdesk_core.accounts",
      "name": "account_read",
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
      "table": "helpdesk_core.contract_versions",
      "name": "contract_version_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.support_contracts",
      "name": "contract_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_update",
      "permissive": true,
      "command": "w"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "message_read",
      "permissive": true,
      "command": "r"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "message_insert",
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
      "name": "note_insert",
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
      "name": "event_insert",
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
      "name": "idem_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "outbox_insert",
      "permissive": true,
      "command": "a"
    },
    {
      "table": "helpdesk_audit.audit_events",
      "name": "audit_insert",
      "permissive": true,
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
      "name": "ticket_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "ticket_scope_update",
      "permissive": false,
      "command": "w"
    },
    {
      "table": "helpdesk_core.ticket_messages",
      "name": "message_scope_insert",
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
      "table": "helpdesk_core.internal_notes",
      "name": "note_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "event_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.coverages",
      "name": "coverage_scope_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idem_scope_read",
      "permissive": false,
      "command": "r"
    },
    {
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idem_scope_insert",
      "permissive": false,
      "command": "a"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "priority_event_operator",
      "permissive": false,
      "command": "a"
    }
  ],
  "triggers": [
    {
      "table": "helpdesk_core.contract_versions",
      "name": "immutable_contract_version",
      "function": "helpdesk_core.reject_published_version_change()",
      "type": 27,
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
      "name": "ticket_initial_outbox",
      "function": "helpdesk_core.require_initial_outbox()",
      "type": 5,
      "deferred": true
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "authorized_ticket_transition",
      "function": "helpdesk_core.guard_ticket_transition()",
      "type": 19,
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
      "table": "helpdesk_integration.api_idempotency_keys",
      "name": "idempotency_record_quota",
      "function": "helpdesk_auth.limit_idempotency_records()",
      "type": 7,
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
      "name": "ticket_priority_outbox",
      "function": "helpdesk_core.require_priority_outbox()",
      "type": 17,
      "deferred": true
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
      "name": "ticket_assignment_event",
      "function": "helpdesk_core.require_assignment_event()",
      "type": 17,
      "deferred": true
    }
  ],
  "constraints": [
    {
      "table": "helpdesk_core.ticket_events",
      "name": "event_visibility_kind",
      "type": "c"
    },
    {
      "table": "helpdesk_core.contract_versions",
      "name": "policy_size_limit",
      "type": "c"
    },
    {
      "table": "helpdesk_core.tickets",
      "name": "contract_snapshot_size_limit",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.integration_credentials",
      "name": "credential_hash_hex",
      "type": "c"
    },
    {
      "table": "helpdesk_auth.integration_sessions",
      "name": "session_hash_hex",
      "type": "c"
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
      "table": "helpdesk_core.ticket_events",
      "name": "priority_event_shape",
      "type": "c"
    },
    {
      "table": "helpdesk_core.ticket_events",
      "name": "assignment_event_shape",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "priority_outbox_shape",
      "type": "c"
    },
    {
      "table": "helpdesk_integration.outbox_events",
      "name": "assignment_outbox_forbidden",
      "type": "c"
    }
  ]
} as const;
