/** Request snapshots are scoped to a session/ticket generation, never just a ticket ID. */
export function createMutationState(makeKey = () => crypto.randomUUID()) {
  let owner = '', generation = 0;
  const drafts = new Map();
  const state = channel => {
    if (!drafts.has(channel)) drafts.set(channel, {body: '', revision: 0, key: makeKey(), pending: null, unresolved: null});
    return drafts.get(channel);
  };
  const current = operation => !!operation && !!owner && operation.owner === owner && operation.generation === generation;
  const reset = next => { owner = next; generation++; drafts.clear(); };
  return {
    select(next) { if (owner !== next) reset(next); },
    reset,
    edit(channel, body) {
      const draft = state(channel);
      if (draft.unresolved) return;
      if (draft.body !== body) { draft.body = body; draft.revision++; draft.key = makeKey(); }
    },
    draft: channel => state(channel).body,
    busy: channel => !!state(channel).pending,
    unresolved: channel => !!state(channel).unresolved,
    current,
    begin(channel) {
      const draft = state(channel);
      if (!owner || draft.pending) return null;
      const operation = draft.unresolved ?? Object.freeze({owner, generation, channel, revision: draft.revision, body: draft.body, key: draft.key});
      draft.pending = operation;
      return operation;
    },
    finish(operation, succeeded, uncertain = false) {
      if (!current(operation)) return {current: false, cleared: false};
      const draft = state(operation.channel);
      if (draft.pending !== operation) return {current: false, cleared: false};
      draft.pending = null;
      if (succeeded) draft.unresolved = null;
      else if (uncertain) draft.unresolved ??= operation;
      const cleared = succeeded && draft.revision === operation.revision;
      if (cleared) { draft.body = ''; draft.revision++; draft.key = makeKey(); }
      return {current: true, cleared};
    }
  };
}
