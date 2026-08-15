const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createSourceClient
} = require("../cloudfunctions/wall-sync-posts/lib/source-client");

test("source client forwards an observable request ID and parses the response", async (t) => {
  const originalFetch = global.fetch;
  let request;

  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({
      apiVersion: "1",
      sourceInstance: "unimelb-wall-prod",
      highWatermark: "0",
      nextCursor: "cursor-0",
      hasMore: false,
      changes: [],
      requestId: "run-id.1"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const client = createSourceClient({
    sourceBaseUrl: "https://source.example.com",
    token: "secret",
    sourceInstance: "unimelb-wall-prod",
    pageLimit: 50,
    timeoutMs: 1000
  });
  const page = await client.fetchPage(null, "run-id.1");

  assert.equal(request.options.headers["X-Request-Id"], "run-id.1");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.match(request.url, /limit=50/);
  assert.equal(page.requestId, "run-id.1");
});
