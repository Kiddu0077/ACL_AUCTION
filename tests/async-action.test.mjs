import assert from "node:assert/strict";
import test from "node:test";
import { createActionRunner } from "../lib/async-action.ts";

test("a pending network operation blocks repeated clicks until it settles", async () => {
  const states = [];
  const errors = [];
  const run = createActionRunner((pending) => states.push(pending));
  let finish;
  let calls = 0;
  const delayed = new Promise((resolve) => { finish = resolve; });
  const first = run(async () => { calls += 1; await delayed; }, (error) => errors.push(error));
  await run(async () => { calls += 1; }, (error) => errors.push(error));
  assert.equal(calls, 1);
  assert.deepEqual(states, [true]);
  finish();
  await first;
  assert.deepEqual(states, [true, false]);
  await run(async () => { calls += 1; }, (error) => errors.push(error));
  assert.equal(calls, 2);
  assert.deepEqual(states, [true, false, true, false]);
  assert.deepEqual(errors, []);
});

test("network failures release the control and invoke rollback exactly once", async () => {
  const states = [];
  const run = createActionRunner((pending) => states.push(pending));
  const failure = new Error("Network unavailable");
  let rollback = 0;
  await run(async () => { throw failure; }, (error) => {
    assert.equal(error, failure);
    rollback += 1;
  });
  await run(async () => {}, assert.fail);
  assert.equal(rollback, 1);
  assert.deepEqual(states, [true, false, true, false]);
});
