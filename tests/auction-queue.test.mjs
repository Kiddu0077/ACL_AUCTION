import test from 'node:test';
import assert from 'node:assert/strict';
import { createOptimisticQueue } from '../lib/auction/optimistic-queue.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('next player appears synchronously while select and sale are saved in order', async () => {
  const first = deferred(), sale = deferred(), next = deferred();
  const called = [];
  const queue = createOptimisticQueue({ initial: { player: null, sold: [] }, recover: async () => ({ player: null, sold: [] }) });
  const pick = (id, gate) => queue.enqueue({ apply: d => ({ ...d, player: id }), execute: () => { called.push(id); return gate.promise; }, commit: (d, result) => ({ ...d, player: result }) });
  pick('A', first);
  queue.enqueue({ apply: d => ({ player: null, sold: [...new Set([...d.sold, 'A'])] }), execute: () => { called.push('sell A'); return sale.promise; }, commit: d => ({ player: null, sold: ['A'] }) });
  pick('B', next);
  assert.deepEqual(queue.getSnapshot().data, { player: 'B', sold: ['A'] });
  assert.deepEqual(called, ['A']);
  assert.equal(queue.replace({ player: 'STALE', sold: [] }), false);
  first.resolve('A'); await flush();
  assert.deepEqual(called, ['A', 'sell A']);
  assert.equal(queue.getSnapshot().data.player, 'B');
  sale.resolve(); await flush();
  assert.equal(queue.getSnapshot().data.player, 'B');
  next.resolve('B'); await flush();
  assert.deepEqual(queue.getSnapshot().data, { player: 'B', sold: ['A'] });
  assert.equal(queue.getSnapshot().pending, 0);
});

test('failed write cancels dependent commands and reloads authoritative partial writes', async () => {
  const write = deferred(), recovery = deferred();
  let cancelled = 0, secondCalled = false;
  const queue = createOptimisticQueue({ initial: 0, recover: () => recovery.promise, onError: (_message, count) => { cancelled = count; } });
  queue.enqueue({ apply: () => 1, execute: () => write.promise, commit: () => 1 });
  queue.enqueue({ apply: () => 2, execute: async () => { secondCalled = true; }, commit: () => 2 });
  write.reject(new Error('network lost after write')); await flush();
  assert.equal(cancelled, 1);
  assert.equal(queue.getSnapshot().recovering, true);
  assert.equal(queue.enqueue({apply:()=>3,execute:async()=>3,commit:()=>3}), false);
  recovery.resolve(1); await flush();
  assert.equal(secondCalled, false);
  assert.equal(queue.getSnapshot().data, 1);
  assert.equal(queue.getSnapshot().error, null);
});

test('offline recovery blocks writes until an explicit successful resync', async () => {
  let offline = true;
  const queue = createOptimisticQueue({ initial: 0, recover: async () => { if (offline) throw new Error('offline'); return 4; } });
  queue.enqueue({apply:()=>1,execute:async()=>{throw new Error('failed');},commit:()=>1});
  await flush();
  assert.ok(queue.getSnapshot().error);
  assert.equal(queue.enqueue({apply:()=>2,execute:async()=>2,commit:()=>2}),false);
  offline = false;
  assert.equal(await queue.resync(),true);
  assert.equal(queue.getSnapshot().data,4);
});

test('100 rapid projections remain immediate with a 200-player roster and delayed network', () => {
  const gate = deferred();
  const queue = createOptimisticQueue({ initial: { current:null, players:Array.from({length:200},(_,id)=>({id})) }, recover: async()=>({current:null,players:[]}) });
  const started=performance.now();
  for(let id=0;id<100;id++) queue.enqueue({apply:d=>({...d,current:id}),execute:()=>gate.promise,commit:(d)=>d});
  const elapsed=performance.now()-started;
  assert.equal(queue.getSnapshot().data.current,99);
  assert.equal(queue.getSnapshot().pending,100);
  assert.ok(elapsed < 100, `Synchronous projection took ${elapsed.toFixed(2)}ms`);
  console.log(`100 queued UI projections: ${elapsed.toFixed(2)}ms (database intentionally delayed)`);
});
