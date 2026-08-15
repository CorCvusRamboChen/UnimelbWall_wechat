const net = require("node:net");

const MEDIA_FORMATS = {
  "image/jpeg": { extension: "jpg", type: "image" },
  "image/png": { extension: "png", type: "image" },
  "image/webp": { extension: "webp", type: "image" },
  "image/gif": { extension: "gif", type: "image" },
  "video/mp4": { extension: "mp4", type: "video" }
};

const ACCEPT_HEADERS = {
  image: "image/webp,image/png,image/jpeg,image/gif",
  video: "video/mp4"
};

function assetError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateMediaUrl(value, allowedHosts) {
  let url;

  try {
    url = new URL(value);
  } catch (error) {
    throw assetError("MEDIA_URL_INVALID", "Media URL is invalid");
  }

  const hostname = url.hostname.toLowerCase();

  if (url.protocol !== "https:"
      || url.username
      || url.password
      || (url.port && url.port !== "443")
      || hostname === "localhost"
      || net.isIP(hostname) !== 0
      || !allowedHosts.includes(hostname)) {
    throw assetError("MEDIA_HOST_NOT_ALLOWED", "Media URL is not on the allowlist");
  }

  return url;
}

async function readBoundedBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw assetError("MEDIA_TOO_LARGE", "Media exceeds the configured size limit");
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw assetError("MEDIA_TOO_LARGE", "Media exceeds the configured size limit");
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw assetError("MEDIA_TOO_LARGE", "Media exceeds the configured size limit");
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

function mediaFormat(mime, expectedType) {
  const format = MEDIA_FORMATS[mime];

  if (!format || format.type !== expectedType) {
    throw assetError("MEDIA_FORMAT_UNSUPPORTED", "Media MIME type does not match its declared type");
  }

  return format;
}

async function downloadAsset(value, expectedType, config) {
  if (!ACCEPT_HEADERS[expectedType]) {
    throw assetError("MEDIA_TYPE_UNSUPPORTED", "Media type is not supported");
  }

  const url = validateMediaUrl(value, config.allowedHosts);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { Accept: ACCEPT_HEADERS[expectedType] },
      signal: controller.signal
    });

    if (!response.ok) {
      throw assetError("MEDIA_DOWNLOAD_FAILED", `Media returned HTTP ${response.status}`);
    }

    const mime = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const format = mediaFormat(mime, expectedType);
    const buffer = await readBoundedBody(response, config.maxBytes);

    return { buffer, mime, extension: format.extension, type: format.type };
  } catch (error) {
    if (error && error.code) throw error;
    throw assetError(
      error && error.name === "AbortError" ? "MEDIA_TIMEOUT" : "MEDIA_DOWNLOAD_FAILED",
      "Media download failed"
    );
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  MEDIA_FORMATS,
  validateMediaUrl,
  mediaFormat,
  downloadAsset
};
