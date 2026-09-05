// M0-3 golden 测试：验证 全局读取配置 与旧逻辑行为一致（逐字段断言）。
// 方案：将构建产物 transform（export default → globalThis.__worker）后，
// 由 node 以子进程执行 bundle + 测试体（顶层只做声明，fetch 不会被调用）。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// 仓库根：基于脚本位置推导（test-config.js 位于 scripts/ 下），
// 兼容本地沙箱与 CI checkout（两者工作目录不同，禁止硬编码绝对路径）。
const ROOT = path.resolve(__dirname, '..');
const PRODUCT = path.join(ROOT, '_worker.js');

// 测试体：注入到 bundle 末尾一并执行（与 _worker.js 顶层共享作用域）
const TEST_BODY = `
;(async () => {
  const assert = require('assert');
  // MD5 shim：CF Workers 的 WebCrypto 支持 'MD5' 摘要（非标准扩展），node 不支持。
  // 仅在测试环境注入，映射到 node:crypto 的 createHash('md5')，业务代码零改动。
  {
    const nodeCrypto = require('crypto');
    const origDigest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (algo, data) => {
      const name = typeof algo === 'string' ? algo : algo.name;
      return name.toUpperCase() === 'MD5'
        ? nodeCrypto.createHash('md5').update(new Uint8Array(data)).digest()
        : origDigest(algo, data);
    };
  }
  const run = async (env, cf, host, search = '') => {
    const url = new URL('https://' + host + '/' + search);
    const request = {
      cf: Object.assign({ colo: 'SJC' }, cf),
      headers: new Headers({ 'User-Agent': 'test' }),
      url: url.href,
      method: 'GET',
    };
    // 每次调用前重置被副作用写入的全局变量
    调试日志打印 = false; 预加载竞速拨号 = false; 反代并发拨号数 = 1; TCP并发拨号数 = 1;
    return await 全局读取配置(env, request, url);
  };

  // 场景 1：最简 env，无 KV、无 HOST、无 PROXYIP
  let cfg = await run({ ADMIN: 'testpass', KEY: 'secret', DEBUG: 'true' }, {}, 'example.com');
  assert.strictEqual(cfg.管理员密码, 'testpass', '管理员密码');
  assert.strictEqual(cfg.加密秘钥, 'secret', '加密秘钥');
  assert.match(cfg.userID, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'userID 为 UUID v4 格式');
  assert.strictEqual(cfg.host, 'example.com', 'host 取 url.hostname');
  assert.ok(typeof cfg.默认反代IP === 'string' && cfg.默认反代IP.startsWith('sjc.'), '默认反代IP 使用 colo 前缀');
  assert.strictEqual(cfg.默认反代兜底, true, '未配 PROXYIP 时兜底开启');
  assert.strictEqual(cfg.envUUID, undefined, '未配 UUID env');
  assert.strictEqual(cfg.BEST_SUB, false, 'BEST_SUB 默认 false');
  assert.strictEqual(cfg.KV可用, false, '无 KV 绑定');
  assert.strictEqual(cfg.伪装页URL, 'nginx', '伪装页默认 nginx');
  assert.strictEqual(调试日志打印, true, 'DEBUG=true 副作用全局生效');

  // 场景 2：配 HOST + PROXYIP + UUID + KV stub + URL 伪装页
  const kvStub = { get: async () => null, put: async () => {}, delete: async () => {} };
  cfg = await run({ ADMIN: 'a', KEY: 'k', HOST: 'a.example.com,b.example.com', PROXYIP: '1.2.3.4:443', UUID: '11111111-1111-4111-8111-111111111111', URL: 'http://fake.example.com/extra/', KV: kvStub }, { colo: 'HKG' }, 'via.host.dev');
  assert.ok(Array.isArray(cfg.hosts) && cfg.hosts.length === 2, 'HOST 解析为数组');
  assert.strictEqual(cfg.host, 'a.example.com', 'host 取 HOST 首项');
  assert.strictEqual(cfg.默认反代IP, '1.2.3.4:443', 'PROXYIP 优先');
  assert.strictEqual(cfg.默认反代兜底, false, '配 PROXYIP 后关闭兜底');
  assert.strictEqual(cfg.envUUID, '11111111-1111-4111-8111-111111111111', 'UUID env 透传');
  assert.strictEqual(cfg.KV可用, true, 'KV 绑定可识别');
  assert.strictEqual(cfg.伪装页URL, 'https://fake.example.com', '伪装页规范化（强制 https + 去路径）');

  console.log('[test] 场景1 基础 env / 场景2 全量 env');

  // ===== M1-P0 config 覆盖断言 =====
  // 场景 3：KV 全量配置 cfg:{host} 优先于 env（KV > env > 默认值）
  const cfgKV全量 = { 跳过证书验证: true, PATH: '/kvpath' };
  const kvCfgStub = { get: async (k) => k === 'cfg:kv.example.com' ? JSON.stringify(cfgKV全量) : null, put: async () => {} };
  cfg = await 读取config_JSON({ ADMIN: 'a', KEY: 'k', PATH: '/envpath', KV: kvCfgStub }, 'kv.example.com', '11111111-1111-4111-8111-111111111111', 'test');
  assert.strictEqual(cfg.PATH, '/kvpath', 'KV cfg:{host} 覆盖 env.PATH');
  assert.strictEqual(cfg.跳过证书验证, true, 'KV cfg:{host} 覆盖默认值');

  // KV 缺键回退 env/默认值（缺键不崩溃）
  cfg = await 读取config_JSON({ ADMIN: 'a', KEY: 'k', PATH: '/envpath', KV: { get: async () => null, put: async () => {} } }, 'kv.example.com', '11111111-1111-4111-8111-111111111111', 'test');
  assert.strictEqual(cfg.PATH, '/envpath', 'KV 缺 cfg:{host} 时回退 env.PATH');

  // 场景 4：path 逐节点覆盖与 p/wk 互斥
  let ctx = await 反代参数获取(new URL('https://example.com/?p=9.9.9.9:443'), '00000000-0000-4000-8000-000000000000');
  assert.strictEqual(ctx.反代IP, '9.9.9.9:443', 'path 参数 p 覆盖连接级反代IP');
  assert.strictEqual(ctx.跳过地区匹配, true, '写 p 则跳过地区匹配');
  assert.strictEqual(ctx.地区匹配, false, '写 p 时地区匹配关闭');
  assert.strictEqual(ctx.地区, null, '写 p 时地区置空（p 与 wk 互斥）');

  ctx = await 反代参数获取(new URL('https://example.com/?wk=hk&rm=true'), '00000000-0000-4000-8000-000000000000');
  assert.strictEqual(ctx.地区, 'hk', 'wk 记录地区覆盖');
  assert.strictEqual(ctx.地区匹配, true, 'rm 开启地区匹配');
  assert.strictEqual(ctx.跳过地区匹配, false, '未写 p 时不跳过地区匹配');

  ctx = await 反代参数获取(new URL('https://example.com/?p=9.9.9.9:443&wk=hk&rm=true'), '00000000-0000-4000-8000-000000000000');
  assert.strictEqual(ctx.反代IP, '9.9.9.9:443', 'p 与 wk 同时出现时 p 生效（ProxyIP 覆盖）');
  assert.strictEqual(ctx.地区, null, 'p 与 wk 互斥：wk 被忽略');
  assert.strictEqual(ctx.跳过地区匹配, true, 'p 与 wk 互斥：地区匹配跳过');

  console.log('[test] 全部断言通过（场景1 基础 env / 场景2 全量 env / 场景3 KV>env / 场景4 path 覆盖 & p/wk 互斥）');
  process.exit(0);
})().catch((e) => { console.error('[test] FAIL:', e); process.exit(1); });
`;

function main() {
  const raw = fs.readFileSync(PRODUCT, 'utf8');
  // 仅替换第一处 `export default {`（main.js 的 Worker 入口对象字面量）
  const idx = raw.indexOf('export default {');
  if (idx === -1) { console.error('[test] FAIL: 产物中未找到 export default {'); process.exit(1); }
  const bundle = raw.slice(0, idx) + 'globalThis.__worker = {' + raw.slice(idx + 'export default {'.length) + '\n' + TEST_BODY;

  const tmp = path.join(os.tmpdir(), `m0-config-test-${process.pid}-${Date.now()}.cjs`);
  fs.writeFileSync(tmp, bundle, 'utf8');
  try {
    execFileSync(process.execPath, [tmp], {
      cwd: ROOT,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: Object.assign({}, process.env, { NODE_OPTIONS: '' }),
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (e) {
    // 子进程的 stderr 已 inherit；这里补充退出信息
    console.error(`[test] FAIL: 断言失败或执行异常 (exit ${e.status})`);
    process.exitCode = e.status || 1;
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch (_) {}
  }
}

main();