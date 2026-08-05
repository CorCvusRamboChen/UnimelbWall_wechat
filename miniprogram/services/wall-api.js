const config = require("../constants/config");

class WallApiError extends Error {
  constructor(code, message) {
    super(message || "服务暂时不可用");
    this.name = "WallApiError";
    this.code = code || "UNKNOWN_ERROR";
  }
}

async function callWallApi(action, params = {}) {
  let response;

  try {
    response = await wx.cloud.callFunction({
      name: config.wallApiFunctionName,
      data: { action, params }
    });
  } catch (error) {
    throw new WallApiError("NETWORK_ERROR", "网络连接失败，请稍后重试");
  }

  const result = response && response.result;

  if (!result || result.ok !== true) {
    throw new WallApiError(
      result && result.error && result.error.code,
      result && result.error && result.error.message
    );
  }

  return result;
}

async function listPosts(params) {
  const result = await callWallApi("posts.list", params);

  return {
    items: result.data.items || [],
    nextCursor: result.data.next_cursor || null,
    hasMore: result.data.has_more === true,
    lastSyncedAt: result.meta && result.meta.last_synced_at,
    syncStatus: result.meta && result.meta.sync_status
  };
}

async function getPost(id) {
  const result = await callWallApi("posts.get", { id });
  return result.data;
}

async function listCategories() {
  const result = await callWallApi("categories.list");
  return result.data.items || [];
}

async function getSyncStatus() {
  const result = await callWallApi("sync.status");
  return result.data;
}

module.exports = {
  WallApiError,
  listPosts,
  getPost,
  listCategories,
  getSyncStatus
};
