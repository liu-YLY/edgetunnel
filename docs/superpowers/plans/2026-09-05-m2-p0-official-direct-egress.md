# M2-P0 出站"官方直连"化 + wk/rm 消费实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 前置：M0 / M1-P0 / M1-P1 已入库。本计划基于 `/workspace/src/**`，产物由 `node build.js --force --out _worker.js` 生成并提交。

**Goal:** 把默认出站从"依赖第三方动态反代域名（`{colo}.{特征码}.SsSs.nEt`）"改为"内置 Cloudflare 官方地址直连 + 多候选竞速兜底"，并让 M1-P0 预留的 `wk`/`rm` path 参数真正接入出站选择；`p`（手动 ProxyIP）与 `env.PROXYIP` 优先级不变。

**Architecture:** 引入"出站模式"三层选择：`auto`（默认，官方地址列表直连）> `region`（wk 指定地区时启用旧的 colo 反代域名模板）> `manual`（p / env.PROXYIP 手填优先）。默认反代 IP 生成从 `src/config.js`（全局读取配置）下移到 `src/transport/forward.js`（直连/反代候选构建处），并复用现有"并发打开候选连接 + 预加载竞速 + 失败兜底"机制做官方地址多路竞速。`wk`/`rm` 的消费点在 `src/proxy/preferred.js`（反代参数获取）补齐。

**Tech Stack:** 纯 JS 全局函数（拼接构建）、node 内置测试（扩展 `scripts/test-config.js`）、GitHub Actions（build.yml）。

---

## 0. 现状锚点（先读代码确认）

- 默认反代 IP 生成：`src/config.js` 的 `全局读取配置` L277-294：`默认反代IP = (\`${request.cf.colo}.${特征码字典[0]}.${特征码字典[1]}SsSs.nEt\`).toLowerCase()`；`env.PROXYIP` 存在则随机取一并 `默认反代兜底=false`。
- 出站接线：`src/transport/forward.js`：
  - `connectDirect(address, port, data, 启用预加载)` —— A/AAAA 预加载竞速（L97-149）
  - `connectProxyIP(address, port, data, 所有反代数组, 启用反代失败兜底)`（L151-180）—— `解析地址端口(ctx反代IP, host, yourUUID)` 拆出候选列表 → `并发打开候选连接`（L74-95）
  - 兜底链：`ctx反代兜底` 开启时反代失败回落直连（L178）
- 已预留字段：`src/proxy/preferred.js` 的 `反代参数获取`（M1-P0 加入 `p`/`wk`/`rm`/`s`，其中 wk/rm 目前只记录不消费；注释标明 M2 接入）。
- 配置默认值表：`src/config.js` 头部 `const … = { 反代: { SOCKS5… } }`（L51-140 区间），KV `cfg:{host}`（M1-P0）已能覆盖 env/默认值。

## 1. 参数与数据结构

新增配置键（默认值表 + env/KV 可覆盖；缺省即 `auto`，老用户零配置零迁移）：

```js
// src/config.js 默认值表（反代 段内新增）——字段名即 KV/面板配置键
出站: {
  模式: 'auto',            // 'auto' 官方直连 | 'region' 地区反代（需 wk）| 'manual' 手填 ProxyIP
  地区: '',                // 等同 wk；留空按默认
  官方地址列表: [           // 事实数据：Cloudflare 官方 IP（/24 段内实测可用地址）
    '104.16.0.1:443',      // 实施时回填 10 个分布在 10 个 /24 段、实测 443 可达的地址，
    // … (来源：Cloudflare 官方公开 IP 段中实测；每项带注释说明段与来源，避免误导)
  ],
}
```

优先级（跨层，最终写入 `反代上下文` 供 forward 使用）：
`path p > path wk(region 模式) > env.PROXYIP > 默认(auto 官方列表 > 旧 colo 域名模板不再作为默认)`

## 2. 任务拆分

### Task M2-P0-0 出站模式默认值与地址表

**Files:** Modify `src/config.js`、Modify `src/transport/dial.js`（或新建 `src/transport/官方地址.js` 常量文件）

- [ ] **Step 1**：默认值表 反代 段新增 `出站` 键（结构见 §1）。`官方地址列表` 实施时：用 CF 官方 IP 段随机抽样 + 443 握手（`isSpeedTestSite`/`/cdn-cgi/trace` 现成探测逻辑）实测可用 10 个，按 /24 分散排列并注释来源数组段。
- [ ] **Step 2**：`全局读取配置` 返回值扩展：`出站模式`（读 `出站.模式`，缺省'aut'→'auto'）、`官方地址列表`；**停用**默认生成 `{colo}.{特征码}.SsSs.nEt` 域名——`默认反代IP` 仅当 `env.PROXYIP`/配置手填时非空。
- [ ] **Step 3**：验证 `node build.js --force --out _worker.js && node --check`；`scripts/test-config.js` 加 2 条断言：无任何配置时 `出站模式==='auto'`、`官方地址列表.length===10`。

### Task M2-P0-1 auto 模式：官方地址多候选直连

**Files:** Modify `src/transport/forward.js`

- [ ] **Step 1**：`forwardataTCP` 拿到 `反代上下文` 后，若 `ctx反代IP` 为空且 `ctx出站模式==='auto'`：走新分支 `直连官方地址列表(address, port, data, 首包数据)`：
  - 候选 = 官方地址列表（先打乱顺序，避免每次固定第一个被墙后全灭）；
  - 复用 `并发打开候选连接` + `构建预加载竞速候选列表` 同款机制：对每个候选 `解析地址端口(官方地址, host, yourUUID)` 目标会话；
  - 逐个失败 → 下一个；全部失败 → 抛带上下文的错误（日志 `[官方直连] 全部 N 个官方地址连接失败`），不静默。
- [ ] **Step 2**：原"反代失败回落直连"（L178）在 auto 模式下语义变为"官方地址全部失败后直连原始 host"仍保留（`ctx反代兜底` 为 true 时）。
- [ ] **Step 3**（等价性）：`p`/env.PROXYIP 存在时走原 `connectProxyIP` 路径（manual），与 Task 0 前行为一致。

### Task M2-P0-2 region 模式：wk 消费 + rm 语义修正

**Files:** Modify `src/proxy/preferred.js`、Modify `src/config.js`（`全局读取配置` 的默认反代逻辑）

- [ ] **Step 1**：修正 `反代参数获取` 的 wk/rm 逻辑（M1-P0 现行为：`地区匹配 = includes(rm)`，rm 缺省=false）改为：
  - `rm` 语义：`rm=no` → 强制关闭地区匹配；`rm` 缺省/`yes/true/on` → 开启（由模式下决定是否真正生效）；
  - `wk` 指定且 `出站模式==='region'` → `反代IP = \`${wk}.${特征码字典[0]}.${特征码字典[1]}SsSs.nEt\``（旧 colo 模板在 region 模式下作为"指定地区出口"复用），`跳过地区匹配=false`；
  - `auto` 模式 + 无 `p` → `反代IP` 保持空，走 Task 1 官方直连；
  - `p` 写入手填 → 互斥跳过 wk（保持 M1-P0 行为）。
- [ ] **Step 2**：`全局读取配置`/fetch 入口的 `默认反代IP` 计算与 `出站模式` 联动：`env.PROXYIP` 存在 → `manual`（覆盖模式）；否则 `auto`。
- [ ] **Step 3**：`scripts/test-config.js` 场景 5 新增：`反代参数获取(new URL('?wk=hk&rm=no'))` → 地区匹配关闭；`?wk=hk`（region 模式）→ `反代IP` 含 `hk.` 前缀；带 `p=` → `p` 生效且 wk 忽略（保持）。

### Task M2-P0-3 README 与部署说明

**Files:** Modify `README.md`

- [ ] **Step 1**：部署章节"变量表"加 `出站.模式` 说明（auto/region/manual 三选一，缺省 auto）；"行为变更"小节：升级后默认不再请求第三方 `{colo}.{特征码}.SsSs.nEt` 域名，改走官方地址直连；想保持旧地区行为 → 显式配 `wk` + `region`。
- [ ] **Step 2**：path 覆盖小节的 `wk`/`rm` 行由"预留字段"改为"端到端生效"（附 region 模式说明）。

### Task M2-P0-4 收尾与 CI

- [ ] `node build.js --force --out _worker.js` 提交产物；`scripts/test-config.js` + `scripts/verify.js` 全绿；build.yml 无需新增步骤（test-config 已在跑），确认 push 复跑通过；
- [ ] 回归：旧部署（仅 ADMIN+KV，无任何出站配置）行为 = auto 官方直连，无第三方依赖；`env.PROXYIP` 老配置走 manual，与升级前一致。

## 3. 部署影响（硬约束）

- 零新绑定、零新必填变量；新增 `出站.*` 配置键全部有默认值（auto），KV 缺键回退正常；
- 存量"仅 ADMIN+KV"部署升级后**默认行为变化**（官方直连替代第三方域名）——安全性增强，README 显著说明，不接受静默变化；
- `_worker.js` 仍是唯一部署产物；CF Pages / 粘贴 / wrangler 路径均不变。

## 4. 通用验收 / 回归清单

- [ ] `node scripts/verify.js` / `node scripts/test-config.js`（含场景 5）全绿；可重现构建
- [ ] 无配置时：`出站模式==='auto'`、无 `p`/wk 时 `反代IP` 为空、forward 走官方多候选竞速（代码路径断言：日志关键字 `[官方直连]`）
- [ ] `p=…`：manual 覆盖，路径与升级前逐字一致
- [ ] `wk=hk` + region：`反代IP` = `hk.…SsSs.nEt`；`rm=no`：地区匹配关闭
- [ ] `env.PROXYIP`：manual，随机取一 + 兜底关闭（与旧行为一致）
- [ ] README 变量表/行为变更说明与实际一致

## 5. 风险与对策

| 风险 | 对策 |
|---|---|
| 官方地址列表时效性（个别段被墙/失效） | 10 个 /24 分散 + 每个连接打乱顺序 + 逐个失败自动换下一个；README 说明可自行在 KV 覆写列表 |
| 默认行为变化引发老用户困惑/投诉 | README "行为变更"醒目说明；`region` 模式一键回到旧逻辑 |
| 预加载/竞速路径误伤直连稳定性 | Task 1 复用现有竞速机制与超时，仅换候选来源；test-config 断言前向兼容（p/manual 不变） |
| 重启依赖第三方域名的影响面 | 官方列表 = 内置常量，运行时零外部 DNS/API 依赖（除目标访问本身） |