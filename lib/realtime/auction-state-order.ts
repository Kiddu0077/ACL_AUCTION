type State = { id: string; updated_at: string };
export type StateMessage<T> = { state?: T; pending?: boolean; syncId?: string; sequence?: number };

/** Keep delayed database events from replacing a newer instant UI preview. */
export function createAuctionStateOrder<T extends State>(initial: T, now = Date.now) {
  let confirmed = initial;
  let preview: T | null = null;
  let activeSync: string | null = null;
  let expires = 0;
  const sequences = new Map<string, number>();
  const valid = (state: T) => state.id === 'current' && Number.isFinite(Date.parse(state.updated_at));
  const updateConfirmed = (state: T) => {
    if (valid(state) && Date.parse(state.updated_at) >= Date.parse(confirmed.updated_at)) confirmed = state;
  };
  const expire = () => {
    if (preview && now() >= expires) { preview = null; activeSync = null; return true; }
    return false;
  };
  return {
    get: () => preview ?? confirmed,
    pending: () => preview !== null,
    expire,
    database(state: T) {
      expire();
      updateConfirmed(state);
      return preview ?? confirmed;
    },
    broadcast(message: StateMessage<T>) {
      const state = message.state;
      if (!state || !valid(state)) return preview ?? confirmed;
      const { syncId, sequence } = message;
      if (syncId && typeof sequence === 'number' && Number.isSafeInteger(sequence)) {
        if (sequence <= (sequences.get(syncId) ?? -1)) return preview ?? confirmed;
        sequences.set(syncId, sequence);
        if (sequences.size > 16) sequences.delete(sequences.keys().next().value!);
        if (message.pending) {
          activeSync = syncId;
          preview = state;
          expires = now() + 8000;
          return preview;
        }
        if (activeSync === syncId) { preview = null; activeSync = null; }
      }
      updateConfirmed(state);
      return preview ?? confirmed;
    },
  };
}
