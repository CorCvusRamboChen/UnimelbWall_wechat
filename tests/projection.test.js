const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createExcerpt,
  mirrorStatus,
  projectPost
} = require("../cloudfunctions/wall-sync-posts/lib/projection");

test("excerpt collapses whitespace and remains bounded", () => {
  assert.equal(createExcerpt("  第一行\n\n 第二行  ", 20), "第一行 第二行");
  assert.equal(createExcerpt("123456", 4), "1234");
});

test("visibility follows hidden and status fields", () => {
  assert.equal(mirrorStatus({ status: "published", hidden: false }), "published");
  assert.equal(mirrorStatus({ status: "published", hidden: true }), "hidden");
  assert.equal(mirrorStatus({ status: "deleted", hidden: false }), "deleted");
  assert.equal(mirrorStatus({ status: "draft", hidden: false }), "unavailable");
});

test("post projection preserves ready images and public dependency snapshots", () => {
  const existing = { images: [{ file_id: "cloud://ready" }] };
  const post = projectPost({
    id: "post-1",
    boardId: "course-help",
    authorId: "author-1",
    isAnonymous: false,
    title: "COMP90024 组队",
    body: "还缺一名队友",
    tags: ["COMP90024"],
    commentCount: 2,
    pinned: true,
    hidden: false,
    status: "published",
    createdAt: "2026-08-05T09:00:00Z",
    updatedAt: "2026-08-05T09:30:00Z"
  }, {
    board: { _id: "course-help", name: "课程互助", enabled: true },
    author: { username: "匿名用户", verified: true }
  }, "9007199254740993", existing);

  assert.equal(post.pin_rank, 1);
  assert.equal(post.category.name, "课程互助");
  assert.equal(post.author.verified, true);
  assert.deepEqual(post.images, existing.images);
  assert.equal(post.source_last_seq, "9007199254740993");
});

test("explicit anonymous posts discard author identity and verification", () => {
  const post = projectPost({
    id: "post-anon",
    boardId: "general",
    authorId: "author-private",
    isAnonymous: true,
    title: "匿名帖子",
    body: "正文",
    status: "published",
    hidden: false,
    createdAt: "2026-08-07T00:00:00Z",
    updatedAt: "2026-08-07T00:00:00Z"
  }, {
    board: { _id: "general", name: "综合", enabled: true },
    author: { username: "不应公开", verified: true }
  }, "10");

  assert.equal(post.is_anonymous, true);
  assert.equal(post.author_id, null);
  assert.equal(post.author.display_name, "匿名用户");
  assert.equal(post.author.verified, false);
  assert.equal(post.author.avatar_file_id, null);
});

test("post projection keeps a unified media list while retaining legacy images", () => {
  const existing = {
    media: [
      { source_id: "image-1", type: "image", file_id: "cloud://image" },
      { source_id: "video-1", type: "video", file_id: "cloud://video" }
    ],
    images: [{ source_id: "image-1", file_id: "cloud://image" }]
  };
  const post = projectPost({
    id: "post-media",
    boardId: "general",
    isAnonymous: false,
    title: "媒体帖子",
    body: "正文",
    status: "published",
    hidden: false,
    createdAt: "2026-08-15T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z"
  }, { board: null, author: null }, "11", existing);

  assert.deepEqual(post.media, existing.media);
  assert.deepEqual(post.images, existing.images);
});
