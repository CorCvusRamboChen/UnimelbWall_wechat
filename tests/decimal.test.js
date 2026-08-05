const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeDecimal,
  compareDecimal,
  isNewerSequence
} = require("../cloudfunctions/wall-sync-posts/lib/decimal");

test("decimal sequence comparison remains bigint safe", () => {
  assert.equal(compareDecimal("9007199254740992", "9007199254740991"), 1);
  assert.equal(compareDecimal("10", "9"), 1);
  assert.equal(compareDecimal("1", "1"), 0);
  assert.equal(isNewerSequence("9821", "9801"), true);
  assert.equal(isNewerSequence("9801", "9801"), false);
});

test("decimal sequences reject unsafe representations", () => {
  for (const value of ["", "-1", "1.2", "1e3", "001", " 1", "abc"]) {
    assert.throws(() => normalizeDecimal(value), TypeError);
  }
});
