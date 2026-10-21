import assert from "node:assert/strict";
import test from "node:test";
import { preparePlayerPhoto } from "../lib/prepare-player-photo.ts";

function browser(t, { width = 3000, height = 2000, decode = true, blob = new Blob(["jpeg"], { type: "image/jpeg" }) } = {}) {
  const revoked = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: (done) => done(blob) };
  t.mock.method(URL, "createObjectURL", () => "blob:photo");
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  const previous = { Image: globalThis.Image, document: globalThis.document, window: globalThis.window };
  globalThis.Image = class {
    naturalWidth = width;
    naturalHeight = height;
    set src(value) { queueMicrotask(() => decode ? this.onload() : this.onerror()); }
  };
  globalThis.document = { createElement: () => canvas };
  globalThis.window = { setTimeout, clearTimeout };
  t.after(() => Object.assign(globalThis, previous));
  return { canvas, revoked };
}

test("large registration photos are resized proportionally and JPEG encoded", async (t) => {
  const { canvas, revoked } = browser(t);
  const result = await preparePlayerPhoto(new File(["photo"], "profile.png", { type: "image/png" }));
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 800);
  assert.equal(result.type, "image/jpeg");
  assert.equal(result.name, "profile.jpg");
  assert.deepEqual(revoked, ["blob:photo"]);
});

test("already-small photos are preserved without making downloads larger", async (t) => {
  browser(t, { width: 400, height: 600 });
  const original = new File(["x"], "small.webp", { type: "image/webp" });
  assert.equal(await preparePlayerPhoto(original), original);
});

test("unsupported and corrupt photos fail before upload and release object URLs", async (t) => {
  const { revoked } = browser(t, { decode: false });
  await assert.rejects(preparePlayerPhoto(new File(["invalid"], "photo.heic", { type: "image/heic" })), /export it as JPG/);
  assert.deepEqual(revoked, ["blob:photo"]);
});

test("canvas failures produce a useful error and release object URLs", async (t) => {
  const { revoked } = browser(t, { blob: null });
  await assert.rejects(preparePlayerPhoto(new File(["photo"], "photo.png", { type: "image/png" })), /choose another image/);
  assert.deepEqual(revoked, ["blob:photo"]);
});
