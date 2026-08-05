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
