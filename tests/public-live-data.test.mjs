import assert from "node:assert/strict";
import test from "node:test";
import { upsertLiveRow } from "../lib/realtime/rows.ts";

test("duplicate deliveries cannot duplicate players or teams", () => {
  const row = { id: "player-1", full_name: "Test Player", updated_at: "2026-10-21T12:00:00Z" };
  const rows = upsertLiveRow(upsertLiveRow([], row), row);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].full_name, "Test Player");
});

test("late updates cannot undo a sale or a changed team purse", () => {
  const committed = { id: "player-1", team_id: "team-2", updated_at: "2026-10-21T12:00:02Z" };
  const stale = { ...committed, team_id: null, updated_at: "2026-10-21T12:00:01Z" };
  const before = Object.freeze([committed]);
  assert.equal(upsertLiveRow(before, stale), before);
  const corrected = { ...committed, team_id: "team-3", updated_at: "2026-10-21T12:00:03Z" };
  assert.equal(upsertLiveRow(before, corrected)[0].team_id, "team-3");
  assert.equal(before[0].team_id, "team-2");
});

test("an update arriving before its insert still appears exactly once", () => {
  const update = { id: "team-1", budget_total: 2500, updated_at: "2026-10-21T12:00:02Z" };
  const insert = { ...update, budget_total: 1000, updated_at: "2026-10-21T12:00:01Z" };
  assert.deepEqual(upsertLiveRow(upsertLiveRow([], update), insert), [update]);
});
