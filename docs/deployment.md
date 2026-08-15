# 部署说明

## 1. 环境

建议创建两个彼此隔离的 CloudBase 环境：

```text
unimelb-wall-wechat-dev
unimelb-wall-wechat-prod
```

在 `miniprogram/constants/config.js` 中填入真实环境 ID。CloudBase 环境 ID 不是源站密钥；不要在小程序配置中加入 Token 或 Supabase 密钥。

## 2. 集合与索引

创建以下集合：

```text
wall_boards
wall_authors
wall_posts
wall_post_media
wall_sync_state
wall_sync_runs
wall_asset_jobs
```

为 `wall_posts` 创建架构文档列出的复合索引；为 `wall_post_media` 创建 `post_id + position` 索引；为 `wall_asset_jobs` 创建 `status + next_attempt_at` 索引；为 `wall_sync_runs` 创建 `started_at` 降序索引。

数据库安全规则应拒绝小程序客户端直接读写所有集合。所有读取经 `wall-api` 完成。

## 3. 云函数环境变量

`wall-sync-posts`：

```text
SOURCE_BASE_URL=https://<project-ref>.supabase.co
POST_EXPORT_API_TOKEN=<secret>
POST_EXPORT_SOURCE_ID=unimelb-wall-prod
SYNC_PAGE_LIMIT=50
SYNC_MAX_PAGES=10
SYNC_LOCK_SECONDS=240
SOURCE_TIMEOUT_MS=15000
```

`wall-sync-assets`：

```text
SOURCE_MEDIA_HOSTS=<host-a>,<host-b>
MEDIA_BATCH_SIZE=5
MEDIA_DOWNLOAD_TIMEOUT_MS=15000
MEDIA_MAX_BYTES=26214400
MEDIA_MAX_ATTEMPTS=5
```

`MEDIA_MAX_BYTES` 默认 25 MiB，用于容纳母项目已经使用的 MP4；允许的最大配置为 100 MiB。`SOURCE_MEDIA_HOSTS` 通常只加入母项目重新托管媒体所使用的 Storage/API 主机，不要直接放行小红书、抖音等第三方 CDN。旧版 `IMAGE_BATCH_SIZE`、`IMAGE_DOWNLOAD_TIMEOUT_MS`、`IMAGE_MAX_BYTES`、`IMAGE_MAX_ATTEMPTS` 仍可作为兼容回退，但新部署应使用 `MEDIA_*` 名称。

不要把任何真实值写入仓库。

## 4. 触发器

两个函数目录中的 `config.json` 使用 CloudBase 七段 Cron：

```text
wall-sync-posts   0 */5 * * * * *
wall-sync-assets  0 */2 * * * * *
```

上传云函数后还需要在微信开发者工具或 CloudBase 控制台确认触发器已经上传。时区以控制台显示为准。

## 5. 函数权限

CloudBase 函数安全规则建议：

```json
{
  "wall-api": { "invoke": true },
  "wall-sync-posts": { "invoke": false },
  "wall-sync-assets": { "invoke": false }
}
```

安全规则仅控制客户端 SDK 调用，不阻止定时触发器。正式发布前在控制台再次验证。

## 6. 首次上线顺序

1. 主站 PR #9 已合并；部署时应用 `0033_post_export_api.sql`，配置稳定的 Token 和 Source ID，并部署 `export-posts`。
2. 在开发 CloudBase 环境创建集合和索引。
3. 上传 `wall-api`，用三条手工帖子验证列表和详情。
4. 配置并手动运行 `wall-sync-posts`，从起点完成初始化。
5. 配置媒体主机白名单并运行 `wall-sync-assets`，分别抽样验证图片与 MP4。
6. 验证匿名作者脱敏、隐藏、软删除、物理删除、重复消费和 Token 错误。
7. 开启定时触发器，再迁移同样配置到生产环境。

## 7. 发布前验证

```powershell
npm test
npm run check
```

还必须在微信开发者工具和真机上验证首屏、下拉刷新、触底分页、匿名标识、详情长文本、图片预览、视频播放、弱网和源站不可用时保留旧数据。

## 8. 从旧版图片镜像升级

如果旧版函数已经推进过同步游标，历史帖子不会仅因部署新代码而自动重新投影。也不要只把现有 `wall_sync_state.cursor` 改回起点：实体上的 `source_last_seq` 会把相同或更旧事件视为幂等重放并跳过。

生产环境推荐使用蓝绿升级：

1. 新建一套隔离的 CloudBase 环境或带新前缀的镜像集合。
2. 部署新函数并从游标起点完成全量回填。
3. 抽样确认历史匿名帖已经脱敏，历史视频已经镜像并可播放。
4. 暂停旧环境触发器，切换小程序环境 ID，再启用新环境触发器。
5. 保留旧环境用于短期回滚，确认稳定后再按数据保留策略处理。

尚未运行过首次同步的新环境不需要执行迁移步骤。
