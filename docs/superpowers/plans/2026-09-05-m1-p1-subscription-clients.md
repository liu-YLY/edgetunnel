# M1-P1 订阅客户端生成（先扩 4 个）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 前置：M0 工程底座与 M1-P0 已入库（main）。本计划全部基于 `/workspace/src/**` 源码模式开发，产物由 `node build.js --force --out _worker.js` 生成并提交。

**Goal:** 把 `/sub` 订阅从现有 Clash/SingBox/Surge 三种扩展到 10 种客户端（本轮先做 Loon / QuantumultX / Shadowrocket / V2rayNG 四个），按 User-Agent 自动分流。

**Architecture:** 沿用 edgetunnel 现有"订阅转换器 + 热补丁"链路：`/sub` 路由按 UA/target 选格式 →（可选）请求 `订阅转换URL`（`config_JSON.反代.SUBAPI`，即 `SUBAPI.<域>ssss.net`）→ 调用对应 `xxx订阅配置文件热补丁(content, url, config_JSON)` 修复节点配置；对不支持转换器目标、结构简单的客户端（Shadowrocket / V2rayNG）由 Worker 直接从节点列表拼 VLESS/Trojan 明文订阅，**零外部依赖**。

**Tech Stack:** 纯 JS 全局函数（拼接构建，无 import/export）、node 内置测试（scripts/test-subscribe.js）、GitHub Actions（在 build.yml 增加步骤）。

---

## 0. 现状锚点（必须读代码确认后再动手）

- `/sub` 路由：`src/main.js` L296-493；UA 分支在 L329-334（`clash/meta/mihomo` → `clash`；`singbox/sing-box` → `singbox`；`surge` → `surge&ver=4`），订阅类型在 L311 附近从 `ua`/查询参数判定。
- 热补丁函数（全部顶层作用域，签名固定）：
  - `Clash订阅配置文件热补丁(Clash_原始订阅内容, config_JSON)` —— `src/subscribe/format-clash.js`
  - `Singbox订阅配置文件热补丁(SingBox_原始订阅内容, config_JSON)`（async）—— `src/subscribe/format-singbox.js`
  - `Surge订阅配置文件热补丁(content, url, config_JSON)` —— `src/subscribe/format-surge.js`
- 转换器如何被调用：L452 `fetch(订阅转换URL, { headers: UA })`；L455 surge 分支热补丁；`订阅转换URL` 的来源需在实施时追到 `config_JSON.反代.SUBAPI` 与 `scu` 配置。
- 节点链接生成函数（用于 Shadowrocket/V2rayNG 直出）在 `src/subscribe/*` 上游：L400 起生成 VLESS/Trojan/LINK 格式（`协议类型://...`），实施时确认其名称（如 `生成配置`/`LINK数组` 系列）并复用，不要重写。

## 1. 文件结构（本计划产出）

```
src/subscribe/
  format-clash.js / format-singbox.js / format-surge.js   # 现有，不动
  format-loon.js          # 新增：Loon 热补丁
  format-quanx.js         # 新增：QuantumultX 热补丁
  format-shadowrocket.js  # 新增：直出明文订阅
  format-v2rayn.js        # 新增：直出明文订阅
scripts/
  test-subscribe.js       # 新增：订阅分流 golden 测试
.github/workflows/build.yml  # 修改：追加 test-subscribe 步骤
README.md                 # 修改：客户端适配表 + 订阅说明
```

## 2. 任务拆分

### Task M1-P1-0 订阅类型解析与 UA 映射表

**Files:** Modify `src/main.js`（`/sub` 分支 L296-493）、Create `src/subscribe/format-*.js`（任务 2-5 各自建）

- [ ] **Step 1**：把 `/sub` 分支里嵌套的 UA/参数判定（L329-334）重构为一张映射表（保持对已有 `clash`/`singbox`/`surge` 的行为完全不变，只做"读出订阅类型"）：

```js
// 订阅类型解析：查询参数 > UA 关键词（顺序敏感，长词在前）
const 订阅类型映射表 = [
  { 类型: 'loon',         参数: ['loon'],         UA: ['loon'] },
  { 类型: 'quantumultx',  参数: ['qx', 'quanx'],  UA: ['quantumult%20x', 'quantumult x'] },
  { 类型: 'shadowrocket', 参数: ['shadowrocket'], UA: ['shadowrocket'] },
  { 类型: 'v2rayn',       参数: ['v2rayn', 'v2rayng'], UA: ['v2rayn', 'v2rayng'] },
  { 类型: 'clash',        参数: ['clash', 'meta', 'mihomo'], UA: ['clash', 'meta', 'mihomo'] },
  { 类型: 'singbox',      参数: ['sb', 'singbox'],  UA: ['singbox', 'sing-box'] },
  { 类型: 'surge',        参数: ['surge'],       UA: ['surge'] },
];
function 识别订阅类型(ua小写, url) {
  for (const 项 of 订阅类型映射表) {
    if (项.参数.some(p => url.searchParams.has(p))) return 项.类型;
    if (项.UA.some(k => ua小写.includes(k))) return 项.类型;
  }
  return 'clash'; // 默认
}
```
- [ ] **Step 2**：确认旧逻辑的"优先级"（参数优先于 UA，L329-334 顺序）被新映射表等价保留；`surge&ver=4` 的 `ver=4` 逻辑放到 surge 分支内处理（L342 的协议类型判定与 L455 热补丁调用保持原样）。
- [ ] **Step 3**：跑 `node build.js --force --out _worker.js && node --check _worker.js`，确认重构后行为不变（旧的 clash/singbox/surge 静态测试见 Task 6）。

### Task M1-P1-1 format-loon.js（转换器 + 热补丁）

**Files:** Create `src/subscribe/format-loon.js`

- [ ] **Step 1**：新文件提供全局函数 `Loon订阅配置文件热补丁(content, url, config_JSON)`（签名与 Surge 一致），只处理 Loon 特有的差异（参考现有 Surge 热补丁的"规则集/节点 Server 字段"模式，实施时以实际转换器输出为准）：
  - 节点行 `server` 必须是域名/IP 标量，IPv6 带 `[]`；
  - 策略组最小集：节点选择 / 全球直连 / 广告拦截（引用 `config_JSON.反代.SUBCONFIG` 同源的 Loon 规则或复用现有远端规则 URL）。
- [ ] **Step 2**：`src/main.js` 的请求转换器段落（L452 fetch 前）为 loon 追加转换参数：`url.searchParams` 透传 `&target=loon`（转换器 target 名以实测为准，实施时用 `?target=` 试连确认）。热补丁调用：`订阅内容 = Loon订阅配置文件热补丁(订阅内容, url, config_JSON)`。
- [ ] **Step 3**：README 客户端适配表加 Loon。

### Task M1-P1-2 format-quanx.js（转换器 + 热补丁）

**Files:** Create `src/subscribe/format-quanx.js`

- [ ] **Step 1**：`QuantumultX订阅配置文件热补丁(content, url, config_JSON)`：QuanX 远端规则是 `[filter_remote]` 段（ACL4SSR 提供），节点段 `[server_local]` 的 VLESS/Trojan 行格式与 clash 不同，只做字段级修正（`tls-host`/`sni`/`obfs-path`）。
- [ ] **Step 2**：转换器调用追加 `&target=quanx`；热补丁接入 `/sub` 分支。
- [ ] **Step 3**：README 补 QuantumultX。

### Task M1-P1-3 format-shadowrocket.js（直出明文订阅，零转换器依赖）

**Files:** Create `src/subscribe/format-shadowrocket.js`

- [ ] **Step 1**：全局函数 `生成Shadowrocket订阅(节点链接列表, 完整节点路径, config_JSON)`：直接用节点链接生成函数（Task 0 里确认的 LINK 生成器）产出 `vless://`/`trojan://` 逐行拼接（每行带 `#节点名`），返回 `text/plain; charset=utf-8` 字符串。
- [ ] **Step 2**：`/sub` 分支：`订阅类型 === 'shadowrocket'` 时跳过转换器 fetch，直接响应明文（响应头 `Content-Disposition: attachment; filename=shadowrocket.txt` 可选）。
- [ ] **Step 3**：README 补 Shadowrocket。

### Task M1-P1-4 format-v2rayn.js（直出明文订阅）

**Files:** Create `src/subscribe/format-v2rayn.js`

- [ ] **Step 1**：同 Task 3：`生成V2rayN订阅(节点链接列表, 完整节点路径, config_JSON)`，输出 VLESS/Trojan URI 逐行（V2rayN 原生支持）。
- [ ] **Step 2**：`/sub` 分支接入；V2rayNG 的 UA 也命中 v2rayn（映射表已含 `v2rayng`）。
- [ ] **Step 3**：README 补 V2rayN/V2rayNG。

### Task M1-P1-5 测试 scripts/test-subscribe.js

**Files:** Create `scripts/test-subscribe.js`、Modify `.github/workflows/build.yml`

- [ ] **Step 1**：仿 `scripts/test-config.js` 的 bundle 方式（transform `export default {` → `globalThis.__worker = {` + 注入测试体 + node 子进程执行），测试：
  - `识别订阅类型`：UA `Shadowrocket/2.x` → shadowrocket；`Quantumult%20X` → quantumultx；带 `?loon` → loon；无关 UA → clash（默认）。
  - 直出格式：`生成Shadowrocket订阅`/`生成V2rayN订阅` 传入 mock 节点列表（构造 1 个 VLESS、1 个 Trojan），断言每行以 `vless://`/`trojan://` 开头且含 `#` 备注。
  - 热补丁不抛异常：`Loon订阅配置文件热补丁`/`QuantumultX订阅配置文件热补丁` 用 mock 转换器输出（取现有 clash 输出的样例文本）跑通（只断言不抛错 + 返回非空字符串）。
- [ ] **Step 2**：`build.yml` 新增 step `run: node scripts/test-subscribe.js`。
- [ ] **Step 3**：本地全绿：`node scripts/verify.js && node scripts/test-config.js && node scripts/test-subscribe.js`。

### Task M1-P1-6 收尾

- [ ] 重新 `node build.js --force --out _worker.js`，提交 `_worker.js` 产物；README 客户端适配表同步；
- [ ] 回归清单（见 §4）全绿。

## 3. 部署影响（硬约束：不增加部署负担）

- 零新绑定、零新必填变量；新增客户端全部由现有 `KV`/env 配置驱动（无新增键）；
- `SUBAPI`（转换器）仍是可选项：Shadowrocket/V2rayNG 走直出，不依赖它也能出订阅；Loon/QuanX 依赖转换器（README 注明）；
- 订阅端点路径 `/sub?token=...` 不变，存量 clash/singbox/surge 生成链路的输入输出**逐字不变**（重构只重排分支判定，不改生成逻辑）。

## 4. 通用验收 / 回归清单（合入前全绿）

- [ ] `node build.js --force --out _worker.js` 可重现；`node scripts/verify.js` 通过
- [ ] `node scripts/test-config.js`、`node scripts/test-subscribe.js` 通过
- [ ] 存量 clash/singbox/surge：相同 UA + 相同参数下，变更前后 `/sub` 响应一致（Task 0 Step 3 的等价性验证）
- [ ] 四种新 UA 各自返回合法格式（能导入对应客户端，至少 schema 级不报错）
- [ ] CI：build.yml 新步骤在 push 时执行（模拟：本地跑同名命令）
- [ ] README 部署章节/客户端适配表与实际行为一致

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| 转换器 target 名（loon/quanx）与实测不符 | 先用 `?target=` 试连真实 `SUBAPI` 确认参数名，再固化进代码；热补丁按"字段修正"而非"整段重写"，可靠性优先 |
| 重构 UA 判定引入顺序回归 | 映射表保持"长词在前"等旧优先级；用 Task 0 Step 3 的等价性单测兜底 |
| 直出订阅缺 WS/TLS 参数（shadowrocket/v2rayn 需要完整 transport 参数） | 直接复用现有节点链接生成器（L400 系函数），它已带 ed/WS 参数；测试断言含 `path=`/`security=` 类键 |