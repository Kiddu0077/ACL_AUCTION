import assert from "node:assert/strict";
import test from "node:test";
import { createOptimisticQueue } from "../lib/auction/optimistic-queue.ts";
import { createAuctionStateOrder } from "../lib/realtime/auction-state-order.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));
const state = (player, seconds) => ({ id: "current", current_player_id: player, updated_at: `2026-10-21T10:00:0${seconds}Z` });

test("a failed notification cannot roll back a committed sale or cancel the next pick", async () => {
  let recoveryCalls = 0;
  const queue = createOptimisticQueue({ initial: 0, recover: async () => { recoveryCalls++; return -1; } });
  queue.enqueue({ apply: () => 1, execute: async () => 1, commit: (_value, result) => result, onCommit: () => { throw new Error("Broadcast unavailable"); } });
  queue.enqueue({ apply: () => 2, execute: async () => 2, commit: (_value, result) => result });
  await flush();
  assert.equal(queue.getSnapshot().data, 2);
  assert.equal(queue.getSnapshot().pending, 0);
  assert.equal(queue.getSnapshot().error, null);
  assert.equal(recoveryCalls, 0);
});

test("reconnection cannot start a snapshot read in the middle of pending writes", async () => {
  let finish;
  let recoveryCalls = 0;
  const gate = new Promise((resolve) => { finish = resolve; });
  const queue = createOptimisticQueue({ initial: 0, recover: async () => { recoveryCalls++; return 3; } });
  queue.enqueue({ apply: () => 1, execute: () => gate, commit: (_value, result) => result });
  assert.equal(await queue.resync(), false);
  assert.equal(recoveryCalls, 0);
  assert.equal(queue.getSnapshot().data, 1);
  finish(1);
  await flush();
  assert.equal(await queue.resync(), true);
  assert.equal(queue.getSnapshot().data, 3);
});

test("a delayed confirmation from another tab cannot erase the active next-player preview", () => {
  const order = createAuctionStateOrder(state("A", 1));
  order.broadcast({ state: state("B", 1), pending: true, syncId: "first-tab", sequence: 2 });
  order.broadcast({ state: state("C", 2), pending: true, syncId: "second-tab", sequence: 1 });
  const afterOldConfirmation = order.broadcast({ state: state("B", 3), pending: false, syncId: "first-tab", sequence: 3 });
  assert.equal(afterOldConfirmation.current_player_id, "C");
  const confirmed = order.broadcast({ state: state("C", 4), pending: false, syncId: "second-tab", sequence: 2 });
  assert.equal(confirmed.current_player_id, "C");
  assert.equal(order.pending(), false);
  assert.equal(order.database(state(null, 2)).current_player_id, "C");
});
