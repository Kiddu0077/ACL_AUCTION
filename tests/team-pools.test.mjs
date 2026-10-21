import assert from "node:assert/strict";
import test from "node:test";

import { drawTeamPools } from "../lib/team-pools.ts";

test("draw includes every team once, balances odd rosters, and preserves input", () => {
  for (const size of [0, 1, 2, 3, 4, 7, 10, 25]) {
    for (const random of [() => 0, () => 0.5, () => 0.999999]) {
      const teams = Object.freeze(
        Array.from({ length: size }, (_, index) => Object.freeze({ id: index })),
      );
      const before = [...teams];
      const { A, B } = drawTeamPools(teams, random);
      const assigned = [...A, ...B];

      assert.equal(A.length, Math.ceil(size / 2));
      assert.equal(B.length, Math.floor(size / 2));
      assert.equal(new Set(assigned.map((team) => team.id)).size, size);
      assert.deepEqual(assigned.toSorted((a, b) => a.id - b.id), before);
      assert.deepEqual(teams, before);
    }
  }
});

test("all six three-team draw outcomes are possible with equal representation", () => {
  const teams = ["team-a", "team-b", "team-c"];
  const outcomes = new Set();
  const smallerPoolCounts = new Map(teams.map((team) => [team, 0]));

  for (const firstChoice of [1 / 6, 0.5, 5 / 6]) {
    for (const secondChoice of [0.25, 0.75]) {
      const values = [firstChoice, secondChoice];
      const { A, B } = drawTeamPools(teams, () => values.shift());
      outcomes.add([...A, ...B].join(","));
      smallerPoolCounts.set(B[0], smallerPoolCounts.get(B[0]) + 1);
    }
  }

  assert.equal(outcomes.size, 6);
  assert.deepEqual([...smallerPoolCounts.values()], [2, 2, 2]);
});

test("team names cannot influence assignments", () => {
  const teams = [
    { id: "a", name: "First team" },
    { id: "b", name: "Second team" },
    { id: "c", name: "Third team" },
  ];
  const renamed = teams.map((team) => ({ ...team, name: "A new team name" }));
  const originalDraw = drawTeamPools(teams, () => 0.2);
  const renamedDraw = drawTeamPools(renamed, () => 0.2);

  for (const pool of ["A", "B"]) {
    assert.deepEqual(
      originalDraw[pool].map((team) => team.id),
      renamedDraw[pool].map((team) => team.id),
    );
  }
});
