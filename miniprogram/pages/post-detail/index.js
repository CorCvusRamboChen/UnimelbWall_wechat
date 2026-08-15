const wallApi = require("../../services/wall-api");
const cache = require("../../services/cache");
const { formatDate } = require("../../utils/date");

function authorInitial(post) {
  if (!post || post.is_anonymous) {
    return "匿";
  }

  const name = post.author && post.author.display_name || "墨";
  return Array.from(String(name).trim())[0] || "墨";
}

function decoratePost(post) {
  if (!post) {
    return null;
  }

  const rawMedia = Array.isArray(post.media)
    ? post.media
    : (Array.isArray(post.images)
      ? post.images.map((item) => ({ ...item, type: "image" }))
      : []);
  const media = rawMedia.map((item, index) => ({
    ...item,
    id: item.id || item.source_id || item.file_id || String(index)
  }));

  return {
    ...post,
    author_initial: authorInitial(post),
    media,
    images: media.filter((item) => item.type !== "video"),
    published_at_text: formatDate(post.published_at),
    updated_at_text: formatDate(post.updated_at)
  };
}

Page({
  data: {
    postId: "",
    post: null,
    loading: true,
    error: null
  },

  onLoad(options) {
    const postId = options && options.id ? decodeURIComponent(options.id) : "";

    if (!postId || postId.length > 128) {
      this.setData({ loading: false, error: "帖子链接无效" });
      return;
    }

    this.setData({ postId });
    const cached = cache.get(cache.postKey(postId));

    if (cached) {
      this.setData({ post: decoratePost(cached), loading: false });
    }

    this.loadPost();
  },

  async loadPost() {
    if (!this.data.postId) {
      return;
    }

    if (!this.data.post) {
      this.setData({ loading: true });
    }
    this.setData({ error: null });

    try {
      const post = await wallApi.getPost(this.data.postId);
      cache.set(cache.postKey(this.data.postId), post);
      this.setData({ post: decoratePost(post) });
    } catch (error) {
      this.setData({
        post: null,
        error: error.code === "POST_NOT_FOUND"
          ? "帖子不存在或已停止显示"
          : (error.message || "帖子加载失败")
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.fileId;
    const urls = (this.data.post && this.data.post.images || [])
      .map((image) => image.file_id)
      .filter(Boolean);

    if (!current || urls.length === 0) {
      return;
    }

    wx.previewImage({ current, urls });
  },

  onRetry() {
    this.loadPost();
  }
});
