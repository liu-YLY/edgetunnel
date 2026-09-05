# edgetunnel 深度分叉迭代方案实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 本文档为**方案评审稿**：先评审设计、文件结构与任务拆分，评审通过后再按 skill 流程拆解为逐行编码任务。

**Goal:** 在方案 B（深度分叉）工程结构之上，将 edgetunnel（cmliu 系）迭代为"配置零门槛、客户端全覆盖、出口伪装保持领先"的自维护版本，且任何迭代都不增加 CF Worker 的部署负担。

**Architecture:** 保持"部署产物 = 单文件 `_worker.js`"不变，源码层拆分 `src/` 多模块 + 零依赖 node 构建脚本合并（M0）；随后按"配置体系（M1-P0）→ 客户端订阅（M1-P1）→ 运维工具（M1-P2）→ 出站官方直连化（M2-P0）→ 部署形态（M2-P1）"顺序落地。所有运行时可配置项全部收敛进统一的"path > KV > env > 默认值"读取层。

**Tech Stack:** Cloudflare Workers（`export default { fetch }` + TCP Socket + KV）、零依赖 Node.js 构建脚本、GitHub Actions；方案 B 已就位的 `main` / `upstream-main` 分支模型。

---

## 0. 背景与决策依据（一行版）

edgetunnel（cmliu）协议/传输最强（VLESS/Trojan/SS/gRPC/xHTTP + 自研 TLS 客户端 + 竞速拨号），cfnew（byJoey）产品体验最强（KV 即改即生效、path 逐节点覆盖、10 客户端订阅、内置测速）。本方案以 cmliu 为底座、以 cfnew 为"功能库"，但**一切改动必须以不损伤 CF Worker 部署的简单性为前提**。

已就位的工程结构（勿回退）：
- `main`：定制开发主线（后续所有本方案改动都落在 main）
- `upstream-main`：上游每日镜像（`sync.yml` 已改为只同步镜像分支，收上游 = 手动 `git merge origin/upstream-main`）
- `_worker.js`：当前 6630 行部署产物（与上游同步的基线）

## 1. 硬约束：部署到 CF Worker 的易用性准则（评审基准）

任何任务违反以下任一条即为评审不通过：

1. **部署产物永远是单文件 `_worker.js`。** "CF 控制台 → 创建 Worker → 粘贴代码 → 加 ADMIN 变量 → 绑 KV" 的最低门槛路径不可被破坏；多文件只存在于源码与构建期，构建产物提交进仓库（`main`），确保不跑构建也能部署。
2. **CF Pages 自动部署路径不变。** 仓库根的 `_worker.js` 即 Pages 部署源；push 到 `main` 即触发重新部署，构建产物必须是"新鲜的"（见 M0-5 防漂移检查）。
3. **不增加新绑定。** 运行时最多依赖现有 `KV` 绑定（README 教程早已包含）；任何新 KV 键都必须有默认值兜底，缺键不崩溃。
4. **不引入强制环境变量。** 新增可配置项必须有默认值；既有 env（`ADMIN`/`KEY`/`HOST` 等）语义保持向后兼容——存量部署（只配 ADMIN+KV）升级后照常工作。
5. **构建脚本零依赖、可自动化。** 只用 Node 内置模块；CI 与本地同一入口；构建失败时不产出部署文件（宁可旧产物，不产半成品）。
6. **README 部署章节与功能同步。** 每个任务完成后，README 的"变量表 + KV 绑定"段落必须与实现一致，保证用户照文档部署不出错。

## 2. 目标文件结构（M0 完成后的形态）

```
/workspace
├─ _worker.js        # 部署产物（构建生成，提交进仓库）  ← 部署面
├─ wrangler.toml     # 部署配置（wrangler deploy 用，Pages 忽略） ← 部署面
├─ src/              # 源码面（不在 CF 上运行，仅供构建）
│  ├─ main.js        # export default { fetch } 入口：路由分发（版本/WS/POST/admin/sub）
│  ├─ config.js      # 统一配置读取：path > KV > env > 默认值（M1-P0 落点）
│  ├─ protocol/
│  │  ├─ vless.js    # VLESS 解析（含 xHTTP 变体）
│  │  ├─ trojan.js   # Trojan 握手与 UDP
│  │  ├─ ss.js       # SS AEAD 加解密
│  │  ├─ ws.js       # WebSocket 转发入口
│  │  ├─ grpc.js     # gRPC 请求处理
│  │  └─ xhttp.js    # xHTTP Padding / HPACK 头
│  ├─ transport/
│  │  ├─ tls-client.js  # 自研 TLS1.2/1.3 客户端（整体搬迁，不重写）
│  │  ├─ dial.js        # 竞速拨号/预加载/失败兜底/并发限流
│  │  ├─ proxy.js       # SOCKS5/HTTP(S)/TURN/SSTP 链式
│  │  └─ grain.js       # Grain 合包（上行聚合/下行合包）
│  ├─ subscribe/
│  │  ├─ rulesets.js    # 规则集模板（M1-P1 时吸收 cfnew：Clash rule-providers / SRS / ACL4SSR）
│  │  ├─ format-clash.js / format-singbox.js / format-surge.js   # 现有 3 个（从热补丁迁出）
│  │  └─ format-loon.js / format-quanx.js / format-shadowrocket.js / format-v2rayn.js …  # M1-P1 新增
│  ├─ admin/
│  │  ├─ panel.js       # 管理面板（登录/日志/对方配置页 M1-P0 增）
│  │  └─ usage.js       # CF 用量查询
│  ├─ doh.js            # DoH 查询（ECH 配置）
│  └─ utils.js          # base64/md5/字节工具/掩码等
└─ build.js             # 零依赖拼接脚本（输入 src/ 清单，输出 _worker.js）
```

拆分原则：**只切文件、不重写逻辑**。各 `src/*.js` 共享顶层作用域（与当前单文件的全局函数/Buffer 语义一致），构建器按固定清单顺序拼接，做到"构建产物与手改产物在逻辑上等价，仅组织不同"。这使 M0 风险最低、可随时回退。

## 3. 阶段任务拆分

> 每个任务都标注：目的 / 设计要点 / 改动文件 / **部署影响** / 验收。
> 运行时影响一律以本 repos 的 README 部署教程（ADMIN + KV）为基线评估。

### Phase M0 — 工程化底座（先决阶段，产出 = 可持续开发 + 部署面不变）

#### Task M0-1 源码骨架与构建器雏形
- 目的：建立 `src/` 目录与构建闭环，先空跑通。
- 设计要点：`build.js` 读取 `BUILD_MANIFEST`（固定文件顺序数组），用 `fs.readFileSync` 拼接后 `node --check` 校验语法，写入 `_worker.js`；任一文件缺失即退出码非 0，**不覆盖**旧 `_worker.js`。
- 改动文件：Create `src/`（先放 `main.js` 与占位清单）、Create `build.js`、Modify `package.json`（Create：`"scripts": {"build": "node build.js"}`，无第三方依赖）。
- 部署影响：无（此阶段 `_worker.js` 暂不替换）。
- 验收：`node build.js` 生成合法的 `_worker.js` 骨架；`node --check _worker.js` 通过；`wrangler dev` 能本地起服务。

#### Task M0-2 单文件按"注释锚点"机械切分
- 目的：把当前 6630 行 `_worker.js` 按模块边界切到 `src/`，**逐字节保留逻辑**（只调整函数声明顺序以满足 JS 顶层顺序约束——当前文件本身就是顺序相关的，切分必须保持拼接顺序一致）。
- 设计要点：切分时保留每个片段的首部注释标明原行号（`/* src: 原 _worker.js:451-820 */`），便于后续上游 merge 时定位；`main.js` 放 `export default { fetch }` 及路由，其余文件只含函数/常量定义。
- 改动文件：Create `src/protocol/*`、`src/transport/*`、`src/subscribe/format-*.js` 等（按 §2 清单）、Modify `build.js`（补全清单）。
- 部署影响：无（构建前后 `_worker.js` 逻辑等价）。
- 验收：`node build.js && node --check _worker.js` 通过；用 diff 抽查 3 个关键函数（TLS ClientHello 构建、VLESS 解析、Clash 热补丁）与切分前逐字符一致；（可选强验收）用高分对照测试，见 §5。

#### Task M0-3 配置读取层 `config.js`（只读侧，先合后开）
- 目的：先把散落在各处的配置读取（`env.ADMIN`/`env.KEY`/`env.KV` 的 `读取config_JSON` 等）收敛为单一入口，**行为不变的先合**；M1-P0 再开 path/KV 覆盖能力。
- 设计要点：`config.js` 导出 `getConfig(env, request)` 返回统一 `cfg` 对象；默认值集中在一张表中（维护面）。
- 改动文件：Create `src/config.js`、Modify `src/main.js` 及调用点。
- 部署影响：无（输出值与旧逻辑一致）。
- 验收：同一环境变量集合下，`getConfig` 输出与旧读取逻辑逐字段一致（写单测，见 §5）。

#### Task M0-4 CI 防漂移检查
- 目的：确保 `src/` 与仓库内 `_worker.js` 永远一致（部署安全）。
- 设计要点：`.github/workflows/build.yml`：`on push: paths: [src/**, build.js]` → `node build.js` → `git diff --exit-code _worker.js`，不一致则 job 失败（防止"源码更新而产物陈旧"）；可选 auto-commit（评审时定：保守选"失败提示"而非自动提交，因为 main 是定制主线）。
- 改动文件：Create `.github/workflows/build.yml`。
- 部署影响：无（仅 CI）。
- 验收：故意改 `src/` 不跑构建 → push → Actions 报错并列出差异文件。
- **已定案（2026-09-05）**：选 A「CI 报错提示」——不一致时 job 失败并输出 `git diff --stat`，不自动 commit，保持 main 提交历史由人控制。

### Phase M1 — 产品向迭代（抄 cfnew 的强项，按部署影响排 P0→P2）

#### Task M1-P0 配置体系升级：KV 全量配置 + path 逐节点覆盖
- 目的：让"改配置"不再依赖改环境变量/重部署（cfnew 的最实用能力），并支持 **path 参数逐节点覆盖**（`p`/`wk`/`rm`/`s`）。
- 设计要点：
  - 优先级（写入 `config.js` 并在 README 写明）：**path 参数 > KV > env > 默认值**。
  - KV 新增键：`cfg:{host}`（以访问域名分桶，避免多域名互相覆盖），面板写入全量 JSON；缺键回退 env/默认值（满足约束 3、4）。
  - path 覆盖白名单 = 连接级 4 项：`p`（ProxyIP）、`wk`（地区）、`rm`（地区匹配开关）、`s`（出站代理）——与 cfnew v2.9.4 对齐；订阅级变量（`ev`/`et`/`yx` 等）不进 path，避免握手期歧义。
  - 管理面板：挂在 `/admin` 下新增「配置」页（**已定案 2026-09-05**；复用现有登录 cookie 认证），表单读写 `cfg:{host}`，保存即生效；保留环境变量只读展示。
  - `p` 与 `wk` 互斥语义照抄 cfnew：写 `p` 则地区匹配整体跳过。
- 改动文件：Modify `src/config.js`、`src/main.js`（path 解析插入点）、Create `src/admin/panel.js` 配置页片段、Modify README。
- 部署影响：**零新绑定、零强制变量**；只用现有 KV 绑定；存量 env 配置优先级不变（env 仍覆盖默认值），存量部署行为不回退。仅 UI 层新增入口。
- 验收：只配 `ADMIN`+KV 的旧部署可正常访问；直连请求带 `p=` 时该连接使用对应 ProxyIP；不填任何 KV 时行为与基线一致；`wrangler dev` 下全链路冒烟通过。

#### Task M1-P1 订阅 10 客户端生成
- 目的：从 3 种热补丁扩到 10 种客户端（Loon / QuanX / Shadowrocket / Nekoray / Stash / V2rayNG/V2Ray + 现有 Clash/SingBox/Surge），UA 自动识别返回对应格式。
- 设计要点：新增 `src/subscribe/format-*.js`；规则集统一引用 cfnew 的模板（Clash `rule-providers`=Loyalsoldier、Sing-box SRS=MetaCubeX、Surge/Loon/QuanX=ACL4SSR/blackmatrix7）——**只取模板，不抄协议逻辑**，规避 GPL 沾染风险点（cfnew 无明确 LICENSE，模板类内容属数据引用）；订阅响应按 `User-Agent` 分流（已有 UA 分支处扩展映射表）。
- 改动文件：Create `src/subscribe/format-{loon,quanx,shadowrocket,v2rayng}.js`（**已定案 2026-09-05：先扩这 4 个**，Nekoray / Stash 列入 backlog）、Create `src/subscribe/rulesets.js`、Modify 订阅路由、Modify README。
- 部署影响：无新绑定/变量；订阅端点路径不变（`/sub?token=...`）。
- 验收：模拟各客户端 UA 请求 `/sub`，返回合法配置（用各客户端官方模板做 schema 级校验）；无 UA 时返回默认格式。

#### Task M1-P2 运维工具：内置延迟测试 + 优选 IP REST API
- 目的：把 cfnew 的"面板测速 + API 管理优选"搬进 edgetunnel，减少对第三方优选工具的依赖。
- 设计要点：
  - 延迟测试：面板页内 JS 用 `fetch`（`no-cors` 探测 443 握手）测候选 IP；复用现有"请求优选API"得到候选池，测速结果写 KV（`cfg:{host}.yx` 合并）。
  - REST API（仅登录 cookie 可调，避免公开写）：`POST /admin/api/preferred-ips`（单/批量）、`DELETE`（单个/清空）、`GET` 列表；与现有 `yx` 环境变量值自动合并（写时保留手动项）。
- 改动文件：Modify `src/admin/panel.js`、Modify `src/main.js`（新增 /admin/api 路由）、Modify 优选读取逻辑接入点。
- 部署影响：无新绑定；API 走既有登录鉴权；默认关闭（不开启不暴露任何面）（满足约束 3/4）。
- 验收：登录后 POST 一条优选 → 订阅节点列表出现该 IP；未登录 POST 返回 401；`yx` 手动项不被清空。

### Phase M2 — 传输/出口向迭代（护城河加固 + 部署形态）

#### Task M2-P0 出站"官方直连"化
- 目的：把默认出站从"依赖第三方动态反代域名"改为"内置 CF 官方地址 + 失败兜底"，减少外部依赖与不确定性（cfnew v3.0 已验证此方向）。
- 设计要点：内置 10 个分布在 10 个 /24 段的官方地址常量；默认出站按"随机取一"直连；`p` 变量手动指定时仍以用户为准；原有地区匹配（`反代参数获取`）保留为显式开启项（`wk`），**默认关闭**——行为变更需在 README 显著说明。
- 改动文件：Modify `src/transport/dial.js`（出站候选构建）、Modify `src/config.js`（默认值表）、Modify README。
- 部署影响：无新绑定/变量；但**默认出站行为变化**（升级后默认不再请求第三方域名）——属安全性增强，README 引导。
- 验收：未配 `p`/`wk` 时，连接建立且出口为 CF 官方地址（核对节点 Server 字段）；配 `p` 后走用户指定；`wk` 显式开启时行为与基线一致。

#### Task M2-P1 部署形态扩展：Snippets + 可选混淆产物
- 目的：降低"不想绑 KV/不想用 Pages"场景的部署门槛（cfnew 已具备 Snippets 形态）。
- 设计要点：构建器增加产物模式：`--target worker|snippets|obf`：snippets 模式输出单文件（不含 KV 强依赖路径的 UI 降级）；混淆产物只在发布时生成，仓库只维护明文 `src/`，混淆产物**仅作为 release asset 产出，不提交进仓库**（**已定案 2026-09-05**）。混淆器用构建期可插拔，**不做运行时混淆**，避免运行时性能/审计成本（约束 5）。
- 改动文件：Modify `build.js`（多 target）、Modify README（Snippets 教程段落）。
- 部署影响：新增一条部署路径（Snippets 粘贴）；原路径不受影响。混淆产物如提交，需在 CI 校验与明文逻辑一致（smoke）。
- 验收：`node build.js --target snippets` 产物可通过 Snippets 官方接入创建；混淆产物 smoker 通过（关键协议解析仍工作）。

#### Task M2-P2 传输纵深（低优先级，视评审定）
- 目的：gRPC 头紧凑化、UDP over WS 增强；TURN/SSTP 保持现状并记录基线（防上游 merge 破坏）。
- 设计要点：仅为可选打磨项；本期不展开编码，列入 backlog 并在 `upstream-main` merge 时用 §5 回归保护。
- 部署影响：无。
- 验收：回归清单全绿。

## 4. 任务依赖与建议顺序

```
M0-1 → M0-2 → M0-3 → M0-4（依赖全部就绪）
                    ↓
              M1-P0（依赖 M0-3 的 config.js）
M1-P1 ──────────────────→ 可并行（依赖 M0-2 的 subscribe 文件）
M1-P2 ────────→ 依赖 M1-P0（KV 配置层 & 登录鉴权路由）
M2-P0 ────────→ 依赖 M0-3 + M1-P0（默认值表与出站候选）
M2-P1 ────────→ 依赖 M0-4（构建器就绪）
M2-P2 ────────→ backlog，随时可插入 & 依赖回归保护
```

每完成一个 Task 即可独立部署（产物仍为单文件），用户可按周拣选。

## 5. 通用验收 / 回归清单（每个 Task 合入前必须全绿）

- [ ] `node --check _worker.js` 通过；`node build.js` 可重现同一产物。
- [ ] 粘贴部署冒烟：`wrangler dev` 起服务 → WS 链接 + 管理后台可访问 → 连通（在 CI 中做基线冒烟，M0-4 起）。
- [ ] 兼容性：仅配 `ADMIN`+KV 的旧式部署照常工作（无新增必填变量）。
- [ ] KV 缺键不崩溃（所有新 KV 键有默认值）。
- [ ] README 部署章节与本任务变更同步。
- [ ] 回归测试套件（M0-3 起建立）：`config.js` 单测（默认值/优先级）、协议解析 golden 测试（固定输入→固定输出）、订阅生成 schema 校验。

## 6. 风险与对策

| 风险 | 概率 | 对策 |
|---|---|---|
| 切分破坏顶层作用域顺序导致行为漂移 | 中 | M0 只机械切分不动逻辑；构建后黄金比对（§3 M0-2 验收）；`upstream-main` 镜像保证可 diff |
| 上游 merge 与本方案冲突（尤其 `_worker.js` 大改） | 高 | 方案 B 手动 merge 流程 + 标注行号锚点（M0-2）+ 回归清单兜底；冲突集中在 transport/tls-client 时优先让上游 |
| cfnew 规则集模板无 LICENSE 存在合规噪音 | 中 | 只引用数据（rulesets.js 引源注明），不复制其核心代码；若团队要求严格，改用自维护迷你规则集 |
| 混淆产物逻辑漂移 | 低 | 混淆只在构建期、可插拔，产物不承诺长期运行基线 |
| 过度工程化（如把简单配置做成框架） | 中 | 每任务遵守 YAGNI：只加本任务所需的最小抽象（config.js 单表默认值，不引入类/DI） |

## 7. 评审决策（2026-09-05 已全部定案）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | M0-4 防漂移策略 | **A. CI 报错提示**（不自动 commit，保持 main 历史由人控制） |
| 2 | M1-P0 面板入口 | **A. 挂 `/admin` 下**（复用登录 cookie，安全上下文统一） |
| 3 | M2-P1 混淆产物 | **A. 仅 release asset**（仓库只维护明文 `src/`） |
| 4 | M1-P1 客户端名单 | **A. 先扩 4 个**（Loon / QuanX / Shadowrocket / V2rayNG；Nekoray / Stash 入 backlog） |

> 若后续对任何结论有异议，可在此表追加"变更记录"行，但需同步更新 §3 对应任务。

## 8. 执行方式（评审通过后）

本计划评审定稿后，按 writing-plans 的成熟流程将每个 Task 拆成逐步编码任务（TDD、每步可提交），推荐 Subagent-Driven（每 Task 一个子代理 + 两段评审）或 Inline（批量执行 + 检查点）。每个 Task 完成后按 §5 回归清单验收，再进入下一个。