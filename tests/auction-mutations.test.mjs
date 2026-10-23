import assert from "node:assert/strict";
import test from "node:test";
import {
  checkTeamAllocation,
  checkTeamLimits,
  clearPlayerBlock,
  completePlayerSale,
  completeUnsoldPlayer,
  recallAuctionPlayer,
  selectAuctionPlayer,
} from "../lib/auction/mutations.ts";

function fixture({ beforeUpdate, beforeRead } = {}) {
  const db = {
    auction_state: [{ id: "current", current_player_id: "player-a", current_bid: 100, base_price: 100, current_bidder_team_id: null, updated_at: "initial" }],
    players: [
      { id: "player-a", sold_at: null, team_id: null, sold_price: null, updated_at: "initial" },
      { id: "player-b", sold_at: null, team_id: null, sold_price: null, updated_at: "initial" },
    ],
    teams: [{ id: "team-a", budget_total: 1000, squad_size: 2, is_locked: false }],
  };
  let revision = 0;
  const client = {
    from(table) {
      let patch;
      const filters = [];
      const execute = () => {
        if (!patch) {
          const error = beforeRead?.({ table, db });
          if (error) return { data: null, error: { message: error } };
        }
        if (patch) {
          const error = beforeUpdate?.({ table, patch, db });
          if (error) return { data: null, error: { message: error } };
        }
        const rows = db[table].filter((row) => filters.every((filter) => filter(row)));
        if (patch) {
          for (const row of rows) Object.assign(row, patch, { updated_at: `revision-${++revision}` });
        }
        return { data: rows.map((row) => ({ ...row })), error: null };
      };
      const query = {
        select() { return this; },
        update(value) { patch = value; return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { return this.eq(key, value); },
        neq(key, value) { filters.push((row) => row[key] !== value); return this; },
        single() {
          const result = execute();
          return Promise.resolve(result.error ? result : result.data.length === 1
            ? { data: result.data[0], error: null }
            : { data: null, error: { message: "Row not found" } });
        },
        maybeSingle() {
          const result = execute();
          return Promise.resolve(result.error ? result : { data: result.data[0] ?? null, error: null });
        },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      };
      return query;
    },
  };
  return { db, client };
}

test("a delayed sale cannot clear the next player's block", async () => {
  const { db, client } = fixture({
    beforeUpdate({ table, db }) {
      if (table === "auction_state") {
        db.auction_state[0].current_player_id = "player-b";
      }
    },
  });
  const result = await completePlayerSale(client, "player-a", "team-a", 300);
  assert.equal(result.error, null);
  assert.equal(result.player.team_id, "team-a");
  assert.equal(result.state, undefined);
  assert.equal(db.auction_state[0].current_player_id, "player-b");
});

test("competing sales record one winner and never overwrite the price", async () => {
  const { db, client } = fixture();
  const results = await Promise.all([
    completePlayerSale(client, "player-a", "team-a", 300),
    completePlayerSale(client, "player-a", "team-a", 700),
  ]);
  assert.equal(results.filter((result) => !result.error).length, 1);
  assert.equal(results.filter((result) => result.error).length, 1);
  const winner = results.find((result) => !result.error);
  assert.equal(db.players[0].sold_price, winner.player.sold_price);
  assert.equal(db.auction_state[0].current_player_id, null);
  assert.match(winner.player.updated_at, /^revision-/);
  assert.match(winner.state.updated_at, /^revision-/);
});

test("competing selections cannot silently replace the current player", async () => {
  const { db, client } = fixture();
  db.auction_state[0].current_player_id = null;
  const results = await Promise.all([
    selectAuctionPlayer(client, "player-a"),
    selectAuctionPlayer(client, "player-b"),
  ]);
  assert.equal(results.filter((result) => !result.error).length, 1);
  const winner = results.find((result) => !result.error);
  assert.equal(db.auction_state[0].current_player_id, winner.state.current_player_id);
  assert.equal(winner.state.current_bid, 100);
});

test("registered players can be selected and sold without a verification status", async () => {
  for (const legacyStatus of [undefined, "Pending", "Rejected"]) {
    const { db, client } = fixture();
    if (legacyStatus) db.players[0].status = legacyStatus;
    db.auction_state[0].current_player_id = null;
    const selection = await selectAuctionPlayer(client, "player-a");
    assert.equal(selection.error, null, legacyStatus);
    assert.equal(selection.state.current_player_id, "player-a");
    const sale = await completePlayerSale(client, "player-a", "team-a", 300);
    assert.equal(sale.error, null, legacyStatus);
    assert.equal(sale.player.team_id, "team-a");
    assert.equal(sale.player.sold_price, 300);
  }
});

test("registered players can be marked unsold regardless of legacy verification status", async () => {
  for (const legacyStatus of [undefined, "Pending", "Rejected"]) {
    const { db, client } = fixture();
    if (legacyStatus) db.players[0].status = legacyStatus;
    const result = await completeUnsoldPlayer(client, "player-a");
    assert.equal(result.error, null, legacyStatus);
    assert.ok(result.player.sold_at);
    assert.equal(result.player.team_id, null);
    assert.equal(result.state.current_player_id, null);
  }
});

test("sale eligibility is checked before any write", async () => {
  for (const scenario of ["locked", "full", "over-budget", "wrong-block", "already-auctioned", "assigned"]) {
    const { db, client } = fixture();
    if (scenario === "locked") db.teams[0].is_locked = true;
    if (scenario === "full") db.teams[0].squad_size = 0;
    if (scenario === "over-budget") db.teams[0].budget_total = 200;
    if (scenario === "wrong-block") db.auction_state[0].current_player_id = "player-b";
    if (scenario === "already-auctioned") db.players[0].sold_at = "previous-auction";
    if (scenario === "assigned") db.players[0].team_id = "team-a";
    const before = structuredClone(db);
    const result = await completePlayerSale(client, "player-a", "team-a", 300);
    assert.ok(result.error, scenario);
    assert.deepEqual(db, before, scenario);
  }
});

test("selection and unsold preserve players already auctioned or assigned", async () => {
  for (const patch of [{ sold_at: "previous-auction" }, { team_id: "team-a" }]) {
    for (const operation of [selectAuctionPlayer, completeUnsoldPlayer]) {
      const { db, client } = fixture();
      Object.assign(db.players[0], patch);
      const before = structuredClone(db);
      const result = await operation(client, "player-a");
      assert.ok(result.error);
      assert.deepEqual(db, before);
    }
  }
});

test("a stale unsold request cannot auction a different player or clear their block", async () => {
  const { db, client } = fixture();
  db.auction_state[0].current_player_id = "player-b";
  const before = structuredClone(db);
  const unsold = await completeUnsoldPlayer(client, "player-a");
  assert.equal(unsold.error, "This player is no longer on the block");
  assert.deepEqual(db, before);
  const cancel = await clearPlayerBlock(client, "player-a");
  assert.equal(cancel.error, null);
  assert.deepEqual(db, before);
});

test("unsold requires an active block and a successful authoritative read", async () => {
  const { db, client } = fixture();
  db.auction_state[0].current_player_id = null;
  const before = structuredClone(db);
  assert.equal((await completeUnsoldPlayer(client, "player-a")).error, "No player on the block");
  assert.deepEqual(db, before);
  const failed = fixture({ beforeRead: ({ table }) => table === "auction_state" ? "Disconnected" : null });
  assert.equal((await completeUnsoldPlayer(failed.client, "player-a")).error, "Disconnected");
  assert.equal(failed.db.players[0].sold_at, null);
});

test("competing unsold and sale requests settle the player only once", async () => {
  const { db, client } = fixture();
  const results = await Promise.all([
    completeUnsoldPlayer(client, "player-a"),
    completePlayerSale(client, "player-a", "team-a", 300),
  ]);
  assert.equal(results.filter((result) => !result.error).length, 1);
  const winner = results.find((result) => !result.error);
  assert.equal(db.players[0].team_id, winner.player.team_id);
  assert.equal(db.players[0].sold_price, winner.player.sold_price);
  assert.equal(db.auction_state[0].current_player_id, null);
});

test("recall preserves a sale that changes during its read/write window", async () => {
  const { db, client } = fixture({
    beforeUpdate({ table, db }) {
      if (table === "players") {
        Object.assign(db.players[0], { team_id: "new-team", sold_price: 900, updated_at: "newer-sale" });
      }
    },
  });
  Object.assign(db.players[0], { team_id: "team-a", sold_price: 300, sold_at: "first-sale" });
  const result = await recallAuctionPlayer(client, "player-a");
  assert.ok(result.error);
  assert.equal(db.players[0].team_id, "new-team");
  assert.equal(db.players[0].sold_price, 900);
});

test("sale followed by a queued recall succeeds using the committed row version", async () => {
  const { db, client } = fixture();
  assert.equal((await completePlayerSale(client, "player-a", "team-a", 300)).error, null);
  const recall = await recallAuctionPlayer(client, "player-a");
  assert.equal(recall.error, null);
  assert.equal(recall.player.sold_at, null);
  assert.equal(db.players[0].team_id, null);
  assert.ok((await recallAuctionPlayer(client, "player-a")).error);
});

test("a committed sale is returned when clearing fails, allowing authoritative recovery", async () => {
  const { db, client } = fixture({
    beforeUpdate({ table }) { return table === "auction_state" ? "Connection interrupted" : null; },
  });
  const result = await completePlayerSale(client, "player-a", "team-a", 300);
  assert.equal(result.error, "Connection interrupted");
  assert.equal(result.player.team_id, "team-a");
  assert.equal(db.players[0].sold_price, 300);
  assert.equal(db.auction_state[0].current_player_id, "player-a");
});

test("editing an existing player's price excludes their previous price and squad slot", async () => {
  const { db, client } = fixture();
  Object.assign(db.players[0], { team_id: "team-a", sold_price: 700 });
  db.teams[0].squad_size = 1;
  assert.equal((await checkTeamAllocation(client, "team-a", 1000, "player-a", true)).error, null);
  assert.ok((await checkTeamAllocation(client, "team-a", 1001, "player-a", true)).error);
  assert.ok((await checkTeamAllocation(client, "team-a", 1, "player-b", true)).error);
});

test("team settings cannot shrink below existing commitments", async () => {
  const { db, client } = fixture();
  Object.assign(db.players[0], { team_id: "team-a", sold_price: 700 });
  Object.assign(db.players[1], { team_id: "team-a", sold_price: 200 });
  assert.equal((await checkTeamLimits(client, "team-a", { budget_total: 900, squad_size: 2 })).error, null);
  assert.ok((await checkTeamLimits(client, "team-a", { budget_total: 899 })).error);
  assert.ok((await checkTeamLimits(client, "team-a", { squad_size: 1 })).error);
});

test("sale rejects non-finite, fractional, zero and out-of-range prices before writing", async () => {
  for (const price of [NaN, Infinity, -1, 0, 1.5, 2_147_483_648]) {
    const { db, client } = fixture();
    const before = structuredClone(db);
    assert.ok((await completePlayerSale(client, "player-a", "team-a", price)).error);
    assert.deepEqual(db, before);
  }
});

test("failed or missing eligibility reads prevent writes and preserve the actual error", async () => {
  for (const failedTable of ["teams", "players", "auction_state"]) {
    const { db, client } = fixture({
      beforeRead({ table }) { return table === failedTable ? `${table} unavailable` : null; },
    });
    const before = structuredClone(db);
    assert.equal((await completePlayerSale(client, "player-a", "team-a", 300)).error, `${failedTable} unavailable`);
    assert.deepEqual(db, before);
  }
  const { db, client } = fixture();
  db.teams = [];
  assert.equal((await completePlayerSale(client, "player-a", "team-a", 300)).error, "Row not found");
  assert.equal(db.players[0].sold_at, null);
});
