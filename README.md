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

## 代理链接生成

登录 `/admin`，在「节点与订阅 → 生成链接」选择 VLESS、Trojan 或 Shadowsocks，输入入口地址、端口、路径和备注后点击「生成预览」。VLESS/Trojan 可选 WebSocket、gRPC、XHTTP；Shadowsocks 仅支持 WebSocket。生成结果可复制或打开、下载二维码。预览不会保存配置，也不会改变已有订阅。

链接使用当前实例的 UUID、SNI、指纹及相关配置。入口地址和端口必须由实际部署支持；生成成功只证明链接格式有效，不代表目标网络可达或客户端已连接。节点链接含访问凭据，请勿公开分享。

同页可从已保存的 ADD.txt 或当前优选结果批量生成。批量结果保留地址备注，按地址和端口去重，单次最多扫描 500 个候选、返回 100 条；外部订阅 URI、优选 API 指令及路径代理指令会跳过并计数。支持逐条复制、复制全部和下载 TXT。读取当前优选结果可能触发配置中的远端优选接口，仅在点击时请求；普通订阅与批量预览最多读取 8 个远端优选源；批量页面显示跳过数量，本地生成订阅通过 X-Preferred-Sources-Skipped 响应头报告。

二维码由登录后的浏览器本地生成，不会为每次打开二维码新增 Worker 请求或服务端编码 CPU。`browser/qr.js` 在构建时内联到管理页；`src/admin/qr.js` 是可重现的生成文件。

节点工作区提供参数/结果双栏预览（移动端单栏），批量结果支持本地搜索、每次显示 20 条、逐条二维码和参数检查。搜索只影响展示，复制全部和 TXT 导出仍包含本次生成的全部节点。

「检查已有链接」可解析 VLESS、Trojan、SS 的入口、传输、TLS、SNI、路径与 ALPN，并比对当前实例认证。检查在浏览器执行，不发送链接，不在报告中显示认证凭据；参数检查通过不代表网络可达或代理客户端已连接。

主节点、预览、批量及 `/sub` 共用 `src/core/link.js` 的节点模型与序列化器。订阅保留 SS 端口映射、插件转义、转换器和订阅生成器等明确的兼容选项；17 组历史输出纳入回归：15 组逐字一致，2 组仅忽略随机目录前缀。

「当前优选」会展示来源诊断，区分超时、HTTP 错误、空列表、解析失败、响应大小/重定向限制及内置地址段兜底。来源请求最多 4 个并发，每源响应体限制 512 KiB、最多跟随 2 次重定向，超时覆盖响应头和响应体读取。诊断不回显来源 URL 中的凭据或 token。远端来源全部未返回节点时，订阅返回 502，避免以空成功结果覆盖客户端旧节点。

## 维护

[模块职责与依赖规则](docs/MODULES.md) · [当前架构边界](docs/ARCHITECTURE-LIMITS.md) · [排障历史](docs/TROUBLESHOOTING.md) · [旧 README 快照](docs/HISTORY-README.md)

协议/传输改动必须运行数据面回归和 workerd 集成测试。测试通过不替代真实 CF 边缘、客户端和负载验证。

## 来源与许可

分叉自 [cmliu/edgetunnel](https://github.com/cmliu/edgetunnel)。沿用仓库 [GPL-2.0 许可证](LICENSE)；上游致谢与历史变更保留在旧 README 快照中。
