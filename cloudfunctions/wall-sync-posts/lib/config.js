const { SyncError } = require("./errors");

function integer(name, fallback, minimum, maximum) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new SyncError("CONFIG_INVALID", `${name} is invalid`, { retryable: false });
  }

  return value;
}

function loadConfig() {
  const sourceBaseUrl = String(process.env.SOURCE_BASE_URL || "").replace(/\/+$/, "");
  const token = String(process.env.POST_EXPORT_API_TOKEN || "");
  const sourceInstance = String(process.env.POST_EXPORT_SOURCE_ID || "");

  if (!sourceBaseUrl.startsWith("https://") || !token || !sourceInstance) {
    throw new SyncError(
      "CONFIG_INVALID",
      "Source URL, export token, and source ID are required",
      { retryable: false }
    );
  }

  return {
    sourceBaseUrl,
    token,
    sourceInstance,
    pageLimit: integer("SYNC_PAGE_LIMIT", 50, 1, 500),
    maxPages: integer("SYNC_MAX_PAGES", 10, 1, 100),
    lockSeconds: integer("SYNC_LOCK_SECONDS", 240, 30, 900),
    timeoutMs: integer("SOURCE_TIMEOUT_MS", 15000, 1000, 60000)
  };
}

module.exports = { loadConfig };
