# 迭代计划：验收基线 + M1-P2 面板运维 + M2-P2 传输纵深

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先补齐 gRPC/XHTTP 数据面验收基线，再交付 M1-P2 面板内置延迟测试与优选 IP 管理，并在此基础上对 M2-P2 传输改动做“先测后改、无据不改”的评估。

**Architecture:** 三个独立可验收的阶段（Phase A→B→C），每阶段产出可运行的测试/功能并自验收后才进入下一阶段。Phase A 只加测试代码（不动生产逻辑），复用 `scripts/test-runtime.cjs` 的 Miniflare + 本地 TCP echo 模式，新增 gRPC/XHTTP 双向集成测试与突发分帧压力测试。Phase B 新增：`transport/dial.js` 导出 TCP 探测助手（约束：`cloudflare:sockets` 只允许在 dial.js 导入）、`main.js` 增加 `/admin/probe` 路由（复用登录会话鉴权）、`admin/panel.js` 增加“优选 IP 测速与编辑”卡片（读写已有 KV 键 `ADD.txt`，不新增绑定）。Phase C 仅在 Phase A 基线上评估 gRPC 头紧凑化/UDP over WS 是否有可验证收益，无则记录决策跳过。

**Tech Stack:** Miniflare (workerd)、Node ≥22、esbuild、Cloudflare Workers（KV + cloudflare:sockets + nodejs_als）。

**关键约束（不可违反）：**
1. 部署产物始终单文件 `_worker.js`；任何 src 改动必须 `npm run build` 后 `npm run check`。
2. 零新绑定：只允许现有 KV。
3. `cloudflare:sockets` 只在 `src/transport/dial.js` 导入（MODULES.md 边界）。
4. 真实 CF 边缘/长期负载不在本沙箱可自验收范围，记为外部验收项，不假报通过。

---

## 文件结构

- Create: `scripts/test-grpc-xhttp.cjs` — gRPC/XHTTP 双向集成测试 + 突发分帧回环测试
- Modify: `scripts/test-runtime.cjs` — 追加 Phase B 的 probe/ADD.txt 断言
- Modify: `package.json` — 新增 `test:proto` 脚本
- Modify: `src/transport/dial.js` — 新增导出 `TCP连接延迟(主机, 端口, 超时毫秒)`
- Modify: `src/main.js` — 新增 `/admin/probe` 路由（GET，会话鉴权）
- Modify: `src/admin/panel.js` — 新增优选 IP 测速/编辑卡片
- Modify: `README.md` — “当前行为”补充面板测速说明（约束：文档与功能同步）
- Modify: `docs/ARCHITECTURE-LIMITS.md` — 验收条目状态更新（gRPC/XHTTP、背压）

---

# Phase A — 验收基线（只加测试，不改生产逻辑）

## Task A1: gRPC 双向集成测试（VLESS + Trojan over gRPC）

**Files:**
- Create: `scripts/test-grpc-xhttp.cjs`
- Modify: `package.json`（scripts 增加 `test:proto`）

- [ ] **Step 1: 编写测试**

```js
// scripts/test-grpc-xhttp.cjs
'use strict';
// Phase A-1：gRPC/XHTTP 双向集成。在 workerd 中跑真实 _worker.js，
// 用本地 TCP echo 验证 gRPC(application/grpc) 与 XHTTP(padding 头) 两类传输的
// VLESS/Trojan 四组合：上行分帧重组 + 下行协议响应头 + 双向数据回传。
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');

const uuid = '11111111-1111-4111-8111-111111111111';
// 与 src/core/paths.js 获取叉HTTPPadding标识 的派生规则保持一致。
const paddingHeader = uuid.slice(1, 7);       // '111111'
const paddingKey = '_' + uuid.slice(25, 31);  // '_111111'

// ---- gRPC 帧工具（上行：5 字节头 + protobuf{0x0a + varint + 数据}）----
function varint(n) {
  const out = [];
  while (n > 127) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n);
  return Uint8Array.from(out);
}
function grpcFrame(payload) {
  const body = new Uint8Array(1 + varint(payload.length).length + payload.length);
  body[0] = 0x0a;
  body.set(varint(payload.length), 1);
  body.set(payload, 1 + varint(payload.length).length);
  const total = 5 + body.length;
  const frame = new Uint8Array(total);
  frame[0] = 0;
  frame[1] = body.length >>> 24; frame[2] = (body.length >>> 16) & 0xff;
  frame[3] = (body.length >>> 8) & 0xff; frame[4] = body.length & 0xff;
  frame.set(body, 5);
  return frame;
}
// 解析下行 gRPC 帧流 → 拼接 payload（剥离 0x0a + varint 前缀）。
function parseGrpcDownlink(bytes) {
  const chunks = [];
  let offset = 0;
  while (offset + 5 <= bytes.length) {
    const len = ((bytes[offset + 1] << 24) >>> 0) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 8) | bytes[offset + 4];
    const end = offset + 5 + len;
    if (end > bytes.length) break;
    let p = offset + 5;
    if (bytes[p] === 0x0a) {
      let shift = 0; p++;
      while (p < end && (bytes[p] & 0x80) !== 0) { shift += 7; p++; }
      p++;
    }
    chunks.push(bytes.subarray(p, end));
    offset = end;
  }
  return Buffer.concat(chunks);
}
// ---- VLESS / Trojan 首包构造（与 test-runtime.cjs 相同字节布局）----
function vlessHeader(port, payload) {
  return Uint8Array.from([0, ...Buffer.from(uuid.replaceAll('-', ''), 'hex'),
    0, 1, port >> 8, port & 255, 1, 127, 0, 0, 1, ...payload]);
}
function trojanHeader(port, payload) {
  return Buffer.concat([
    Buffer.from(crypto.createHash('sha224').update(uuid).digest('hex') + '\r\n'),
    Buffer.from([1, 1, 127, 0, 0, 1, port >> 8, port & 255, 13, 10]),
    Buffer.from(payload),
  ]);
}
async function readAllStream(stream, timeoutMs = 8000) {
  const reader = stream.getReader();
  const chunks = [];
  return await Promise.race([
    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks);
    })(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('response stream timeout')), timeoutMs)),
  ]);
}

(async () => {
  const sockets = new Set();
  const echo = net.createServer(s => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.pipe(s); });
  await new Promise((resolve, reject) => { echo.once('error', reject); echo.listen(0, '127.0.0.1', resolve); });
  let mf;
  try {
    mf = new Miniflare(convertV4MiniflareOptions({
      cf: false,
      workers: [{
        name: 'test',
        modules: true,
        scriptPath: path.join(__dirname, '../_worker.js'),
        compatibilityDate: '2025-11-04',
        compatibilityFlags: ['nodejs_als'],
        kvNamespaces: ['KV'],
        bindings: { ADMIN: 'runtime-test-password', KEY: 'runtime-test-key', UUID: uuid, OFF_LOG: 'true' },
      }],
    }));
    const call = (pathname, init = {}) =>
      mf.dispatchFetch('https://runtime.example' + pathname, { redirect: 'manual', ...init, headers: { 'User-Agent': 'runtime-test', ...init.headers } });
    const port = echo.address().port;
    const echoText = (t) => t + '-' + crypto.randomBytes(4).toString('hex');

    // ---------- 1) VLESS over gRPC ----------
    const vText = echoText('grpc-vless');
    const vBody = grpcFrame(vlessHeader(port, Buffer.from(vText)));
    const vRes = await call('/', { method: 'POST', headers: { 'Content-Type': 'application/grpc' }, body: vBody });
    assert.equal(vRes.status, 200);
    assert.match(vRes.headers.get('content-type'), /application\/grpc/);
    const vDown = parseGrpcDownlink(await readAllStream(vRes.body));
    assert.deepEqual([...vDown.subarray(0, 2)], [0, 0], 'gRPC VLESS 应回传 [version,0] 协议响应头');
    assert.equal(vDown.subarray(2).toString(), vText);

    // ---------- 2) Trojan over gRPC ----------
    const tText = echoText('grpc-trojan');
    const tBody = grpcFrame(trojanHeader(port, tText));
    const tRes = await call('/', { method: 'POST', headers: { 'Content-Type': 'application/grpc' }, body: tBody });
    assert.equal(tRes.status, 200);
    const tDown = parseGrpcDownlink(await readAllStream(tRes.body));
    assert.equal(tDown.toString(), tText, 'gRPC Trojan 下行不应有响应头前缀');

    // ---------- 3) VLESS over gRPC：分帧 + 突发（64KB×8 回环校验）----------
    const burst = crypto.randomBytes(64 * 1024);
    const big = grpcFrame(vlessHeader(port, burst));
    const chunkSize = 3; // 模拟任意分片，强制首包重组路径
    const stream = new ReadableStream({
      start(controller) { let i = 0; while (i < big.length) { controller.enqueue(big.subarray(i, i + chunkSize)); i += chunkSize; } controller.close(); },
    });
    const bRes = await call('/', { method: 'POST', headers: { 'Content-Type': 'application/grpc' }, body: stream });
    assert.equal(bRes.status, 200);
    const bDown = parseGrpcDownlink(await readAllStream(bRes.body));
    assert.equal(bDown.subarray(2).length, burst.length, '突发回环长度不一致');
    assert.ok(bDown.subarray(2).equals(Buffer.from(burst)), '突发回环内容不一致');

    // ---------- 4) VLESS over XHTTP（需要合法 padding 头；140 个 base62 字符 → Huffman 105 字节）----------
    const XHTTP_base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const padding = Array.from({ length: 140 }, () => XHTTP_base62[Math.floor(Math.random() * XHTTP_base62.length)]).join('');
    const xText = echoText('xhttp-vless');
    const xBody = Buffer.concat([vlessHeader(port, Buffer.from(xText))]);
    const xRes = await call('/', { method: 'POST', headers: { [paddingHeader]: padding, 'Content-Type': 'application/octet-stream' }, body: xBody });
    assert.equal(xRes.status, 200);
    assert.ok(xRes.headers.get(paddingHeader) || xRes.headers.get(paddingHeader.toLowerCase()),
      'XHTTP 响应应回带 padding 头');
    const xDown = await readAllStream(xRes.body);
    assert.deepEqual([...xDown.subarray(0, 2)], [0, 0], 'XHTTP VLESS 应回传 [version,0] 协议响应头');
    assert.equal(xDown.subarray(2).toString(), xText);

    // ---------- 5) Trojan over XHTTP ----------
    const xTextT = echoText('xhttp-trojan');
    const xTBody = trojanHeader(port, xTextT);
    const xTRes = await call('/', { method: 'POST', headers: { [paddingHeader]: padding, 'Content-Type': 'application/octet-stream' }, body: Buffer.from(xTBody) });
    assert.equal(xTRes.status, 200);
    const xTDown = await readAllStream(xTRes.body);
    assert.equal(xTDown.toString(), xTextT, 'XHTTP Trojan 下行不应有响应头前缀');

    console.log('[PASS] gRPC(VLESS/Trojan/突发64KB×8分帧) + XHTTP(VLESS/Trojan) 双向流经真实 workerd 回环一致');
  } finally {
    await mf?.dispose();
    for (const s of sockets) s.destroy();
    await new Promise(r => echo.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 2: 注册脚本**

`package.json` scripts 增加：

```json
"test:proto": "node scripts/test-grpc-xhttp.cjs",
```

- [ ] **Step 3: 运行并确认通过**

Run: `npm run test:proto`
Expected: `[PASS] gRPC(VLESS/Trojan/突发64KB×8分帧) + XHTTP(VLESS/Trojan) 双向流经真实 workerd 回环一致`

- [ ] **Step 4: 提交**

```bash
git add scripts/test-grpc-xhttp.cjs package.json package-lock.json
git commit -m "test: 新增 gRPC/XHTTP 数据面验收基线（VLESS/Trojan/突发分帧回环）"
```

## Task A2: 背压/突发回归（并入 Task A1 的突发用例）与验收记录

- [ ] **Step 1: 确认 A1 步骤 3 中突发用例已覆盖“单连接 1MB 上行队列”边界内的最大单帧回环（64KB×8=512KB）**
  - 若通过，在 `docs/ARCHITECTURE-LIMITS.md` 的“缓冲”行补充注记：本地 workerd 已验 512KB 单连接突发回环（绝对内存/慢消费者长时行为仍需 staging，列为外部验收项）。
- [ ] **Step 2: 记录外部验收项（不假报通过）**
  - 在 `docs/ARCHITECTURE-LIMITS.md` 末尾追加一行 checklist：
    - [ ] staging：真实 CF 边缘 gRPC/XHTTP 各 1 小时长连接；证书过期/主机名错误矩阵；慢消费者内存观测
  - 说明：本沙箱无 CF 凭据与发布权限，该矩阵属外部验收，不在本地自验收范围。

- [ ] **Step 3: 提交**

```bash
git add docs/ARCHITECTURE-LIMITS.md
git commit -m "docs: 更新验收基线记录（gRPC/XHTTP/突发已验，staging 矩阵列为外部验收）"
```

---

# Phase B — M1-P2 面板内置测速 + 优选 IP 管理

> 现状核查：`admin/ADD.txt` 的 GET/POST 已在 main.js 存在（保存/读取自定义优选 IP→KV `ADD.txt`），订阅生成路径（nodes.js）也已消费 `ADD.txt`。因此本阶段**不重复实现 REST API**（DRY），只补缺失的两块：TCP 连通测速端点 + 本地面板编辑/测速 UI。

## Task B1: TCP 探测助手（transport/dial.js）

- [ ] **Step 1: 在 `src/transport/dial.js` 末尾追加导出助手**

```js
// M1-P2：面板测速用 TCP 连通探测。只做 I/O 等待（connect 计时），不发送数据；
// cloudflare:sockets 仍只在 dial.js 导入（MODULES.md 边界）。
async function TCP连接延迟(主机, 端口, 超时毫秒 = 3000) {
  const 开始 = performance.now();
  try {
    const socket = cloudflareConnect({ hostname: 主机, port: 端口 });
    const opened = socket.opened;
    await Promise.race([
      opened,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 超时毫秒)),
    ]);
    const ms = Math.max(0, Math.round(performance.now() - 开始));
    setTimeout(() => { try { socket.close(); } catch (e) { } }, 0);
    return { ok: true, ms };
  } catch (error) {
    return { ok: false, ms: Math.max(0, Math.round(performance.now() - 开始)), error: String(error?.message || error).slice(0, 120) };
  }
}
```

- [ ] **Step 2: 导出函数**

在 `src/transport/dial.js` 的 `export { ... }` 中追加 `TCP连接延迟`。

- [ ] **Step 3: 运行模块边界检查**

Run: `node scripts/check-modules.cjs`（经 `npm run check` 全量执行）
Expected: 无“未声明引用/隐式引用”错误。

- [ ] **Step 4: 提交**

```bash
git add src/transport/dial.js
git commit -m "feat: transport 导出 TCP 连通探测助手（面板测速用，零新绑定）"
```

## Task B2: /admin/probe 路由（main.js）

- [ ] **Step 1: 在 `src/main.js` 顶部 import 追加**

```js
import { httpConnect, socks5Connect, 创建请求TCP连接器, TCP连接延迟 } from './transport/dial.js';
```

- [ ] **Step 2: 在 admin GET 分支（`admin/config.json` 附近）插入探测路由**

在 `src/main.js` 的 `} else if (区分大小写访问路径 === 'admin/ADD.txt') {// 处理 admin/ADD.txt 请求，返回本地优选IP` 块**之后**追加：

```js
} else if (区分大小写访问路径 === 'admin/probe') {// M1-P2 面板测速：登录会话内 TCP 连通探测
  const 目标 = String(url.searchParams.get('target') || '').trim();
  const ipv4 = 目标.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$/);
  const ipv6 = 目标.match(/^\[([0-9a-fA-F:]+)\]:(\d{1,5})$/);
  if (!ipv4 && !ipv6) return new Response(JSON.stringify({ error: '仅支持 IPv4/IPv6 端口格式，如 1.2.3.4:443 或 [::1]:443' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
  const 主机 = ipv4 ? ipv4[1] : ipv6[1];
  const 端口 = Number(ipv4 ? ipv4[2] : ipv6[2]);
  if (!Number.isInteger(端口) || 端口 < 1 || 端口 > 65535) return new Response(JSON.stringify({ error: '端口无效' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
  const 结果 = await TCP连接延迟(主机, 端口, Number(url.searchParams.get('timeout') || '3000'));
  return new Response(JSON.stringify({ target: 目标, ...结果 }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' } });
}
```

路由位置说明：该分支位于登录会话校验之后（`验证会话` 已通过），GET 请求，复用现有鉴权，无需新增限流绑定；面板 UI 控制单次探测数量。

- [ ] **Step 3: 构建并检查**

Run: `npm run build && npm run check`
Expected: 构建重现一致（`[check] 构建产物与仓库内一致`）且全部单测通过。

- [ ] **Step 4: 提交**

```bash
git add src/main.js _worker.js
git commit -m "feat: 新增 admin/probe 登录会话内 TCP 连通测速端点"
```

## Task B3: 面板“优选 IP 测速与编辑”卡片（admin/panel.js）

- [ ] **Step 1: 在 `管理面板配置页HTML` 的 `.card`（“KV 全量配置”卡片之后、“环境变量”卡片之前）插入卡片与样式**

在样式区末尾追加：

```css
.iprow dt{font-size:12px;color:#8b93a7;margin:0 0 6px}.iprow{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}
table.probe{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}table.probe td{padding:5px 8px;border-bottom:1px solid #232c3e;overflow-wrap:anywhere}
table.probe td.ok{color:#6fd18a}table.probe td.bad{color:#f2706c}
```

在“环境变量”卡片前插入：

```html
<div class="card"><div class="row"><h2>优选 IP 测速与编辑</h2><div><button onclick="loadIps()">加载</button> <button class="ghost" onclick="saveIps()">保存到 KV</button> <button class="ghost" onclick="probeIps()">批量测速</button><span id="ipstatus" role="status" aria-live="polite"></span></div></div>
<p class="sub">每行一个 <code>IP:端口</code> 或 <code>[IPv6]:端口</code>（可带 <code>#备注</code>）。保存写入 KV <code>ADD.txt</code>；订阅节点使用它需要把配置 JSON 中 <code>优选订阅生成.本地IP库.随机IP</code> 改为 <code>false</code>。测速仅登录会话语境内运行，建议先测后保存。</p>
<textarea id="ips" spellcheck="false" placeholder="例如&#10;1.2.3.4:443#备注">${转义HTML(currentIps)}</textarea>
<div id="probeResult"></div></div>
```

在 `<script>` 开头增加状态变量与函数：

```js
let currentIps='';
async function loadIps(){try{const r=await fetch('/admin/ADD.txt');if(!r.ok)throw new Error('HTTP '+r.status);currentIps=await r.text();document.getElementById('ips').value=currentIps;ipd('已加载 ADD.txt');}catch(e){ipd('加载失败：'+e.message);}}
async function saveIps(){ipd('正在保存…');try{const r=await fetch('/admin/ADD.txt',{method:'POST',headers:{'Content-Type':'text/plain'},body:document.getElementById('ips').value});const res=await r.json();ipd(r.ok?(res.message||'已保存'):('保存失败：'+JSON.stringify(res)));}catch(e){ipd('保存失败：'+e.message);}}
async function probeIps(){const lines=document.getElementById('ips').value.split(/\r?\n/).map(s=>s.trim().split('#')[0].trim()).filter(s=>/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[[0-9a-fA-F:]+\]):\d{1,5}$/.test(s));if(!lines.length){ipd('没有可测的 IP 行');return;}ipd('正在测速 '+lines.length+' 个目标（并发 5）…');const el=document.getElementById('probeResult');el.innerHTML='<table class="probe"><tr><td>目标</td><td>结果</td></tr></table>';const tbl=el.firstChild;let done=0,queue=lines.slice();async function worker(){while(queue.length){const t=queue.shift();let row=document.createElement('tr');const td1=document.createElement('td');td1.textContent=t;const td2=document.createElement('td');td2.textContent='…';row.append(td1,td2);tbl.append(row);try{const r=await fetch('/admin/probe?target='+encodeURIComponent(t));const res=await r.json();td2.textContent=res.ok?('可达 '+res.ms+'ms'):('不可达'+(res.error?'：'+res.error:''));td2.className=res.ok?'ok':'bad';}catch(e){td2.textContent='测速失败：'+e.message;td2.className='bad';}done++;ipd('测速中… '+done+'/'+lines.length);}}await Promise.all(Array.from({length:Math.min(5,lines.length)},worker));ipd('测速完成 '+done+'/'+lines.length);}
function ipd(m){const s=document.getElementById('ipstatus');s.textContent=m;}
loadIps();
```

函数 `管理面板配置页HTML(env, config_JSON)` 签名不变；卡片内的 `${currentIps}` 由函数入口的空串默认值渲染（首次加载后由 `loadIps()` 填充）。

- [ ] **Step 2: 构建并检查**

Run: `npm run build && npm run check`
Expected: 一致且通过。

- [ ] **Step 3: 提交**

```bash
git add src/admin/panel.js _worker.js
git commit -m "feat: 面板新增优选 IP 测速与编辑卡片（复用 admin/ADD.txt，零新绑定）"
```

## Task B4: probe/ADD.txt 集成断言（extend test-runtime.cjs）

- [ ] **Step 1: 在 `scripts/test-runtime.cjs` 的 SS 用例之后插入**

```js
  // M1-P2：admin/probe 需登录会话；探测本地 echo 端口应可达，已关闭端口应不可达。
  const probe401 = await call('/admin/probe?target=127.0.0.1:1');
  assert.equal(probe401.status, 302);
  const probeOk = await call('/admin/probe?target=' + '127.0.0.1:' + port, { headers: { Cookie: cookie } });
  assert.equal(probeOk.status, 200);
  const probeJson = await probeOk.json();
  assert.equal(probeJson.ok, true);
  assert.ok(probeJson.ms >= 0);
  const probeBad = await call('/admin/probe?target=127.0.0.1:1', { headers: { Cookie: cookie } });
  const probeBadJson = await probeBad.json();
  assert.equal(probeBadJson.ok, false);
  assert.equal((await call('/admin/probe?target=not-an-ip', { headers: { Cookie: cookie } })).status, 400);
  // M1-P2：ADD.txt 保存后可由订阅节点读取链路回读（本地 KV）。
  const customIps = '127.0.0.1:' + port + '#local\n';
  const saveIps = await call('/admin/ADD.txt', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'text/plain' }, body: customIps });
  assert.equal(saveIps.status, 200);
  const savedIps = await (await mf.getKVNamespace('KV')).get('ADD.txt');
  assert.equal(savedIps, customIps);
  assert.equal((await call('/admin/ADD.txt', { headers: { Cookie: cookie } })).status, 200);
```

- [ ] **Step 2: 运行全部运维断言**

Run: `npm run build && npm run test:runtime`
Expected: 原有 5 条 PASS 之外新增 probe/ADD.txt 断言全部通过。

- [ ] **Step 3: 提交**

```bash
git add scripts/test-runtime.cjs
git commit -m "test: 新增 admin/probe 与 ADD.txt 集成断言"
```

## Task B5: README 同步

- [ ] **Step 1: 在 README “当前行为”末尾追加一行**

```markdown
- 管理面板内置“优选 IP 测速与编辑”：登录后对候选 IP 做 TCP 连通测速（会话内端点 `/admin/probe`），编辑结果保存到 KV `ADD.txt`；使用固定 IP 作订阅节点时把配置 JSON 的 `优选订阅生成.本地IP库.随机IP` 设为 `false`。
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: README 同步面板优选 IP 测速功能"
```

---

# Phase C — M2-P2 传输纵深（先测后改，无据不改）

## Task C1: 基线评估

- [ ] **Step 1: 在 Phase A/B 全绿后评估两个候选方向**
  - **gRPC 头紧凑化**：当前下行逐块封装 `5 字节头 + 0x0a + varint` 是 gRPC 线协议规范要求；“紧凑化”若偏离规范会破坏与标准 gRPC 客户端（xray/sing-box 的 gun）互操作。无用户侧实测指标支撑时，**不做**（YAGNI + 互操作风险）。
  - **UDP over WS**：`ws.js` 已具备 VLESS/Trojan UDP 分支并走 `udp.js`（`forwardataudp`/`转发木马UDP数据`）；Phase A 未覆盖 UDP。补一条 UDP 回环回归（本地 `dgram` echo + 分帧）验证现状即可，不改实现。
- [ ] **Step 2: 若 Step 1 未发现可验证的缺陷或收益，在 Phase C 记录决策**

```markdown
### Phase C 决策（2026-09-19）
- gRPC 头紧凑化：不实施。规范合规优先，缺收益数据，改动即互操作风险。
- UDP over WS：现状已实现；补充 UDP 回环回归测试固化现状（见 Task C2），不改协议逻辑。
```

- [ ] **Step 3: 提交决策记录（追加到 `docs/ARCHITECTURE-LIMITS.md` 验收记录末尾）**

## Task C2: UDP 回环回归（固化现状）

- [ ] **Step 1: 在 `scripts/test-grpc-xhttp.cjs` 追加 UDP 用例（VLESS over WS → dgram echo）**
  - 本地 `dgram.createSocket('udp4')` 回显，随机端口；VLESS UDP 首包（cmd=2, port=该端口, atype=1, ip 127.0.0.1, 载荷 8 字节）；经 `/` WebSocket（`Upgrade: websocket`）发送，断言回包载荷一致。
  - 实现与 `test-runtime.cjs` 的 VLESS WS 用例同构（`response.webSocket` + 分帧发送）。
- [ ] **Step 2: 运行并确认通过**

Run: `npm run test:proto`
Expected: 新增 `[PASS] UDP over WS 回环` 输出，原有 PASS 不回归。

- [ ] **Step 3: 提交**

```bash
git add scripts/test-grpc-xhttp.cjs
git commit -m "test: UDP over WS 回环回归（固化现状，不改协议）"
```

---

# 自验收门（每阶段完成必须全绿）

| 阶段 | 命令 | 必过项 |
|---|---|---|
| A | `npm run test:proto` | gRPC VLESS/Trojan + 突发分帧 + XHTTP VLESS/Trojan 回环 |
| A 全量 | `npm run check && npm run test:runtime && npm run test:proto` | 全部单测 + 登录/鉴权/KV + 新协议测试 |
| B | `npm run build && npm run check && npm run test:runtime` | 构建重现一致 + probe/ADD.txt 断言 |
| C | `npm run test:proto` | UDP 回环 + 既有协议测试不回归 |

**外部验收项（本沙箱不可自验，不假报通过）**：真实 CF 边缘 gRPC/XHTTP 长连接、证书矩阵、慢消费者内存观测、长期负载。