> 历史记录：当前实现与验证边界以 [CF-DEPLOYMENT.md](CF-DEPLOYMENT.md) 为准。本文旧出口策略、30 秒跨区同步、128 并发及资源归因不作为当前保证。

# edgetunnel 排障与避坑手册（TROUBLESHOOTING）

> 维护约定：**踩一个坑记一条**。每条含「现象 / 根因 / 修复 / 预防」。
> 新会话、新协作者、未来的自己在动手前先读一遍第三节检查清单。

---

## 一、已踩坑案例（按时间倒序）

### 坑 7：KV 绑定从未启用，管理后台整体不可达（2026-09-07）

- **现象**：`edt2.liuyong.eu.org/login` 与 `/admin` 均返回 nginx 伪装页，无法登录后台。
- **根因**：`wrangler.toml` 的 KV 段整体处于注释状态，Worker 从未绑定 KV → `env.KV` 缺失 → `KV可用=false` → `/login` `/admin` `/sub` `cfg:{host}` 等**全部功能路由被跳过**，直接落伪装页。KV 命名空间虽存在但是孤儿（从未绑定）。
- **修复**：commit `166cfa0` 启用 `[[kv_namespaces]]`（版本 `a74b5334`）。
- **预防**：
  1. "KV 命名空间存在" ≠ "KV 已绑定"——部署后必须核对 bindings 清单；
  2. 任何改动后跑一遍**路由冒烟**：`/`（浏览器 UA）、`/login`、`/admin`、`/sub?token=…`、WS 升级、bot UA；
  3. 配置文件里被注释的能力 = 不存在的能力，审计时按"缺失"处理。

### 坑 6：UA 拦截误伤可用性监控，触发"代理故障"误报（2026-09-07）

- **现象**：M2-P0.6 上线 25 分钟后，uptimeflare 预警"EdgeTunnel 代理故障"，错误 `Expected codes: 2xx, Got: 404`，故障窗口 15 分钟。
- **根因**：初版拦截逻辑为"非浏览器 UA 一律 404"。uptimeflare 的 RemoteChecker 发出的探测请求 UA 非浏览器形态 → 被当扫描器拦截 → 监控判据（期望 2xx）失配 → 误报。
- **修复**：commit `da3aa42`。拦截收敛为"**仅明确 bot 工具前缀**（curl/wget/python/okhttp/...）"；监控探测 UA（uptimeflare/kuma/uptimerobot/gatus/statuspage/pingdom）**显式放行**；未知/空 UA 放行（零误伤优先）。
- **预防（最重要的一条）**：**改动 HTTP 状态码 / UA 判定 / 路由行为前，必须清点所有"以状态码为判据的调用方"**——可用性监控、CI 健康检查、webhook 回调、订阅客户端自动更新。它们不在常规功能路径里，却决定告警是否误报。单测用例要覆盖真实调用方的 UA 形态。

### 坑 5：构建产物漂移——`src/` 已改、`_worker.js` 未重建提交（2026-09-07 发现）

- **现象**：clone 后 `node build.js` 产物与仓库内 `_worker.js` 差 250 行。
- **根因**：最后一批 commit 改了 `src/` 但忘了重建产物。本项目是"双产物"结构（`src/` 源码 + `_worker.js` 构建产物），两者必须同步。
- **修复**：重建并随下一 commit 提交。
- **预防**：**commit 前必跑** `node build.js --force --out _worker.js && node scripts/verify.js`。CI 已有防漂移检查（M0-4），但本地不跑就会在 push 后才被拦。

### 坑 4：test-subscribe.js 从未跑通过——模板字符串三层转义地狱（2026-09-07 发现）

- **现象**：`node scripts/test-subscribe.js` 直接 SyntaxError。
- **根因**：`TEST_BODY` 是外层反引号模板字符串，内嵌的 JS 测试体里：
  1. `${函数名}` 被外层**立即求值**（Unexpected identifier '$'）；
  2. `'\n'` 被解析为真实换行，写进 bundle 后字符串字面量断行；
  3. 正则 `\/` 的反斜杠被外层吃掉，bundle 内正则损坏。
- **修复**：内层全部改字符串拼接 + 双重转义。
- **预防**：
  1. "外层模板嵌内层代码"模式禁止使用裸 `${}` 与裸 `\`，要么全转义、要么改为独立 `.cjs` 文件拼接；
  2. **测试没实际跑过 = 没有测试**。CI 虽会跑，但提交前本地必须跑一次并确认输出（见坑 3 的连锁教训）。

### 坑 3：Loon/QuanX 热补丁对含空格节点名失效——实现与测试双双未经运行验证（2026-09-07 发现）

- **现象**：Loon/QuanX 订阅的 `skip-cert-verify` 补齐、裸 IPv6 加方括号从未生效。
- **根因**：节点行判定用 `^\S+\s*=`，而 Loon/QuanX 节点名**可以含空格**（`HK 01 = trojan,...` 是行业惯例）→ 判定永不命中。且因坑 4，相关测试从未运行过，无人发现。
- **修复**：判定放宽为 `^[^#]+?=`（行含等号且非注释；非节点行无逗号不受影响）。
- **预防**：协议解析类正则必须用**真实客户端输出样本**做 golden 断言；测试红着的时候不许提交功能代码。

### 坑 2：1 小时 8 连发部署触发 loadShed——30 天 72% 错误的来源（2026-09-05）

- **现象**：30 天错误 362 次中 81% 集中在 2026-09-05 03:00-05:59 UTC，与 8 次连续 deploy 完全重叠。
- **根因**：连续部署窗口内，旧实例仍在处理未完成请求 + 新实例 cold-start，瞬时负载叠加 → Cloudflare 边缘主动 `loadShed`。
- **预防**：**两次 deploy 间隔 ≥ 5 分钟**；小改动攒批合并发布；发布窗口避开流量高峰。

### 坑 1：项目目录内 `npx wrangler` 卡死（exit 137）（2026-09-07）

- **现象**：在本仓库目录运行 `npx wrangler deploy`，无任何输出即被 SIGTERM。
- **根因**：项目 `package.json` 无 wrangler 依赖，npx 弹出 "Need to install... Ok to proceed? (y)" 交互确认，非交互环境挂起。
- **预防**：固定使用已安装的 wrangler 二进制（或项目内 `npm i -D wrangler`）。 CI 环境同理，避免任何交互式 npx。

---

## 二、当前已知问题与技术债（按优先级）

| # | 级别 | 问题 | 影响 | 建议动作 |
|---|---|---|---|---|
| 1 | ~~**P0**~~ 已解决 | ~~`KEY` 未设置，UUID/Token 用默认密钥字符串（"勿动此默认密钥…"）派生~~ | — | **已解决（2026-09-19 核实）**：线上 `KEY` 为 `secret_text` 自定义值（面板掩码 `66d…67`），非源码默认串；`UUID` 由 env 直接提供，不再走 `MD5(ADMIN+KEY)` 派生 |
| 2 | ~~**P0**~~ 已解决 | ~~`ADMIN` / `UUID` 为 plaintext binding~~ | — | **已解决（2026-09-19 核实）**：`ADMIN`、`KEY`、`UUID` 经 Cloudflare settings API 实测均为 `secret_text` |
| 3 | P1 | `region` 出站模式仍依赖第三方 `{wk}.SsSs.nEt` 模板 | 该域名族稳定性不可控（本账号曾 61+ 次异常相关） | 仅显式 opt-in 才启用（现状安全）；长期以官方直连池替代，或自建地区出口 |
| 4 | P1 | 订阅转换仍依赖外部 SUBAPI（clash/singbox/surge/loon/quanx 分支） | 转换器故障 → 订阅不可用（已有 10s 超时兜底，但仍是单点） | 参照 cfnew v2.9.8c 全格式 Worker 内化；shadowrocket/v2rayn 已直出可作样板 |
| 5 | P1（部分缓解） | 每请求读 KV（config.json + cfg:{host}），内存缓存 TTL 仅 30s | 冷启动/长尾仍会放大 KV 延迟 | **现状**：M2-P1 最小版 30s isolate 内存缓存已上线；更长 TTL + `c_ver` 版本键仍未做 |
| 6 | P2 | 与上游 cmliu/edgetunnel 已结构性分叉（src/ 多模块 vs 上游单文件） | 无法直接 merge 上游；上游安全修复需手工移植 | 定期 diff 上游关键 fix（如 Grain 合包流改进），手工移植 + golden 测试护航 |
| 7 | P2 | compat date `2025-11-04` 偏旧 | 无法使用新运行时特性；旧 flag 有弃用风险 | 随下一个功能版本统一提升，并在独立测试域名先验证 |
| 8 | ~~P2~~ 已解决 | ~~`读取config_JSON` 的 UsageAPI 查询在请求路径上（非 waitUntil）~~ | — | **已解决（2026-09-19 核实）**：用量刷新已迁入 `ctx.waitUntil`（`读取config_JSON` 末尾），并配 60s 节流与 isolate 级缓存 |
| 9 | P3 | 孤儿 KV `subscribe-kv (0db20ae1…)` 仍未绑定 | 命名空间泄漏 | 确认 subscribe-worker 是否需要，不需要则删 |
| 10 | P3 | Cloudflare D1 指标 `num_tables=0` 但库实际有数据 | 审计时易误判"空库" | 平台指标特性；核对请用 `wrangler d1 execute <db> --command "SELECT name FROM sqlite_master WHERE type='table'"` |

---

## 三、变更前检查清单（防复发 SOP）

**每次改 `src/` 或配置，逐项过一遍：**

```text
□ 1. 行为面影响清点
      改动涉及 HTTP 状态码 / UA 判定 / 路由匹配？
      → 清点调用方：uptimeflare 探测、CI 健康检查、订阅客户端、webhook 回调
      → 单测覆盖真实调用方的 UA 与期望状态码

□ 2. 绑定与变量
      新增/修改 env、KV、D1、DO 绑定？
      → wrangler.toml 与 Dashboard 双侧核对；被注释的配置 = 不存在
      → 部署后核对 GET /workers/scripts/<name>/settings 的 bindings

□ 3. 构建同步
      改了 src/？
      → node build.js --force --out _worker.js
      → node scripts/verify.js && node scripts/test-config.js && node scripts/test-subscribe.js
      → _worker.js 产物与源码同一 commit 提交

□ 4. 部署纪律
      → 距上次 deploy ≥ 5 分钟
      → 用非交互方式调用 wrangler（禁止裸 npx）

□ 5. 线上冒烟（部署后 3 分钟内）
      → /（浏览器 UA = 200 伪装页）
      → /login（= 登录页非伪装页）
      → /admin（= 302 → /login）
      → /sub?token=<TOKEN>（= 订阅内容）
      → WS 升级（= 非 5xx）
      → curl UA（= 404，拦截仍生效）
      → status 页 7/7 up（等一轮探测周期）

□ 6. 回退预案（三层，先软后硬）
      → 软回退：调整 env（如补 PROXYIP 进 manual 模式）
      → 代码回退：git checkout backup/pre-m2-2026-09-07 -- _worker.js 后重新 deploy
      → 平台回退：Dashboard → Deployments → Rollback
```

---

## 四、快速排障索引

| 症状 | 先查什么 |
|---|---|
| 访问任何路径都是 nginx 页 | KV 绑定是否在（坑 7）；`ADMIN` 是否存在（无 ADMIN 时 noADMIN 404 分支） |
| 监控误报 404/5xx | 最近是否改过拦截/路由（坑 6）； Observatory Logs 看完整堆栈（已开启） |
| 大量 loadShed | 部署记录是否密集（坑 2）；KV 读取量是否激增（坑→技术债 5） |
| exceededResources | 观察日志里哪个出站 fetch 卡住；确认 `AbortSignal.timeout` 是否被移除 |
| 订阅内容异常/某客户端不识别 | 对应 format-*.js 热补丁；用真实客户端输出做样本重放 test-subscribe |
| `wrangler` 命令无输出被杀 | 是否在项目目录裸用 npx（坑 1） |
| 构建产物与 src 不一致 | 坑 5；跑 build + verify，产物随 commit 提交 |

---

*本手册随项目演进持续追加。最近更新：2026-09-07（M2-P0 实施日，坑 1-7 全部来自当日实战）。*