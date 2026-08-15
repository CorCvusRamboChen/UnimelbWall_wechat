const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadConfig
} = require("../cloudfunctions/wall-sync-assets/lib/config");

const VARIABLE_NAMES = [
  "SOURCE_MEDIA_HOSTS",
  "MEDIA_BATCH_SIZE",
  "MEDIA_DOWNLOAD_TIMEOUT_MS",
  "MEDIA_MAX_BYTES",
  "MEDIA_MAX_ATTEMPTS",
  "IMAGE_BATCH_SIZE",
  "IMAGE_DOWNLOAD_TIMEOUT_MS",
  "IMAGE_MAX_BYTES",
  "IMAGE_MAX_ATTEMPTS"
];

function withEnvironment(values, callback) {
  const original = Object.fromEntries(VARIABLE_NAMES.map((name) => [name, process.env[name]]));

  for (const name of VARIABLE_NAMES) delete process.env[name];
  Object.assign(process.env, values);

  try {
    return callback();
  } finally {
    for (const name of VARIABLE_NAMES) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
}

test("media configuration uses video-capable defaults", () => {
  withEnvironment({ SOURCE_MEDIA_HOSTS: "Storage.Example.com" }, () => {
    const config = loadConfig();
    assert.deepEqual(config.allowedHosts, ["storage.example.com"]);
    assert.equal(config.batchSize, 5);
    assert.equal(config.maxBytes, 25 * 1024 * 1024);
  });
});

test("MEDIA variables take precedence while IMAGE variables remain compatible", () => {
  withEnvironment({
    SOURCE_MEDIA_HOSTS: "storage.example.com",
    MEDIA_BATCH_SIZE: "7",
    IMAGE_BATCH_SIZE: "3",
    IMAGE_MAX_BYTES: "10485760"
  }, () => {
    const config = loadConfig();
    assert.equal(config.batchSize, 7);
    assert.equal(config.maxBytes, 10485760);
  });
});
