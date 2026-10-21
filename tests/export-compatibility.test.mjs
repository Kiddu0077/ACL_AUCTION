import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { prepareExportPhoto } from "../lib/prepare-export-photo.ts";

const columns = ["Full name", "Role", "Phone", "City", "Status", "Registered"];
const rows = [["Test Player", "Bowler", "+91 90000 00000", "Pudur", "Pending", "21/10/2026"]];

test("installed PDF libraries support the production text, table and document APIs", async () => {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Pudur Premier League — Player Registrations", 14, 14);
  doc.setFontSize(10);
  doc.text("Generated 21/10/2026", 14, 20);
  autoTable(doc, { startY: 24, head: [columns], body: rows, styles: { fontSize: 9 }, headStyles: { fillColor: [19, 57, 43] } });
  const bytes = Buffer.from(doc.output("arraybuffer"));
  assert.ok(bytes.subarray(0, 8).toString().startsWith("%PDF-"));
  assert.ok(bytes.toString("latin1").includes("Test Player"));
  assert.equal(doc.getNumberOfPages(), 1);
  assert.equal(typeof doc.save, "function");
});

test("Excel export keeps text that begins with equals as text, with the existing columns", async () => {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([columns, ["=1+1", ...rows[0].slice(1)]]);
  assert.equal(ws.A2.t, "s");
  assert.equal(ws.A2.f, undefined);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Players");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const zip = await JSZip.loadAsync(bytes);
  const sheet = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.ok(sheet.includes("Full name"));
  assert.ok(sheet.includes("=1+1"));
  assert.equal(sheet.includes("<f>"), false);
});

test("PPT export produces a valid deck archive with an embedded image", async () => {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();
  slide.background = { color: "13392B" };
  slide.addText("Pudur Premier League", { x: 0.4, y: 0.35, w: 9, h: 0.6, fontSize: 22, color: "FFFFFF" });
  slide.addShape(pptx.ShapeType.rect, { x: 8.38, y: 1.88, w: 4.44, h: 4.44, fill: { color: "D3F36B" } });
  slide.addImage({ data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKumwAAAAASUVORK5CYII=", x: 8.5, y: 2, w: 4.2, h: 4.2, sizing: { type: "contain", w: 4.2, h: 4.2 } });
  const bytes = await pptx.write({ outputType: "nodebuffer" });
  const zip = await JSZip.loadAsync(bytes);
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.ok(slideXml.includes("Pudur Premier League"));
  assert.ok(Object.keys(zip.files).some((name) => /^ppt\/media\/.*\.png$/.test(name)));
});

test("PPT photo preparation letterboxes a portrait without stretching or cropping", async (t) => {
  const revoked = [];
  let draw;
  let fill;
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect: (...args) => { fill = args; }, drawImage: (...args) => { draw = args; } }), toDataURL: (type) => `data:${type};base64,test` };
  t.mock.method(URL, "createObjectURL", () => "blob:export-photo");
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  const previous = { Image: globalThis.Image, window: globalThis.window, document: globalThis.document };
  globalThis.Image = class { naturalWidth = 1000; naturalHeight = 2000; set src(value) { queueMicrotask(() => this.onload()); } };
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.document = { createElement: () => canvas };
  t.after(() => Object.assign(globalThis, previous));
  assert.equal(await prepareExportPhoto(new Blob(["photo"])), "data:image/jpeg;base64,test");
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 1200);
  assert.deepEqual(fill, [0, 0, 1200, 1200]);
  assert.deepEqual(draw.slice(1), [300, 0, 600, 1200]);
  assert.deepEqual(revoked, ["blob:export-photo"]);
});
