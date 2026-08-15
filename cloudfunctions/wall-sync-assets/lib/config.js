function integer(name, fallback, minimum, maximum) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    const error = new Error(`${name} is invalid`);
    error.code = "CONFIG_INVALID";
    throw error;
  }

  return value;
}

function compatibleInteger(name, legacyName, fallback, minimum, maximum) {
  if (process.env[name] !== undefined) {
    return integer(name, fallback, minimum, maximum);
  }

  return integer(legacyName, fallback, minimum, maximum);
}

function loadConfig() {
  const allowedHosts = String(process.env.SOURCE_MEDIA_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (allowedHosts.length === 0) {
    const error = new Error("SOURCE_MEDIA_HOSTS is required");
    error.code = "CONFIG_INVALID";
    throw error;
  }

  return {
    allowedHosts,
    batchSize: compatibleInteger("MEDIA_BATCH_SIZE", "IMAGE_BATCH_SIZE", 5, 1, 20),
    timeoutMs: compatibleInteger(
      "MEDIA_DOWNLOAD_TIMEOUT_MS",
      "IMAGE_DOWNLOAD_TIMEOUT_MS",
      15000,
      1000,
      60000
    ),
    maxBytes: compatibleInteger(
      "MEDIA_MAX_BYTES",
      "IMAGE_MAX_BYTES",
      25 * 1024 * 1024,
      1024,
      100 * 1024 * 1024
    ),
    maxAttempts: compatibleInteger("MEDIA_MAX_ATTEMPTS", "IMAGE_MAX_ATTEMPTS", 5, 1, 20)
  };
}

module.exports = { loadConfig };
