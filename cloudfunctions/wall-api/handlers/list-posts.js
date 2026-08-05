const { parseCategoryId, parseLimit } = require("../lib/validators");
const { decodeCursor, cursorForPost } = require("../lib/cursor");
const { isoDate, listPost } = require("../lib/serializers");

module.exports = async function listPosts(params, context) {
  const categoryId = parseCategoryId(params.categoryId);
  const limit = parseLimit(params.limit);
  const cursor = decodeCursor(params.cursor, categoryId);
  const [page, syncState] = await Promise.all([
    context.repository.listPosts({ categoryId, cursor, limit }),
    context.repository.getSyncState()
  ]);
  const lastPost = page.documents[page.documents.length - 1];

  return {
    ok: true,
    data: {
      items: page.documents.map(listPost),
      next_cursor: page.hasMore && lastPost
        ? cursorForPost(lastPost, categoryId)
        : null,
      has_more: page.hasMore
    },
    meta: {
      last_synced_at: syncState ? isoDate(syncState.last_success_at) : null,
      sync_status: syncState && syncState.status || "unknown"
    }
  };
};
