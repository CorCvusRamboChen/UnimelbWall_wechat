function isoDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicAuthor(post) {
  if (post.is_anonymous === true) {
    return {
      display_name: "匿名用户",
      verified: false
    };
  }

  return {
    display_name: post.author && post.author.display_name || "匿名用户",
    verified: Boolean(post.author && post.author.verified)
  };
}

function publicMedia(post) {
  const source = Array.isArray(post.media)
    ? post.media
    : (Array.isArray(post.images)
      ? post.images.map((item) => ({ ...item, type: "image" }))
      : []);

  return source
    .filter((item) => item && item.file_id)
    .map((item) => ({
      id: item.source_id || item.file_id,
      type: item.type === "video" ? "video" : "image",
      file_id: item.file_id,
      width: Number(item.width) || null,
      height: Number(item.height) || null,
      alt: item.alt || ""
    }));
}

function publicCategory(post) {
  return {
    id: post.category && post.category.id || post.board_id || "uncategorized",
    name: post.category && post.category.name || "未分类"
  };
}

function listPost(post) {
  const media = publicMedia(post);
  const images = media.filter((item) => item.type === "image");
  const thumbnail = images.find((image) => image && image.file_id);

  return {
    id: post._id,
    title: post.title || "",
    excerpt: post.excerpt || "",
    category: publicCategory(post),
    author: publicAuthor(post),
    is_anonymous: post.is_anonymous === true,
    is_pinned: post.pin_rank === 1,
    has_video: media.some((item) => item.type === "video"),
    comment_count: Number(post.comment_count) || 0,
    thumbnail_file_id: thumbnail ? thumbnail.file_id : null,
    published_at: isoDate(post.published_at)
  };
}

function detailPost(post) {
  const media = publicMedia(post);

  return {
    ...listPost(post),
    body_format: "plain_text",
    body: post.body || "",
    media,
    images: media.filter((item) => item.type === "image"),
    updated_at: isoDate(post.source_updated_at),
    content_version: post.source_last_seq || "0"
  };
}

module.exports = { isoDate, publicMedia, listPost, detailPost };
