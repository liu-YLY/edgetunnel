# 管理面板 P2：连通自检 + 节点订阅增强 + 代理通道诊断

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理面板新增"出口连通自检、节点/订阅增强、代理通道数据采集"三大能力，UI 交互参考官方示例（edt-pages.github.io/admin）的卡片式状态视图，并与 P1 科幻视觉语言融合。

**Architecture:** 自检/探测全部在 Worker（Cloudflare 边缘）内执行 —— 这是唯一能拿到真实网络数据的位置（沙箱实测：局域网 workerd 无外部出口，只能测协议行为、不能测真实时延）。后端新增单一自检接口 `/admin/api/self-check`（快捷 JSON）+ 轻量 `/admin/api/tcp-check`；前端新增"自检"Tab 渲染卡片网格与诊断报告，节点 Tab 增加"代理连通测试"与"优选IP 解析统计"。代理通道优化动作（连接复用参数、握手超时收紧、伪装页头）在部署后采集到真实边缘数据再定（P2.5），本次只落地"可测"。

**Tech Stack:** Cloudflare Workers（workerd / ES Modules）+ 现有管理面板（theme.js/styles.js/client.js + tabs/*）+ miniflare 本地 runtime 测试壳。

---

## 探测结论（2026-09-19 沙箱实测，`scripts/probe-worker.mjs`）

| 项 | 结果 | 含义 |
|---|---|---|
| cloudflare.connect 复用 | 本地全超时（每次 3000ms 打满） | 沙箱无出口，**复用率只能到边缘测**；探测代码协议正确可移植 |
| 黑洞地址握手超时 | 11000ms 预算内实测 11002–11010ms，触发即释放 | `有限代理握手` 10s 预算实测有效；是否收紧需边缘真实数据 |
| fetch 出口（baidu/generate204/CF trace） | 全部 8000ms 超时 | 同上，边缘才会成功 |
| 落地IP 识别 | 未测 | 边缘测 ipinfo/ip.sb 等服务 |

**结论与决策：**
1. 本地永远只能做"协议正确性"验证（runtime 测试），真实网络数据必须部署后在面板"自检"触发采集。
2. 因此 P2 必须先落地"自检/诊断接口 + UI"，再谈优化动作（P2.5）。—— 这就是"先探测再定"的工程化形态。

## 文件结构

- 创建 `src/services/self-check.js` —— 自检执行模块（快捷 fetch 检查 + 深度诊断：连接复用命中率/黑洞超时/伪装页反代头/TCP 抽测）。唯一新后端模块。
- 修改 `src/main.js` —— 挂载两个新路由：`admin/api/self-check`（GET）、`admin/api/tcp-check`（POST/GET，`host`+`port`）。复用既有 `创建请求TCP连接器`。
- 修改 `src/admin/ui/index.js` —— 新 Tab"自检"（数据页 `page-check`）+ 导航第5项 + 快捷键 1–5。
- 创建 `src/admin/ui/tabs/check.js` —— 自检 Tab：卡片网格（国内/国外/CF/落地IP/通道诊断）+ 运行/深度运行按钮 + 结果区。
- 修改 `src/admin/ui/tabs/nodes.js` —— 增加"代理连通测试"卡片（URI 输入 + 协议选择 + 测试按钮）、"优选IP 解析统计"（从 `GET /admin/ADD.txt` 解析行数/去重/样例）+ 按 IP 一键 `tcp-check`。
- 修改 `src/admin/ui/client.js` —— 绑定新元素 id 事件：运行自检、深度自检、节点测试、优选IP 解析、单 IP 测试；沿用既有 `取JSON/取文本/骨架完毕/内联错误/Toast` 等工具。
- 修改 `src/admin/ui/styles.js` —— 若需新增卡片网格/状态徽章/分段控件样式（尽量复用 P1 既有类）。
- 修改 `src/admin/ui/theme.js` —— 状态色（ok/warn/err/run）已具备，通常无需改动。
- 修改 `scripts/test-ui.mjs` —— 断言产物含自检 Tab 元素与胶囊按钮；元素 id 引用断言（已有）自动覆盖新 id。
- 修改 `scripts/test-runtime.cjs`（或新增 `scripts/test-selfcheck.cjs` 并入）—— 登录后 GET `/admin/api/self-check` 断言 200 + quick 结构字段存在；GET `/admin/api/tcp-check` 参数缺失返回 400。
- 清理：删除 `scripts/probe-worker.mjs`、`scripts/run-probe.cjs`（一次性探测壳，结论已入本文档）。

## 接口契约

### GET `/admin/api/self-check` （需登录会话；同源）
- 返回 `{ at: ISO, quick: { 国内: {...}, 国外: {...}, cf: {...}, ip: {...} }, deep: { 未请求 ? null : {...} } }`
- `?deep=1` 时追加深度诊断（顺序执行，预估 8–20s）：
  - `复用率`: 同一 host:port ×6，`{ hits: "4/5", times: [...] }`
  - `超时预算`: `192.0.2.1:443` 实测耗时（5s 预算，触发即算通过）
  - `伪装页`: 配置了 `伪装页URL` 才测：`{ status, headers: { content-type, server, has-cf-ray } }`
  - `代理`: 反代 PROXYIP 建连：`{ ok, ms, error? }`
- 任何单项失败不整体失败：单项记 `{ ok:false, error, ms }`。
- 建议头：`Cache-Control: no-store`。

### GET/POST `/admin/api/tcp-check?host=X&port=Y` （需登录会话；同源）
- 单目标 TCP 连通性毫秒级抽测（3s 超时），返回 `{ ok, ms, error? }`。
- 参数缺失/非法返回 400。

## UI 交互参考（官方示例 → 本项目映射）

| 官方示例（edt-pages.github.io/admin） | 本项目落点 |
|---|---|
| "当前网络信息" 卡片组（每项：名称+状态徽章+说明+加载中） | 自检 Tab 卡片网格：国内 / 国外 / CF CDN / 落地IP / 通道诊断 |
| 状态徽章（绿✓/红✗/黄进行中） | 复用 P1 状态色 token（--ok/--err/--warn）+ 新 `.pill` 徽章 |
| 订阅格式分段选择（自适应/Base64/Clash/SingBox） | 节点 Tab 格式行改分段控件 + 高亮当前选择 |
| 详细配置信息（只读 key-value） | 沿用概览/运维现有实现，不重复造 |

视觉语言继续 P1：HUD 切角、网格背景、扫描/脉冲动画、`--cut` 切角、三档动效。

## 任务分解

### Task 1: 后端自检接口（self-check + tcp-check）

**Files:** Create `src/services/self-check.js`; Modify `src/main.js` (路由挂载，位于 `admin/api/usage-history` 分支附近).

- [ ] **Step 1: 写 runtime 失败测试**（追加到 `scripts/test-runtime.cjs` 或新建 `scripts/test-selfcheck.cjs` 并由 `npm run test:runtime` 合入）—— 登录后：
  - `GET /admin/api/self-check` → 200，body JSON 含 `quick.国内`、`quick.国外`、`quick.cf`、`quick.ip` 字段（允许全 `ok:false`，沙箱无出口）。
  - `GET /admin/api/self-check?deep=1` → 200，`deep` 对象存在（复用率/超时预算字段存在）。
  - `GET /admin/api/tcp-check`（无参）→ 400。
- [ ] **Step 2: 跑测试确认失败**（无路由 → 404/结构缺失）
- [ ] **Step 3: 实现 `self-check.js`**
  - `执行自检(request, env, 配置)`：
    - quick 并行 fetch 检查（各自 5s `AbortSignal.timeout`）：
      - 国内 `https://www.baidu.com`（触发握手的到达性）
      - 国外 `https://www.gstatic.com/generate_204`
      - cf `https://cp.cloudflare.com/generate_204`
      - ip：依次尝试 `https://ipinfo.io/json`、`https://api.ip.sb/geoip`、`https://myip.ipip.net`，取首个成功 → `{ ip, 地区? }`
    - deep（顺序，`?deep=1` 才跑）：
      - 复用率：`connect({hostname:'example.com',port:443},{secureTransport:'on'})` ×6，收集每轮耗时（3s/轮超时），命中 = 首轮后耗时 < 首轮×0.6 → `hits:n/5`
      - 超时预算：`connect({hostname:'192.0.2.1',port:443})` 5s 预算，记录实测毫秒
      - 伪装页：`配置.伪装页URL` 存在则 `fetch(...)` 记录 status + 关键头（content-type/server/是否含 cf-ray）
      - 代理：若反代 PROXYIP 可解析，用 `创建请求TCP连接器(request)({hostname,port})` + `socket.opened` 3s 预算测建连耗时
    - **注意模板内联约束**：本模块是普通 ESM，无内联限制；但 `main.js` 已按既有风格 import。
- [ ] **Step 4: 在 `main.js` 挂载路由**（`访问路径 === 'admin/api/self-check'` GET；`admin/api/tcp-check` GET/POST）。放在 `admin/api/usage-history` 分支之前，鉴权已由外层 cookie 校验保证。
- [ ] **Step 5: 跑测试确认通过**
- [ ] **Step 6: Commit** `feat(admin): 新增 /admin/api/self-check 自检与 /admin/api/tcp-check 目标连通探针`

### Task 2: 自检 Tab UI（官方示例卡片式 + P1 融合）

**Files:** Create `src/admin/ui/tabs/check.js`; Modify `src/admin/ui/index.js`（nav + 挂载 + 快捷键 1–5）; Modify `src/admin/ui/client.js`（事件绑定）; Modify `src/admin/ui/styles.js`（若需 `.grid/.pill/.seg` 样式）.

- [ ] **Step 1: 扩展 test-ui 断言**：产物含 `id="page-check"`、`btn-run-check`、`btn-run-deep`；内联脚本语法与元素 id 引用断言自动覆盖新 id。
- [ ] **Step 2: 跑测试失败**（新 id 缺失）
- [ ] **Step 3: 实现 `check.js`**：
  - `<section class="page" id="page-check">`
  - 顶部操作行：`运行自检`（快捷）/ `深度诊断`（深色幽灵按钮，提示耗时 8–20s）
  - 卡片网格（2 列响应式）：国内 / 国外 / CF CDN / 落地IP —— 每张卡：名称、`.pill` 状态徽章（运行中 warn 脉冲 / ok 绿 / err 红）、说明行、耗时与结果明细、骨架占位。
  - 通道诊断卡（深度结果）：复用率（`hits` 与大数字）、超时预算实测、伪装页头摘要（mono 行）、代理建连耗时。
  - 空态：未运行时显示"点击运行自检开始"。
- [ ] **Step 4: `index.js`**：nav 增加 `按钮 data-tab="check"`；`${自检Tab()}` 挂载于 nodes 之后；快捷键帮助行 1–5 与切换逻辑（client.js 既有 `[data-tab]` 实现自动支持第5个）。
- [ ] **Step 5: `client.js` 绑定**：`btn-run-check` → GET `/admin/api/self-check`（`取JSON`，骨架→徽章更新）；`btn-run-deep` → `?deep=1`；渲染 quick 卡片与 deep 区。沿用既有重试/Toast。
- [ ] **Step 6: 跑 check 全量 + 浏览器冒烟**（wrangler dev 或 test-ui 产物人工检查）
- [ ] **Step 7: Commit** `feat(admin): 自检 Tab——卡片式连通状态 + 深度通道诊断`

### Task 3: 节点 Tab 增强（代理连通测试 + 优选IP 统计）

**Files:** Modify `src/admin/ui/tabs/nodes.js`、`src/admin/ui/client.js`、`scripts/test-ui.mjs`.

- [ ] **Step 1: test-ui 断言**：`btn-node-test`、`n-test-result`、`o-add-stats` 存在。
- [ ] **Step 2: 跑失败**
- [ ] **Step 3: nodes.js 增加两卡**：
  - "代理连通测试"：`<select id="n-proto">`(socks5/http/https/turn/sstp) + URI 输入（placeholder 示例 `user:pass@host:port`）+ 测试按钮 `btn-node-test` + 结果区 `n-test-result`（复用 `/admin/check?<proto>=<uri>` 返回 success/responseTime/error 渲染徽章）。
  - "优选IP 解析统计"（放运维 Tab 更合适？—— 与既有 `#o-add` 优选IP 编辑器同 Tab）：改在 **运维 Tab** 的优选IP 卡片上方加统计行 `o-add-stats`（行数/去重数/样例前 3）与"逐个测试"按钮 `btn-o-test-add`（对每个 IP:port 调 `/admin/api/tcp-check`，徽章逐行刷新）。
- [ ] **Step 4: client.js 绑定对应事件**
- [ ] **Step 5: check 全绿 + Commit** `feat(admin): 代理连通测试与优选IP 状态统计`

### Task 4: 清理与收尾

- [ ] **Step 1: 删除** `scripts/probe-worker.mjs`、`scripts/run-probe.cjs`
- [ ] **Step 2: `npm run check` + `npm run test:runtime` + `npm run deploy:check` 全绿**
- [ ] **Step 3: 浏览器人工冒烟**（本地 `wrangler dev`：登录 → 自检 Tab 运行 → 节点测试 → 优选IP 统计）
- [ ] **Step 4: Commit** `chore: 移除一次性探测壳，P2 收尾` 并推送 main 触发部署
- [ ] **Step 5: P2.5 待办登记**（本文档补一段）：上线后在面板运行"深度诊断"，把真实数据回填下方表格，确定通道优化动作（收紧 `有限代理握手` 预算到 6s ? / 连接复用参数 / 伪装页反代头补充），再单独立项。

## 验收标准

1. `/admin/api/self-check` 与 `/admin/api/tcp-check` 在登录会话下可用，`npm run check` 全绿。
2. 自检 Tab 打开即见卡片网格，点击"运行自检"→ 徽章从运行中转为 ok/err，不依赖任何第三方前端资源。
3. 部署后（Cloudflare 边缘）自检能返回真实状态与落地 IP，深度诊断给出复用率/超时/伪装页头数据 —— 成为 P2.5 通道优化的依据。
4. UI 无回归：既有四 Tab 与快捷键、命令面板、主题/动效切换保持工作。

---

## P2.5 首次线上深度诊断数据与决策（2026-09-19）

首次线上（Cloudflare 边缘）深度诊断读数：

| 项 | 读数 | 解读 |
|---|---|---|
| 复用命中 | `2/5` | **读数失真**：采样实现每轮 `close()`，主动断开必然破坏池化复用 |
| 黑洞超时 | `1 ms / 预算 6000` | 不是超时，是**连接被立即拒绝**（快速失败）→ 预算未被消耗 |
| 伪装页 | 渲染为 `?` | 说明 fetch **失败**（status 为空），但错误文本被 UI 吞掉 → 真实信号被埋 |
| 反代建连 | `未配置反代PROXYIP` | auto 模式，无反代可测 |

### 据此做的修正（本轮）

1. `连接复用采样`：采样期间**保持 socket 打开**（结束后统一关闭），并补充 `首轮` / `后续中位` 字段 —— 让复用读数可解释。
2. `黑洞超时采样`：新增 `判定` 字段（`快速失败` / `静默超时` / `已建立`）与 `error` —— 把"1 ms"从无意义数字变成明确结论。
3. 自检 Tab 重做：明细行改为键值对并显示错误原因（不再吞掉伪装页错误）；新增整体状态徽章、进度条与计时、检测时间、`复制 JSON` 按钮（便于反馈）。
4. `scripts/test-ui.mjs` 接入 `npm test` —— 此前该脚本未进 CI，UI 断言等于空转。

### 通道优化动作的决策（数据驱动）

- **不收紧 `有限代理握手` 的 10s 预算**：唯一相关证据是"无效目标快速失败 1 ms"，说明预算未被消耗；真正需要预算兜底的是**静默丢包**场景，本轮未观测到。在无证据前改动代理主链路属于拿线上稳定性赌博。
- **不改连接复用策略**：复用读数已确认失真，需等修正后的新读数。
- **待确认的真实可疑项**：伪装页请求失败。下次诊断请确认 `伪装页URL` 是否可达（若失败会直接显示错误原因）。
- 下一步：部署本轮修正后，在面板重跑"深度诊断"，用新的 `复制 JSON` 输出判定是否收紧预算与调整复用参数。