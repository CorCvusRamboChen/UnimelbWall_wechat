const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateMediaUrl
} = require("../cloudfunctions/wall-sync-assets/lib/download");

test("media URL validator accepts only exact HTTPS allowlist hosts", () => {
  const allowed = ["storage.example.com"];
  assert.equal(
    validateMediaUrl("https://storage.example.com/public/image.jpg", allowed).hostname,
    "storage.example.com"
  );

  for (const url of [
    "http://storage.example.com/image.jpg",
    "https://storage.example.com.evil.test/image.jpg",
    "https://127.0.0.1/image.jpg",
    "https://user:pass@storage.example.com/image.jpg"
  ]) {
    assert.throws(() => validateMediaUrl(url, allowed));
  }
});
