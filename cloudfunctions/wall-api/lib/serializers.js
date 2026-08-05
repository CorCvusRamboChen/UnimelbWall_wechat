function isoDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicAuthor(post) {
  return {
    display_name: post.author && post.author.display_name || "匿名用户",
    verified: Boolean(post.author && post.author.verified)
  };
}

function publicCategory(post) {
  return {
    id: post.category && post.category.id || post.board_id || "uncategorized",
    name: post.category && post.category.name || "未分类"
  };
}

function listPost(post) {
  const images = Array.isArray(post.images) ? post.images : [];
  const thumbnail = images.find((image) => image && image.file_id);

  return {
    id: post._id,
    title: post.title || "",
    excerpt: post.excerpt || "",
    category: publicCategory(post),
    author: publicAuthor(post),
    is_pinned: post.pin_rank === 1,
    comment_count: Number(post.comment_count) || 0,
    thumbnail_file_id: thumbnail ? thumbnail.file_id : null,
    published_at: isoDate(post.published_at)
  };
}

function detailPost(post) {
  return {
    ...listPost(post),
    body_format: "plain_text",
    body: post.body || "",
    images: (Array.isArray(post.images) ? post.images : [])
      .filter((image) => image && image.file_id)
      .map((image) => ({
        file_id: image.file_id,
        width: Number(image.width) || null,
        height: Number(image.height) || null,
        alt: image.alt || ""
      })),
    updated_at: isoDate(post.source_updated_at),
    content_version: post.source_last_seq || "0"
  };
}

module.exports = { isoDate, listPost, detailPost };
