type Row = { id: string; updated_at: string };

/** Realtime INSERT and UPDATE are both upserts: duplicate deliveries must not
 * create duplicate cards, and delayed events must not replace a newer row. */
export function upsertLiveRow<T extends Row>(rows: T[], incoming: T): T[] {
  const existing = rows.find((row) => row.id === incoming.id);
  if (existing && Date.parse(existing.updated_at) > Date.parse(incoming.updated_at)) return rows;
  return existing ? rows.map((row) => row.id === incoming.id ? incoming : row) : [...rows, incoming];
}
