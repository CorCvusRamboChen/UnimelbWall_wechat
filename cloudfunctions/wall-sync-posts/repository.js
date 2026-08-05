const crypto = require("node:crypto");
const { isNewerSequence } = require("./lib/decimal");
const {
  projectPost,
  publicAuthor,
  publicCategory
} = require("./lib/projection");
const { SyncError } = require("./lib/errors");

function createRepository(db) {
  const collections = {
    boards: db.collection("wall_boards"),
    authors: db.collection("wall_authors"),
    posts: db.collection("wall_posts"),
    media: db.collection("wall_post_media"),
    state: db.collection("wall_sync_state"),
    runs: db.collection("wall_sync_runs"),
    jobs: db.collection("wall_asset_jobs")
  };

  async function optionalDocument(collection, id) {
    try {
      const result = await collection.doc(id).get();
      return result.data || null;
    } catch (error) {
      return null;
    }
  }

  async function ensureState() {
    const existing = await optionalDocument(collections.state, "post-export");

    if (existing) {
      return existing;
    }

    const initial = {
      cursor: null,
      source_instance: null,
      high_watermark: "0",
      last_attempt_at: null,
      last_success_at: null,
      status: "unknown",
      consecutive_failures: 0,
      lock_run_id: null,
      lock_until: null
    };

    await collections.state.doc("post-export").set({ data: initial });
    return { _id: "post-export", ...initial };
  }

  async function acquireLock(runId, lockSeconds) {
    await ensureState();
    const now = new Date();
    const lockUntil = new Date(now.getTime() + lockSeconds * 1000);

    await db.runTransaction(async (transaction) => {
      const reference = transaction.collection("wall_sync_state").doc("post-export");
      const result = await reference.get();
      const state = result.data || {};
      const currentLockUntil = state.lock_until ? new Date(state.lock_until) : null;

      if (state.lock_run_id && currentLockUntil && currentLockUntil > now) {
        throw new SyncError("SYNC_ALREADY_RUNNING", "Another sync run owns the lock");
      }

      await reference.update({
        data: {
          lock_run_id: runId,
          lock_until: lockUntil,
          last_attempt_at: now
        }
      });
    });
  }

  async function releaseLock(runId) {
    try {
      await db.runTransaction(async (transaction) => {
        const reference = transaction.collection("wall_sync_state").doc("post-export");
        const result = await reference.get();

        if (result.data && result.data.lock_run_id === runId) {
          await reference.update({
            data: { lock_run_id: null, lock_until: null }
          });
        }
      });
    } catch (error) {
      console.error("failed to release sync lock", {
        runId,
        message: error && error.message
      });
    }
  }

  async function state() {
    return ensureState();
  }

  async function startRun(runId, initialCursor) {
    await collections.runs.doc(runId).set({
      data: {
        type: initialCursor ? "incremental" : "initial",
        started_at: new Date(),
        finished_at: null,
        status: "running",
        start_cursor: initialCursor || null,
        end_cursor: initialCursor || null,
        high_watermark: "0",
        fetched_count: 0,
        applied_count: 0,
        skipped_count: 0,
        ignored_comment_count: 0,
        pages: 0,
        error_code: null,
        error_message: null
      }
    });
  }

  async function finishRun(runId, data) {
    await collections.runs.doc(runId).update({
      data: { ...data, finished_at: new Date() }
    });
  }

  async function checkpoint(page, cursor, runId, lockSeconds) {
    await db.runTransaction(async (transaction) => {
      const reference = transaction.collection("wall_sync_state").doc("post-export");
      const result = await reference.get();

      if (!result.data || result.data.lock_run_id !== runId) {
        throw new SyncError("SYNC_LOCK_LOST", "Sync lock ownership was lost");
      }

      await reference.update({
        data: {
          cursor: page.nextCursor || cursor || null,
          source_instance: page.sourceInstance,
          high_watermark: page.highWatermark,
          last_attempt_at: new Date(),
          lock_until: new Date(Date.now() + lockSeconds * 1000)
        }
      });
    });
  }

  async function markSuccess(runId) {
    const now = new Date();
    await db.runTransaction(async (transaction) => {
      const reference = transaction.collection("wall_sync_state").doc("post-export");
      const result = await reference.get();

      if (!result.data || result.data.lock_run_id !== runId) {
        throw new SyncError("SYNC_LOCK_LOST", "Sync lock ownership was lost");
      }

      await reference.update({
        data: {
          last_success_at: now,
          last_attempt_at: now,
          status: "healthy",
          consecutive_failures: 0,
          lock_run_id: null,
          lock_until: null
        }
      });
    });
  }

  async function markFailure(runId) {
    return db.runTransaction(async (transaction) => {
      const reference = transaction.collection("wall_sync_state").doc("post-export");
      const result = await reference.get();
      const current = result.data || {};

      if (current.lock_run_id !== runId) {
        return false;
      }

      const failures = (Number(current.consecutive_failures) || 0) + 1;
      const status = failures >= 12 ? "unhealthy" : failures >= 3 ? "degraded" : "healthy";

      await reference.update({
        data: {
          last_attempt_at: new Date(),
          status,
          consecutive_failures: failures,
          lock_run_id: null,
          lock_until: null
        }
      });
      return true;
    });
  }

  async function refreshPostImages(postId) {
    if (!postId) {
      return;
    }

    const result = await collections.media
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

    await collections.posts.doc(postId).update({ data: { images } });
  }

  async function applyBoard(change) {
    const existing = await optionalDocument(collections.boards, change.entityId);

    if (existing && !isNewerSequence(change.seq, existing.source_last_seq)) {
      return "skipped";
    }

    if (change.operation === "delete") {
      await collections.boards.doc(change.entityId).remove();
      await collections.posts.where({ board_id: change.entityId }).update({
        data: {
          board_enabled: false,
          category: { id: change.entityId, name: "已停用分类" }
        }
      });
      return "applied";
    }

    const data = change.data;
    const board = {
      name: String(data.name || "未分类"),
      slug: String(data.slug || ""),
      description: String(data.description || ""),
      sort_order: Number(data.order) || 0,
      enabled: data.enabled === true,
      source_last_seq: change.seq,
      last_synced_at: new Date()
    };
    await collections.boards.doc(change.entityId).set({ data: board });
    await collections.posts.where({ board_id: change.entityId }).update({
      data: {
        board_enabled: board.enabled,
        category: { id: change.entityId, name: board.name }
      }
    });
    return "applied";
  }

  async function applyAuthor(change) {
    const existing = await optionalDocument(collections.authors, change.entityId);

    if (existing && !isNewerSequence(change.seq, existing.source_last_seq)) {
      return "skipped";
    }

    if (change.operation === "delete") {
      await collections.authors.doc(change.entityId).remove();
      await collections.posts.where({ author_id: change.entityId }).update({
        data: { author: publicAuthor(null) }
      });
      return "applied";
    }

    const data = change.data;
    const author = {
      username: String(data.username || "匿名用户"),
      avatar_url: data.avatarUrl ? String(data.avatarUrl) : null,
      avatar_scale: Number(data.avatarScale) || 1,
      avatar_offset_x: Number(data.avatarOffsetX) || 0,
      avatar_offset_y: Number(data.avatarOffsetY) || 0,
      role: String(data.role || "member"),
      verified: data.verified === true,
      source_last_seq: change.seq,
      last_synced_at: new Date()
    };
    await collections.authors.doc(change.entityId).set({ data: author });
    await collections.posts.where({ author_id: change.entityId }).update({
      data: { author: publicAuthor(author) }
    });
    return "applied";
  }

  async function applyPost(change) {
    const existing = await optionalDocument(collections.posts, change.entityId);

    if (existing && !isNewerSequence(change.seq, existing.source_last_seq)) {
      return "skipped";
    }

    if (change.operation === "delete") {
      await collections.posts.doc(change.entityId).remove();
      await collections.media.where({ post_id: change.entityId }).remove();
      await collections.jobs.where({ post_id: change.entityId }).remove();
      return "applied";
    }

    if (String(change.data.id) !== change.entityId) {
      throw new SyncError("SOURCE_RESPONSE_INVALID", "Post ID does not match entityId", {
        retryable: false
      });
    }

    const [board, author] = await Promise.all([
      change.data.boardId
        ? optionalDocument(collections.boards, String(change.data.boardId))
        : null,
      change.data.authorId
        ? optionalDocument(collections.authors, String(change.data.authorId))
        : null
    ]);
    const post = projectPost(change.data, { board, author }, change.seq, existing || {});
    const { _id, ...postData } = post;
    await collections.posts.doc(_id).set({ data: postData });
    await refreshPostImages(_id);
    return "applied";
  }

  async function applyMedia(change) {
    const existing = await optionalDocument(collections.media, change.entityId);

    if (existing && !isNewerSequence(change.seq, existing.source_last_seq)) {
      return "skipped";
    }

    const postId = change.postId || existing && existing.post_id;

    if (change.operation === "delete") {
      await collections.media.doc(change.entityId).remove();
      await collections.jobs.doc(change.entityId).remove();
      await refreshPostImages(postId);
      return "applied";
    }

    const data = change.data;

    if (String(data.id) !== change.entityId || !data.postId || !data.url) {
      throw new SyncError("SOURCE_RESPONSE_INVALID", "Media payload is invalid", {
        retryable: false
      });
    }

    const sourceUrl = String(data.url);
    const unchangedReady = existing
      && existing.source_url === sourceUrl
      && existing.asset_status === "ready"
      && existing.mirror_file_id;
    const media = {
      post_id: String(data.postId),
      type: String(data.type || "image"),
      source_url: sourceUrl,
      source_url_hash: crypto.createHash("sha256").update(sourceUrl).digest("hex"),
      width: Number(data.width) || null,
      height: Number(data.height) || null,
      alt: String(data.alt || ""),
      position: Number(data.position) || 0,
      mirror_file_id: unchangedReady ? existing.mirror_file_id : null,
      asset_status: unchangedReady ? "ready" : "pending",
      source_last_seq: change.seq,
      last_synced_at: new Date()
    };
    await collections.media.doc(change.entityId).set({ data: media });

    if (!unchangedReady) {
      await collections.jobs.doc(change.entityId).set({
        data: {
          post_id: media.post_id,
          media_id: change.entityId,
          source_url: sourceUrl,
          source_url_hash: media.source_url_hash,
          status: "pending",
          attempts: 0,
          next_attempt_at: new Date(),
          created_at: existing && existing.created_at || new Date(),
          updated_at: new Date(),
          last_error_code: null
        }
      });
    }

    await refreshPostImages(media.post_id);
    return "applied";
  }

  async function applyChange(change) {
    switch (change.entity) {
      case "board":
        return applyBoard(change);
      case "author":
        return applyAuthor(change);
      case "post":
        return applyPost(change);
      case "post_media":
        return applyMedia(change);
      case "comment":
        return "ignored_comment";
      default:
        throw new SyncError("SOURCE_SCHEMA_UNSUPPORTED", "Unknown change entity", {
          retryable: false
        });
    }
  }

  async function applyPage(changes) {
    const counts = { applied: 0, skipped: 0, ignoredComment: 0 };

    for (const change of changes) {
      const result = await applyChange(change);

      if (result === "applied") counts.applied += 1;
      if (result === "skipped") counts.skipped += 1;
      if (result === "ignored_comment") counts.ignoredComment += 1;
    }

    return counts;
  }

  return {
    acquireLock,
    releaseLock,
    state,
    startRun,
    finishRun,
    checkpoint,
    markSuccess,
    markFailure,
    applyPage,
    refreshPostImages
  };
}

module.exports = { createRepository };
