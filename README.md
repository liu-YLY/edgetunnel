# EdgeTunnel — Cloudflare Workers

本项目基于 cmliu/edgetunnel 分叉，提供 WebSocket、gRPC、XHTTP 隧道及订阅和配置管理。源码位于 `src/`，使用显式 ES Modules，由 esbuild 打包；`_worker.js` 是可重现的部署产物，禁止手工修改产物。

## 开发与验证

```sh
npm ci
npm run build
npm run check
npm run test:runtime
npm run deploy:check
```

Node.js 22+；固定构建与测试依赖版本。`check` 包含模块边界、隐式引用、循环依赖及产物一致性检查。运行时测试仅使用本地回环端口与临时 KV。生产可用性仍需独立测试环境验收。

## 部署

push `main` 即由 `.github/workflows/deploy.yml` 自动校验并部署到生产 Worker（服务名 `edgetunnel`，由 [wrangler.toml](wrangler.toml) 的 `name`/`account_id` 唯一定义）；也可用 `npm run deploy` 本地手动发布。绑定 `KV`，通过 Secrets 配置 `ADMIN`、`KEY`、`UUID`。仓库不预置 staging 环境，需要隔离验证时按部署指南自建。不要直接套用历史 Pages 上传教程。

完整步骤、CI 链路、环境隔离、验收及回退见 [Cloudflare 部署指南](docs/CF-DEPLOYMENT.md)。

## 当前行为

- 使用官方 `cloudflare:sockets`，auto 连接原始目标；已删除内置 Cloudflare IP 出口池。
- 配置、拨号选项和异步事件按请求隔离；30 秒内存缓存保存独立快照。KV 跨地区仍是最终一致，可能需要 60 秒或更久。
- HTTPS 代理使用原生 TLS 证书验证；不再使用自实现 TLS。
- 管理会话服务端校验 24 小时有效期；登录限流、同源写入检查、配置校验和上一版本恢复。
- `/login`、`/admin` 为本地页面；`/admin` 固定使用本仓库自带的管理面板，上游远程面板的代理路径已移除。
- 日志使用脱敏 Workers Logs，不再更新单个 KV 大 JSON；用量统计在后台刷新。
- 原客户端订阅保持；Clash 订阅默认由本地直出（代理组 + 精简分流规则，不依赖第三方转换器），`&converter=1` 可回落转换器；`native=1` 可选择 Clash/Mihomo 或 sing-box 最小原生配置，支持范围见部署指南。

## 维护

[模块职责与依赖规则](docs/MODULES.md) · [当前架构边界](docs/ARCHITECTURE-LIMITS.md) · [排障历史](docs/TROUBLESHOOTING.md) · [旧 README 快照](docs/HISTORY-README.md)

协议/传输改动必须运行数据面回归和 workerd 集成测试。测试通过不替代真实 CF 边缘、客户端和负载验证。

## 来源与许可

分叉自 [cmliu/edgetunnel](https://github.com/cmliu/edgetunnel)。沿用仓库 [GPL-2.0 许可证](LICENSE)；上游致谢与历史变更保留在旧 README 快照中。
