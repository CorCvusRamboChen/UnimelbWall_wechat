function createRepository(db) {
  const command = db.command;
  const jobs = db.collection("wall_asset_jobs");
  const media = db.collection("wall_post_media");
  const posts = db.collection("wall_posts");

  async function candidateJobs(limit) {
    const result = await jobs.where({
      status: command.in(["pending", "retry"]),
      next_attempt_at: command.lte(new Date())
    })
      .orderBy("next_attempt_at", "asc")
      .orderBy("_id", "asc")
      .limit(limit)
      .get();

    return result.data;
  }

  async function claimJob(id) {
    return db.runTransaction(async (transaction) => {
      const reference = transaction.collection("wall_asset_jobs").doc(id);
      const result = await reference.get();
      const job = result.data;

      if (!job || !["pending", "retry"].includes(job.status)) {
        return null;
      }

      await reference.update({
        data: { status: "processing", updated_at: new Date() }
      });

      return { ...job, _id: id };
    });
  }

  async function refreshPostImages(postId) {
    if (!postId) return;
    const result = await media
      .where({ post_id: postId, asset_status: "ready" })
      .orderBy("position", "asc")
      .orderBy("_id", "asc")
      .limit(100)
      .get();
    const images = result.data
      .filter((item) => item.mirror_file_id)
      .map((item) => ({
        source_id: item._id,
        file_id: item.mirror_file_id,
        width: Number(item.width) || null,
        height: Number(item.height) || null,
        alt: item.alt || "",
        position: Number(item.position) || 0
      }));

    await posts.doc(postId).update({ data: { images } });
  }

  async function completeJob(job, fileId) {
    let current;

    try {
      current = await jobs.doc(job._id).get();
    } catch (error) {
      return false;
    }

    if (!current.data || current.data.source_url_hash !== job.source_url_hash) {
      return false;
    }

    let mediaRecord;

    try {
      mediaRecord = await media.doc(job.media_id).get();
    } catch (error) {
      return false;
    }

    if (!mediaRecord.data || mediaRecord.data.source_url_hash !== job.source_url_hash) {
      return false;
    }

    await media.doc(job.media_id).update({
      data: {
        mirror_file_id: fileId,
        asset_status: "ready",
        asset_updated_at: new Date()
      }
    });
    await jobs.doc(job._id).update({
      data: {
        status: "ready",
        updated_at: new Date(),
        completed_at: new Date(),
        last_error_code: null
      }
    });
    await refreshPostImages(job.post_id);
    return true;
  }

  async function failJob(job, error, maxAttempts) {
    const attempts = (Number(job.attempts) || 0) + 1;
    const terminal = attempts >= maxAttempts;
    const delaySeconds = Math.min(3600, 60 * (2 ** Math.min(attempts, 6)));

    await jobs.doc(job._id).update({
      data: {
        status: terminal ? "failed" : "retry",
        attempts,
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000),
        updated_at: new Date(),
        last_error_code: error && error.code || "IMAGE_DOWNLOAD_FAILED"
      }
    });
    await media.doc(job.media_id).update({
      data: { asset_status: terminal ? "failed" : "pending" }
    });
  }

  return { candidateJobs, claimJob, completeJob, failJob };
}

module.exports = { createRepository };
