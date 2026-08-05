# 墨大墙只读微信小程序

这是一个原生微信小程序基础工程，用于只读浏览墨大墙公开帖子。数据由受信任的 CloudBase 云函数消费主站的帖子镜像变更流，再通过唯一的客户端入口 `wall-api` 提供给小程序。

## 当前范围

- 帖子列表、分类筛选、下拉刷新和游标分页
- 帖子详情、纯文本正文和已完成镜像的图片预览
- PR #9 `export-posts` 变更流的幂等消费骨架
- 板块、公开作者、帖子和媒体的 CloudBase 镜像
- 同步状态、失败记录、分布式锁和媒体任务队列
- 不包含登录、发帖、评论正文、点赞、收藏、私信和账户功能

## 本地结构

```text
miniprogram/                 原生小程序
cloudfunctions/wall-api/     客户端唯一可调用的只读云函数
cloudfunctions/wall-sync-posts/  PR #9 变更流消费者
cloudfunctions/wall-sync-assets/  受限媒体镜像任务
docs/                        架构、接口映射和部署说明
tests/                       不依赖云环境的纯逻辑测试
```

## 快速开始

1. 在微信开发者工具中导入仓库根目录，并把 `project.config.json` 的 `appid` 替换为实际小程序 AppID。
2. 在 `miniprogram/constants/config.js` 中填写开发和生产 CloudBase 环境 ID。
3. 按 [部署文档](docs/deployment.md) 创建集合、索引、函数环境变量和安全规则。
4. 分别安装并上传三个云函数；同步函数使用云端安装依赖。
5. 运行 `npm test` 和 `npm run check` 做本地纯逻辑验证。

完整设计见 [基础架构](docs/architecture.md) 和 [源 API 映射](docs/source-api-contract.md)。
