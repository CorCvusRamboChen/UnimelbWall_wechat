class SyncError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    this.retryable = options.retryable !== false;
  }
}

module.exports = { SyncError };
