const test = require("node:test");
const assert = require("node:assert/strict");
const {
  encodeCursor,
  decodeCursor,
  cursorForPost
} = require("../cloudfunctions/wall-api/lib/cursor");

test("wall-api cursors are opaque and filter-bound", () => {
  const cursor = cursorForPost({
    _id: "post-1",
    pin_rank: 1,
    published_at: new Date("2026-08-05T09:00:00Z")
  }, "course-help");
  const decoded = decodeCursor(cursor, "course-help");

  assert.equal(decoded.pinRank, 1);
  assert.equal(decoded.id, "post-1");
  assert.throws(
    () => decodeCursor(cursor, "housing"),
    (error) => error.code === "INVALID_PARAMS"
  );
});

test("malformed wall-api cursors are rejected", () => {
  assert.throws(
    () => decodeCursor("not-json", "all"),
    (error) => error.code === "INVALID_PARAMS"
  );
  assert.throws(
    () => decodeCursor(encodeCursor({ v: 2 }), "all"),
    (error) => error.code === "INVALID_PARAMS"
  );
});
