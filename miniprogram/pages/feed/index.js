const wallApi = require("../../services/wall-api");
const cache = require("../../services/cache");
const config = require("../../constants/config");
const { formatDate } = require("../../utils/date");

function authorInitial(post) {
  if (!post || post.is_anonymous) {
    return "匿";
  }

  const name = post.author && post.author.display_name || "墨";
  return Array.from(String(name).trim())[0] || "墨";
}

function decoratePosts(items) {
  return (items || []).map((post) => ({
    ...post,
    author_initial: authorInitial(post),
    published_at_text: formatDate(post.published_at)
  }));
}

function deduplicatePosts(items) {
  const seen = Object.create(null);
  return items.filter((item) => {
    if (!item || !item.id || seen[item.id]) {
      return false;
    }
    seen[item.id] = true;
    return true;
  });
}

Page({
  data: {
    items: [],
    categories: [{ id: "all", name: "全部" }],
    selectedCategoryId: "all",
    cursor: null,
    hasMore: true,
    initialLoading: true,
    loadingMore: false,
    error: null,
    lastSyncedAt: null,
    lastSyncedAtText: "",
    syncStatus: "unknown"
  },

  onLoad() {
    this.requestGeneration = 0;
    this.restoreCachedFeed("all");
    this.loadCategories();
    this.loadFirstPage();
  },

  onPullDownRefresh() {
    this.loadFirstPage({ refreshing: true });
  },

  onReachBottom() {
    this.loadMore();
  },

  restoreCachedFeed(categoryId) {
    const cached = cache.get(cache.feedKey(categoryId));

    if (!cached || !Array.isArray(cached.items)) {
      return;
    }

    this.setData({
      items: decoratePosts(cached.items),
      cursor: cached.nextCursor || null,
      hasMore: cached.hasMore === true,
      initialLoading: false,
      lastSyncedAt: cached.lastSyncedAt || null,
      lastSyncedAtText: cached.lastSyncedAt ? formatDate(cached.lastSyncedAt) : "",
      syncStatus: cached.syncStatus || "unknown"
    });
  },

  async loadCategories() {
    try {
      const categories = await wallApi.listCategories();
      this.setData({
        categories: [
          { id: "all", name: "全部" },
          ...categories.filter((item) => item && item.id !== "all")
        ]
      });
    } catch (error) {
      // 分类失败不阻止“全部”帖子加载。
    }
  },

  async loadFirstPage(options = {}) {
    const generation = ++this.requestGeneration;
    const categoryId = this.data.selectedCategoryId;

    if (!options.refreshing && this.data.items.length === 0) {
      this.setData({ initialLoading: true });
    }

    this.setData({ error: null });

    try {
      const result = await wallApi.listPosts({
        categoryId,
        cursor: null,
        limit: config.feedPageSize
      });

      if (generation !== this.requestGeneration || categoryId !== this.data.selectedCategoryId) {
        return;
      }

      this.setData({
        items: decoratePosts(result.items),
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        lastSyncedAt: result.lastSyncedAt || null,
        lastSyncedAtText: result.lastSyncedAt ? formatDate(result.lastSyncedAt) : "",
        syncStatus: result.syncStatus || "unknown"
      });

      cache.set(cache.feedKey(categoryId), {
        items: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        lastSyncedAt: result.lastSyncedAt,
        syncStatus: result.syncStatus
      });
    } catch (error) {
      if (generation === this.requestGeneration) {
        this.setData({ error: error.message || "加载失败，请稍后重试" });
      }
    } finally {
      if (generation === this.requestGeneration) {
        this.setData({ initialLoading: false });
      }
      if (options.refreshing) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data.cursor) {
      return;
    }

    const generation = this.requestGeneration;
    const categoryId = this.data.selectedCategoryId;
    const cursor = this.data.cursor;
    this.setData({ loadingMore: true });

    try {
      const result = await wallApi.listPosts({
        categoryId,
        cursor,
        limit: config.feedPageSize
      });

      if (generation !== this.requestGeneration || categoryId !== this.data.selectedCategoryId) {
        return;
      }

      this.setData({
        items: decoratePosts(deduplicatePosts([...this.data.items, ...result.items])),
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        lastSyncedAt: result.lastSyncedAt || this.data.lastSyncedAt,
        lastSyncedAtText: result.lastSyncedAt
          ? formatDate(result.lastSyncedAt)
          : this.data.lastSyncedAtText,
        syncStatus: result.syncStatus || this.data.syncStatus
      });
    } catch (error) {
      wx.showToast({ title: "加载更多失败", icon: "none" });
    } finally {
      if (generation === this.requestGeneration) {
        this.setData({ loadingMore: false });
      }
    }
  },

  onCategoryTap(event) {
    const categoryId = event.currentTarget.dataset.id;

    if (!categoryId || categoryId === this.data.selectedCategoryId) {
      return;
    }

    this.requestGeneration += 1;
    this.setData({
      selectedCategoryId: categoryId,
      items: [],
      cursor: null,
      hasMore: true,
      error: null,
      loadingMore: false
    });
    this.restoreCachedFeed(categoryId);
    this.loadFirstPage();
  },

  onPostSelect(event) {
    const id = event.detail && event.detail.id;

    if (!id) {
      return;
    }

    wx.navigateTo({
      url: `/pages/post-detail/index?id=${encodeURIComponent(id)}`
    });
  },

  onRetry() {
    this.loadFirstPage();
  },

  openAbout() {
    wx.navigateTo({ url: "/pages/about/index" });
  }
});
