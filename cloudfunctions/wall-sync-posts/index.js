const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");
const { loadConfig } = require("./lib/config");
const { createSourceClient } = require("./lib/source-client");
const { createRepository } = require("./repository");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function safeError(error) {
  return {
    code: error && error.code || "SYNC_FAILED",
    message: error && error.message || "Sync failed",
    retryable: error && error.retryable !== false
  };
}

exports.main = async () => {
  const runId = crypto.randomUUID();
  let repository;
  let lockAcquired = false;
  let runStarted = false;
  const totals = {
    fetched: 0,
    applied: 0,
    skipped: 0,
    ignoredComment: 0,
    pages: 0,
    cursor: null,
    highWatermark: "0"
  };

  try {
    const config = loadConfig();
    repository = createRepository(db);
    const sourceClient = createSourceClient(config);
    await repository.acquireLock(runId, config.lockSeconds);
    lockAcquired = true;

    const initialState = await repository.state();
    totals.cursor = initialState.cursor || null;

    if (initialState.source_instance
        && initialState.source_instance !== config.sourceInstance) {
      const error = new Error("Configured source instance differs from saved state");
      error.code = "SOURCE_INSTANCE_MISMATCH";
      error.retryable = false;
      throw error;
    }

    await repository.startRun(runId, totals.cursor);
    runStarted = true;

    for (let pageNumber = 0; pageNumber < config.maxPages; pageNumber += 1) {
      const page = await sourceClient.fetchPage(
        totals.cursor,
        `${runId}.${pageNumber + 1}`
      );
      const counts = await repository.applyPage(page.changes);
      await repository.checkpoint(
        page,
        totals.cursor,
        runId,
        config.lockSeconds
      );

      totals.fetched += page.changes.length;
      totals.applied += counts.applied;
      totals.skipped += counts.skipped;
      totals.ignoredComment += counts.ignoredComment;
      totals.pages += 1;
      totals.cursor = page.nextCursor || totals.cursor;
      totals.highWatermark = page.highWatermark;

      if (!page.hasMore) {
        break;
      }
    }

    await repository.finishRun(runId, {
      status: "success",
      end_cursor: totals.cursor,
      high_watermark: totals.highWatermark,
      fetched_count: totals.fetched,
      applied_count: totals.applied,
      skipped_count: totals.skipped,
      ignored_comment_count: totals.ignoredComment,
      pages: totals.pages
    });
    await repository.markSuccess(runId);
    lockAcquired = false;

    return { ok: true, runId, ...totals };
  } catch (error) {
    const failure = safeError(error);

    console.error("post export sync failed", {
      runId,
      code: failure.code,
      message: failure.message,
      retryable: failure.retryable,
      fetched: totals.fetched,
      pages: totals.pages
    });

    if (repository && lockAcquired) {
      try {
        await repository.markFailure(runId);
        lockAcquired = false;
      } catch (markError) {
        console.error("failed to mark sync state", {
          runId,
          message: markError && markError.message
        });
      }
    }

    if (repository && runStarted) {
      try {
        await repository.finishRun(runId, {
          status: "failed",
          end_cursor: totals.cursor,
          high_watermark: totals.highWatermark,
          fetched_count: totals.fetched,
          applied_count: totals.applied,
          skipped_count: totals.skipped,
          ignored_comment_count: totals.ignoredComment,
          pages: totals.pages,
          error_code: failure.code,
          error_message: failure.message
        });
      } catch (runError) {
        console.error("failed to finish sync run record", {
          runId,
          message: runError && runError.message
        });
      }
    }

    return { ok: false, runId, error: failure };
  } finally {
    if (repository && lockAcquired) {
      await repository.releaseLock(runId);
    }
  }
};
