const test = require("node:test");
const assert = require("node:assert/strict");
const {
  listPost,
  detailPost
} = require("../cloudfunctions/wall-api/lib/serializers");

function mirroredPost() {
  return {
    _id: "post-1",
    title: "匿名视频帖",
    excerpt: "摘要",
    body: "正文",
    category: { id: "general", name: "综合" },
    author: { display_name: "不应公开", verified: true },
    is_anonymous: true,
    pin_rank: 0,
    comment_count: 2,
    published_at: new Date("2026-08-15T00:00:00Z"),
    source_updated_at: new Date("2026-08-15T01:00:00Z"),
    source_last_seq: "42",
    media: [
      {
        source_id: "video-1",
        type: "video",
        file_id: "cloud://video.mp4",
        width: 1080,
        height: 1920,
        alt: "视频"
      },
      {
        source_id: "image-1",
        type: "image",
        file_id: "cloud://image.webp",
        width: 1200,
        height: 900,
        alt: "图片"
      }
    ]
  };
}

test("list DTO masks anonymous authors and reports video media", () => {
  const dto = listPost(mirroredPost());

  assert.equal(dto.is_anonymous, true);
  assert.deepEqual(dto.author, { display_name: "匿名用户", verified: false });
  assert.equal(dto.has_video, true);
  assert.equal(dto.thumbnail_file_id, "cloud://image.webp");
});

test("detail DTO exposes only mirrored file IDs with explicit media types", () => {
  const dto = detailPost(mirroredPost());

  assert.deepEqual(dto.media.map((item) => item.type), ["video", "image"]);
  assert.deepEqual(dto.media.map((item) => item.file_id), [
    "cloud://video.mp4",
    "cloud://image.webp"
  ]);
  assert.equal(dto.images.length, 1);
  assert.equal(dto.images[0].type, "image");
});

test("detail DTO remains compatible with records that only have images", () => {
  const post = mirroredPost();
  delete post.media;
  post.images = [{ source_id: "legacy", file_id: "cloud://legacy.jpg" }];

  const dto = detailPost(post);
  assert.equal(dto.media.length, 1);
  assert.equal(dto.media[0].type, "image");
  assert.equal(dto.has_video, false);
});
