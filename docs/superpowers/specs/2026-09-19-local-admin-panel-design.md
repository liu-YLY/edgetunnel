# 本地内嵌管理面板 设计文档

日期：2026-09-19
状态：已获用户确认（方案 A：单文件内嵌模块）

## 背景与目标

当前 `/admin` 默认渲染的是 [panel.js](src/admin/panel.js) 里精简的"配置管理"页（JSON 编辑器 + env 只读表）。用户希望面板功能更丰富、页面更美观、交互更优雅，同时保持本仓库"单文件发布、运行时零外部依赖"的纪律。

目标：
1. 四个功能模块：节点与订阅展示、配置编辑增强、用量与日志概览、平台运维入口；
2. 美观：深色主题（延续现有 `#0f1420` 配色）、卡片布局、响应式（移动端单列）、SVG 图标；
3. 交互优雅：SPA Tab 切换、Toast 提示、保存 loading、表单脏检查；
4. 性能：首屏服务端注入 config 摘要，减少一次请求；全部原地 fetch，无整页跳转。

## 非目标（YAGNI，首版不做）

- 日志详情页（以"跳转 Workers Logs"引导代替）
- WebSocket 实时推送
- 多语言切换
- 多管理员 RBAC
- 任何外部 CDN / 前端框架依赖

## 架构

- 新增单一模块 `src/admin/ui.js`，导出 `管理面板HTML(env, config_JSON)`，返回完整 HTML 字符串（HTML 骨架 + 内联 CSS + 内嵌客户端 JS）。
- 改造 [main.js](src/main.js) 的 `/admin` GET 分支：默认渲染新面板；`REMOTE_ADMIN=true` 的远程分支保留在前（兼容旧行为）。
- `管理面板配置页HTML`（panel.js）被替代；`请求日志记录`（panel.js 同文件导出）保留不动。
- 构建零改动：`build.js`、`scripts/verify.js`、`npm run check` 全部不变。
- 数据全部复用现有 `/admin/*` API；仅新增 2 个轻量接口。

## 页面结构

单页 SPA，四个 Tab：

| Tab | 内容 | 数据来源 |
|---|---|---|
| **概览** | 用量环形图（当前 total/max）+ 近 30 天趋势柱状图（SVG）+ 运行状态摘要卡（协议/传输/Fingerprint/出站模式/ECH/0RTT/SS 加密） | `config_JSON.CF.Usage` 首屏注入 + `GET /admin/api/usage-history` |
| **节点与订阅** | 主节点卡：VLESS 链接一键复制 + 二维码（内嵌轻量 QR 实现）；订阅链接列表（通用 `/sub?token`、Clash 原生、sing-box 原生）带复制；客户端格式链接（clash/singbox/surge/loon/quanx/v2rayn/shadowrocket） | `config_JSON.LINK`、`优选订阅生成.TOKEN` 首屏注入 + 现有 `/sub` |
| **配置** | JSON 编辑器 + 保存到 KV + 恢复上一版本（保留现有能力）；新增常用字段表单区，提交 = 读当前 cfg JSON 合并后 `POST /admin/config`；env 只读表 | `GET /admin/config.json`、`POST /admin/config`、`POST /admin/config/restore` |
| **运维** | TG 通知配置、CF API 凭据（掩码显示）、自定义优选 IP（ADD.txt）编辑、重置初始化（二次确认）、用量手动刷新 | `GET/POST /admin/tg.json`、`/admin/cf.json`、`/admin/ADD.txt`、`POST /admin/init`、`POST /admin/getCloudflareUsage` |

## 新增接口与用量历史

### `GET /admin/api/usage-history`

- 会话鉴权（复用 `验证会话`），返回 KV `usage:{host}` 的 30 天快照数组 `[{date, workers, pages, total, max}]`；KV 无键或读取失败返回空数组 `[]`。

### 用量快照写入

- 挂在 [config/index.js](src/config/index.js) 现有用量刷新 waitUntil 成功回调之后：按 **host + 当日日期** 去重（读-改-写），仅在日期变化时新落一条；一天 1 次/域。
- KV key：`usage:{host}`，数组按日期升序，超出 30 天裁剪。
- **诚实声明**：KV 无原子追加，读-改-写存在极小竞态窗口，极端并发下可能丢一天快照；面板展示场景可接受，不引入 D1/DO 解决。

### 日志

- 面板内"日志/访问"区域放"跳转 Cloudflare Workers Logs 控制台"引导卡（含 Workers 名称），**不恢复 KV 日志写入**；`OFF_LOG` 语义不变。

## 安全与错误处理

- 新增接口沿用现有会话鉴权（`验证会话`）+ 登录限流；写操作沿用 `同源写请求` 校验。
- 客户端：所有 fetch try/catch + 错误 Toast；4xx/5xx 解析 JSON `error` 字段内联展示；保存 loading 态。
- 凭据：展示一律 `掩码敏感信息`，明文只在服务端保存时处理。
- XSS：注入模板的 host/config 摘要一律经 `转义HTML`；客户端拿到的 JSON 只用 `textContent` 渲染。
- 关键写操作（重置初始化）二次确认对话框。

## 测试与构建

- 新增 `scripts/test-ui.cjs`（并入 `npm test`）：
  1. `ui.js` 可正常加载；输出 HTML 含四个 Tab、首屏注入摘要、二维码容器；
  2. 转义/XSS：构造含 `<script>`、双引号的 config/env 值 → 断言输出中无未转义注入；
  3. `usage-history` GET 返回数组、快照合并去重与 30 天裁剪逻辑（mock env.KV）。
- `npm run build` 产物大小增幅预期 +30~60KB（含 QR 实现）。
- `npm run check`（模块边界扫描）需覆盖 `ui.js` 无隐式依赖。

## 验收标准

1. `npm run check` 与 `npm test` 全绿；
2. `/admin` 登录后展示新面板，四个 Tab 可切换；
3. 概览显示当前用量与 30 天趋势（数据来自 KV 快照，首次为空数组不报错）；
4. 节点链接可复制、二维码可扫描；订阅链接/Clash 原生/sing-box 原生链接可复制；
5. 配置表单区保存后 cookie 会话保持，KV `cfg:{host}` 写入生效，恢复上一版本可用；
6. TG/CF/ADD.txt 表单读写正常，凭据掩码展示；
7. `REMOTE_ADMIN=true` 时仍走旧远程分支；
8. 移动端单列布局正常。