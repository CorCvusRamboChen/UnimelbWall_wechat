const { PublicError } = require("./errors");

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor(value, expectedCategoryId) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.length > 1024) {
    throw new PublicError("INVALID_PARAMS", "分页游标无效");
  }

  let decoded;

  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch (error) {
    throw new PublicError("INVALID_PARAMS", "分页游标无效");
  }

  const valid = decoded
    && decoded.v === 1
    && decoded.categoryId === expectedCategoryId
    && (decoded.pinRank === 0 || decoded.pinRank === 1)
    && typeof decoded.publishedAt === "string"
    && !Number.isNaN(Date.parse(decoded.publishedAt))
    && typeof decoded.id === "string"
    && decoded.id.length > 0
    && decoded.id.length <= 128;

  if (!valid) {
    throw new PublicError("INVALID_PARAMS", "分页游标无效或不属于当前分类");
  }

  return decoded;
}

function cursorForPost(post, categoryId) {
  const publishedAt = post.published_at instanceof Date
    ? post.published_at.toISOString()
    : new Date(post.published_at).toISOString();

  return encodeCursor({
    v: 1,
    categoryId,
    pinRank: post.pin_rank === 1 ? 1 : 0,
    publishedAt,
    id: post._id
  });
}

module.exports = { encodeCursor, decodeCursor, cursorForPost };
