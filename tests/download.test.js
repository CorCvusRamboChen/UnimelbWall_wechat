const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateMediaUrl,
  mediaFormat,
  downloadAsset
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

test("video downloads request and accept only MP4", async (t) => {
  const originalFetch = global.fetch;
  let accept;

  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url, options) => {
    accept = options.headers.Accept;
    return new Response(Buffer.from("video"), {
      status: 200,
      headers: { "Content-Type": "video/mp4" }
    });
  };

  const result = await downloadAsset("https://storage.example.com/video.mp4", "video", {
    allowedHosts: ["storage.example.com"],
    timeoutMs: 1000,
    maxBytes: 1024
  });

  assert.equal(accept, "video/mp4");
  assert.equal(result.extension, "mp4");
  assert.equal(result.type, "video");
  assert.equal(result.buffer.toString(), "video");
});

test("media MIME must match the declared image or video type", () => {
  assert.deepEqual(mediaFormat("image/webp", "image"), {
    extension: "webp",
    type: "image"
  });
  assert.deepEqual(mediaFormat("video/mp4", "video"), {
    extension: "mp4",
    type: "video"
  });
  assert.throws(
    () => mediaFormat("video/mp4", "image"),
    (error) => error.code === "MEDIA_FORMAT_UNSUPPORTED"
  );
  assert.throws(
    () => mediaFormat("text/html", "video"),
    (error) => error.code === "MEDIA_FORMAT_UNSUPPORTED"
  );
});
