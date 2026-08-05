const config = require("../constants/config");

function get(key) {
  try {
    const cached = wx.getStorageSync(key);

    if (!cached || !cached.savedAt) {
      return null;
    }

    if (Date.now() - cached.savedAt > config.cacheTtlMs) {
      wx.removeStorageSync(key);
      return null;
    }

    return cached.value;
  } catch (error) {
    return null;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, {
      savedAt: Date.now(),
      value
    });
  } catch (error) {
    // 缓存失败不影响正式数据读取。
  }
}

function feedKey(categoryId) {
  return `wall_feed_${categoryId || "all"}_v1`;
}

function postKey(postId) {
  return `wall_post_${postId}_v1`;
}

module.exports = { get, set, feedKey, postKey };
