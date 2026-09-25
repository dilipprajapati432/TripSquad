import { test } from "node:test";
import assert from "node:assert/strict";

process.env.MONGO_URI ||= "mongodb://localhost/test";
process.env.JWT_SECRET ||= "test";
const { parsePlan } = await import("../src/services/ai.js");

test("parsePlan accepts valid JSON and drops bad days", () => {
  const text = JSON.stringify({
    days: [
      { day: 1, places: [{ name: "Baga Beach", note: "Sunset" }, { name: "" }] },
      { day: 9, places: [{ name: "Too late" }] },
      { day: 2, places: [{ name: "Fort Aguada" }] },
    ],
  });
  assert.deepEqual(parsePlan(text, 3), [
    { day: 1, places: [{ name: "Baga Beach", note: "Sunset" }] },
    { day: 2, places: [{ name: "Fort Aguada", note: "" }] },
  ]);
});

test("parsePlan handles code fences and rejects garbage", () => {
  assert.equal(parsePlan('```json\n{"days":[{"day":1,"places":[{"name":"A"}]}]}\n```', 2).length, 1);
  assert.throws(() => parsePlan("not json", 2));
  assert.throws(() => parsePlan('{"days":[]}', 2));
});
