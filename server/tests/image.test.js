import { test } from "node:test";
import assert from "node:assert/strict";
import { detectImageType } from "../src/utils/image.js";

const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

test("detects real image files by their first bytes", () => {
  assert.equal(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]);
  assert.equal(detectImageType(webp), "image/webp");
});

test("rejects files that only pretend to be images", () => {
  assert.equal(detectImageType(Buffer.from("<svg onload=alert(1)></svg>........")), null);
  assert.equal(detectImageType(Buffer.from("GIF89a..............")), null);
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8])), null); // too short
  assert.equal(detectImageType("not a buffer"), null);
});
