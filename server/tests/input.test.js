import { test } from "node:test";
import assert from "node:assert/strict";
import { str } from "../src/utils/input.js";
import { toMinor, MAX_MINOR } from "../src/utils/money.js";
import { setBounded } from "../src/utils/cache.js";

test("str() only accepts text and numbers", () => {
  assert.equal(str("Goa"), "Goa");
  assert.equal(str(42), "42");
  assert.equal(str({ toString: 1 }), ""); // would make String() throw
  assert.equal(str({ a: 1 }), ""); // would be saved as "[object Object]"
  assert.equal(str(["a"]), "");
  assert.equal(str(null, "x"), "x");
  assert.equal(str(NaN), "");
});

test("toMinor() rejects anything that isn't a sensible amount", () => {
  assert.equal(toMinor("24.5"), 2450);
  assert.equal(toMinor(0.1 + 0.2), 30); // floating point noise is rounded away
  for (const bad of [0, -5, "abc", null, undefined, true, [5], { a: 1 }, Infinity, 1e300]) {
    assert.equal(toMinor(bad), null, `toMinor(${JSON.stringify(bad)})`);
  }
  assert.equal(toMinor(MAX_MINOR / 100), MAX_MINOR);
  assert.equal(toMinor(MAX_MINOR / 100 + 1), null);
});

test("setBounded() keeps caches from growing forever", () => {
  const m = new Map();
  for (let i = 0; i < 10; i++) setBounded(m, i, i, 3);
  assert.deepEqual([...m.keys()], [7, 8, 9]);
  setBounded(m, 7, "again", 3); // re-used keys become the newest
  assert.deepEqual([...m.keys()], [8, 9, 7]);
});
