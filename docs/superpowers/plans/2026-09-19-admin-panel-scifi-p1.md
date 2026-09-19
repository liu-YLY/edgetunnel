# 管理面板 P1（科幻融合视觉 + 主题/动效 + 交互效率）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 564 行单文件 `src/admin/ui.js` 拆成 `src/admin/ui/` 子模块，落地 A+D 融合视觉（切角 HUD + 深蓝克制）、深/浅主题与三档动效、以及命令面板/编辑器增强/加载态等交互效率改造，产物仍是单文件 `_worker.js`。

**Architecture:** 拆为 `index.js`（渲染入口，导出签名不变的 `管理面板HTML`）、`theme.js`（主题令牌与动效规则）、`styles.js`（组件样式）、`client.js`（客户端运行时）、`tabs/{overview,nodes,config,ops}.js`（HTML 片段）。依赖单向无环：`index → theme/styles/client/tabs/*`；`tabs/* → core/html.js`；`client.js`、`theme.js`、`styles.js` 零 import。构建链零改动（已核实 `check-modules.cjs` 的 `layer()` 取路径第二段 → 子目录仍属 `admin` 层且允许层内互引；`verify.js` 递归扫描不依赖文件清单）。

**Tech Stack:** Node ≥22；原生浏览器 API（`clip-path`、`localStorage`、`matchMedia`、`Clipboard`、`canvas`）；无任何第三方依赖。测试＝`node:assert` + ESM 测试加载器（`node --import ./scripts/register-test-loader.mjs`）。

**关键基线（务必先读）：**

- 现有单文件 `src/admin/ui.js` 结构：`const CSS` L6–L74；`管理面板HTML(env, config_JSON)` L77；`摘` L79–L94；`env只读行` L97–L112；HTML 返回 L114–L280；`<script>window.__ET__` L278；二维码运行时 L279；客户端 IIFE L280–L562。
- 必须保持不变的 DOM 契约（**不得重命名**）：`#toast`（`.show/.ok/.err`）、`#chart`/`#chart-tip`、`#ubar-fill`/`#utext`、`#clock`/`#clock-local`/`#clock-utc`、`#badges`、`#qr`/`#qr-big`/`#qr-modal`、`#kbd-help`、`#diag`/`#diag-note`、`#cfg`/`#cfg-status`、`#nlink-code`/`#sub-link`/`#fmt-links`、全部 `#btn-*`（`btn-copy-link`/`btn-copy-sub`/`btn-copy-clash`/`btn-copy-singbox`/`btn-open-qr`/`btn-qr-close`/`btn-qr-download`/`btn-kbd-close`/`btn-refresh-top`/`btn-diag-copy`/`btn-save-tg`/`btn-save-cf`/`btn-refresh-usage`/`btn-save-add`/`btn-init`/`btn-save-ess`/`btn-save-json`/`btn-restore`/`btn-load-json`/`btn-cfg-export`/`btn-cfg-import`）、`#c-*`、`#o-*`、`nav [data-tab]`、`.page[data-page]`、`.card/.hero/.gauge/.kvList/.item/.mono/.row/.qr/.dim/.badges/.badge/.clock/.badges/.side-node`。
- 仅 2 处代码引用 `src/admin/ui.js`：[src/main.js:4](file:///workspace/src/main.js#L4)、[scripts/test-ui.mjs:1](file:///workspace/scripts/test-ui.mjs#L1)。

---

### Task 0: 基线校验

**Files:** 无改动

- [ ] **Step 1: 跑现有面板测试，确认基线为绿**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: `[test-ui] ui.html 结构 / XSS 断言通过`，exit 0。

- [ ] **Step 2: 记录等价性基线快照（Task 1 要用）**

Run:
```bash
node --import ./scripts/register-test-loader.mjs -e "
import('./src/admin/ui.js').then(m=>{
  const cfg={HOST:'edt2.example.org',LINK:'vless://aaaa@edt2.example.org:443#t',协议类型:'vless',传输协议:'ws',完整节点路径:'/',Fingerprint:'chrome',SS:{加密方式:'aes-128-gcm',TLS:true},优选订阅生成:{TOKEN:'tok123',SUBNAME:'edgetunnel'},CF:{Usage:{success:true,pages:1,workers:2,total:3,max:100}}};
  require('fs').writeFileSync('/tmp/panel-before.html', m.管理面板HTML({ADMIN:'x',KEY:'y'}, cfg));
  console.log('baseline bytes:', require('fs').statSync('/tmp/panel-before.html').size);
})"
```
Expected: 输出 `baseline bytes: <N>`，且 `/tmp/panel-before.html` 存在。

---

### Task 1: 拆模块（等价迁移，渲染结果逐字节不变）

**Files:**
- Create: `src/admin/ui/theme.js`、`src/admin/ui/styles.js`、`src/admin/ui/client.js`、`src/admin/ui/index.js`
- Create: `src/admin/ui/tabs/overview.js`、`nodes.js`、`config.js`、`ops.js`
- Delete: `src/admin/ui.js`
- Modify: `src/main.js:4`、`scripts/test-ui.mjs:1`

本任务是**纯搬运**：不新增逻辑、不改样式、不改 DOM。搬运对象是仓库里已存在的代码，按下列行号原样复制即可。

- [ ] **Step 1: 先改测试的 import 路径，确认失败**

把 `scripts/test-ui.mjs:1` 改为：
```js
import { 管理面板HTML } from '../src/admin/ui/index.js';
```
Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: FAIL（`ERR_MODULE_NOT_FOUND`，指向 `src/admin/ui/index.js`）。

- [ ] **Step 2: 建 `src/admin/ui/theme.js`（搬运现有 CSS 的令牌行与动效降级行）**

```js
// 主题令牌与动效规则。颜色只在此处定义，其它样式一律引用变量，便于切换主题。
// 本文件零 import（admin 层内自包含），只导出返回 CSS 文本的函数。

const 深色令牌 = `:root{--bg1:#0b1020;--bg2:#131a2e;--bg3:#0e1424;--glass-bg:rgba(255,255,255,.04);--glass-line:rgba(255,255,255,.09);--fg:#e6e8ee;--mut:#8b93a7;--acc:#6e8bff;--acc2:#22d3ee;--ok:#3fb950;--err:#f85149;--r:18px;--shadow:0 12px 32px rgba(0,0,0,.35)}`;

const 动效降级 = `@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto}}`;

function 主题CSS() {
  return 深色令牌 + '\n' + 动效降级;
}

export { 主题CSS };
```

- [ ] **Step 3: 建 `src/admin/ui/styles.js`（搬运现有 CSS 的其余部分）**

把原 `src/admin/ui.js` **L8–L72** 的 CSS 原样复制（即整块 CSS 去掉 L7 的 `:root{...}` 与 L73 的 `@media(prefers-reduced-motion...)`，这两行已进 `theme.js`），包成：

```js
// 组件样式：布局、卡片、按钮、表格、弹层、图表容器等。
// 颜色一律引用 theme.js 定义的 CSS 变量。本文件零 import。

const 组件样式 = `
/* 此处粘贴原 src/admin/ui.js 的 L8–L72（原样，不修改） */
`;

function 样式CSS() {
  return 组件样式;
}

export { 样式CSS };
```

- [ ] **Step 4: 建 `src/admin/ui/tabs/` 四个 HTML 片段模块**

各自导出返回 `<section>` 字符串的函数，**内容原样搬运**，签名统一为接收已转义的注入摘要 `摘`（`index.js` 负责计算）：

| 新文件 | 搬运来源 | 导出 |
|---|---|---|
| `tabs/overview.js` | 原 L150–L184 | `概览Tab()` |
| `tabs/nodes.js` | 原 L186–L216 | `节点Tab()` |
| `tabs/config.js` | 原 L218–L242 | `配置Tab(摘, env只读行)` |
| `tabs/ops.js` | 原 L244–L276 | `运维Tab(摘)` |

`tabs/config.js` 需要在文件头引入转义工具（`admin` 层允许依赖 `core`）：
```js
import { 转义HTML } from '../../core/html.js';
```
（`config.js` 内 `env只读行` 已由 `index.js` 拼好并作为参数传入，故只需 `转义HTML` 处理 `摘` 中的字段。）

- [ ] **Step 5: 建 `src/admin/ui/client.js`（搬运客户端 IIFE）**

把原 L280–L562 的 IIFE 内容原样搬运，包成：

```js
// 客户端运行时：页面内 JS（IIFE），以字符串形式注入 <script>。
// 自包含：不 import 任何模块，也不引用构建期变量。
// 唯一的外部输入是页面里先于本脚本注入的 window.__ET__。

const 客户端脚本 = `
/* 此处粘贴原 src/admin/ui.js 的 L282–L562（IIFE 主体，原样，不修改） */
`;

export { 客户端脚本 };
```

- [ ] **Step 6: 建 `src/admin/ui/index.js`（渲染入口）**

```js
// 管理面板渲染入口：拼装 head（主题/样式/防闪烁脚本）+ shell + 各 Tab + 客户端脚本。
// 零外部依赖；依赖 core/html.js（转义、掩码）、admin/qr.js（二维码运行时）、
// 同目录 theme/styles/client 与 tabs/*。
import { 掩码敏感信息, 转义HTML } from '../../core/html.js';
import { 二维码运行时 } from '../qr.js';
import { 主题CSS } from './theme.js';
import { 样式CSS } from './styles.js';
import { 客户端脚本 } from './client.js';
import { 概览Tab } from './tabs/overview.js';
import { 节点Tab } from './tabs/nodes.js';
import { 配置Tab } from './tabs/config.js';
import { 运维Tab } from './tabs/ops.js';

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
<html lang="zh-CN" data-theme="glass">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>edgetunnel 管理面板 · ${sse}</title>
<style>${主题CSS()}${样式CSS()}</style>
</head>
<body>
<div id="toast" role="status" aria-live="polite"></div>
${快捷键帮助浮层()}
<div class="wrap" id="top">
${页头(sse)}
${主导航()}
${概览Tab()}
${节点Tab()}
${配置Tab(摘, env只读行)}
${运维Tab(摘)}
</div>
<script>window.__ET__=${JSON.stringify(摘).replace(/</g, '\\u003c')};</script>
<script>${二维码运行时}</script>
<script>${客户端脚本}</script>
</body>
</html>`;
}

export { 管理面板HTML };
```

其中三个本地小函数把原 L124–L148 的固定片段原样返回（为 Task 3/4 加按钮留出位置）：

```js
function 快捷键帮助浮层() {
  return `<div id="kbd-help" role="dialog" aria-modal="true" aria-label="快捷键">
  <div class="box">
    <div class="row" style="justify-content:space-between"><b>键盘快捷键</b><button type="button" class="iconbtn" id="btn-kbd-close">关闭</button></div>
    <table>
      <tbody>
        <tr><td><kbd>1</kbd>−<kbd>4</kbd></td><td>切换 Tab（概览/节点/配置/运维）</td></tr>
        <tr><td><kbd>c</kbd></td><td>复制主节点链接</td></tr>
        <tr><td><kbd>r</kbd></td><td>立即刷新用量</td></tr>
        <tr><td><kbd>?</kbd></td><td>打开/关闭本帮助</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>关闭弹窗</td></tr>
      </tbody>
    </table>
  </div>
</div>`;
}

function 页头(sse) {
  return `<header>
  <h1>edgetunnel 管理面板 <small>${sse}</small></h1>
  <div class="row"><button type="button" class="iconbtn" id="btn-refresh-top" title="刷新状态与用量">⟳ 刷新</button><a href="#top" style="color:var(--mut)">↑ 置顶</a> · <a href="/logout">退出登录</a></div>
</header>`;
}

function 主导航() {
  return `<nav>
  <button type="button" class="on" data-tab="overview">概览</button>
  <button type="button" data-tab="nodes">节点与订阅</button>
  <button type="button" data-tab="config">配置</button>
  <button type="button" data-tab="ops">运维</button>
</nav>`;
}
```

- [ ] **Step 7: 删除旧文件并改 main.js 的 import**

删除 `src/admin/ui.js`；把 `src/main.js:4` 改为：
```js
import { 管理面板HTML } from './admin/ui/index.js';
```

- [ ] **Step 8: 等价性验证（关键）**

> 注意：这里比对的是**渲染出的 HTML**，不是打包产物字节。esbuild 会为每个模块插入路径注释（原来只有 `// src/admin/ui.js`，拆分后会有 7 条），因此 `_worker.js` 的字节**一定会变**，这是预期的；模块拆分的正确性由"渲染结果逐字节一致"来保证，产物在 Step 9 重新生成。

Run:
```bash
node --import ./scripts/register-test-loader.mjs -e "
import('./src/admin/ui/index.js').then(m=>{
  const cfg={HOST:'edt2.example.org',LINK:'vless://aaaa@edt2.example.org:443#t',协议类型:'vless',传输协议:'ws',完整节点路径:'/',Fingerprint:'chrome',SS:{加密方式:'aes-128-gcm',TLS:true},优选订阅生成:{TOKEN:'tok123',SUBNAME:'edgetunnel'},CF:{Usage:{success:true,pages:1,workers:2,total:3,max:100}}};
  require('fs').writeFileSync('/tmp/panel-after.html', m.管理面板HTML({ADMIN:'x',KEY:'y'}, cfg));
})" && cmp /tmp/panel-before.html /tmp/panel-after.html && echo "✅ 渲染结果逐字节一致"
```
Expected: `✅ 渲染结果逐字节一致`（`cmp` 无输出）。

- [ ] **Step 9: 重新生成产物并跑全量校验**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs && npm run build && npm run check`
Expected: 测试通过（原断言不变即通过）；build 成功；`check` 全绿（模块数由 49 增至约 56，产物字节因新增模块注释而变大属预期）。

- [ ] **Step 10: 提交**

```bash
git add src/admin/ui src/main.js scripts/test-ui.mjs _worker.js
git rm src/admin/ui.js
git commit -m "refactor(admin): 面板拆分为 src/admin/ui/ 子模块（等价迁移，渲染逐字节一致）"
```

---

### Task 2: 视觉融合落地（新令牌 + 切角组件样式）

**Files:**
- Modify: `src/admin/ui/theme.js`（整体替换）
- Modify: `src/admin/ui/styles.js`（整体替换）
- Modify: `src/admin/ui/index.js`（`<html>` 属性 + head 内联防闪烁脚本）
- Test: `scripts/test-ui.mjs`

- [ ] **Step 1: 先加断言（追加到 `scripts/test-ui.mjs` 现有断言之后）**

```js
  // 2) P1 视觉与主题标记
  for (const 标记 of ['data-theme="dark"', 'data-motion="full"', '--cut:', 'et_admin_theme', 'et_admin_motion', '[data-theme="light"]', '[data-motion="off"]']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: FAIL（`HTML 应包含 data-theme="dark"`）。

- [ ] **Step 3: 用下述内容整体替换 `src/admin/ui/theme.js`**

```js
// 主题令牌与动效规则。颜色只在此处定义，其它样式一律引用变量。
// 零 import；只导出返回 CSS 文本的函数。

// 深色为默认（:root），浅色通过 [data-theme="light"] 覆盖同名变量。
const 令牌 = `:root{--bg1:#060a12;--bg2:#0a1120;--bg3:#070c16;--grid:rgba(120,170,255,.055);--surf:rgba(18,28,46,.78);--line:rgba(120,170,255,.22);--fg:#dce7f5;--mut:#7d90ad;--acc:#4da3ff;--acc2:#35e0d8;--ok:#5ce6a0;--warn:#f2c14e;--err:#ff8a80;--cut:10px;--r:12px;--shadow:0 10px 28px rgba(0,0,0,.38)}
:root[data-theme="light"]{--bg1:#f6f9fd;--bg2:#e9eef7;--bg3:#f2f6fc;--grid:rgba(30,60,110,.05);--surf:rgba(255,255,255,.86);--line:rgba(30,60,110,.2);--fg:#16233a;--mut:#5b6b85;--acc:#2f6fe4;--acc2:#0f9e93;--ok:#0f8a5f;--warn:#a06a00;--err:#c0392b;--shadow:0 10px 24px rgba(20,40,80,.12)}`;

// 动效三档：full 保留入场与图表动画；lite 只留状态反馈；off 全关。
// prefers-reduced-motion 优先级最高，一律按 off 处理。
const 动效 = `[data-motion="off"] *, [data-motion="off"] *::before, [data-motion="off"] *::after{transition:none!important;animation:none!important}
[data-motion="lite"] .page.on{animation:none!important}
[data-motion="full"] .page.on{animation:et-in .22s ease both}
@keyframes et-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}}`;

function 主题CSS() {
  return 令牌 + '\n' + 动效;
}

export { 主题CSS };
```

- [ ] **Step 4: 用下述内容整体替换 `src/admin/ui/styles.js`**

```js
// 组件样式：布局、切角卡片、按钮、表格、弹层、图表容器、骨架屏、命令面板、diff 视图。
// 颜色一律引用 theme.js 的 CSS 变量。零 import。

const 组件样式 = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;color:var(--fg);background:linear-gradient(165deg,var(--bg1),var(--bg2) 60%,var(--bg3));background-attachment:fixed;font:400 14px/1.5 -apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(900px 480px at 12% -10%,rgba(40,90,170,.32),transparent 60%),radial-gradient(700px 400px at 92% -4%,rgba(53,224,216,.14),transparent 58%)}
body::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,transparent 0 15px,var(--grid) 15px 16px),repeating-linear-gradient(90deg,transparent 0 15px,var(--grid) 15px 16px)}
.wrap{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:20px 16px 84px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
h1{font-size:17px;margin:0;letter-spacing:.6px}
h1 small{color:var(--mut);font-weight:400;font-size:12px;letter-spacing:0}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
nav button{background:transparent;border:1px solid var(--line);color:var(--mut);padding:7px 15px;font-size:13px;cursor:pointer;clip-path:polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%)}
nav button:hover{color:var(--fg)}
nav button.on{background:linear-gradient(135deg,var(--acc2),var(--acc));color:#06121f;font-weight:600;border-color:transparent}
.page{display:none}.page.on{display:block}
.card{position:relative;background:var(--surf);border:1px solid var(--line);padding:16px;margin-bottom:14px;box-shadow:var(--shadow);clip-path:polygon(0 var(--cut),var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%)}
.card::before,.card::after{content:"";position:absolute;width:12px;height:12px;pointer-events:none}
.card::before{top:0;left:0;border-top:2px solid var(--acc2);border-left:2px solid var(--acc2)}
.card::after{bottom:0;right:0;border-bottom:2px solid var(--acc2);border-right:2px solid var(--acc2)}
.card h2{font-size:12px;margin:0 0 12px;color:var(--mut);letter-spacing:1px;text-transform:uppercase}
.hero{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.gauge{flex:0 0 120px}
label{font-size:12px;color:var(--mut);display:block;margin:10px 0 4px}
input,select,textarea{width:100%;background:color-mix(in srgb,var(--bg1) 55%,transparent);color:var(--fg);border:1px solid var(--line);padding:9px 10px;font-size:13px;outline:none;clip-path:polygon(0 6px,6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)}
input:focus,select:focus,textarea:focus{border-color:var(--acc2);box-shadow:0 0 0 2px color-mix(in srgb,var(--acc2) 28%,transparent)}
textarea{font:12px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;resize:vertical}
button.btn{min-height:42px;background:linear-gradient(135deg,var(--acc2),var(--acc));color:#06121f;border:0;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;clip-path:polygon(0 6px,6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)}
button.btn:disabled{opacity:.5;cursor:not-allowed}
button.ghost{background:transparent;color:var(--fg);border:1px solid var(--line);font-weight:400}
button.ghost:hover{background:color-mix(in srgb,var(--acc) 12%,transparent)}
button.iconbtn{min-height:34px;background:transparent;color:var(--fg);border:1px solid var(--line);padding:5px 13px;font-size:12px;cursor:pointer}
button.iconbtn:hover{background:color-mix(in srgb,var(--acc) 14%,transparent)}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{overflow-wrap:anywhere;padding:6px 8px;border-bottom:1px solid var(--line);text-align:left}
td.mn{width:200px;color:var(--mut)}
.qr svg{max-width:180px;height:auto;background:#fff;padding:8px}
.mono{font:12px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;word-break:break-all;background:color-mix(in srgb,var(--bg1) 55%,transparent);border:1px solid var(--line);padding:10px;margin:6px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dim{color:var(--mut);font-size:13px}
.kvList{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.kvList .item{background:color-mix(in srgb,var(--bg1) 40%,transparent);border:1px solid var(--line);padding:10px}
.kvList .item b{display:block;font-size:11px;color:var(--mut);letter-spacing:.5px;margin-bottom:4px}
.clock{display:flex;gap:10px;align-items:baseline;justify-content:flex-end;font-variant-numeric:tabular-nums;font-size:14px;margin-bottom:10px}
.clock .t{font-weight:600;letter-spacing:1.2px}
.badges{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
.badge{font-size:11px;color:var(--fg);background:color-mix(in srgb,var(--acc) 14%,transparent);border:1px solid var(--line);padding:3px 10px;border-radius:999px;font-variant-numeric:tabular-nums}
#chart{position:relative}#chart svg{width:100%;height:auto}
#chart-tip{position:absolute;display:none;pointer-events:none;background:color-mix(in srgb,var(--bg1) 92%,transparent);border:1px solid var(--line);padding:6px 10px;font-size:12px;z-index:5;white-space:nowrap}
.sk{height:10px;margin:8px 0;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 8%,transparent),color-mix(in srgb,var(--acc) 20%,transparent),color-mix(in srgb,var(--acc) 8%,transparent))}
.err-inline{font-size:12px;color:var(--err);margin-top:8px}
#qr-modal,#kbd-help,#cmdk,#diff-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,#04070d 62%,transparent);z-index:20;padding:16px}
#qr-modal.open,#kbd-help.open,#cmdk.open,#diff-modal.open{display:flex}
#qr-modal .box,#kbd-help .box,#cmdk .box,#diff-modal .box{background:var(--surf);border:1px solid var(--line);padding:18px;max-width:92vw;max-height:86vh;overflow:auto;box-shadow:var(--shadow);clip-path:polygon(0 var(--cut),var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%)}
#qr-modal .box{background:#fff;color:#111}
#qr-modal .box svg{width:100%;max-width:280px;height:auto}
#kbd-help kbd{font:12px ui-monospace,monospace;background:color-mix(in srgb,var(--acc) 16%,transparent);border:1px solid var(--line);border-bottom-width:2px;padding:2px 6px}
#cmdk .box{width:min(560px,92vw)}
#cmdk input{margin-bottom:10px}
#cmdk .list{max-height:52vh;overflow:auto}
#cmdk .item{padding:7px 10px;font-size:13px;cursor:pointer;border:1px solid transparent}
#cmdk .item.sel{background:color-mix(in srgb,var(--acc) 16%,transparent);border-color:var(--line)}
#cmdk .item b{color:var(--acc2)}
#cmdk .empty{color:var(--mut);font-size:13px;padding:8px}
#diff-view{font:12px/1.55 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-all;max-height:46vh;overflow:auto;border:1px solid var(--line);padding:10px}
#diff-view .add{color:var(--ok)}#diff-view .del{color:var(--err)}
#cfg-check{font-size:12px;margin-top:8px;display:flex;flex-direction:column;gap:4px}
#cfg-check .bad{color:var(--err)}#cfg-check .good{color:var(--ok)}
#toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:color-mix(in srgb,var(--bg1) 92%,transparent);border:1px solid var(--line);padding:10px 18px;font-size:13px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:30;max-width:86vw;box-shadow:var(--shadow)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
#toast.ok{border-color:var(--ok);color:var(--ok)}#toast.ok::before{content:"✓ "}
#toast.err{border-color:var(--err);color:var(--err)}#toast.err::before{content:"✕ "}
@media(max-width:640px){
.hero{flex-direction:column}
nav{position:fixed;bottom:0;left:0;right:0;z-index:8;margin:0;padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg1) 88%,transparent);justify-content:space-around;border-top:1px solid var(--line)}
nav button{flex:1;padding:8px 6px}
.wrap{padding-bottom:96px}}
`;

function 样式CSS() {
  return 组件样式;
}

export { 样式CSS };
```

- [ ] **Step 5: 在 `index.js` 里换根属性并注入防闪烁脚本**

把返回模板中的
```
<html lang="zh-CN" data-theme="glass">
```
改为
```
<html lang="zh-CN" data-theme="dark" data-motion="full">
```

并在 `<style>` 之前插入内联脚本（必须在渲染前执行，避免主题跳变）：
```html
<script>(function(){try{
var d=document.documentElement,t=localStorage.getItem('et_admin_theme'),m=localStorage.getItem('et_admin_motion');
var light=t?t==='light':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches);
d.setAttribute('data-theme',light?'light':'dark');
if(!m)m=(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'off':'full';
d.setAttribute('data-motion',m);
}catch(e){}})();</script>
```

- [ ] **Step 6: 跑测试确认通过**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: PASS（Task 1 旧断言 + Task 2 新断言全过）。

- [ ] **Step 7: 构建 + 全量校验**

Run: `npm run build && npm run check`
Expected: build 成功；`check` 全绿（字节比对通过）。

- [ ] **Step 8: 提交**

```bash
git add src/admin/ui/theme.js src/admin/ui/styles.js src/admin/ui/index.js scripts/test-ui.mjs _worker.js
git commit -m "feat(admin): 落地 A+D 融合视觉（切角 HUD + 深蓝令牌）与防闪烁主题预设"
```

---

### Task 3: 主题/动效切换 + Tab 可访问性

**Files:**
- Modify: `src/admin/ui/index.js`（页头加两个按钮；导航与页面加 aria）
- Modify: `src/admin/ui/client.js`（切换逻辑 + 焦点陷阱工具）
- Test: `scripts/test-ui.mjs`

- [ ] **Step 1: 加断言**

```js
  // 3) 主题/动效切换入口与 Tab 可访问性
  for (const 标记 of ['id="btn-theme"', 'id="btn-motion"', 'role="tablist"', 'role="tabpanel"', 'aria-selected']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: FAIL（`id="btn-theme"`）。

- [ ] **Step 3: `index.js` 的 `页头()` 加两个按钮**

把 `页头(sse)` 的 `.row` 一行改为：
```js
  <div class="row"><button type="button" class="iconbtn" id="btn-theme" title="切换深色/浅色">◐ 主题</button><button type="button" class="iconbtn" id="btn-motion" title="切换动效档位">≋ 动效</button><button type="button" class="iconbtn" id="btn-refresh-top" title="刷新状态与用量">⟳ 刷新</button><a href="#top" style="color:var(--mut)">↑ 置顶</a> · <a href="/logout">退出登录</a></div>
```

- [ ] **Step 4: `index.js` 的 `主导航()` 与 Tab 片段加 aria**

`主导航()` 改为：
```js
function 主导航() {
  return `<nav role="tablist" aria-label="面板分区">
  <button type="button" class="on" role="tab" aria-selected="true" aria-controls="page-overview" data-tab="overview">概览</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="page-nodes" data-tab="nodes">节点与订阅</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="page-config" data-tab="config">配置</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="page-ops" data-tab="ops">运维</button>
</nav>`;
}
```
四个 Tab 片段的 `<section class="page..." data-page="X">` 分别改为带 id 与 role：
`<section class="page on" id="page-overview" role="tabpanel" aria-labelledby="..." data-page="overview">`（其余三个去掉 ` on`，id 与 `aria-controls` 对应）。

- [ ] **Step 5: `client.js` 追加切换逻辑与焦点工具**

在 IIFE 内 `function fmt(...)` 之后追加：
```js
  // —— 主题与动效 ——
  function 当前主题() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function 设置主题(v) {
    var t = v || (当前主题() === 'dark' ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('et_admin_theme', t); } catch (e) {}
    toast('主题：' + (t === 'light' ? '浅色' : '深色'), true);
  }
  var 动效档 = ['full', 'lite', 'off'];
  function 当前动效() { var v = document.documentElement.getAttribute('data-motion'); return 动效档.indexOf(v) >= 0 ? v : 'full'; }
  function 设置动效(v) {
    var i = 动效档.indexOf(当前动效());
    var t = v || 动效档[(i + 1) % 动效档.length];
    document.documentElement.setAttribute('data-motion', t);
    try { localStorage.setItem('et_admin_motion', t); } catch (e) {}
    toast('动效：' + ({ full: '完整', lite: '精简', off: '关闭' })[t], true);
  }
  $('#btn-theme').addEventListener('click', function () { 设置主题(); });
  $('#btn-motion').addEventListener('click', function () { 设置动效(); });

  // —— 弹层焦点管理：打开时聚焦首元素，Tab 循环，Esc 关闭后聚焦回触发元素 ——
  var 焦点栈 = [];
  function 打开弹层(el, 首元素) {
    焦点栈.push(document.activeElement);
    el.classList.add('open');
    var f = 首元素 || el.querySelector('button,input,textarea,select,a[href]');
    if (f) f.focus();
  }
  function 关闭弹层(el) {
    el.classList.remove('open');
    var back = 焦点栈.pop();
    if (back && back.focus) back.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var open = document.querySelector('.open[role="dialog"]');
    if (!open) return;
    var els = open.querySelectorAll('button,input,textarea,select,a[href]');
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
```

- [ ] **Step 6: `client.js` 里 `switchTab` 同步 aria**

把 `switchTab(btn)` 内的 Tab 高亮循环改为同时维护 aria：
```js
    tabs.forEach(function (b) { b.classList.toggle('on', b === btn); b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
```

- [ ] **Step 7: 跑测试 + 构建校验**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs && npm run build && npm run check`
Expected: 全部通过。

- [ ] **Step 8: 提交**

```bash
git add src/admin/ui scripts/test-ui.mjs _worker.js
git commit -m "feat(admin): 深/浅主题与三档动效切换、弹层焦点管理与 Tab 可访问性"
```

---

### Task 4: 命令面板（⌘/Ctrl+K）

**Files:**
- Modify: `src/admin/ui/index.js`（注入 `#cmdk` 浮层）
- Modify: `src/admin/ui/client.js`（动作表 + 模糊匹配 + 键盘）
- Test: `scripts/test-ui.mjs`

- [ ] **Step 0: 加断言**

```js
  // 4) 命令面板
  for (const 标记 of ['id="cmdk"', 'id="cmd-input"', 'id="cmd-list"', 'id="cmd-empty"']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }
```

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: FAIL（`id="cmdk"`）。

- [ ] **Step 1: `index.js` 注入命令面板浮层**

新增函数并加入 `body`（放在 `${快捷键帮助浮层()}` 之后）：
```js
function 命令面板() {
  return `<div id="cmdk" role="dialog" aria-modal="true" aria-label="命令面板">
  <div class="box">
    <input id="cmd-input" type="text" placeholder="输入动作名称…（↑↓ 选择，Enter 执行，Esc 关闭）" autocomplete="off" spellcheck="false" />
    <div class="list" id="cmd-list" role="listbox"></div>
    <div class="empty" id="cmd-empty" style="display:none">无匹配动作</div>
  </div>
</div>`;
}
```

- [ ] **Step 2: `client.js` 追加命令面板**

```js
  // —— 命令面板 ——
  var 动作表 = [
    { 名: '概览', 组: '切换', 跑: function () { 点('[data-tab="overview"]'); } },
    { 名: '节点与订阅', 组: '切换', 跑: function () { 点('[data-tab="nodes"]'); } },
    { 名: '配置', 组: '切换', 跑: function () { 点('[data-tab="config"]'); } },
    { 名: '运维', 组: '切换', 跑: function () { 点('[data-tab="ops"]'); } },
    { 名: '复制主节点链接', 组: '节点', 跑: function () { 点('#btn-copy-link'); } },
    { 名: '复制通用订阅', 组: '节点', 跑: function () { 点('#btn-copy-sub'); } },
    { 名: '复制 Clash 原生订阅', 组: '节点', 跑: function () { 点('#btn-copy-clash'); } },
    { 名: '复制 sing-box 原生订阅', 组: '节点', 跑: function () { 点('#btn-copy-singbox'); } },
    { 名: '打开二维码', 组: '节点', 跑: function () { 点('#btn-open-qr'); } },
    { 名: '下载二维码 PNG', 组: '节点', 跑: function () { 点('#btn-open-qr'); setTimeout(function () { 点('#btn-qr-download'); }, 120); } },
    { 名: '刷新用量', 组: '概览', 跑: function () { 点('#btn-refresh-usage'); } },
    { 名: '刷新全部', 组: '概览', 跑: function () { 点('#btn-refresh-top'); } },
    { 名: '配置：重新加载', 组: '配置', 跑: function () { 点('#btn-load-json'); } },
    { 名: '配置：保存到 KV', 组: '配置', 跑: function () { 点('[data-tab="config"]'); setTimeout(function () { 点('#btn-save-json'); }, 120); } },
    { 名: '配置：导出到剪贴板', 组: '配置', 跑: function () { 点('#btn-cfg-export'); } },
    { 名: '配置：从剪贴板导入', 组: '配置', 跑: function () { 点('#btn-cfg-import'); } },
    { 名: '配置：恢复上一版本', 组: '配置', 跑: function () { 点('#btn-restore'); } },
    { 名: '运维：保存 TG', 组: '运维', 跑: function () { 点('#btn-save-tg'); } },
    { 名: '运维：保存 CF 凭据', 组: '运维', 跑: function () { 点('#btn-save-cf'); } },
    { 名: '运维：保存优选 IP', 组: '运维', 跑: function () { 点('#btn-save-add'); } },
    { 名: '运维：复制诊断 JSON', 组: '运维', 跑: function () { 点('#btn-diag-copy'); } },
    { 名: '运维：重置配置为默认值', 组: '运维', 跑: function () { 点('#btn-init'); } },
    { 名: '切换主题', 组: '外观', 跑: function () { 设置主题(); } },
    { 名: '切换动效档位', 组: '外观', 跑: function () { 设置动效(); } },
    { 名: '打开快捷键帮助', 组: '外观', 跑: function () { 打开弹层($('#kbd-help')); } },
    { 名: '打开 Workers 日志控制台', 组: '外观', 跑: function () { window.open('https://dash.cloudflare.com/?to=/:account/workers/services/edit/edgetunnel/production/logs', '_blank', 'noopener'); } },
  ];
  function 点(sel) { var el = document.querySelector(sel); if (el) el.click(); return !!el; }

  // 子序列模糊匹配：按字符顺序命中即算匹配，返回命中位置用于高亮
  function 模糊(文本, 输入) {
    var t = 文本.toLowerCase(), q = 输入.toLowerCase(), pos = [], i = 0;
    for (var j = 0; j < q.length; j++) {
      var k = t.indexOf(q[j], i);
      if (k < 0) return null;
      pos.push(k); i = k + 1;
    }
    return pos;
  }
  function 高亮(文本, pos) {
    if (!pos || !pos.length) return 转义文本(文本);
    var out = '', set = {}, i;
    for (i = 0; i < pos.length; i++) set[pos[i]] = 1;
    for (i = 0; i < 文本.length; i++) out += set[i] ? '<b>' + 转义文本(文本[i]) + '</b>' : 转义文本(文本[i]);
    return out;
  }
  function 转义文本(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var 命令结果 = [], 命令选中 = 0;
  function 渲染命令(输入) {
    var hits = [];
    动作表.forEach(function (a) {
      if (!输入) { hits.push({ a: a, pos: null }); return; }
      var pos = 模糊(a.名, 输入);
      if (pos) hits.push({ a: a, pos: pos });
    });
    命令结果 = hits; 命令选中 = 0;
    var list = $('#cmd-list');
    list.innerHTML = hits.map(function (h, i) {
      return '<div class="item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '" role="option">' + 高亮(h.a.名, h.pos) + ' <span class="dim">· ' + 转义文本(h.a.组) + '</span></div>';
    }).join('');
    $('#cmd-empty').style.display = hits.length ? 'none' : '';
    Array.prototype.slice.call(list.querySelectorAll('.item')).forEach(function (el) {
      el.addEventListener('click', function () { 执行命令(Number(el.dataset.i)); });
    });
  }
  function 移动命令(步) {
    if (!命令结果.length) return;
    var list = $('#cmd-list'), els = list.querySelectorAll('.item');
    命令选中 = (命令选中 + 步 + 命令结果.length) % 命令结果.length;
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('sel', i === 命令选中);
    if (els[命令选中]) els[命令选中].scrollIntoView({ block: 'nearest' });
  }
  function 执行命令(i) {
    var hit = 命令结果[i];
    if (!hit) return;
    关闭弹层($('#cmdk'));
    hit.a.跑();
  }
  function 打开命令面板() { 渲染命令(''); $('#cmd-input').value = ''; 打开弹层($('#cmdk'), $('#cmd-input')); }
  $('#cmd-input').addEventListener('input', function () { 渲染命令(this.value.trim()); });
  $('#cmd-input').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); 移动命令(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); 移动命令(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); 执行命令(命令选中); }
  });
  $('#cmdk').addEventListener('click', function (e) { if (e.target === this) 关闭弹层($('#cmdk')); });
```

- [ ] **Step 3: 快捷键接入（`⌘/Ctrl+K`）**

把既有的快捷键 `keydown` 监听体开头改为：
```js
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); $('#cmdk').classList.contains('open') ? 关闭弹层($('#cmdk')) : 打开命令面板(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('#cmdk').classList.contains('open')) return;
    var tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape') { 关所有弹层(); return; }
    var map = { '1': 'overview', '2': 'nodes', '3': 'config', '4': 'ops' };
    if (map[e.key]) { 点('[data-tab="' + map[e.key] + '"]'); }
    else if (e.key === 'c' || e.key === 'C') { 点('#btn-copy-link'); }
    else if (e.key === 'r' || e.key === 'R') { 点('#btn-refresh-usage'); }
    else if (e.key === '?') { var h = $('#kbd-help'); h.classList.contains('open') ? 关闭弹层(h) : 打开弹层(h); }
  });
  function 关所有弹层() {
    ['#kbd-help', '#qr-modal', '#cmdk', '#diff-modal'].forEach(function (s) { var el = $(s); if (el && el.classList.contains('open')) 关闭弹层(el); });
  }
```
同时把既有的 `closeQR()`、`#btn-kbd-close`、遮罩点击绑定改为调用 `关闭弹层(...)`，并把「打开二维码」改为 `打开弹层($('#qr-modal'))`；快捷键帮助里的文案加上 `⌘K` 一行。

**另外必须处理的两个既有遗留**（否则 Esc 会被处理两次、且关闭后不归还焦点）：

1. `client.js` 里 L136 附近那条独立监听 `document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeQR(); });` —— **整条删除**，Esc 统一交给上面改好的快捷键监听里的 `关所有弹层()`。
2. `#qr-modal` 的遮罩点击绑定（`if (e.target === this) closeQR();`）改为 `关闭弹层($('#qr-modal'))`；`#kbd-help` 的遮罩点击同样改为 `关闭弹层($('#kbd-help'))`。

- [ ] **Step 4: 跑测试 + 构建校验**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs && npm run build && npm run check`
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/admin/ui scripts/test-ui.mjs _worker.js
git commit -m "feat(admin): 命令面板（⌘/Ctrl+K，含全部内置动作与本地模糊匹配）"
```

---

### Task 5: 配置编辑器增强（内联校验 / diff 预览 / 草稿 / 撤销重做）

**Files:**
- Modify: `src/admin/ui/index.js`（新增并注入 `差异浮层()`）
- Modify: `src/admin/ui/tabs/config.js`（在 JSON 卡片的 `<textarea id="cfg">` 之后插入 `<div id="cfg-check" role="status" aria-live="polite"></div>`）
- Modify: `src/admin/ui/client.js`
- Test: `scripts/test-ui.mjs`

- [ ] **Step 1: 加断言**

```js
  for (const 标记 of ['id="cfg-check"', 'id="diff-modal"', 'id="diff-view"', 'id="btn-diff-confirm"']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }
```

- [ ] **Step 2: 跑测试确认失败**

Expected: FAIL（`id="cfg-check"`）。

- [ ] **Step 3: `index.js` 补 DOM**

在 `配置Tab` 的 JSON 卡片内、`<textarea id="cfg">` 之后加：
```html
    <div id="cfg-check" role="status" aria-live="polite"></div>
```
并在 `命令面板()` 之后新增并加入 body：
```js
function 差异浮层() {
  return `<div id="diff-modal" role="dialog" aria-modal="true" aria-label="保存前差异预览">
  <div class="box">
    <div class="row" style="justify-content:space-between"><b>保存前差异预览</b><span class="dim" id="diff-count"></span></div>
    <div id="diff-view"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px">
      <button type="button" class="btn ghost" id="btn-diff-cancel">取消</button>
      <button type="button" class="btn" id="btn-diff-confirm">确认保存</button>
    </div>
  </div>
</div>`;
}
```

- [ ] **Step 4: `client.js` 实现校验规则（镜像后端 `src/config/validation.js`）**

在 IIFE 内追加：
```js
  // —— 配置内联校验：镜像服务端 validation.js，仅预检，不替代服务端校验 ——
  var 枚举表 = { 协议类型: ['vless', 'trojan', 'ss'], 传输协议: ['ws', 'grpc', 'xhttp'], gRPC模式: ['gun', 'multi'], 'SS.加密方式': ['aes-128-gcm', 'aes-256-gcm'] };
  function 校验配置对象(o, path, depth, errs) {
    path = path || ''; depth = depth || 0; errs = errs || [];
    if (depth > 12) { errs.push('配置嵌套过深'); return errs; }
    if (o && typeof o === 'object') {
      for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
        if (['__proto__', 'constructor', 'prototype'].indexOf(k) >= 0) { errs.push('禁止的配置字段: ' + (path ? path + '.' : '') + k); continue; }
        var v = o[k], p = path ? path + '.' + k : k;
        if (typeof v === 'string' && v.length > 8192) errs.push(p + ' 字符串过长（≤8192）');
        if (Array.isArray(v) && v.length > 512) errs.push(p + ' 数组过长（≤512）');
        if (枚举表[p] && 枚举表[p].indexOf(v) < 0) errs.push(p + ' 取值必须是 ' + 枚举表[p].join(' / '));
        if (p === 'PATH' && (typeof v !== 'string' || v.charAt(0) !== '/')) errs.push('PATH 必须以 / 开头');
        if (p === '优选订阅生成.SUBUpdateTime' && !(typeof v === 'number' && v >= 1 && v <= 168)) errs.push('SUBUpdateTime 必须是 1–168 之间的数字');
        if (p === '优选订阅生成.本地IP库.随机数量' && !(Number.isInteger(v) && v >= 1 && v <= 100)) errs.push('随机数量必须是 1–100 的整数');
        if (p === '优选订阅生成.本地IP库.指定端口' && !(Number.isInteger(v) && (v === -1 || (v >= 1 && v <= 65535)))) errs.push('指定端口必须是 -1 或 1–65535');
        if (p === 'HOSTS' && (!Array.isArray(v) || !v.length || v.some(function (x) { return typeof x !== 'string' || /[\s/@?#]/.test(x); }))) errs.push('HOSTS 必须是非空字符串数组且不含空白 / @ ? #');
        校验配置对象(v, p, depth + 1, errs);
      }
    }
    return errs;
  }
  function 校验编辑器() {
    var box = $('#cfg-check'), ta = $('#cfg');
    var errs = [], obj = null, m = $('#cfg-status');
    var raw = ta.value.trim();
    if (!raw) { box.innerHTML = '<span class="dim">点击「重新加载」获取当前生效配置…</span>'; return { ok: false, obj: null, errs: ['配置为空'] }; }
    try { obj = JSON.parse(raw); } catch (e) { errs.push('JSON 解析失败：' + e.message); }
    if (obj && !Array.isArray(obj)) errs = errs.concat(校验配置对象(obj, '', 0, []));
    else if (obj) errs.push('配置必须是对象');
    box.innerHTML = errs.length
      ? errs.map(function (e) { return '<span class="bad">✕ ' + 转义文本(e) + '</span>'; }).join('')
      : '<span class="good">✓ JSON 合法，字段校验通过</span>';
    var btn = $('#btn-save-json');
    if (btn) btn.disabled = errs.length > 0;
    return { ok: !errs.length, obj: obj, errs: errs };
  }
```

- [ ] **Step 5: `client.js` 实现 diff 与保存确认**

```js
  // —— 保存前差异预览（本地计算，先确认再写 KV） ——
  var 已加载配置文本 = '';
  function 生成差异(旧文本, 新文本) {
    var a = 旧文本 ? 旧文本.split('\n') : [], b = 新文本 ? 新文本.split('\n') : [];
    // 简单 LCS 前缀/后缀裁剪，中间整段标记增删，够用且无依赖
    var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    var j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    var out = [], add = 0, del = 0, k;
    for (k = 0; k < i; k++) out.push('  ' + a[k]);
    for (k = i; k < a.length - j; k++) { out.push('<span class="del">- ' + 转义文本(a[k]) + '</span>'); del++; }
    for (k = i; k < b.length - j; k++) { out.push('<span class="add">+ ' + 转义文本(b[k]) + '</span>'); add++; }
    for (k = a.length - j; k < a.length; k++) out.push('  ' + a[k]);
    return { html: out.join('\n') || '<span class="dim">（无变化）</span>', add: add, del: del };
  }
  var 待保存配置 = null;
  function 请求保存配置() {
    var r = 校验编辑器();
    if (!r.ok) { toast('配置有 ' + r.errs.length + ' 处问题，已阻止保存', false); return; }
    var d = 生成差异(已加载配置文本, $('#cfg').value);
    $('#diff-view').innerHTML = d.html;
    $('#diff-count').textContent = '+' + d.add + ' / -' + d.del;
    待保存配置 = r.obj;
    打开弹层($('#diff-modal'));
  }
  function 写入配置() {
    if (!待保存配置) return;
    api('/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(待保存配置) })
      .then(function (r) { statusCfg('保存成功：' + (r.message || '')); toast('配置已保存', true); 已加载配置文本 = $('#cfg').value; 清草稿(); 校验编辑器(); })
      .catch(function (e) { statusCfg('保存失败：' + e.message); toast('保存失败：' + e.message, false); })
      .then(function () { 待保存配置 = null; 关闭弹层($('#diff-modal')); });
  }
```

- [ ] **Step 6: `client.js` 实现草稿与撤销/重做**

```js
  // —— 编辑器草稿（localStorage）与撤销/重做 ——
  var 草稿键 = 'et_admin_draft_cfg';
  var 撤销栈 = [], 重做栈 = [];
  function 压栈(旧值) { if (旧值 === $('#cfg').value) return; 撤销栈.push(旧值); if (撤销栈.length > 50) 撤销栈.shift(); 重做栈.length = 0; }
  function 撤销() { if (!撤销栈.length) return; 重做栈.push($('#cfg').value); $('#cfg').value = 撤销栈.pop(); 校验编辑器(); 存草稿(); }
  function 重做() { if (!重做栈.length) return; 撤销栈.push($('#cfg').value); $('#cfg').value = 重做栈.pop(); 校验编辑器(); 存草稿(); }
  function 存草稿() { try { localStorage.setItem(草稿键, $('#cfg').value); } catch (e) {} }
  function 清草稿() { try { localStorage.removeItem(草稿键); } catch (e) {} }
  var 草稿定时 = null;
  function 防抖存草稿() { clearTimeout(草稿定时); 草稿定时 = setTimeout(存草稿, 1000); }
  function 恢复草稿提示() {
    var d = null; try { d = localStorage.getItem(草稿键); } catch (e) {}
    if (!d || d === $('#cfg').value) return;
    if (confirm('检测到未保存的草稿，是否恢复到编辑器？（取消则丢弃）')) { 压栈($('#cfg').value); $('#cfg').value = d; 校验编辑器(); }
    else 清草稿();
  }
```

- [ ] **Step 7: `client.js` 接线**

- 删除旧的 `#btn-save-json` 直接 POST 绑定，改为 `$('#btn-save-json').addEventListener('click', 请求保存配置);`
- 新增：`$('#btn-diff-cancel').addEventListener('click', function () { 待保存配置 = null; 关闭弹层($('#diff-modal')); });`
- 新增：`$('#btn-diff-confirm').addEventListener('click', 写入配置);`
- 在 `loadConfig()` 成功回调里，设置 `$('#cfg').value` 之后追加：`已加载配置文本 = $('#cfg').value; 校验编辑器(); 恢复草稿提示();`
- 在 `#cfg` 上绑定：`$('#cfg').addEventListener('input', function () { 校验编辑器(); 防抖存草稿(); });`、`$('#cfg').addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? 重做() : 撤销(); } });`
- 在 `#cfg` 的 `keydown` 前用 `focus` 事件压栈：`$('#cfg').addEventListener('focus', function () { 压栈($('#cfg').value); });`

- [ ] **Step 8: 跑测试 + 构建校验**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs && npm run build && npm run check`
Expected: 全部通过。

- [ ] **Step 9: 提交**

```bash
git add src/admin/ui scripts/test-ui.mjs _worker.js
git commit -m "feat(admin): 配置编辑器增强（内联校验、保存前 diff、草稿恢复、撤销重做）"
```

---

### Task 6: 骨架屏 / 失败重试 / Toast 队列

**Files:**
- Modify: `src/admin/ui/client.js`
- Modify: `src/admin/ui/tabs/overview.js`（趋势图卡片容器加 `data-skeleton` + 骨架条）
- Modify: `src/admin/ui/tabs/ops.js`（`#diag` 上方加 `data-skeleton` + 骨架条）
- Test: `scripts/test-ui.mjs`

- [ ] **Step 1: 加断言**

```js
  for (const 标记 of ['class="sk"', 'data-skeleton']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }
```

- [ ] **Step 1.5: 加"内联脚本语法"断言（永久守卫模板字符串转义类缺陷）**

背景：`client.js` 是模板字符串，内部代码里的 `'\n'`、`/[\s]/` 若只写单反斜杠，求值后会变成真换行/丢掉 `\s`，生成的 `<script>` 会语法错误；而 `verify.js` 的 `node --check` 只校验外层 bundle，**抓不到**。Task 5 曾真实触发该缺陷，故固化为断言。

```js
  // 5) 每个内联 <script> 段都必须语法正确（覆盖 client.js 模板字符串转义问题）
  const 内联段 = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(内联段.length >= 3, `应有至少 3 个内联脚本段，实际 ${内联段.length}`);
  内联段.forEach((段, i) => {
    try { new Function(段); } catch (e) { assert.fail(`第 ${i + 1} 个内联脚本语法错误：${e.message}`); }
  });
```

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs`
Expected: PASS（若此时 FAIL，说明已有内联脚本语法错误，必须先修好再继续）。

- [ ] **Step 1.6: 加"元素 id 引用"断言（执行期补入，守卫运行时崩溃）**

背景：`client.js` 里任何 `$('#x').addEventListener(...)` 若 `#x` 不存在，都会在运行时抛 `null.addEventListener` 而中断整个脚本（面板直接不可用，且静态测试原本抓不到）。执行 Task 6 时补入此断言。

```js
  // 8) client.js 引用的元素 id 必须都出现在产物 HTML 中
  const 客户端源码 = readFileSync(new URL('../src/admin/ui/client.js', import.meta.url), 'utf8');
  const 引用id = new Set([
    ...[...客户端源码.matchAll(/\$\('#([^']+)'\)/g)].map((m) => m[1]),
    ...[...客户端源码.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]),
  ]);
  const 缺失id = [...引用id].filter((x) => !html.includes(`id="${x}"`));
  assert.deepEqual(缺失id, [], `client.js 引用了产物中不存在的 id：${缺失id.join(', ')}`);
```

需在文件头补 `import { readFileSync } from 'node:fs';`。

- [ ] **Step 2: 跑测试确认失败**

Expected: FAIL（`class="sk"`）。

- [ ] **Step 3: Tab 片段里给异步卡片加骨架占位**

`tabs/overview.js`、`tabs/ops.js` 中会被异步填充的容器加 `data-skeleton` 属性与骨架条，例如趋势图卡片：
```html
    <div id="chart" data-skeleton><div class="sk" style="width:92%"></div><div class="sk" style="width:74%"></div></div>
```
运维页 `#diag` 与 `#o-add` 上方同理各加两条骨架条（`<div class="sk"></div>`）。

- [ ] **Step 4: `client.js` 加 Toast 队列与重试**

```js
  // —— Toast 队列：同时只显示一条，其余排队 ——
  var 提示队列 = [], 提示忙 = false;
  function toast(msg, ok) { 提示队列.push({ msg: msg, ok: ok !== false }); 出队提示(); }
  function 出队提示() {
    if (提示忙 || !提示队列.length) return;
    var it = 提示队列.shift(), t = $('#toast');
    提示忙 = true;
    t.textContent = it.msg; t.className = 'show ' + (it.ok ? 'ok' : 'err');
    setTimeout(function () { t.className = ''; 提示忙 = false; 出队提示(); }, 3200);
  }

  // —— 幂等 GET 的失败重试（对 POST 不自动重试，避免重复写入） ——
  function 取(path, 重试次数) {
    var 次数 = 重试次数 === undefined ? 2 : 重试次数;
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) {
      if (次数 <= 0) throw e;
      return new Promise(function (res) { setTimeout(res, 次数 === 2 ? 500 : 1500); }).then(function () { return 取(path, 次数 - 1); });
    });
  }
  function 骨架完毕(sel) { var el = $(sel); if (el) el.removeAttribute('data-skeleton'); }
  function 内联错误(sel, msg, 重试函数) {
    var el = $(sel); if (!el) return;
    el.innerHTML = '<p class="err-inline">' + 转义文本(msg) + '</p>';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'iconbtn'; b.textContent = '重试';
    b.addEventListener('click', 重试函数);
    el.appendChild(b);
  }
```

（注意：`toast` 与 `api` 的**旧定义整体删除**，只保留上面的新实现；`api` 保持原签名不变，供所有 POST 使用。）

- [ ] **Step 5: 把概览与运维的读取改为走后端重试 + 骨架收尾**

- `loadOverview()` 内 `api('/admin/api/usage-history')` 改为 `取('/admin/api/usage-history')`，并在 `.then` 开头调用 `骨架完毕('#chart')`，在 `.catch` 里改为 `内联错误('#chart', '用量历史不可用：' + e.message, loadOverview)`。
- `loadDiag()` 内 `api('/admin/config.json')` 改为 `取('/admin/config.json')`，`.then` 开头 `骨架完毕('#diag')`，`.catch` 改为 `内联错误('#diag', '诊断数据加载失败：' + e.message, loadDiag)`。
- `loadOps()` 内 `api('/admin/ADD.txt')` 改为 `取('/admin/ADD.txt')`，`.then` 开头 `骨架完毕('#o-add')`。

- [ ] **Step 6: 跑测试 + 构建校验**

Run: `node --import ./scripts/register-test-loader.mjs scripts/test-ui.mjs && npm run build && npm run check`
Expected: 全部通过。

- [ ] **Step 7: 提交**

```bash
git add src/admin/ui scripts/test-ui.mjs _worker.js
git commit -m "feat(admin): 卡片骨架屏、幂等 GET 退避重试与 Toast 队列"
```

---

### Task 7: 发布与验收

**Files:** 无源码改动（产物已随各任务提交）

- [ ] **Step 1: 全量门禁**

Run: `npm run check && npm run test:runtime && npm run deploy:check`
Expected: 三项全绿；`deploy:check` 显示 `Total Upload` 与 KV 绑定。

- [ ] **Step 2: 推送并确认 CI 部署到 edgetunnel**

Run: `git push origin main`
Expected: GitHub Actions `Deploy to Cloudflare Workers` 成功，日志含 `secret ADMIN OK`/`secret UUID OK`/`Uploaded edgetunnel`；`wrangler.toml` 的 `name` 必须是 `edgetunnel`。

- [ ] **Step 3: 生产冒烟**

Run:
```bash
curl -s -o /dev/null -w "登录 %{http_code}\n" -X POST https://edt2.liuyong.eu.org/login -H 'Origin: https://edt2.liuyong.eu.org' -H 'Content-Type: application/x-www-form-urlencoded' --data 'password=@TEST_PASSWORD'
```
（用真实 ADMIN 口令，从环境变量或手填，勿写入仓库脚本）
Expected: 200，且 `/admin` 返回 200 并含 `data-theme="dark"`、`id="cmdk"`、`id="diff-modal"`。

- [ ] **Step 4: 浏览器人工验收清单**

- [ ] 深浅主题切换即时生效、刷新后保持、无首屏闪烁
- [ ] 动效三档可见差异；系统开启"减少动效"时一律无动画
- [ ] `⌘/Ctrl+K` 打开命令面板，输入 `复制`/`配置`/`主题` 能命中并执行；`↑↓`+`Enter` 正常
- [ ] 配置页：故意写错 `SUBUpdateTime: 300` → 内联报错且「保存到 KV」禁用；改对后点保存 → 出现 diff 预览（+/− 计数正确）→ 确认才写 KV
- [ ] 编辑器草稿：改动后刷新页面 → 提示恢复草稿；撤销/重做 `Ctrl+Z` / `Ctrl+Shift+Z` 可用
- [ ] 概览与运维首屏出现骨架条，加载后被真实内容替换；断网时显示内联错误 + 「重试」
- [ ] 键盘：Tab 能到达所有交互元素、焦点环可见；弹层内 Tab 循环、Esc 关闭、焦点回到触发按钮
- [ ] 移动端（≤640px）：底栏 Tab、单列卡片、无横向滚动

---

## 自审记录（写入时执行）

1. **Spec 覆盖**：§3 架构 → Task 1（拆分）+ 各任务文件清单；§4 视觉/令牌 → Task 2；§5 主题与动效 → Task 2 Step 5（无闪脚本）+ Task 3；§6 可访问性 → Task 3；§7.1 命令面板 → Task 4；§7.2 编辑器增强（校验/diff/草稿/撤销）→ Task 5；§7.3 加载与失败 → Task 6；§8 数据流（不新增接口、仅 localStorage）→ 各任务实现均已遵守；§9 安全（textContent/转义、`localStorage` 仅偏好与草稿）→ Task 4 `转义文本`、Task 5 校验与 diff 渲染、Task 6 `内联错误`；§10 测试 → 各任务断言 + Task 7；§11 变更文件 → 与计划一致；§12 交付 → Task 7；§13 裁剪 → 未引入任何被裁项。
2. **占位符扫描**：无 TBD/TODO；Task 1 的 CSS/IIFE 搬运明确标注为"按行号原样复制"（纯搬运，不需重新创作），其余所有代码步骤均给出完整代码。
3. **命名一致性**：`主题CSS`/`样式CSS`/`客户端脚本`/`概览Tab`/`节点Tab`/`配置Tab`/`运维Tab`/`快捷键帮助浮层`/`页头`/`主导航`/`命令面板`/`差异浮层` 在定义处与调用处一致；`打开弹层`/`关闭弹层`/`关所有弹层`/`点`/`转义文本`/`取`/`内联错误`/`骨架完毕` 均在 Task 3、4、6 中先定义后使用；`校验编辑器` 返回 `{ok,obj,errs}` 被 Task 5 的 `请求保存配置` 正确消费；`已加载配置文本` 在 `loadConfig` 与 `生成差异` 中同名。
4. **hooks 风险**：Task 1 Step 8 的逐字节等价校验是拆分正确性的硬门禁；Task 2 起才改变样式与结构，且保留全部既有 id/class（见"关键基线"清单）。
5. **已知取舍**：`生成差异` 采用"公共前缀/后缀裁剪 + 中间整段增删"而非完整 LCS——对本场景（单块 JSON）足够且零依赖；`撤销/重做` 以 `focus` 为压栈点，粒度是"一次编辑会话"，不做逐字符级撤销。

**结论：计划完整、自洽，可直接进入 subagent-driven-development 执行。**
