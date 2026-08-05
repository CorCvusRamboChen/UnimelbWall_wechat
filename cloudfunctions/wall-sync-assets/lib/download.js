const net = require("node:net");

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
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
    throw assetError("IMAGE_URL_INVALID", "Media URL is invalid");
  }

  const hostname = url.hostname.toLowerCase();

  if (url.protocol !== "https:"
      || url.username
      || url.password
      || (url.port && url.port !== "443")
      || hostname === "localhost"
      || net.isIP(hostname) !== 0
      || !allowedHosts.includes(hostname)) {
    throw assetError("IMAGE_HOST_NOT_ALLOWED", "Media URL is not on the allowlist");
  }

  return url;
}

async function readBoundedBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw assetError("IMAGE_TOO_LARGE", "Image exceeds the configured size limit");
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw assetError("IMAGE_TOO_LARGE", "Image exceeds the configured size limit");
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
      throw assetError("IMAGE_TOO_LARGE", "Image exceeds the configured size limit");
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

async function downloadImage(value, config) {
  const url = validateMediaUrl(value, config.allowedHosts);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.code) throw error;
    throw assetError(
      error && error.name === "AbortError" ? "IMAGE_TIMEOUT" : "IMAGE_DOWNLOAD_FAILED",
      "Image download failed"
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw assetError("IMAGE_DOWNLOAD_FAILED", `Image returned HTTP ${response.status}`);
  }

  const mime = String(response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const extension = MIME_EXTENSIONS[mime];

  if (!extension) {
    throw assetError("IMAGE_FORMAT_UNSUPPORTED", "Image MIME type is not supported");
  }

  const buffer = await readBoundedBody(response, config.maxBytes);
  return { buffer, mime, extension };
}

module.exports = { MIME_EXTENSIONS, validateMediaUrl, downloadImage };
