# 代理链接功能验收记录

日期：2026-09-24。分支：`codex/proxy-link-generator`。

## 已修复并复测

- 合法 IPv6 完整写法被 URL 规范化后误判为非法：现接受并规范化，等价写法可在批量结果中去重。
- 主节点及预览链接遗漏 ALPN：现保留配置中的 ALPN，空值不添加参数。
- 优选结果中的逐节点反代规则丢失：相关候选计入跳过数，避免生成改变出口语义的普通节点。
- 切换标签后表单回到默认值、旧链接仍可复制：表单只在页面首次加载时初始化，切换标签保留对应参数与结果。
- 当前优选重复读取 ADD.txt：同次解析只读一次；批量参数校验在读取候选及远端请求之前执行。

## 自动化验证

- `npm run check`：模块边界、可重现构建、配置、订阅、协议回归、UI 脚本语法及链接专项测试通过。
- `scripts/test-links.mjs`：IPv6 规范化/去重、ALPN、反代候选保护、100 条输出/500 条扫描上限、配置不被修改。
- `npm run test:runtime`：本地 workerd 登录、鉴权、输入校验、批量接口和 VLESS/Trojan/SS 双向 WebSocket 到 TCP 回传通过。
- `npm run deploy:check`：Wrangler dry-run 通过；最终上传体积 555.57 KiB，gzip 126.64 KiB。

## 浏览器操作验证

使用 Ego Lite 与本地 workerd 临时 KV、测试 UUID/密码。浏览器通过只监听 loopback 的 HTTP 测试桥访问 workerd；桥将本地 URL/Origin 转为 HTTPS 并去掉测试 Cookie 的 Secure 标记。此方式仅用于本地交互，不验证生产 TLS 或 Secure Cookie 传输。

| 操作 | 结果 |
|---|---|
| 登录 → 节点页 | 可用，主节点含 ALPN |
| Trojan + gRPC + 完整 IPv6 → 预览 | 地址规范化，协议、serviceName、ALPN、备注正确 |
| ADD.txt 批量生成 | 3 行输入生成 2 条，报告 1 条重复，保留备注及来源 |
| 当前优选生成 | 使用本地保存的候选生成 2 条 |
| 下载 TXT | 实际下载文件与页面两条链接逐字一致 |
| 复制单条链接 | 浏览器 Clipboard API 成功提示；未读取系统剪贴板作内容比对 |
| 下载二维码 PNG | 实际下载文件经 `zbarimg` 解码，`cmp` 确认与预览链接逐字一致 |
| 二维码网络请求 | 未产生二维码接口请求，编码在浏览器本地执行 |
| 修改参数 | 旧单条/批量结果失效，复制与下载禁用 |
| 选择 SS | 自动选择 WS，gRPC/XHTTP 选项禁用；SS 预览成功 |
| 切换概览后返回节点页 | 表单与生成链接保持一致 |
| 非法入口地址 | 显示校验错误，旧链接不可复制 |

## 尚未覆盖

- 真实 Cloudflare 边缘 CPU、网络、KV 跨区域传播及资源限额表现。
- 代理客户端实际导入和远端连通，尤其 gRPC/XHTTP。
- 远端优选服务的真实网络可用性；浏览器验收使用本地地址列表。

本轮只进行了本地提交与 dry-run，没有 push 或部署。

## 后续迭代：节点工作区与本地诊断

- 新增浏览器本地链接参数诊断，覆盖 VLESS/WS、Trojan/gRPC、VLESS/XHTTP、SS/WS，以及认证缺失、无效 UUID、无效路由域名、无效路径、超长输入和实例认证差异。
- 生成表单与结果预览双栏展示，完整链接/高级参数按需展开。错误保留输入并聚焦对应字段；错误区预留空间，避免提交按钮在点击时位移。
- 批量列表保留全部生成结果，默认渲染前 20 条；搜索、更多、逐条复制、二维码和检查均在浏览器执行。
- 节点页恢复可见时不再刷新概览用量历史，减少无关的 Worker 请求。

浏览器实测（同上临时 workerd fixture）：

| 项目 | 结果 |
|---|---|
| 端口 70000 后提交 | 错误信息可见，焦点回到端口输入框 |
| Enter 提交生成 | 预览摘要与操作按钮正常更新 |
| 从生成结果检查参数 | 报告正常，认证值未出现在报告内，资源计时记录无新增请求 |
| 粘贴不支持的 HTTPS 链接检查 | 显示参数问题，未声称连通 |
| 27 条批量结果 | 初次显示 20 条，点击更多后显示 27 条 |
| 搜索唯一 IPv6 节点后下载 | 页面只显示 1 条，TXT 正确导出全部 27 条 |
| 375px 竖屏 / 844px 横屏 | 文档宽度等于视口宽度，无横向溢出 |
| 移动端节点页可见按钮 | 高度均不低于 44px |
| 深浅主题辅助文字与卡片背景 | 实测对比度分别 6.29:1 / 5.49:1；这不是全站无障碍认证 |

本次 `npm run check`、workerd 回归与 Wrangler dry-run 通过。最新 dry-run 上传体积 577.63 KiB，gzip 132.60 KiB。真实 CF 边缘和代理客户端连通仍未验证。

## 后续迭代：共享节点模型与优选来源诊断

- 主节点、预览、批量和订阅统一通过节点模型序列化；ECH/TLS 分片参数也共用配置读取函数。
- `scripts/fixtures/link-compat.json` 保存重构前输出。17 组案例覆盖 VLESS/Trojan 的 WS/gRPC/XHTTP、gRPC multi、SS TLS/明文/转换器/生成器、随机路径、IPv6、反代池和链式代理，主节点及订阅输出逐字一致。
- 来源状态区分 HTTP 错误、空列表、解析失败、部分有效、超时、网络错误、大小/重定向上限及兜底，不再制造 `127.0.0.1:1234` 错误节点。
- 来源响应读取限制 512 KiB、最多 2 次重定向、最多 4 个并发；超时包含响应体读取，诊断内容不包含源 URL 和 token。
- `scripts/test-preferred.mjs` 覆盖上述异常及纯文本、两类 CSV、GB2312、Base64 节点、API 备注和反代池。
- workerd 验证普通/Clash 订阅全源失败均返回 502；Clash 不继续回落转换器。管理端仍可读取结构化失败原因。
- 浏览器与本地 HTTP 来源 fixture 验证：正常列表返回两个节点；空响应明确返回空列表；来源无效与 HTTP 503 在批量页自动展开诊断，且不出现假节点。

最终 `npm run check`、`npm run test:runtime`、`npm run deploy:check` 通过。dry-run 上传体积 581.06 KiB，gzip 134.05 KiB。未 push、未部署；生产边缘及真实客户端验收仍未执行。

## Workers 资源边界（2026-09-24）

- 普通订阅与批量预览默认仅请求前 8 个外部优选源；每源最多跟随 2 次重定向、512 KiB、3 秒总超时，最多 4 个并发源。优选源部分最多 24 次 fetch；不代表整个请求的所有子请求总数。
- 超出部分保留来源诊断；本地生成订阅响应头 `X-Preferred-Sources-Skipped` 给出未请求数量。大量源请合并后配置，避免误以为所有源均被请求。
- 配置缓存满 50 项后淘汰最早插入项，避免一次清空引发全量失效。
- 用量数值不变时不写 KV；同日变化最短五分钟更新一次历史，实时查询结果仍正常返回。单域名单条历史在串行读取最新值的条件下至多约 288 次写/天。KV 最终一致，多地域并发不受此本地判断保证；这不是全局限流，也不保证整账户免费写额度。
- 新增普通订阅源数量回归；用量历史测试纳入 `npm test`，覆盖去重、更新间隔、跨日、滚动和损坏数据恢复。
- 对照官方限制：[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[KV limits](https://developers.cloudflare.com/kv/platform/limits/)。免费 CPU 10ms、内存 128MB、外部子请求 50 次；KV 同键写入每秒 1 次。以上边界优化不等于线上 CPU 达标证明。

### 管理页按需加载与编辑保护

- 所有组件初始化后再恢复当前页签，仅加载活动页签。配置与运维首次访问加载，后续切换保留未保存内容；显式重新加载仍有效。
- 自检改为点击按钮触发，恢复/切换页签不消耗外部探测请求。页头按钮明确用于查询用量。
- 页签支持左右方向键、Home/End，只有活动页签进入 Tab 焦点序列。
- Ego + 本地 workerd 实测：恢复节点页的 fetch 从 5 次降至 0；配置 PATH 和 ADD 草稿切换后保留；进入自检 0 请求、状态未检测；方向键焦点正确且只有 1 个页签 tab stop；375px 视口无横向溢出，截图检查通过。
- 使用临时本地 HTTP bridge 与测试凭据；线上 HTTPS Cookie 和真实外部连通性不属于此次浏览器验证。

### 随机路径 CPU 开销

- 目录表移到模块常量，使用部分 Fisher–Yates 抽样，每个节点只抽取 1–3 个不同目录；最多 4 次随机调用，不再复制/随机排序整张目录表。
- 历史链接 17 组回归中，15 组逐字比较，2 组随机路径仅归一化随机目录前缀后比较，其他字段继续逐字比较。新增边界测试覆盖目录去重、查询参数保留与抽样次数。
- 可复现：`node scripts/benchmark-paths.mjs`，固定基线提交 `f14447b`，预热后 7 轮，每轮 1,000 个路径。此次本机 Node 中位耗时：29.569ms → 0.193ms；随机调用：1,696,635 → 3,029。该微基准不代表 Cloudflare 整体请求 CPU、吞吐或线上延迟。
- 最终 `npm run check`、`npm run test:runtime`、`npm run deploy:check` 全部通过；Wrangler dry-run 上传 582.58 KiB / gzip 134.42 KiB。运行时覆盖 VLESS/Trojan/SS WebSocket → 本地 TCP 回传。
- 未 push、未部署；线上 CPU、跨地域 KV 并发与真实客户端连通性需部署环境验证。

## 最终代码审查与修复（2026-09-24）

审查基线 `b67335e`，待审 HEAD `34853eb`。本次功能迭代无已确定但未实现的剩余项；以下是最终审查修复，不再扩展功能范围。

### 确认并修复的问题

| 优先级 | 位置 | 证据与修复 |
|---|---|---|
| P1 | `src/admin/ui/client.js` 编辑命令、loadConfig/loadOps | 从概览的命令面板保存优选 IP，会在未加载 ADD 时提交空内容，使原列表被覆盖。本地浏览器复现原始列表丢失。新增 idle/loading/ready/failed 状态；读取成功前禁用编辑/保存，并在保存处理器再次校验。失败可重试，运维分项重试不重新读取已编辑的 ADD。 |
| P2 | `src/core/link.js` 预览选项校验 | SS 路径 `/ws;host=wrong.example` 原先能进入插件参数，分号导致路径截断或参数歧义。现在拒绝裸分号，提示使用 `%3B`。回归先失败后通过。 |
| P2 | `src/proxy/preferred.js` 生成器入口解析 | 带占位凭据的 `999.999.999.999:99999` 被标为成功。现在共用地址/端口解析，非法项计入 parse_error/partial；合法 IPv6 规范化。回归先失败后通过。 |
| P2 | `src/core/link-diagnostics.js` 入口校验 | 自定义 scheme 的 URL 解析不会严格验证 hostname，`bad%20host` 原先检查通过。现在共用入口校验，拒绝转义空格、非法 IPv4、非法域名。 |
| P2 | `src/admin/ui/client.js` 二维码弹层 | 概览中从命令面板打开二维码时，弹层 open=true 但不可见（位于隐藏节点页内）。弹层移到 body，浏览器验证可见且焦点进入关闭按钮。 |
| P3 | `src/main.js` 批量来源候选 | 当前优选中的完整外部节点链接未传给批量处理器，生成 0 条时跳过也显示 0。现在纳入候选统计，保持不转换的策略。workerd 回归先失败（0≠1）后通过。 |

### 输入与安全边界检查

| 检查项 | 结果 |
|---|---|
| 注入（SQL/命令/模板/响应头） | 新请求路径无 SQL 或 shell 执行；SS 插件分隔符问题已修复。 |
| XSS | 新 UI 动态内容使用 textContent/DOM 构造；HTML 注入数据经过现有转义，QR SVG 由固定元素和数值坐标生成；UI/XSS 测试通过。 |
| 鉴权 | 预览和批量入口处于管理会话保护内；未登录回归返回重定向。 |
| 授权/IDOR | 来源仅从当前实例配置与 ADD 获取；未增加按用户输入任意 KV key 读写的接口。 |
| CSRF | 新 POST 继承同源校验；跨站预览及配置写请求 403 回归通过。 |
| 竞态/状态 | 修复未加载即保存；表单修改使旧预览失效。配置异步隔离回归通过。用量历史 KV 跨地域读改写仍非原子，不能作为全局写入限流。 |
| 会话 | 未修改会话格式/签名；现有过期、篡改、host/UA 绑定回归通过。 |
| 密码学 | 未增加认证算法；随机路径仅为路径变化，不作认证秘密。QR/诊断在浏览器处理。 |
| 信息泄露 | 来源状态只返回分类与序号，不回显来源 URL/token；新诊断不展示认证字段。节点链接本身仍含凭据，为预期的授权导出内容。 |
| DoS/资源 | 来源数、并发、大小、重定向、响应体超时及批量扫描/输出上限有回归覆盖。未做生产压力测试。 |
| 业务边界 | 修复非法入口误报、SS 分隔符、批量漏计；历史链接兼容及随机路径语义回归通过。 |

### 审查覆盖清单

业务代码与 UI 的变更逐项阅读，并沿调用处核对鉴权、输入、KV、外部请求、状态及输出；没有把生成文件的机械 diff 当作独立实现审查。

- 链接/来源：`src/core/link.js`、`src/core/link-diagnostics.js`、`src/core/paths.js`、`src/subscribe/batch-links.js`、`src/subscribe/nodes.js`、`src/proxy/preferred.js`、`src/proxy/source-fetch.js`。
- 请求/存储：`src/main.js`、`src/config/index.js`、`src/services/usage-history.js`（变更及相关调用上下文）。
- 界面：`src/admin/ui/client.js`、`src/admin/ui/index.js`、`src/admin/ui/styles.js`、`src/admin/ui/tabs/nodes.js`（全部变更及相关上下文）；`browser/qr.js`。
- 构建/依赖：`build.js`、`scripts/build-qr-runtime.cjs`、`package.json`、`package-lock.json`。新增依赖固定版本与完整性摘要；未进行第三方依赖全源码安全审计。
- 回归：`scripts/test-links.mjs`、`scripts/test-preferred.mjs`、`scripts/test-runtime.cjs`、`scripts/test-subscribe.mjs`、`scripts/test-ui.mjs`、`scripts/test-usage-history.mjs`、`scripts/benchmark-paths.mjs`。`scripts/fixtures/link-compat.json` 通过全部 17 组语义/字节比较验证。
- 文档：`README.md`、本记录。生成文件 `_worker.js`、`src/admin/qr.js` 通过源码重建一致性、语法、运行时和浏览器执行验证，未逐行人工审查打包依赖。

### 最终验证与结论

- `npm run check`、`npm run test:runtime`、`npm run deploy:check` 均通过。dry-run 上传 586.01 KiB / gzip 135.29 KiB。
- Ego + 本地 workerd：延迟 ADD 读取期间保存/编辑禁用、无 POST；读取完成保留原内容；切换页签保留草稿。优选配置 503 后可重试，重试过程中 ADD 读取次数为 0，草稿不被覆盖。配置加载失败时禁用保存，重新加载后恢复。全局二维码可见并获得焦点。
- 本次确认的 6 项问题全部修复；未发现需要继续阻塞本地迭代收尾的已确认问题。这不是无缺陷保证。
- 发布前仍需真实 CF 边缘 CPU/限额、跨地域 KV 行为，以及代理客户端导入和端到端连通验收（尤其 gRPC/XHTTP）。这些是环境验收项，不是本轮遗漏的功能计划。
- 所有验证使用临时 KV/测试凭据；未 push、未部署。
