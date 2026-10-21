import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustedPurse,
  adminPlayerSchema,
  auctionSettingsSchema,
  teamSchema,
} from "../lib/validations/admin.ts";

test("purse deductions cannot produce zero, negative, fractional or overflowing totals", () => {
  assert.deepEqual(adjustedPurse(1000, -999), { error: null, budget: 1 });
  assert.deepEqual(adjustedPurse(1000, 250), { error: null, budget: 1250 });
  for (const delta of [-1000, -1001, 0.5, NaN, Infinity, 2_147_483_647]) {
    assert.ok(adjustedPurse(1000, delta).error);
  }
});

test("admin forms reject blank names, invalid numeric settings and non-web image URLs", () => {
  assert.equal(teamSchema.safeParse({ name: "   " }).success, false);
  assert.equal(teamSchema.safeParse({ name: "Pudur", budget_total: 0 }).success, false);
  assert.equal(teamSchema.safeParse({ name: "Pudur", squad_size: 2.5 }).success, false);
  assert.equal(teamSchema.safeParse({ name: "Pudur", logo_url: "javascript:alert(1)" }).success, false);
  assert.equal(teamSchema.safeParse({ name: " Pudur ", logo_url: "https://example.com/team.png" }).data.name, "Pudur");
  for (const value of [0, -1, NaN, Infinity, 0.5, 2_147_483_648]) {
    assert.equal(auctionSettingsSchema.safeParse({ base_price: value }).success, false);
  }
});

test("player updates preserve nullable phones and normalize names without accepting invalid roles", () => {
  const player = { full_name: " Player ", city: " Pudur ", role: "Batsman", phone: null };
  const parsed = adminPlayerSchema.parse(player);
  assert.equal(parsed.full_name, "Player");
  assert.equal(parsed.city, "Pudur");
  assert.equal(parsed.phone, null);
  assert.equal(adminPlayerSchema.safeParse({ ...player, role: "Captain" }).success, false);
  assert.equal(adminPlayerSchema.partial().safeParse({ full_name: " " }).success, false);
});
