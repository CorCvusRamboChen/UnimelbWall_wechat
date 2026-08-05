const { PublicError } = require("./lib/errors");

function createRepository(db) {
  const command = db.command;

  async function listPosts({ categoryId, cursor, limit }) {
    const baseFilter = {
      mirror_status: "published",
      board_enabled: true
    };

    if (categoryId !== "all") {
      baseFilter.board_id = categoryId;
    }

    const filters = [baseFilter];

    if (cursor) {
      const publishedAt = new Date(cursor.publishedAt);
      filters.push(command.or([
        { pin_rank: command.lt(cursor.pinRank) },
        {
          pin_rank: cursor.pinRank,
          published_at: command.lt(publishedAt)
        },
        {
          pin_rank: cursor.pinRank,
          published_at: publishedAt,
          _id: command.lt(cursor.id)
        }
      ]));
    }

    const where = filters.length === 1 ? baseFilter : command.and(filters);
    const result = await db.collection("wall_posts")
      .where(where)
      .orderBy("pin_rank", "desc")
      .orderBy("published_at", "desc")
      .orderBy("_id", "desc")
      .limit(limit + 1)
      .get();

    return {
      documents: result.data.slice(0, limit),
      hasMore: result.data.length > limit
    };
  }

  async function getPost(id) {
    let result;

    try {
      result = await db.collection("wall_posts").doc(id).get();
    } catch (error) {
      throw new PublicError("POST_NOT_FOUND", "帖子不存在或已停止显示");
    }

    const post = result && result.data;

    if (!post || post.mirror_status !== "published" || post.board_enabled !== true) {
      throw new PublicError("POST_NOT_FOUND", "帖子不存在或已停止显示");
    }

    return post;
  }

  async function listCategories() {
    const result = await db.collection("wall_boards")
      .where({ enabled: true })
      .orderBy("sort_order", "asc")
      .orderBy("_id", "asc")
      .limit(100)
      .get();

    return result.data;
  }

  async function getSyncState() {
    try {
      const result = await db.collection("wall_sync_state").doc("post-export").get();
      return result.data || null;
    } catch (error) {
      return null;
    }
  }

  return { listPosts, getPost, listCategories, getSyncState };
}

module.exports = { createRepository };
