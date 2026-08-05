# PR #9 源 API 映射

参考实现：[CorCvusRamboChen/Unimebl-Wall PR #9](https://github.com/CorCvusRamboChen/Unimebl-Wall/pull/9)。

## 请求

```http
GET /functions/v1/export-posts?cursor=<opaque>&limit=50
Authorization: Bearer <POST_EXPORT_API_TOKEN>
Accept: application/json
```

- `cursor`：不传表示从起点 `0` 初始化；后续必须原样使用响应的 `nextCursor`。
- `limit`：源 API 支持 `1..500`，本工程默认 `50`，避免单次云函数执行和扇出更新过大。
- `POST_EXPORT_SOURCE_ID`：部署后必须稳定；镜像端会拒绝源实例变化。

## 响应信封

```json
{
  "apiVersion": "1",
  "sourceInstance": "unimelb-wall-prod",
  "highWatermark": "9821",
  "nextCursor": "opaque-cursor",
  "hasMore": true,
  "changes": []
}
```

`seq`、`highWatermark` 和游标内部序列都必须按字符串处理，不能转换为 JavaScript `Number`。

## 事件路由

| `entity` | `operation` | CloudBase 处理 |
| --- | --- | --- |
| `board` | `upsert` | 更新 `wall_boards`，刷新引用该板块的帖子快照 |
| `board` | `delete` | 删除板块镜像，并把相关帖子设为不可公开 |
| `author` | `upsert` | 更新 `wall_authors`，刷新相关帖子作者快照 |
| `author` | `delete` | 删除作者镜像，相关帖子回退到匿名公开展示 |
| `post` | `upsert` | 更新 `wall_posts`；`hidden/status` 决定公开状态 |
| `post` | `delete` | 物理删除帖子读模型及其媒体任务 |
| `post_media` | `upsert` | 更新媒体元数据并创建幂等图片任务 |
| `post_media` | `delete` | 从帖子图片列表移除并删除任务 |
| `comment` | 任意 | 第一版不保存；帖子上的 `commentCount` 是公开数字来源 |

## 字段白名单

```text
board:
  id, name, slug, description, order, enabled

author:
  id, username, avatarUrl, avatarScale, avatarOffsetX,
  avatarOffsetY, role, verified

post:
  id, boardId, authorId, title, body, tags, edited,
  likeCount, commentCount, saveCount, pinned, locked,
  hidden, status, createdAt, updatedAt

post_media:
  id, postId, type, url, width, height, alt, position
```

微信侧不会公开 `likeCount`、`saveCount`、作者角色或源媒体 URL；这些字段只在需要时用于内部投影或直接丢弃。

## 错误策略

- `400 INVALID_CURSOR / INVALID_LIMIT`：停止自动推进并标记 unhealthy，不能跳过游标。
- `401 UNAUTHORIZED`：停止并要求轮换或修正 Token。
- `503 SERVICE_UNAVAILABLE / TEMPORARY_UNAVAILABLE`：保留旧数据，按定时任务自然重试。
- 网络超时、非 JSON、schema 不支持、sourceInstance 变化：均不保存新游标。
