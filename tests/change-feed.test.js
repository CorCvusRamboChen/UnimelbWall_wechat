const test = require("node:test");
const assert = require("node:assert/strict");
const { parseExportPage } = require("../cloudfunctions/wall-sync-posts/lib/change-feed");

function validPage() {
  return {
    apiVersion: "1",
    sourceInstance: "unimelb-wall-prod",
    highWatermark: "9007199254740993",
    nextCursor: "opaque",
    hasMore: true,
    changes: [
      {
        seq: "9007199254740992",
        entity: "post",
        operation: "upsert",
        entityId: "post-1",
        postId: "post-1",
        occurredAt: "2026-08-05T10:30:00Z",
        payloadVersion: 1,
        data: { id: "post-1" }
      },
      {
        seq: "9007199254740993",
        entity: "post_media",
        operation: "delete",
        entityId: "media-1",
        postId: "post-1",
        occurredAt: "2026-08-05T10:31:00Z",
        payloadVersion: 1,
        data: null
      }
    ]
  };
}

test("PR #9 response parses without converting sequences to Number", () => {
  const page = parseExportPage(validPage(), "unimelb-wall-prod");
  assert.equal(page.changes[0].seq, "9007199254740992");
  assert.equal(page.highWatermark, "9007199254740993");
  assert.equal(page.changes[1].operation, "delete");
});

test("source instance, schema, and order are enforced", () => {
  assert.throws(
    () => parseExportPage(validPage(), "another-source"),
    (error) => error.code === "SOURCE_INSTANCE_MISMATCH"
  );

  const unsupported = validPage();
  unsupported.apiVersion = "2";
  assert.throws(
    () => parseExportPage(unsupported, "unimelb-wall-prod"),
    (error) => error.code === "SOURCE_SCHEMA_UNSUPPORTED"
  );

  const unordered = validPage();
  unordered.changes[1].seq = unordered.changes[0].seq;
  assert.throws(
    () => parseExportPage(unordered, "unimelb-wall-prod"),
    (error) => error.code === "SOURCE_RESPONSE_INVALID"
  );
});

test("delete events cannot smuggle a payload", () => {
  const page = validPage();
  page.changes[1].data = { url: "https://example.com/private" };
  assert.throws(
    () => parseExportPage(page, "unimelb-wall-prod"),
    (error) => error.code === "SOURCE_RESPONSE_INVALID"
  );
});
