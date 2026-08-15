const cloud = require("wx-server-sdk");
const { loadConfig } = require("./lib/config");
const { downloadAsset } = require("./lib/download");
const { createRepository } = require("./repository");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function safePathPart(value) {
  return String(value || "unknown").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128);
}

exports.main = async () => {
  const config = loadConfig();
  const repository = createRepository(db);
  const candidates = await repository.candidateJobs(config.batchSize);
  const counts = { selected: candidates.length, ready: 0, failed: 0, stale: 0 };

  for (const candidate of candidates) {
    const job = await repository.claimJob(candidate._id);
    if (!job) continue;

    try {
      const asset = await downloadAsset(job.source_url, job.media_type || "image", config);
      const cloudPath = [
        "wall-posts",
        safePathPart(job.post_id),
        `${safePathPart(job.media_id)}-${job.source_url_hash.slice(0, 12)}.${asset.extension}`
      ].join("/");
      const upload = await cloud.uploadFile({
        cloudPath,
        fileContent: asset.buffer
      });
      const applied = await repository.completeJob(job, upload.fileID);

      if (applied) counts.ready += 1;
      else counts.stale += 1;
    } catch (error) {
      counts.failed += 1;
      console.error("asset mirror failed", {
        mediaId: job.media_id,
        code: error && error.code || "MEDIA_DOWNLOAD_FAILED",
        message: error && error.message
      });
      try {
        await repository.failJob(job, error, config.maxAttempts);
      } catch (stateError) {
        counts.stale += 1;
        console.error("asset job disappeared before failure update", {
          mediaId: job.media_id,
          message: stateError && stateError.message
        });
      }
    }
  }

  return { ok: true, ...counts };
};
