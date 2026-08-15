function createExcerpt(body, maxLength = 140) {
  return String(body || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function mirrorStatus(post) {
  if (!post || post.hidden === true) {
    return "hidden";
  }

  if (post.status === "deleted") {
    return "deleted";
  }

  if (post.status !== "published") {
    return "unavailable";
  }

  return "published";
}

function publicAuthor(author, anonymous = false) {
  if (anonymous) {
    return {
      display_name: "匿名用户",
      verified: false,
      avatar_file_id: null
    };
  }

  return {
    display_name: author && author.username || "匿名用户",
    verified: Boolean(author && author.verified),
    avatar_file_id: author && author.avatar_file_id || null
  };
}

function publicCategory(board, fallbackId) {
  return {
    id: board && board._id || fallbackId || "uncategorized",
    name: board && board.name || "未分类"
  };
}

function safeDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid date`);
  }

  return date;
}

function projectPost(data, dependencies, sequence, existing = {}) {
  const board = dependencies.board || null;
  const author = dependencies.author || null;
  const isAnonymous = data.isAnonymous === true;
  const existingMedia = Array.isArray(existing.media)
    ? existing.media
    : (Array.isArray(existing.images)
      ? existing.images.map((item) => ({ ...item, type: "image" }))
      : []);

  return {
    _id: String(data.id),
    board_id: data.boardId ? String(data.boardId) : "uncategorized",
    author_id: !isAnonymous && data.authorId ? String(data.authorId) : null,
    is_anonymous: isAnonymous,
    title: String(data.title || ""),
    body: String(data.body || ""),
    excerpt: createExcerpt(data.body),
    tags: Array.isArray(data.tags) ? data.tags.map(String).slice(0, 20) : [],
    edited: data.edited === true,
    comment_count: Math.max(0, Number(data.commentCount) || 0),
    locked: data.locked === true,
    mirror_status: mirrorStatus(data),
    pin_rank: data.pinned === true ? 1 : 0,
    board_enabled: board ? board.enabled === true : true,
    category: publicCategory(board, data.boardId),
    author: publicAuthor(author, isAnonymous),
    media: existingMedia,
    images: Array.isArray(existing.images) ? existing.images : [],
    published_at: safeDate(data.createdAt, "createdAt"),
    source_updated_at: safeDate(data.updatedAt || data.createdAt, "updatedAt"),
    source_last_seq: String(sequence),
    last_synced_at: new Date()
  };
}

module.exports = {
  createExcerpt,
  mirrorStatus,
  publicAuthor,
  publicCategory,
  safeDate,
  projectPost
};
