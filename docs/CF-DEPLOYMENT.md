# Cloudflare 部署与本次修复

更新：2026-09-16。本文件和根 README 描述当前实现；旧里程碑的线上结果不作为本版本发布证据。

## 本地验证

需要 Node.js 22+。依赖锁定在 package-lock.json。

```sh
npm ci
npm run build
npm run check
npm run test:runtime
npm run deploy:check
```

- `check`：ES Modules 依赖边界、隐式引用、循环依赖、构建一致性、语法，以及直接导入源码的配置/订阅/回归测试。
- 源码职责和平台模块入口见 [模块化说明](MODULES.md)；部署仍使用 esbuild 生成的单文件 `_worker.js`。
- `test:runtime`：workerd，临时 KV、虚构凭据、本地 TCP echo，验证真实 Worker 路由和 VLESS/Trojan/SS 的分片 WS 双向数据面。需要允许监听回环端口。
- `deploy:check`：Wrangler 打包 dry-run，不部署。
- 本地测试不能证明 CF 边缘出站、跨地区 KV 同步、真实客户端兼容或生产容量。

## 环境隔离

根 wrangler.toml 保留已有生产名称及 KV。staging 有独立名称，不继承生产 KV/Secrets。

1. `npm exec -- wrangler kv namespace create KV --env staging` 创建独立测试 namespace。
2. 将返回 id 填入 `[[env.staging.kv_namespaces]]`；不要复用生产 id。
3. 分别执行 `npm exec -- wrangler secret put ADMIN --env staging`、`KEY`、`UUID`，交互输入独立测试值。UUID 使用 UUIDv4。
4. 运行 `npm run deploy:staging`。仅在明确配置 staging 资源后执行。
5. 完成测试域名验收后，单独决定生产发布。`npm run deploy` 指向顶层生产环境。

本地 `npm run dev` 使用 staging 配置；测试凭据放 `.dev.vars.staging`，已忽略提交。不要在命令行中明文提供生产密码。保留 compatibility_date，新增原生 AsyncLocalStorage 所需 nodejs_als；日期升级另行验证。

## 行为变化与迁移

- 出站使用 `cloudflare:sockets`；auto 仅连接原始目标，不再尝试内置 CF IP。平台不支持的目标将失败；需要受控的可达代理出口时显式配置 PROXYIP/SOCKS/HTTP/HTTPS。region 仍是显式启用的旧外部依赖。
- 所有 HTTPS 代理统一使用原生 TLS；不再绕过证书校验。IP 代理证书不匹配时应改用证书匹配的域名，不能通过关闭验证恢复。
- 管理会话改为 HMAC-SHA256 签名、24 小时服务端过期，并绑定 host/UA。旧 Cookie 失效，需重新登录；订阅 UUID/token 派生规则未改。
- `/admin` 默认本地 JSON 配置页面。`REMOTE_ADMIN=true` 才使用旧远程面板，该面板不是本仓库可控资源；新接口变化可能需要同步适配。
- `/admin/init` 改为 POST；`/admin/getCloudflareUsage` 改为 POST JSON，禁止 API 凭据出现在 URL。
- `/admin/config` 保存时校验、生成版本/时间、保留一个 `cfg:{host}:previous`；POST `/admin/config/restore` 可恢复。旧 config.json 也保留 previous，两个入口不构成跨键事务。
- 不再写 KV `log.json`，旧日志接口返回空数组；查看 Workers Logs 的结构化 access 事件。OFF_LOG 仍关闭 access 日志。TG 开启时也只发送去掉查询参数后的访问路径。
- 自动 invocation 日志关闭，避免完整 URL 中的订阅 token 被记录。DEBUG 默认关闭；开启前应评估诊断日志内容。
- 用量后台刷新，首次响应可能没有统计；过期统计不会阻塞订阅。额度统计不是流量字节计量。
- 登录有每 isolate 5 次/分钟保护；可绑定 LOGIN_RATE_LIMITER 使用 CF 原生限流。内存限流不是全局强一致限流，不应声称防御分布式攻击。

## 原生订阅的渐进迁移

现有各客户端的转换链保留，避免改变 SUBCONFIG 自定义分流规则。

新增 `/sub?token=…&target=clash&native=1` 和 `target=singbox&native=1`：

- VLESS/Trojan + WS/gRPC，最多 100 个节点；不调用订阅转换器。
- 输出最小本地 mixed 端口和 PROXY 选择组，全部流量走该组；不包含旧 SUBCONFIG 的规则。
- ECH、TLS 分片、SS、XHTTP 等暂不支持，会明确返回 400，不静默降级。
- 本地节点地址来源仍可能调用优选列表接口。要完全离线生成，请在配置中关闭随机 IP 并保存 ADD.txt。
- 其余格式仍使用原转换器。全格式、全高级选项迁移需逐格式客户端验收；本次没有宣称已全部内化。

## 线上验收与回退

在独立 staging 环境验证登录、错误密码、过期会话、配置保存/恢复、订阅导入、WS/VLESS/Trojan/SS、gRPC/XHTTP、合法及无效代理证书、慢下游、长连接断开、失败回退。

记录握手成功率、首字节延迟、CPU 时间、内存异常、连接失败类别、KV 读写及客户端实际行为。1MB 队列不代表可以并发 128 条连接，禁止通过内存上限相除作容量承诺。没有真实流量测试时，不声称性能提升比例。

发布前保存旧 deployment/version 标识及配置备份。代码问题使用 Cloudflare 版本回滚；配置问题使用 previous 或备份恢复。Secrets 轮换需单独制定客户端迁移计划。

## 官方依据

- [TCP sockets 与 CF 地址限制](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Workers CPU、内存和连接限制](https://developers.cloudflare.com/workers/platform/limits/)
- [KV 最终一致性](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [AsyncLocalStorage](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/)
- [Mihomo VLESS](https://wiki.metacubex.one/en/config/proxies/vless/)
- [sing-box VLESS](https://sing-box.sagernet.org/configuration/outbound/vless/)
