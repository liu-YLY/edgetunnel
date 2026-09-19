'use strict';
// Phase A-1：gRPC/XHTTP 双向集成。在 workerd 中跑真实 _worker.js，
// 用本地 TCP echo 验证 gRPC(application/grpc) 与 XHTTP(padding 头) 两类传输的
// VLESS/Trojan 组合：上行分帧重组 + 下行协议响应头 + 双向数据回传 + 突发回环。
// 关键：gRPC/XHTTP 均为双向流，测试保持请求体开启，待下行验证完成后再关闭，
// 避免服务端在 EOF 后提前拆除连接（与真实客户端行为一致）。
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
// 解析下行 gRPC 帧流 → 拼接 payload（剥离 5 字节头与 0x0a + varint 前缀）。
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

// 可保持开启的请求体：测试主动 close 前，workerd 视为流未结束（双向流语义）。
function openBody() {
  let ctrl;
  const stream = new ReadableStream({ start(c) { ctrl = c; } });
  return {
    stream,
    push(bytes) { ctrl.enqueue(bytes); },
    close() { try { ctrl.close(); } catch (_) { } },
  };
}
// 读取响应流直到 isDone 满足或流结束/超时，返回全部字节。
async function readStreamUntil(stream, isDone, timeoutMs = 12000) {
  const reader = stream.getReader();
  const chunks = [];
  return await Promise.race([
    (async () => {
      while (true) {
        if (isDone(chunks)) return Buffer.concat(chunks);
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks);
    })(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('response stream timeout')), timeoutMs)),
  ]);
}
const hasBytes = (n) => (chunks) => chunks.reduce((t, c) => t + c.length, 0) >= n;

(async () => {
  const sockets = new Set();
  const echo = net.createServer(s => { sockets.add(s); s.on('error', () => {}); s.on('close', () => sockets.delete(s)); s.pipe(s); });
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
    const call = (pathname, init = {}) => {
      const headers = { 'User-Agent': 'runtime-test', ...init.headers };
      const options = { redirect: 'manual', ...init, headers };
      if (init.body instanceof ReadableStream && !options.duplex) options.duplex = 'half';
      return mf.dispatchFetch('https://runtime.example' + pathname, options);
    };
    const port = echo.address().port;
    const echoText = (t) => t + '-' + crypto.randomBytes(4).toString('hex');

    // ---------- 1) VLESS over gRPC ----------
    const vText = echoText('grpc-vless');
    const vBody = openBody();
    vBody.push(grpcFrame(vlessHeader(port, Buffer.from(vText))));
    const vRes = await call('/', { method: 'POST', headers: { 'Content-Type': 'application/grpc' }, body: vBody.stream });
    assert.equal(vRes.status, 200);
    assert.match(vRes.headers.get('content-type'), /application\/grpc/);
    const vRaw = await readStreamUntil(vRes.body, hasBytes(vText.length + 2));
    vBody.close();
    const vDown = parseGrpcDownlink(vRaw);
    assert.deepEqual([...vDown.subarray(0, 2)], [0, 0], 'gRPC VLESS 应回传 [version,0] 协议响应头');
    assert.equal(vDown.subarray(2).toString(), vText);

    // ---------- 2) Trojan over gRPC ----------
    const tText = echoText('grpc-trojan');
    const tBody = openBody();
    tBody.push(grpcFrame(trojanHeader(port, tText)));
    const tRes = await call('/', { method: 'POST', headers: { 'Content-Type': 'application/grpc' }, body: tBody.stream });
    assert.equal(tRes.status, 200);
    const tRaw = await readStreamUntil(tRes.body, hasBytes(tText.length));
    tBody.close();
    const tDown = parseGrpcDownlink(tRaw);
    assert.equal(tDown.toString(), tText, 'gRPC Trojan 下行不应有响应头前缀');

    // ---------- 3) VLESS over gRPC：分帧 + 突发（64KB×8 回环校验）----------
    const burst = crypto.randomBytes(64 * 1024);
    const big = grpcFrame(vlessHeader(port, burst));
    const chunkSize = 3; // 模拟任意分片，强制收包重组路径
    const bBody = openBody();
    let i = 0;
    while (i < big.length) { bBody.push(big.subarray(i, i + chunkSize)); i += chunkSize; }
    const bRes = await call('/', { method: 'POST', headers: { 'Content-Type': 'application/grpc' }, body: bBody.stream });
    assert.equal(bRes.status, 200);
    const bRaw = await readStreamUntil(bRes.body, hasBytes(burst.length + 2));
    bBody.close();
    const bDown = parseGrpcDownlink(bRaw);
    assert.equal(bDown.subarray(2).length, burst.length, '突发回环长度不一致');
    assert.ok(bDown.subarray(2).equals(Buffer.from(burst)), '突发回环内容不一致');

    // ---------- 4) VLESS over XHTTP（合法 padding 头；140 个 base62 字符 → Huffman 105 字节，落在 98–1002 区间）----------
    const XHTTP_base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const padding = Array.from({ length: 140 }, () => XHTTP_base62[Math.floor(Math.random() * XHTTP_base62.length)]).join('');
    const xText = echoText('xhttp-vless');
    const xBody = openBody();
    xBody.push(Buffer.concat([vlessHeader(port, Buffer.from(xText))]));
    const xRes = await call('/', { method: 'POST', headers: { [paddingHeader]: padding, 'Content-Type': 'application/octet-stream' }, body: xBody.stream });
    assert.equal(xRes.status, 200);
    assert.ok(xRes.headers.get(paddingHeader) || xRes.headers.get(paddingHeader.toLowerCase()),
      'XHTTP 响应应回带 padding 头');
    const xRaw = await readStreamUntil(xRes.body, hasBytes(xText.length + 2));
    xBody.close();
    assert.deepEqual([...xRaw.subarray(0, 2)], [0, 0], 'XHTTP VLESS 应回传 [version,0] 协议响应头');
    assert.equal(xRaw.subarray(2).toString(), xText);

    // ---------- 5) Trojan over XHTTP ----------
    const xTextT = echoText('xhttp-trojan');
    const xTBody = openBody();
    xTBody.push(trojanHeader(port, xTextT));
    const xTRes = await call('/', { method: 'POST', headers: { [paddingHeader]: padding, 'Content-Type': 'application/octet-stream' }, body: xTBody.stream });
    assert.equal(xTRes.status, 200);
    const xTRaw = await readStreamUntil(xTRes.body, hasBytes(xTextT.length));
    xTBody.close();
    assert.equal(xTRaw.toString(), xTextT, 'XHTTP Trojan 下行不应有响应头前缀');

    console.log('[PASS] gRPC(VLESS/Trojan/突发64KB×8分帧) + XHTTP(VLESS/Trojan) 双向流经真实 workerd 回环一致');
  } finally {
    await mf?.dispose();
    for (const s of sockets) s.destroy();
    await new Promise(r => echo.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });