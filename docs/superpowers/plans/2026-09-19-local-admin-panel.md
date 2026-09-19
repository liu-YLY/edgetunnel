# 本地内嵌管理面板 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/admin` 从精简 JSON 配置页升级为本地内嵌的四 Tab 富面板（概览/节点订阅/配置/运维），单文件发布、零外部依赖。

**Architecture:** 新增三个模块——`src/services/usage-history.js`（用量 30 天快照，零依赖，config 与 main 共用）、`src/admin/qr.js`（导出一个浏览器端二维码运行时字符串）、`src/admin/ui.js`（导出 `管理面板HTML(env, config_JSON)`，返回完整 HTML+CSS+SPA 客户端 JS）。`main.js` 增加 `admin/api/usage-history` GET 路由并在 `config/index.js` 用量刷新成功处挂快照写点；`admin/panel.js` 删除旧配置页函数、保留日志函数。构建链（build.js / verify.js / check-modules.cjs 层规则）无需改动，产物 `_worker.js` 需随每次源码变更重新生成并提交。

**Tech Stack:** Cloudflare Workers（ESM，esbuild 单文件打包）、原生 HTML/CSS/JS（无框架无 CDN）、KV（快照存储）、既有安全层（HMAC 会话 + 同源校验）。测试用 node 直接 import 源码（`--import ./scripts/register-test-loader.mjs`）。

**关键约束（踩坑记录）：**
1. 层边界（scripts/check-modules.cjs）：`config` 允许依赖 `config/core/services`；`admin` 允许依赖 `admin/core/security.js`。所以用量历史放 `src/services/`，`ui.js`/`qr.js` 互引。
2. `scripts/verify.js` 会把新构建与仓库内 `_worker.js` 逐字节比对——每次改 `src/` 后必须 `npm run build` 并把 `_worker.js` 一并提交。
3. 客户端二维码不能服务端 import 渲染：以字符串常量内嵌（`window.QRCode` 运行时），单测用 `new Function` 求值验证。
4. 凭据掩码回写防护：cf.json/tg.json 保存时，提交值与 `掩码敏感信息(当前值)` 相等则视为"未改动"，保留原值，防止掩码文本覆盖真实凭据。
5. 面板 HTML 内客户端 JS 一律不使用反引号与 `${}`（外层为服务端模板字面量），避免嵌套求值。

---

## 文件结构

| 文件 | 职责 | 层 |
|---|---|---|
| `src/services/usage-history.js` | 新增。用量快照读/写（KV `usage:{host}`，30 天滚动） | services（零依赖） |
| `src/admin/qr.js` | 新增。导出浏览器端二维码运行时字符串 `二维码运行时` | admin（零依赖） |
| `src/admin/ui.js` | 新增。导出 `管理面板HTML(env, config_JSON)` | admin（依赖 core/html.js、admin/qr.js） |
| `src/main.js` | 修改。新路由 `admin/api/usage-history`；`/admin` 改用 `管理面板HTML`；cf.json/tg.json 掩码回写防护；import 调整 | main |
| `src/config/index.js` | 修改。用量刷新成功回调后挂 `记录用量快照` | config |
| `src/admin/panel.js` | 修改。删除 `管理面板配置页HTML` 及其 import；保留 `请求日志记录` | admin |
| `scripts/test-usage-history.mjs` | 新增。用量历史单元测试 | 测试 |
| `scripts/test-qr.mjs` | 新增。二维码运行时结构测试 | 测试 |
| `scripts/test-ui.mjs` | 新增。面板 HTML 结构 + XSS 转义测试 | 测试 |
| `package.json` | 修改。`test` 脚本追加上述三个测试 | — |
| `_worker.js` | 每次源码变更后 `npm run build` 重新生成并提交 | 产物 |

---

## Task 1: 用量历史模块（TDD）

**Files:**
- Create: `src/services/usage-history.js`
- Create: `scripts/test-usage-history.mjs`
- Modify: `package.json`（test 脚本）

- [ ] **Step 1: 写失败测试**

Create `scripts/test-usage-history.mjs`:

```js
import { 读取用量历史, 记录用量快照, 日期字符串 } from '../src/services/usage-history.js';
import assert from 'node:assert/strict';

;(async () => {
  const kvStore = new Map();
  const clone = v => JSON.parse(JSON.stringify(v));
  const kv = {
    get: async k => (kvStore.has(k) ? clone(kvStore.get(k)) : null),
    put: async (k, v) => { kvStore.set(k, clone(v)); },
  };
  const usage = { success: true, pages: 1, workers: 100, total: 101, max: 100000 };

  // 1) 首次快照：一条，日期为今日
  let 结果 = await 记录用量快照(kv, 'a.example.com', usage);
  assert.ok(Array.isArray(结果) && 结果.length === 1, '首次快照为一条');
  assert.strictEqual(结果[0].date, 日期字符串(), '日期为今日');
  assert.strictEqual(结果[0].total, 101, 'total 记录正确');

  // 2) 同日重复写入：当日覆盖更新，不新增条目
  结果 = await 记录用量快照(kv, 'a.example.com', { ...usage, total: 202 }, new Date('2026-09-19T03:00:00Z'));
  assert.strictEqual(结果.length, 1, '同日快照去重：仍一条');
  assert.strictEqual(结果[0].total, 202, '同日更新为最新值');

  // 3) 手动日期快照：两个不同日期按升序
  结果 = await 记录用量快照(kv, 'a.example.com', usage, new Date('2026-09-18T03:00:00Z'));
  assert.strictEqual(结果.length, 2, '新增一天共两条');
  assert.strictEqual(结果[0].date, '2026-09-18', '老日期在前');
  assert.strictEqual(结果[1].date, '2026-09-19', '新日期在后');

  // 4) 30 天滚动裁剪：写入 35 天，只留最近 30 条
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2026, 8, 1 + i)); // 2026-09-01 起逐日
    await 记录用量快照(kv, 'a.example.com', usage, d);
  }
  结果 = await 读取用量历史(kv, 'a.example.com');
  assert.ok(结果.length <= 30, '超过 30 天被裁剪');
  assert.strictEqual(结果[结果.length - 1].date, 日期字符串(new Date(Date.UTC(2026, 9, 10))), '最新一天仍在');
  assert.ok(结果.every((r, i) => i === 0 || 结果[i - 1].date <= r.date), '按日期升序');

  // 5) 不同 host 互不影响
  assert.strictEqual((await 读取用量历史(kv, 'b.example.com')).length, 0, 'b 域无数据');

  // 6) 非成功结果不写快照
  await 记录用量快照(kv, 'a.example.com', { success: false, total: 99 }, new Date('2026-09-19T05:00:00Z'));
  assert.strictEqual((await 读取用量历史(kv, 'a.example.com')).length, 30, '失败结果不新增快照');

  // 7) KV 中脏数据返回空数组而不是崩溃
  kvStore.set('usage:bad.example.com', '{not json');
  assert.deepStrictEqual(await 读取用量历史(kv, 'bad.example.com'), [], '脏数据返回空数组');
  kvStore.set('usage:obj.example.com', '{"a":1}');
  assert.deepStrictEqual(await 读取用量历史(kv, 'obj.example.com'), [], '非数组 JSON 返回空数组');

  console.log('[test-ui] usage-history 全部断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });
```

- [ ] **Step 2: 运行确认失败**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-usage-history.mjs`
Expected: FAIL，报错 `ERR_MODULE_NOT_FOUND`（../src/services/usage-history.js 不存在）。

- [ ] **Step 3: 实现模块**

Create `src/services/usage-history.js`:

```js
// 用量历史：KV key `usage:{host}`，30 天滚动快照。
// 零依赖模块（仅 Date/JSON/Array），config 与 main 两个入口共用，可直接 node 单测。
const 保留天数 = 30;

function 日期字符串(现在 = new Date()) {
  const 年 = 现在.getFullYear();
  const 月 = String(现在.getMonth() + 1).padStart(2, '0');
  const 日 = String(现在.getDate()).padStart(2, '0');
  return `${年}-${月}-${日}`;
}

async function 读取用量历史(env, host) {
  try {
    const 文本 = await env.KV.get('usage:' + host);
    if (!文本) return [];
    const 解析 = JSON.parse(文本);
    if (!Array.isArray(解析)) return [];
    return 解析.filter(e => e && typeof e === 'object' && typeof e.date === 'string');
  } catch { return []; }
}

// 当日已存在则覆盖更新该日值，否则追加；滚动保留 30 天。读-改-写，竞态窗口见设计文档，面板场景可接受。
async function 记录用量快照(env, host, usage, 现在 = new Date()) {
  if (!usage || usage.success !== true) return [];
  const 今日 = 日期字符串(现在);
  const 现有 = await 读取用量历史(env, host);
  const 过滤 = 现有.filter(e => e.date !== 今日);
  const 快照 = { date: 今日, workers: usage.workers || 0, pages: usage.pages || 0, total: usage.total || 0, max: usage.max || 0 };
  const 合并 = [...过滤, 快照].sort((a, b) => (a.date < b.date ? -1 : 1));
  const 最终 = 合并.slice(-保留天数);
  await env.KV.put('usage:' + host, JSON.stringify(最终));
  return 最终;
}

export { 日期字符串, 读取用量历史, 记录用量快照 };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-usage-history.mjs`
Expected: PASS，输出 `[test-ui] usage-history 全部断言通过`。

- [ ] **Step 5: 挂入 npm test（仅本测试；qr/ui 测试在 Task 3/4 各自挂入）**

Modify `package.json` 的 `test` 脚本，在现有四个测试之后追加 `test-usage-history`：

```json
"test": "node scripts/test-modules.cjs && node --import ./scripts/register-test-loader.mjs scripts/test-config.mjs && node --import ./scripts/register-test-loader.mjs scripts/test-subscribe.mjs && node --import ./scripts/register-test-loader.mjs scripts/test-regression.mjs && node --import ./scripts/register-test-loader.mjs scripts/test-usage-history.mjs"
```

然后运行 `npm test` 确认全绿（5 个测试）。

- [ ] **Step 6: 提交**

```bash
git add src/services/usage-history.js scripts/test-usage-history.mjs package.json
git commit -m "feat: 用量历史快照模块 usage-history（30 天滚动，config/main 共用）"
```

---

## Task 2: 用量历史接线（路由 + 快照钩子）+ 凭据掩码回写防护

**Files:**
- Modify: `src/main.js`
- Modify: `src/config/index.js`

- [ ] **Step 1: 在 config/index.js 用量刷新成功处挂快照**

Modify `src/config/index.js`：
1) import 区（文件顶部，`getCloudflareUsage` 那行附近）追加：

```js
import { 记录用量快照 } from '../services/usage-history.js';
```

2) 在用量刷新 waitUntil 的 `finally` 之后追加快照写点。当前代码（约 L271-L278）为：

```js
                当前请求配置().ctx.waitUntil((async () => {
                    try {
                        entry.value = CF_JSON.UsageAPI ? await (await fetch(CF_JSON.UsageAPI, { signal:AbortSignal.timeout(8000) })).json()
                            : await getCloudflareUsage(CF_JSON.Email, CF_JSON.GlobalAPIKey, CF_JSON.AccountID, CF_JSON.APIToken);
                    } catch { console.error(JSON.stringify({ event:'usage_refresh_failed' })); }
                    finally { entry.pending = false; entry.time = Date.now(); }
                })());
```

改为：

```js
                当前请求配置().ctx.waitUntil((async () => {
                    try {
                        entry.value = CF_JSON.UsageAPI ? await (await fetch(CF_JSON.UsageAPI, { signal:AbortSignal.timeout(8000) })).json()
                            : await getCloudflareUsage(CF_JSON.Email, CF_JSON.GlobalAPIKey, CF_JSON.AccountID, CF_JSON.APIToken);
                        // M3: 用量刷新成功时落当日快照（usage:{host}，30 天滚动）；失败不落
                        if (entry.value?.success) await 记录用量快照(env, host, entry.value);
                    } catch { console.error(JSON.stringify({ event:'usage_refresh_failed' })); }
                    finally { entry.pending = false; entry.time = Date.now(); }
                })());
```

- [ ] **Step 2: main.js 增加 usage-history 路由**

Modify `src/main.js`：
1) import 区追加（`getCloudflareUsage` import 附近）：

```js
import { 读取用量历史 } from './services/usage-history.js';
```

2) 在 GET 分支链中追加。当前（约 L304-L314）结构为 `admin/config.json` GET → `admin/ADD.txt` GET → `admin/cf.json` GET → `admin/config` GET(面板)。在 `admin/cf.json` GET 分支（返回 `request.cf`）之后、`admin/config` GET 分支之前插入：

```js
					} else if (区分大小写访问路径 === 'admin/api/usage-history') {// 用量历史（30 天快照，会话鉴权已在上方完成）
						return new Response(JSON.stringify(await 读取用量历史(env, host), null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
```

- [ ] **Step 3: 凭据掩码回写防护（cf.json / tg.json 保存处理）**

场景：面板会把 `/admin/config.json` 里**掩码后的** CF/TG 凭据回传，若直接写入 KV 会覆盖真实凭据。在保存前与 `掩码敏感信息(当前值)` 比对，相等视为未改动、保留原值。

Modify `src/main.js` 的 `admin/cf.json` POST 处理（约 L236-L258）。把：

```js
						} else if (访问路径 === 'admin/cf.json') { // 保存cf.json配置
							try {
								const newConfig = await 读取管理JSON(request);
								const CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
								if (!newConfig.init || newConfig.init !== true) {
									if (newConfig.Email && newConfig.GlobalAPIKey) {
										CF_JSON.Email = newConfig.Email;
										CF_JSON.GlobalAPIKey = newConfig.GlobalAPIKey;
									} else if (newConfig.AccountID && newConfig.APIToken) {
										CF_JSON.AccountID = newConfig.AccountID;
										CF_JSON.APIToken = newConfig.APIToken;
									} else if (newConfig.UsageAPI) {
										CF_JSON.UsageAPI = newConfig.UsageAPI;
									} else {
										return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									}
								}
```

改为：

```js
						} else if (访问路径 === 'admin/cf.json') { // 保存cf.json配置
							try {
								const newConfig = await 读取管理JSON(request);
								const CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
								// 掩码回写防护：提交值等于当前值的掩码表示时视为未改动，保留 KV 原值
								let 现有CF全量 = {};
								try { 现有CF全量 = JSON.parse(await env.KV.get('cf.json') || 'null') || {}; } catch {}
								const 保留未变 = (名, 提交值) => (提交值 && 现有CF全量[名] && 提交值 === 掩码敏感信息(String(现有CF全量[名]))) ? 现有CF全量[名] : 提交值;
								if (!newConfig.init || newConfig.init !== true) {
									const 处理后 = {
										Email: 保留未变('Email', newConfig.Email),
										GlobalAPIKey: 保留未变('GlobalAPIKey', newConfig.GlobalAPIKey),
										AccountID: 保留未变('AccountID', newConfig.AccountID),
										APIToken: 保留未变('APIToken', newConfig.APIToken),
										UsageAPI: 保留未变('UsageAPI', newConfig.UsageAPI),
									};
									if (处理后.Email && 处理后.GlobalAPIKey) {
										CF_JSON.Email = 处理后.Email;
										CF_JSON.GlobalAPIKey = 处理后.GlobalAPIKey;
									} else if (处理后.AccountID && 处理后.APIToken) {
										CF_JSON.AccountID = 处理后.AccountID;
										CF_JSON.APIToken = 处理后.APIToken;
									} else if (处理后.UsageAPI) {
										CF_JSON.UsageAPI = 处理后.UsageAPI;
									} else {
										return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									}
								}
```

同文件 `admin/tg.json` POST 处理（约 L263-L280），把：

```js
							} else {
								if (!newConfig.BotToken || !newConfig.ChatID) return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
								await env.KV.put('tg.json', JSON.stringify(newConfig, null, 2));
                                失效配置缓存();
							}
```

改为：

```js
							} else {
								if (!newConfig.BotToken || !newConfig.ChatID) return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
								let 现有TG全量 = {};
								try { 现有TG全量 = JSON.parse(await env.KV.get('tg.json') || 'null') || {}; } catch {}
								const TG_JSON = {
									BotToken: (newConfig.BotToken && 现有TG全量.BotToken && newConfig.BotToken === 掩码敏感信息(String(现有TG全量.BotToken))) ? 现有TG全量.BotToken : newConfig.BotToken,
									ChatID: newConfig.ChatID,
								};
								await env.KV.put('tg.json', JSON.stringify(TG_JSON, null, 2));
                                失效配置缓存();
							}
```

注意：`掩码敏感信息` 需在 main.js import。当前 import 区没有，追加：

```js
import { 掩码敏感信息 } from './core/html.js';
```

- [ ] **Step 4: 层边界 + 构建校验**

```bash
npm run build       # 重新生成 _worker.js（含 usage-history 接线）
npm run check       # = verify.js（模块边界 + 与 _worker.js 字节比对）+ npm test（现有 5 项全绿）
```

Expected: `[modules] …无隐式引用…通过`、构建通过、`[check] 通过`、5 个测试全绿。

- [ ] **Step 5: 提交**

```bash
git add src/main.js src/config/index.js _worker.js
git commit -m "feat: usage-history 路由与用量快照写点；cf/tg 凭据掩码回写防护"
```

---

## Task 3: 二维码运行时模块（TDD）

**Files:**
- Create: `src/admin/qr.js`
- Create: `scripts/test-qr.mjs`

浏览器端二维码以"运行时字符串"内嵌，单测用 `new Function` 在 node 里求值验证。字节模式、纠错 M、版本 1–6（ASCII ≤106 字节；超长抛错，UI 端提示）。

- [ ] **Step 1: 写失败测试**

Create `scripts/test-qr.mjs`:

```js
// 求值浏览器端二维码运行时，验证结构正确性（矩阵尺寸/定位图案/抛错/SVG 输出）。
import { 二维码运行时 } from '../src/admin/qr.js';
import assert from 'node:assert/strict';

function evalQR() {
  const sandbox = { window: {} };
  new Function('window', 二维码运行时)(sandbox.window);
  return sandbox.window.QRCode;
}

;(async () => {
  const QR = evalQR();
  assert.ok(QR && typeof QR.generate === 'function' && typeof QR.generateSVG === 'function', '运行时暴露 generate/generateSVG');

  // 1) 短内容 → 版本 1，21x21
  const m = QR.generate('A');
  assert.strictEqual(m.length, 21, 'v1 尺寸 21');
  assert.ok(m.every(row => Array.isArray(row) && row.length === 21), '矩阵为 21x21');

  // 2) 三个定位眼（finder）：每行/列首尾 7 位全 1
  const eye = (x, y) => {
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const v = (j === 0 || j === 6 || i === 0 || i === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) ? 1 : 0;
      assert.strictEqual(m[y + j][x + i], v, `定位眼 (${x},${y}) 内 (${i},${j})`);
    }
  };
  eye(0, 0); eye(14, 0); eye(0, 14);

  // 3) 时序图案：行 6 / 列 6（8..12 范围）交替
  for (let t = 8; t <= 12; t++) {
    assert.strictEqual(m[6][t], (t % 2 === 0) ? 1 : 0, `横向时序 (6,${t})`);
    assert.strictEqual(m[t][6], (t % 2 === 0) ? 1 : 0, `纵向时序 (${t},6)`);
  }

  // 4) 超长抛错（v6-M 上限 106 字节）
  assert.throws(() => QR.generate('A'.repeat(120)), /过长/, '超长内容应抛错');

  // 5) SVG 输出
  const svg = QR.generateSVG('hello');
  assert.ok(typeof svg === 'string' && svg.startsWith('<svg'), 'generateSVG 返回 svg 字符串');

  console.log('[test-ui] qr 运行时结构断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });
```

- [ ] **Step 2: 运行确认失败**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-qr.mjs`
Expected: FAIL（qr.js 不存在，`ERR_MODULE_NOT_FOUND`）。

- [ ] **Step 3: 实现模块**

Create `src/admin/qr.js`（导出浏览器端运行时字符串；模块自身零依赖、零全局引用，通过层边界检查）：

```js
// 浏览器端二维码运行时：以字符串导出，嵌入面板 HTML <script>。
// 字节模式，纠错级别 M，版本 1–6（ASCII ≤106 字节，超长抛错）。
// 单测通过 new Function('window', 二维码运行时) 在 node 中求值验证。
// 注意：该字符串内不得出现反引号、${、或 </script>。
const 二维码运行时 = `window.QRCode = (function () {
  'use strict';
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) { EXP[j] = EXP[j - 255]; }
  })();
  function gmul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGen(ecc) {
    var p = [1];
    for (var i = 0; i < ecc; i++) {
      var n = new Array(p.length + 1);
      for (var k = 0; k < n.length; k++) n[k] = 0;
      for (var j = 0; j < p.length; j++) { n[j] ^= gmul(p[j], EXP[i]); n[j + 1] ^= p[j]; }
      p = n;
    }
    return p;
  }
  function rsRem(data, ecc) {
    var g = rsGen(ecc), buf = new Array(ecc);
    for (var i = 0; i < ecc; i++) buf[i] = 0;
    for (var i = 0; i < data.length; i++) {
      var f = data[i] ^ buf[0];
      for (var j = 0; j < ecc - 1; j++) buf[j] = buf[j + 1];
      buf[ecc - 1] = 0;
      for (var j = 0; j < ecc; j++) buf[j] ^= gmul(g[j + 1], f);
    }
    return buf;
  }
  var V = { 1: { blk: 1, ecc: 10, data: 16 }, 2: { blk: 1, ecc: 16, data: 28 }, 3: { blk: 1, ecc: 26, data: 44 },
            4: { blk: 2, ecc: 18, data: 32 }, 5: { blk: 2, ecc: 24, data: 43 }, 6: { blk: 4, ecc: 16, data: 27 } };
  var CAP = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106 };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
  function baseMatrix(size, align) {
    var m = [];
    for (var y = 0; y < size; y++) { var r = new Array(size); for (var x = 0; x < size; x++) r[x] = 0; m.push(r); }
    function finder(ox, oy) {
      for (var j = -1; j <= 7; j++) {
        for (var i = -1; i <= 7; i++) {
          var x = ox + i, y = oy + j;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          var in7 = j >= 0 && j <= 6 && i >= 0 && i <= 6;
          var dark = in7 && (j === 0 || j === 6 || i === 0 || i === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
          m[y][x] = dark ? 1 : 0;
        }
      }
    }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (var t = 8; t < size - 8; t++) { m[6][t] = (t % 2 === 0) ? 1 : 0; m[t][6] = (t % 2 === 0) ? 1 : 0; }
    for (var a = 0; a < align.length; a++) {
      for (var b = 0; b < align.length; b++) {
        var cx = align[a], cy = align[b];
        if (m[cy][cx] !== 0) continue;
        for (var j = -2; j <= 2; j++) {
          for (var i = -2; i <= 2; i++) {
            m[cy + j][cx + i] = (i === 0 && j === 0) ? 1 : ((i === -2 || i === 2 || j === -2 || j === 2) ? 1 : 0);
          }
        }
      }
    }
    // 格式信息位 + 暗色模块占位（值随意，仅用于占位使数据写入跳过这些单元）
    m[size - 8][8] = 1; // 暗色模块：列 8、行 size-8
    return m;
  }
  function encodeFormat(mask) {
    var data = mask; // EC=M（00）→ 高 3 位数据为 0
    var rem = data << 10;
    for (var i = 14; i >= 10; i--) { if ((rem >> i) & 1) rem ^= 0x537 << (i - 10); }
    return ((data << 10) | rem) ^ 0x5412;
  }
  var FORMAT_POS = null; // 惰性构建：每 bit 两个位置（竖排 x=8 + 横排 y=8），共 2×15
  function formatPositions(size) {
    if (FORMAT_POS && FORMAT_POS.size === size) return FORMAT_POS.list;
    var list = [];
    for (var i = 0; i < 15; i++) {
      var vx = 8, vy = i < 6 ? i : (i < 8 ? i + 1 : size - 15 + i);                       // 竖排（左/左下副本，x=8）
      var hx = i < 8 ? size - 1 - i : (i === 8 ? 7 : 15 - i - 1 + 8), hy = 8;             // 横排（上/右上副本，y=8）
      list.push({ x: vx, y: vy }, { x: hx, y: hy });
    }
    FORMAT_POS = { size: size, list: list };
    return list;
  }
  function maskBit(x, y, mask) {
    switch (mask) {
      case 0: return ((x + y) % 2) === 0;
      case 1: return (y % 2) === 0;
      case 2: return (x % 3) === 0;
      case 3: return ((x + y) % 3) === 0;
      case 4: return ((Math.floor(y / 2) + Math.floor(x / 3)) % 2) === 0;
      case 5: return (((x * y) % 2) + ((x * y) % 3)) === 0;
      case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
      default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
    }
  }
  function penalty(m) {
    var size = m.length, score = 0;
    for (var y = 0; y < size; y++) {
      var run = 1;
      for (var x = 1; x < size; x++) {
        if (m[y][x] === m[y][x - 1]) { run++; } else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (var x = 0; x < size; x++) {
      var runC = 1;
      for (var y = 1; y < size; y++) {
        if (m[y][x] === m[y - 1][x]) { runC++; } else { if (runC >= 5) score += 3 + (runC - 5); runC = 1; }
      }
      if (runC >= 5) score += 3 + (runC - 5);
    }
    for (var j = 0; j < size - 1; j++) {
      for (var i = 0; i < size - 1; i++) {
        var v = m[j][i];
        if (m[j][i + 1] === v && m[j + 1][i] === v && m[j + 1][i + 1] === v) score += 3;
      }
    }
    var dark = 0;
    for (var j = 0; j < size; j++) { for (var i = 0; i < size; i++) { dark += m[j][i]; } }
    var percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }
  function clone(m) { var out = []; for (var i = 0; i < m.length; i++) { out.push(m[i].slice()); } return out; }
  function generate(text) {
    if (typeof text !== 'string') text = String(text);
    var bytes = [];
    for (var i = 0; i < text.length; i++) { var c = text.charCodeAt(i); bytes.push(c <= 0xff ? c : 63); }
    var version = 1;
    while (version <= 6 && bytes.length > CAP[version]) version++;
    if (version > 6) throw new Error('内容过长，二维码仅支持不超过 106 个 ASCII 字符');
    var cfg = V[version], size = 17 + version * 4;
    var totalData = cfg.blk * cfg.data;
    var bits = [];
    function push(v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >> k) & 1); }
    push(4, 4); push(bytes.length, 8);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    var rem8 = 8 - (bits.length % 8); if (rem8 === 8) rem8 = 0;
    var term = Math.min(4, rem8); push(0, term === 0 ? 0 : term);
    while (bits.length % 8 !== 0) push(0, 8 - (bits.length % 8));
    var dataWords = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | (bits[i + k] || 0);
      dataWords.push(b);
    }
    while (dataWords.length < totalData) dataWords.push((dataWords.length % 2) === 0 ? 0xEC : 0x11);
    var per = cfg.data;
    var blocks = [];
    for (var b = 0; b < cfg.blk; b++) blocks.push(dataWords.slice(b * per, (b + 1) * per));
    var eccs = [];
    for (var b = 0; b < cfg.blk; b++) eccs.push(rsRem(blocks[b], cfg.ecc));
    var final = [];
    for (var i = 0; i < per; i++) { for (var b = 0; b < cfg.blk; b++) final.push(blocks[b][i]); }
    for (var i = 0; i < cfg.ecc; i++) { for (var b = 0; b < cfg.blk; b++) final.push(eccs[b][i]); }
    // 数据单元收集（跳过功能图案、格式位、暗色模块占位）
    var base = baseMatrix(size, ALIGN[version]);
    var fmt = [8, size - 8].join(',');
    var skip = formatPositions(size);
    function isFunc(x, y) { return base[y][x] !== 0 || (x === 8 && y === size - 8) || skip.some(function (p) { return p.x === x && p.y === y; }); }
    var cells = [];
    var dir = -1, col = size - 1;
    function walk() {
      if (col === 6) col--;
      for (var row = dir < 0 ? size - 1 : 0; row >= 0 && row < size; row += dir) {
        for (var k = 0; k < 2; k++) {
          var x = col - k;
          if (x < 0) continue;
          if (!isFunc(x, row)) cells.push({ x: x, y: row });
        }
      }
      if (col - 2 < 0) return;
      dir = -dir; col -= 2; walk();
    }
    walk();
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var trial = clone(base);
      trial[size - 8][8] = 1;
      for (var i = 0; i < cells.length && i < final.length; i++) {
        var c = cells[i];
        var v = final[i] ^ (maskBit(c.x, c.y, mask) ? 1 : 0);
        trial[c.y][c.x] = v;
      }
      var s = penalty(trial);
      if (!best || s < best.score) best = { mask: mask, m: trial, score: s };
    }
    var fmtBits = encodeFormat(best.mask);
    (function putFormat() {
      var list = formatPositions(size);
      for (var i = 0; i < 15; i++) {
        var bit = ((fmtBits >> i) & 1) === 1 ? 1 : 0;
        best.m[list[i * 2].y][list[i * 2].x] = bit;       // 竖排（左/左下副本）
        best.m[list[i * 2 + 1].y][list[i * 2 + 1].x] = bit; // 横排（上/右上副本）
      }
      best.m[size - 8][8] = 1; // 暗色模块（列 8、行 size-8）
    })();
    return best.m;
  }
  function generateSVG(text, scale) {
    var m = generate(text), size = m.length, s = scale || 3;
    var rects = [];
    for (var y = 0; y < size; y++) { for (var x = 0; x < size; x++) { if (m[y][x]) rects.push('<rect x="' + (x * s) + '" y="' + (y * s) + '" width="' + s + '" height="' + s + '" fill="#111" />'); } }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (size * s) + ' ' + (size * s) + '" width="' + (size * s) + '" height="' + (size * s) + '" shape-rendering="crispEdges" role="img" aria-label="节点二维码">' + rects.join('') + '</svg>';
  }
  return { generate: generate, generateSVG: generateSVG };
})();`;

export { 二维码运行时 };
```

> 落地代码即为字面量 `const 二维码运行时 = \`window.QRCode = ...\`;`；该字符串内容不允许出现反引号、`${`、`</script`（嵌入式脚本合法）。

- [ ] **Step 4: 运行确认通过**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-qr.mjs`
Expected: PASS，输出 `[test-ui] qr 运行时结构断言通过`。若断言失败（矩阵尺寸/定位眼/时序），修正 qr.js 后重跑。最终以 staging 真机扫码复核为准。

- [ ] **Step 5: 挂入 npm test + 层检查**

Modify `package.json` 的 `test` 脚本，追加：

```json
&& node --import ./scripts/register-test-loader.mjs scripts/test-qr.mjs
```

Run: `node scripts/check-modules.cjs && npm test`
Expected: `[modules] …通过`（模块数 +1：qr.js），6 个测试全绿。

- [ ] **Step 6: 提交**

```bash
git add src/admin/qr.js scripts/test-qr.mjs package.json
git commit -m "feat: 内嵌二维码运行时 qr.js（版本1-6，纠错M，零依赖）"
```

---

## Task 4: 面板 UI 模块 + main.js 切换 + 全量验证

**Files:**
- Create: `src/admin/ui.js`
- Create: `scripts/test-ui.mjs`
- Modify: `src/main.js`（import 与 `/admin` 渲染切换）
- Modify: `src/admin/panel.js`（删除旧配置页函数，清理 import）
- Modify: `_worker.js`（重新构建）

- [ ] **Step 1: 写失败测试**

Create `scripts/test-ui.mjs`:

```js
import { 管理面板HTML } from '../src/admin/ui.js';
import assert from 'node:assert/strict';

;(async () => {
  const 正常配置 = {
    HOST: 'edt2.example.org', LINK: 'vless://aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee@edt2.example.org:443?security=tls&type=ws#edgetunnel',
    PATH: '/', 协议类型: 'vless', 传输协议: 'ws', gRPC模式: 'gun', Fingerprint: 'chrome', ECH: false, 启用0RTT: false,
    完整节点路径: '/', SS: { 加密方式: 'aes-128-gcm', TLS: true },
    优选订阅生成: { TOKEN: 'tok123', SUBNAME: 'edgetunnel', SUBUpdateTime: 3, local: true, 本地IP库: { 随机IP: true, 随机数量: 16, 指定端口: -1 } },
    订阅转换配置: { SUBAPI: 'https://SUBAPI.example.net', SUBCONFIG: 'https://raw.example/cfg.ini', SUBEMOJI: false, SUBLIST: false, UDP: false, XUDP: false, TLS13: false, APPEND_TYPE: false, SORT: false },
    反代: { PROXYIP: 'auto', SOCKS5: { 启用: null, 全局: false, 账号: '', 白名单: [] } },
    TG: { 启用: false, BotToken: null, ChatID: null },
    CF: { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null, Usage: { success: true, pages: 10, workers: 300, total: 310, max: 100000 } },
  };

  // 1) 四个 Tab + 首屏数据注入 + QR 运行时 + 客户端脚本
  const html = 管理面板HTML({}, 正常配置);
  for (const 需包含 of ['data-tab="overview"', 'data-tab="nodes"', 'data-tab="config"', 'data-tab="ops"', '__ET__', 'window.QRCode', 'usage-history']) {
    assert.ok(html.includes(需包含), `HTML 应包含 ${需包含}`);
  }
  // 2) 订阅链接与节点链接出现在页面（server-render 或 __ET__ 数据中）
  assert.ok(html.includes('tok123') && html.includes('edt2.example.org'), '注入的 token 与 host 出现');

  // 3) XSS：恶意值必须被转义
  const 恶意 = {
    ...正常配置,
    HOST: '<script>alert(1)</script>', LINK: 'vless://x" onmouseover="alert(1)@evil.test#t',
    优选订阅生成: { ...正常配置.优选订阅生成, SUBNAME: '<b>sub</b>' },
  };
  const html恶 = 管理面板HTML({}, 恶意);
  assert.ok(!html恶.includes('<script>alert(1)</script>'), '未转义的 script 注入不得出现');
  assert.ok(html恶.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'host 以转义形式出现');
  assert.ok(!html恶.includes(' onmouseover="alert(1)'), '属性注入被转义');
  assert.ok(!html恶.includes('<b>sub</b>'), 'SUBNAME 转义');

  // 4) 出站模式摘要：无 PROXYIP 显示 auto
  assert.ok(html.includes('auto'), 'env 无 PROXYIP 时摘要求 auto');

  console.log('[test-ui] ui.html 结构 / XSS 断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });
```

- [ ] **Step 2: 运行确认失败**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: FAIL（ui.js 不存在，`ERR_MODULE_NOT_FOUND`）。

- [ ] **Step 3: 实现 ui.js**

Create `src/admin/ui.js`：

```js
// 本地内嵌管理面板：单一导出，返回完整 HTML（内联 CSS + SPA 客户端 JS + 内嵌二维码运行时）。
// 零外部依赖。依赖 core/html.js（转义/掩码）与 admin/qr.js（二维码运行时字符串）。
import { 掩码敏感信息, 转义HTML } from '../core/html.js';
import { 二维码运行时 } from './qr.js';

const CSS = `
:root{--bg:#0f1420;--card:#1a2130;--line:#2a3346;--fg:#e6e8ee;--mut:#8b93a7;--acc:#2f81f7;--ok:#3fb950;--err:#f85149}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 60px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
h1{font-size:19px;margin:0}h1 small{color:var(--mut);font-weight:400;font-size:13px}
a{color:#8abaff;text-decoration:none}a:hover{text-decoration:underline}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}nav button{background:transparent;border:1px solid var(--line);color:var(--mut);border-radius:8px;padding:8px 14px;font-size:14px;cursor:pointer}
nav button.on{background:var(--acc);border-color:var(--acc);color:#fff}
.page{display:none}.page.on{display:block}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:14px}
.card h2{font-size:15px;margin:0 0 12px;color:#c9d2e3}
.hero{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.gauge{flex:0 0 120px}label{font-size:12px;color:var(--mut);display:block;margin:10px 0 4px}
input,select,textarea{width:100%;background:#0f1420;color:#d8e0ee;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:13px}
textarea{font:12px/1.5 monospace;resize:vertical}
button.btn{min-height:44px;background:var(--acc);color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:14px;cursor:pointer}
button.btn:hover{background:#1f6bd6}button.ghost{background:var(--line);color:var(--fg)}
table{width:100%;border-collapse:collapse;font-size:13px}td{overflow-wrap:anywhere;padding:6px 8px;border-bottom:1px solid #232c3e}td.mn{width:200px;color:var(--mut)}
.qr svg{max-width:180px;height:auto;background:#fff;padding:8px;border-radius:8px}
.mono{font:12px/1.5 monospace;word-break:break-all;background:#0f1420;border:1px solid var(--line);border-radius:8px;padding:10px;margin:6px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.kvList{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.kvList .item{background:#0f1420;border:1px solid var(--line);border-radius:8px;padding:10px}
.kvList .item b{display:block;font-size:12px;color:var(--mut);margin-bottom:4px}
.dim{color:var(--mut);font-size:13px}
#toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#111;border:1px solid var(--line);border-radius:8px;padding:10px 16px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:9;max-width:86vw}
#toast.show{opacity:1}#toast.ok{border-color:var(--ok)}#toast.err{border-color:var(--err)}
#chart svg{width:100%;height:auto}
@media(max-width:640px){.hero{flex-direction:column}}
`;

// 面板渲染入口：env（只读 env 展示/出站模式推导）+ config_JSON（生效配置，含掩码凭据）
function 管理面板HTML(env, config_JSON) {
  const 出站 = env.PROXYIP ? 'manual(' + (String(env.PROXYIP).includes(',') ? '多候选' : 掩码敏感信息(String(env.PROXYIP))) + ')' : String(env.出站模式 || env.EGRESS_MODE || 'auto');
  const 摘 = {
    host: config_JSON.HOST || '',
    link: config_JSON.LINK || '',
    subname: config_JSON.优选订阅生成?.SUBNAME || 'edgetunnel',
    token: config_JSON.优选订阅生成?.TOKEN || '',
    出站,
    path: config_JSON.完整节点路径 || '/',
    协议类型: config_JSON.协议类型, 传输协议: config_JSON.传输协议, gRPC模式: config_JSON.gRPC模式 || 'gun',
    Fingerprint: config_JSON.Fingerprint || 'chrome', ECH: !!config_JSON.ECH, 启用0RTT: !!config_JSON.启用0RTT,
    TLS分片: config_JSON.TLS分片 || '', ALPN: config_JSON.ALPN || '',
    SS: { 加密方式: config_JSON.SS?.加密方式 || 'aes-128-gcm', TLS: !!config_JSON.SS?.TLS },
    反代: config_JSON.反代?.PROXYIP || 'auto',
    用量: { ...{ success: false, pages: 0, workers: 0, total: 0, max: 100000 }, ...config_JSON.CF?.Usage },
    TG: config_JSON.TG || { 启用: false, BotToken: null, ChatID: null },
    CF: config_JSON.CF || {},
  };
  const 订阅链接 = 'https://' + 摘.host + '/sub?token=' + encodeURIComponent(摘.token);
  const sse = 转义HTML(摘.host);
  const env只读行 = [
    ['ADMIN', env.ADMIN ? '已配置' : '未配置'],
    ['KEY', env.KEY ? 掩码敏感信息(String(env.KEY)) : '未配置'],
    ['HOST', env.HOST || '（默认访问域名）'],
    ['UUID', env.UUID || '（自动派生）'],
    ['PROXYIP', env.PROXYIP ? 掩码敏感信息(String(env.PROXYIP)) : '（未配置）'],
    ['出站模式/EGRESS_MODE', env.出站模式 || env.EGRESS_MODE || 'auto'],
    ['URL', env.URL || 'nginx'],
    ['PATH', env.PATH || '/'],
    ['GO2SOCKS5', env.GO2SOCKS5 || '（未配置）'],
    ['DEBUG', env.DEBUG ? '开启' : '关闭'],
    ['BEST_SUB', env.BEST_SUB ? '开启' : '关闭'],
    ['PRELOAD_RACE_DIAL', env.PRELOAD_RACE_DIAL ? '开启' : '关闭'],
    ['PROXY_CONCURRENT_DIAL', env.PROXY_CONCURRENT_DIAL || '1'],
    ['TCP_CONCURRENT_DIAL', env.TCP_CONCURRENT_DIAL || '2'],
  ].map(([名, 值]) => `<tr><td class="mn">${名}</td><td>${转义HTML(String(值))}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>edgetunnel 管理面板 · ${sse}</title>
<style>${CSS}</style>
</head>
<body>
<div id="toast" role="status" aria-live="polite"></div>
<div class="wrap">
<header>
  <h1>edgetunnel 管理面板 <small>${sse}</small></h1>
  <div class="row"><a href="/admin/config">经典 JSON 页</a> · <a href="/logout">退出登录</a></div>
</header>
<nav>
  <button type="button" class="on" data-tab="overview">概览</button>
  <button type="button" data-tab="nodes">节点与订阅</button>
  <button type="button" data-tab="config">配置</button>
  <button type="button" data-tab="ops">运维</button>
</nav>

<section class="page on" data-page="overview">
  <div class="card">
    <h2>请求用量</h2>
    <div class="hero">
      <div class="gauge"><svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#2a3346" stroke-width="12"/>
        <circle id="ubar-fill" cx="60" cy="60" r="50" fill="none" stroke="#2f81f7" stroke-width="12" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="314" transform="rotate(-90 60 60)"/>
        <text id="utext" x="60" y="66" text-anchor="middle" font-size="12" fill="#e6e8ee"></text>
      </svg></div>
      <div style="flex:1;min-width:240px">
        <div class="kvList">
          <div class="item"><b>协议 / 传输</b>${转义HTML(摘.协议类型)} / ${转义HTML(摘.传输协议)}</div>
          <div class="item"><b>gRPC 模式</b>${转义HTML(摘.gRPC模式)}</div>
          <div class="item"><b>Fingerprint</b>${转义HTML(摘.Fingerprint)}</div>
          <div class="item"><b>路径</b>${转义HTML(摘.path)}</div>
          <div class="item"><b>出站模式</b>${转义HTML(摘.出站)}</div>
          <div class="item"><b>反代</b>${转义HTML(摘.反代)}</div>
          <div class="item"><b>ECH / 0RTT</b>${摘.ECH ? '开' : '关'} / ${摘.启用0RTT ? '开' : '关'}</div>
          <div class="item"><b>SS</b>${转义HTML(摘.SS.加密方式)} / TLS ${摘.SS.TLS ? '开' : '关'}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <h2>近 30 天用量趋势</h2>
    <div id="chart"><p class="dim">加载中…</p></div>
  </div>
  <div class="card">
    <h2>访问日志</h2>
    <p class="dim">访问日志不再写入 KV；请在 Cloudflare 控制台 → Workers → 本 Worker → Logs 查看结构化 access 事件（<a href="https://developers.cloudflare.com/workers/observability/logs/" rel="noopener" target="_blank">文档</a>）。</p>
  </div>
</section>

<section class="page" data-page="nodes">
  <div class="card">
    <h2>主节点</h2>
    <div class="mono" id="nlink-code"></div>
    <div class="row">
      <button type="button" class="btn" id="btn-copy-link">复制链接</button>
      <button type="button" class="btn ghost" id="btn-copy-sub">复制通用订阅</button>
      <button type="button" class="btn ghost" id="btn-copy-clash">复制 Clash 原生</button>
      <button type="button" class="btn ghost" id="btn-copy-singbox">复制 sing-box 原生</button>
    </div>
    <div class="qr" id="qr" aria-label="节点二维码"></div>
  </div>
  <div class="card">
    <h2>订阅链接</h2>
    <div class="mono" id="sub-link"></div>
    <p class="dim">订阅更新周期：每 3 小时提示一次；原生订阅为最小配置（Clash/sing-box），不含自定义分流规则。</p>
  </div>
  <div class="card">
    <h2>客户端格式</h2>
    <p class="dim">以下链接在已登录会话下可直接复制（?target=clash/singbox/surge/loon/quanx/v2rayn/shadowrocket）。</p>
    <div class="row" id="fmt-links"></div>
  </div>
</section>

<section class="page" data-page="config">
  <div class="card">
    <h2>常用字段</h2>
    <div class="kvList">
      <div><label>协议类型</label><select id="c-协议类型"><option>vless</option><option>trojan</option><option>ss</option></select></div>
      <div><label>传输协议</label><select id="c-传输协议"><option>ws</option><option>grpc</option><option>xhttp</option></select></div>
      <div><label>PATH</label><input id="c-PATH" /></div>
      <div><label>Fingerprint</label><input id="c-Fingerprint" /></div>
      <div><label>ALPN（空则不生成）</label><input id="c-ALPN" placeholder="h2" /></div>
      <div><label>TLS 分片</label><select id="c-TLS分片"><option value="">关闭</option><option value="Shadowrocket">Shadowrocket</option><option value="Happ">Happ</option></select></div>
      <div class="row" style="grid-column:1/-1"><label><input id="c-ECH" type="checkbox" /> ECH</label><label><input id="c-启用0RTT" type="checkbox" /> 启用 0RTT</label></div>
    </div>
    <div class="row"><button type="button" class="btn" id="btn-save-ess">保存常用字段</button><span class="dim">写入 KV cfg:{host}，跨区传播需时间</span></div>
  </div>
  <div class="card">
    <h2>KV 全量配置（JSON）</h2>
    <div class="row"><button type="button" class="btn" id="btn-save-json">保存到 KV</button><button type="button" class="btn ghost" id="btn-restore">恢复上一版本</button> <button type="button" class="btn ghost" id="btn-load-json">重新加载</button><span id="cfg-status" class="dim"></span></div>
    <label for="cfg">当前配置 JSON</label>
    <textarea id="cfg" rows="14" spellcheck="false" placeholder="点击『重新加载』获取当前生效配置…"></textarea>
  </div>
  <div class="card">
    <h2>环境变量（只读）</h2>
    <table><thead><tr><th scope="col" class="mn">变量</th><th scope="col">当前值</th></tr></thead><tbody>${env只读行}</tbody></table>
  </div>
</section>

<section class="page" data-page="ops">
  <div class="card">
    <h2>Telegram 通知</h2>
    <label>BotToken（留空保持不变）</label><input id="o-tg-bot" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.TG.BotToken || '')) || '未配置')}" />
    <label>ChatID</label><input id="o-tg-chat" value="${转义HTML(String(摘.TG.ChatID || ''))}" />
    <div class="row"><button type="button" class="btn" id="btn-save-tg">保存 TG</button></div>
  </div>
  <div class="card">
    <h2>Cloudflare API 凭据</h2>
    <label>AccountID（留空保持不变）</label><input id="o-cf-account" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.AccountID || '')) || '未配置')}" />
    <label>APIToken（留空保持不变）</label><input id="o-cf-token" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.APIToken || '')) || '未配置')}" />
    <label>Email（备选认证）</label><input id="o-cf-email" value="${转义HTML(String(摘.CF.Email || ''))}" />
    <label>GlobalAPIKey（备选认证）</label><input id="o-cf-gkey" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.GlobalAPIKey || '')) || '未配置')}" />
    <label>UsageAPI（可选，覆盖自动查询）</label><input id="o-cf-usageapi" value="${转义HTML(String(摘.CF.UsageAPI || ''))}" />
    <p class="dim">凭据仅保存在服务端 KV；页面始终掩码展示。留空的字段不会被提交覆盖。</p>
    <div class="row"><button type="button" class="btn" id="btn-save-cf">保存 CF</button><button type="button" class="btn ghost" id="btn-refresh-usage">立即刷新用量</button></div>
  </div>
  <div class="card">
    <h2>自定义优选 IP（ADD.txt）</h2>
    <textarea id="o-add" rows="6" placeholder="每行一个 IP:端口，留空使用自动优选"></textarea>
    <div class="row"><button type="button" class="btn" id="btn-save-add">保存优选 IP</button></div>
  </div>
  <div class="card">
    <h2>危险区</h2>
    <div class="row"><button type="button" class="btn" id="btn-init">重置配置为默认值</button><span class="dim">将清空 KV cfg:{host}，恢复默认；请先备份。</span></div>
  </div>
</section>
</div>
<script>window.__ET__=${JSON.stringify(摘).replace(/</g, '\\u003c')};</script>
<script>${二维码运行时}</script>
<script>
'use strict';
(function () {
  var S = window.__ET__;
  function $(s) { return document.querySelector(s); }
  function toast(msg, ok) {
    var t = $('#toast'); t.textContent = msg; t.className = 'show ' + (ok ? 'ok' : 'err');
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, 3200);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { toast('已复制'); }, function () { toast('复制失败'); }); }
    else {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败'); }
      ta.remove();
    }
  }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var m = (j && (j.error || j.msg)) || ('HTTP ' + r.status); throw new Error(m); }
        return j;
      });
    });
  }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString() : String(n || 0); }

  // Tab 切换
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) { b.classList.toggle('on', b === btn); });
      Array.prototype.slice.call(document.querySelectorAll('.page')).forEach(function (p) { p.classList.toggle('on', p.dataset.page === btn.dataset.tab); });
      if (btn.dataset.tab === 'overview') loadOverview();
      if (btn.dataset.tab === 'config') loadConfig();
      if (btn.dataset.tab === 'ops') loadOps();
    });
  });

  // 概览
  function loadOverview() {
    var use = S.用量 || {}, max = use.max || 1, total = use.total || 0;
    var c = $('#ubar-fill'); if (c) c.setAttribute('stroke-dashoffset', String(314 - 314 * Math.min(1, total / max)));
    var t = $('#utext'); if (t) t.textContent = fmt(total) + ' / ' + fmt(max) + ' ' + ((total / max) * 100).toFixed(1) + '%';
    api('/admin/api/usage-history').then(function (rows) {
      var box = $('#chart'); if (!box) return;
      if (!rows || !rows.length) { box.innerHTML = '<p class="dim">暂无历史数据（下次用量刷新后写入）</p>'; return; }
      var W = 640, H = 180, pad = 24;
      var maxV = rows.reduce(function (m, r) { return Math.max(m, r.total || 0); }, 1);
      var bw = (W - pad * 2) / rows.length, bars = '', ticks = '';
      rows.forEach(function (r, i) {
        var h = Math.max(2, ((r.total || 0) / maxV) * (H - pad * 2));
        var x = pad + i * bw, y = H - pad - h;
        bars += '<rect x="' + x + '" y="' + y + '" width="' + Math.max(2, bw - 3) + '" height="' + h + '" rx="2" fill="#2f81f7"><title>' + r.date + ': ' + fmt(r.total) + '</title></rect>';
        if (i % 5 === 0) ticks += '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" font-size="9" fill="#8b93a7" text-anchor="middle">' + (r.date || '').slice(5) + '</text>';
      });
      box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近30天用量">' + bars + ticks + '</svg>';
    }).catch(function (e) { var box = $('#chart'); if (box) box.innerHTML = '<p class="dim">用量历史不可用：' + e.message + '</p>'; });
  }

  // 节点与订阅
  function loadNodes() {
    $('#nlink-code').textContent = S.link || '';
    $('#sub-link').textContent = 'https://' + S.host + '/sub?token=' + S.token;
    var qr = $('#qr');
    try { qr.innerHTML = window.QRCode.generateSVG(S.link || 'no-link'); qr.style.display = ''; }
    catch (e) { qr.innerHTML = '<p class="dim">二维码生成失败：' + e.message + '</p>'; }
    var fmts = [['clash', 'Clash'], ['singbox', 'sing-box'], ['surge', 'Surge'], ['loon', 'Loon'], ['quanx', 'Quantumult X'], ['v2rayn', 'v2rayN'], ['shadowrocket', 'Shadowrocket']];
    $('#fmt-links').innerHTML = fmts.map(function (f) {
      return '<button type="button" class="btn ghost" data-fmt="' + f[0] + '">' + f[1] + '</button>';
    }).join('');
    Array.prototype.slice.call(document.querySelectorAll('[data-fmt]')).forEach(function (b) {
      b.addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token + '&target=' + b.dataset.fmt); });
    });
  }
  $('#btn-copy-link').addEventListener('click', function () { copy(S.link || ''); });
  $('#btn-copy-sub').addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token); });
  $('#btn-copy-clash').addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token + '&target=clash&native=1'); });
  $('#btn-copy-singbox').addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token + '&target=singbox&native=1'); });

  // 配置
  function loadConfig() {
    api('/admin/config.json').then(function (cfg) {
      $('#cfg').value = JSON.stringify(cfg, null, 2);
      var p = cfg.协议类型; if (p) $('#c-协议类型').value = p;
      var t = cfg.传输协议; if (t) $('#c-传输协议').value = t;
      $('#c-PATH').value = cfg.PATH || '';
      $('#c-Fingerprint').value = cfg.Fingerprint || '';
      $('#c-ALPN').value = cfg.ALPN || '';
      var ts = cfg.TLS分片; $('#c-TLS分片').value = (ts === 'Shadowrocket' || ts === 'Happ') ? ts : '';
      $('#c-ECH').checked = !!cfg.ECH;
      $('#c-启用0RTT').checked = !!cfg.启用0RTT;
    }).catch(function (e) { statusCfg('加载失败：' + e.message); });
  }
  function statusCfg(m) { var s = $('#cfg-status'); if (s) s.textContent = m; }
  $('#btn-load-json').addEventListener('click', function () { loadConfig(); statusCfg(''); });
  $('#btn-save-json').addEventListener('click', function () {
    var obj; try { obj = JSON.parse($('#cfg').value); } catch (e) { statusCfg('JSON 解析失败：' + e.message); return; }
    statusCfg('正在保存…');
    api('/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
      .then(function (r) { statusCfg('保存成功：' + (r.message || '')); toast('配置已保存', true); })
      .catch(function (e) { statusCfg('保存失败：' + e.message); });
  });
  $('#btn-restore').addEventListener('click', function () {
    if (!confirm('恢复上一版本将覆盖当前配置，继续？')) return;
    api('/admin/config/restore', { method: 'POST' }).then(function (r) { statusCfg('已提交：' + (r.message || '')); }).catch(function (e) { statusCfg('恢复失败：' + e.message); });
  });
  $('#btn-save-ess').addEventListener('click', function () {
    api('/admin/config.json').then(function (cfg) {
      cfg.协议类型 = $('#c-协议类型').value; cfg.传输协议 = $('#c-传输协议').value;
      cfg.PATH = $('#c-PATH').value; cfg.Fingerprint = $('#c-Fingerprint').value;
      cfg.ALPN = $('#c-ALPN').value || '';
      cfg.TLS分片 = $('#c-TLS分片').value || null;
      cfg.ECH = $('#c-ECH').checked; cfg.启用0RTT = $('#c-启用0RTT').checked;
      return api('/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    }).then(function (r) { toast('常用字段已保存', true); statusCfg('已保存：' + (r.message || '')); })
      .catch(function (e) { toast('保存失败：' + e.message, false); });
  });

  // 运维
  function loadOps() {
    api('/admin/ADD.txt').then(function (t) { if (typeof t === 'string') $('#o-add').value = t; })
      .catch(function () { $('#o-add').placeholder = '加载失败'; });
  }
  $('#btn-save-tg').addEventListener('click', function () {
    var body = { BotToken: $('#o-tg-bot').value.trim(), ChatID: $('#o-tg-chat').value.trim() };
    if (!body.BotToken && !body.ChatID) { toast('至少填写 BotToken 或 ChatID', false); return; }
    api('/admin/tg.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { toast('TG 已保存', true); }).catch(function (e) { toast('保存失败：' + e.message, false); });
  });
  $('#btn-save-cf').addEventListener('click', function () {
    var body = { AccountID: $('#o-cf-account').value.trim(), APIToken: $('#o-cf-token').value.trim(), Email: $('#o-cf-email').value.trim(), GlobalAPIKey: $('#o-cf-gkey').value.trim(), UsageAPI: $('#o-cf-usageapi').value.trim() };
    api('/admin/cf.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { toast('CF 凭据已保存', true); }).catch(function (e) { toast('保存失败：' + e.message, false); });
  });
  $('#btn-refresh-usage').addEventListener('click', function () {
    api('/admin/getCloudflareUsage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { toast('用量结果：' + fmt(r.total) + ' / ' + fmt(r.max), true); })
      .catch(function (e) { toast('刷新失败：' + e.message, false); });
  });
  $('#btn-save-add').addEventListener('click', function () {
    fetch('/admin/ADD.txt', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: $('#o-add').value })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (r) { toast(r.message || '已保存', true); }).catch(function (e) { toast('保存失败：' + e.message, false); });
  });
  $('#btn-init').addEventListener('click', function () {
    if (!confirm('确认将配置重置为默认值？此操作不可撤销。')) return;
    api('/admin/init', { method: 'POST' }).then(function (r) { toast('配置已重置', true); loadConfig(); }).catch(function (e) { toast('重置失败：' + e.message, false); });
  });

  loadOverview(); loadNodes(); loadConfig(); loadOps();
})();
</script>
</body>
</html>`;
}

export { 管理面板HTML };
```

> 说明：客户端脚本与 CSS 全部采用字符串拼接/普通模板，不引入反引号嵌套与 `${}` 冲突；QR 运行时在浏览器端由 `window.QRCode.generateSVG(link)` 渲染。

- [ ] **Step 4: main.js 切换 /admin 渲染 + panel.js 清理**

修改 `src/main.js`：
1) 把第 3 行

```js
import { 管理面板配置页HTML, 请求日志记录 } from './admin/panel.js';
```

改为：

```js
import { 请求日志记录 } from './admin/panel.js';
import { 管理面板HTML } from './admin/ui.js';
```

2) 两处 `管理面板配置页HTML(env, config_JSON)`（L313、L318）改为 `管理面板HTML(env, config_JSON)`。

修改 `src/admin/panel.js`：删除 `管理面板配置页HTML` 函数（约 L43-L84）及其 `掩码敏感信息, 转义HTML` import；把顶部

```js
import { 掩码敏感信息, 转义HTML } from '../core/html.js';
import { 安全日志URL } from '../security.js';
```

改为：

```js
import { 安全日志URL } from '../security.js';
```

并把尾部导出

```js
export { 管理面板配置页HTML, 请求日志记录 };
```

改为：

```js
export { 请求日志记录 };
```

（`请求日志记录` 只使用 `安全日志URL`，见其函数体。）

- [ ] **Step 5: 运行测试**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: PASS，输出 `[test-ui] ui.html 结构 / XSS 断言通过`。若 XSS 断言失败，检查 `转义HTML` 使用位置与 `JSON.stringify(...).replace(/</g,'\\u003c')` 注入。

- [ ] **Step 6: 挂入 npm test**

Modify `package.json` 的 `test` 脚本，在 `test-qr` 之后追加：

```json
&& node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs
```

- [ ] **Step 7: 层边界 + 全量校验 + 重新生成产物并提交**

```bash
npm run build       # 重新生成 _worker.js（--force 覆盖，含 ui/qr/usage-history 全部接线）
npm run check       # verify.js（模块边界 + 字节比对）+ npm test（7 项全绿）
git add src/main.js src/admin/panel.js src/admin/ui.js scripts/test-ui.mjs package.json _worker.js
git commit -m "feat: 本地内嵌管理面板（概览/节点订阅/配置/运维）替换精简 JSON 页"
```

Expected: `[check] 通过`，7 个测试全绿（test-modules / test-config / test-subscribe / test-regression / test-usage-history / test-qr / test-ui）。

---

## Task 5: 端到端人工验收（staging，不写死进 CI）

- [ ] **Step 1: staging 验证**

```bash
npm run dev         # 或 wrangler dev --env staging 后打开 /admin
```

人工核对：登录 → 四个 Tab 可见可切换；概览用量环与趋势（首次提示无历史数据）；节点链接复制 + 二维码可扫；订阅/格式链接可复制；常用字段保存 → KV `cfg:{host}` 写入且页面提示成功；JSON 保存与恢复上一版本；TG/CF 表单留空提交不被掩码覆盖（可在 KV 后台核对 cf.json 未被污染）；ADD.txt 保存；重置初始化二次确认；`REMOTE_ADMIN=true` 行为不受影响（旧分支保留）。

- [ ] **Step 2: 更新 README 行为说明（如适用）**

若 README 提到"配置管理页"文案，改为指向新面板；不改动架构文档。按需提交（不强制，避免文档漂移）。

---

## 自审结论（plan 对 spec 覆盖）

- spec「概览」→ Task 4 ui.js 概览 Tab + Task 1/2 用量历史（含趋势、状态卡、日志引导）；✓
- spec「节点与订阅」→ Task 4 节点 Tab（复制/二维码/订阅链接/格式链接）；✓
- spec「配置」→ Task 4 配置 Tab（JSON 编辑/恢复/常用字段表单/env 只读表）；✓
- spec「运维」→ Task 4 运维 Tab（TG/CF/ADD.txt/重置/用量刷新）；✓
- spec「新增接口」→ Task 2 `admin/api/usage-history` + snapshot 写点；✓
- spec「安全」→ Task 2 掩码回写防护；Task 4 转义（XSS 测试覆盖）；会话/同源校验沿用既有层；✓
- spec「测试与构建」→ Task 1/3/4 三个新测试 + 构建零改动 + 产物重生成；✓
- spec「保留 REMOTE_ADMIN」→ Task 4 未移除旧分支；✓