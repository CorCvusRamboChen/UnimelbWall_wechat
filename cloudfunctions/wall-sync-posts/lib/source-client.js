const { parseExportPage } = require("./change-feed");
const { SyncError } = require("./errors");

function createSourceClient(config) {
  async function fetchPage(cursor, requestId) {
    if (typeof fetch !== "function") {
      throw new SyncError("RUNTIME_UNSUPPORTED", "This function requires Node.js 18+");
    }

    const url = new URL(`${config.sourceBaseUrl}/functions/v1/export-posts`);
    url.searchParams.set("limit", String(config.pageLimit));

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.token}`,
          "X-Request-Id": requestId || "wall-sync-posts"
        },
        signal: controller.signal
      });

      if (response.status === 401) {
        throw new SyncError("SOURCE_UNAUTHORIZED", "Source export token was rejected", {
          retryable: false
        });
      }

      if (!response.ok) {
        throw new SyncError(
          response.status >= 500 ? "SOURCE_UNAVAILABLE" : "SOURCE_REQUEST_REJECTED",
          `Source export returned HTTP ${response.status}`,
          { retryable: response.status >= 500 }
        );
      }

      let body;

      try {
        body = await response.json();
      } catch (error) {
        if (error && error.name === "AbortError") throw error;
        throw new SyncError("SOURCE_RESPONSE_INVALID", "Source response is not JSON", {
          retryable: false
        });
      }

      return parseExportPage(body, config.sourceInstance);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      const code = error && error.name === "AbortError"
        ? "SOURCE_TIMEOUT"
        : "SOURCE_UNAVAILABLE";
      throw new SyncError(code, "Source export request failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  return { fetchPage };
}

module.exports = { createSourceClient };
