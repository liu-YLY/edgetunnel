// M1-P1 订阅客户端生成 golden 测试：验证 UA→订阅类型分流、直出明文、Loon/QuanX 热补丁。
// 方案与 test-config.js 一致：将构建产物 transform（export default → globalThis.__worker）后，
// 由 node 以子进程执行 bundle + 测试体（顶层声明共享作用域，不触发 fetch）。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRODUCT = path.join(ROOT, '_worker.js');

const TEST_BODY = `
;(async () => {
  const assert = require('assert');

  // ===== 1) 订阅类型解析（UA / 参数 → 类型，顺序敏感 + 长词在前）=====
  const urlOf = (search, host = 'example.com') => new URL('https://' + host + '/' + search);
  // UA 命中
  assert.strictEqual(识别订阅类型('shadowrocket/2.1.2 (build 1046) iphone', urlOf('sub')), 'shadowrocket', 'UA Shadowrocket → shadowrocket');
  assert.strictEqual(识别订阅类型('quantumult%20x/1.0.0 (9) (quantumult%20x)', urlOf('sub')), 'quantumultx', 'UA Quantumult%20X → quantumultx');
  assert.strictEqual(识别订阅类型('quantumult x/1.0.0', urlOf('sub')), 'quantumultx', 'UA Quantumult X(空格) → quantumultx');
  assert.strictEqual(识别订阅类型('v2rayng/1.8.0', urlOf('sub')), 'v2rayn', 'UA v2rayng → v2rayn');
  assert.strictEqual(识别订阅类型('v2rayn/1.8.0', urlOf('sub')), 'v2rayn', 'UA v2rayN → v2rayn');
  assert.strictEqual(识别订阅类型('clashforandroid/2.5.9', urlOf('sub')), 'clash', 'UA Clash → clash');
  assert.strictEqual(识别订阅类型('sing-box/1.9.0', urlOf('sub')), 'singbox', 'UA sing-box → singbox');
  assert.strictEqual(识别订阅类型('surge/4.0', urlOf('sub')), 'surge', 'UA Surge → surge');
  // 参数优先于 UA
  assert.strictEqual(识别订阅类型('clashforandroid/2.5.9', urlOf('sub?loon')), 'loon', '参数 ?loon 优先 → loon');
  assert.strictEqual(识别订阅类型('shadowrocket/2.1.2', urlOf('sub?qx=1')), 'quantumultx', '参数 ?qx → quantumultx');
  // 无关 UA 默认保持旧行为（mixed）
  assert.strictEqual(识别订阅类型('mozilla/5.0 (windows nt 10.0)', urlOf('sub')), 'mixed', '无关 UA → mixed（默认）');

  // ===== 2) 订阅类型 → 转换器 target 映射 =====
  assert.strictEqual(订阅转换器目标('surge'), 'surge&ver=4', 'surge → surge&ver=4');
  assert.strictEqual(订阅转换器目标('quantumultx'), 'quanx', 'quantumultx → quanx');
  assert.strictEqual(订阅转换器目标('loon'), 'loon', 'loon → loon');
  assert.strictEqual(订阅转换器目标('clash'), 'clash', 'clash → clash');
  assert.strictEqual(订阅转换器目标('singbox'), 'singbox', 'singbox → singbox');

  // ===== 3) 直出明文订阅（Shadowrocket / V2rayN）=====
  const 节点列表 = [
    'vless://00000000-0000-4000-8000-000000000000@1.2.3.4:443?security=tls&type=ws&host=example.com&path=%2Fvideo#USA-01',
    'trojan://password@5.6.7.8:443?security=tls&sni=example.com&type=ws&path=%2Fvideo#JP-02',
  ].join('\n');
  for (const [函数名, 生成函数] of [['生成Shadowrocket订阅', 生成Shadowrocket订阅], ['生成V2rayN订阅', 生成V2rayN订阅]]) {
    const 结果 = 生成函数(节点列表, '/video/abc', {});
    const 行 = 结果.trim().split('\n').filter(Boolean);
    assert.ok(结果.length > 0, `${函数名} 返回非空`);
    assert.strictEqual(行.length, 2, `${函数名} 保留 2 条合法节点`);
    for (const 单行 of 行) {
      assert.match(单行, /^(vless|trojan):\/\//, `${函数名} 行以 vless:// 或 trojan:// 开头`);
      assert.ok(单行.includes('#'), `${函数名} 行含 # 备注`);
    }
    // 非法行应被过滤
    const 带垃圾 = 生成函数('not-a-link\n' + 节点列表 + '\nFINAL,DIRECT', '/video/abc', {});
    assert.strictEqual(带垃圾.trim().split('\n').filter(Boolean).length, 2, `${函数名} 过滤非法行`);
  }

  // ===== 4) Loon / QuanX 热补丁（不抛异常 + 非空 + 字段级修正）=====
  const 配置 = { 跳过证书验证: true, 随机路径: false, 完整节点路径: '/video/abc', UUID: 'x' };
  const loon样本 = [
    '[General]',
    'stay_awake = true',
    '[Proxy]',
    'HK 01 = trojan,example.com,443, password=p,sni=example.com,over-tls=true',
    'US 06 = trojan,2606:4700::1,443, password=p,over-tls=true',
    '[Proxy Group]',
    'PROXY = select, HK 01',
    '[Rule]',
    'FINAL,DIRECT',
    '',
  ].join('\n');
  const loon结果 = Loon订阅配置文件热补丁(loon样本, 'https://example.com/sub?token=t&loon', 配置);
  assert.ok(typeof loon结果 === 'string' && loon结果.length > 0, 'Loon 热补丁返回非空');
  assert.ok(loon结果.includes('skip-cert-verify=true'), 'Loon 热补丁补齐 skip-cert-verify');
  assert.ok(loon结果.includes('[2606:4700::1]'), 'Loon 热补丁为裸 IPv6 补方括号');
  assert.ok(loon结果.includes('HK 01') && loon结果.includes('PROXY = select'), 'Loon 其余内容透传');

  const quanx样本 = [
    '[general]',
    'doh_server = https://223.5.5.5/dns-query',
    '[server_local]',
    'HK 01 = trojan, example.com:443, password=p, over-tls=true, sni=example.com',
    '[filter_remote]',
    'https://example.com/rule.txt, tag=ACL4SSR',
    '',
  ].join('\n');
  const quanx结果 = QuantumultX订阅配置文件热补丁(quanx样本, 'https://example.com/sub?token=t&quanx', 配置);
  assert.ok(typeof quanx结果 === 'string' && quanx结果.length > 0, 'QuantumultX 热补丁返回非空');
  assert.ok(quanx结果.includes('skip-cert-verify=true'), 'QuantumultX 热补丁补齐 skip-cert-verify');
  assert.ok(quanx结果.includes('[filter_remote]'), 'QuantumultX 远端规则段透传');

  console.log('[test] 订阅分流：UA→类型 / 参数优先 / 默认 mixed / target 映射 / 直出链接 / Loon&QuanX 热补丁');
  console.log('[test] 全部断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test] FAIL:', e); process.exit(1); });
`;

function main() {
  const raw = fs.readFileSync(PRODUCT, 'utf8');
  const idx = raw.indexOf('export default {');
  if (idx === -1) { console.error('[test] FAIL: 产物中未找到 export default {'); process.exit(1); }
  const bundle = raw.slice(0, idx) + 'globalThis.__worker = {' + raw.slice(idx + 'export default {'.length) + '\n' + TEST_BODY;

  const tmp = path.join(os.tmpdir(), `m1-subscribe-test-${process.pid}-${Date.now()}.cjs`);
  fs.writeFileSync(tmp, bundle, 'utf8');
  try {
    execFileSync(process.execPath, [tmp], {
      cwd: ROOT,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: Object.assign({}, process.env, { NODE_OPTIONS: '' }),
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (e) {
    console.error(`[test] FAIL: 断言失败或执行异常 (exit ${e.status})`);
    process.exitCode = e.status || 1;
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch (_) {}
  }
}

main();