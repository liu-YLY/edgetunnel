import assert from 'node:assert/strict';
import { 随机路径 } from '../src/core/paths.js';
import { readFileSync } from 'node:fs';
import { 生成节点链接文本 } from '../src/subscribe/nodes.js';
import { 生成主节点链接, 校验链接预览选项 } from '../src/core/link.js';
import { 生成批量节点链接 } from '../src/subscribe/batch-links.js';
import { 检查节点链接 } from '../src/core/link-diagnostics.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const config = { UUID: uuid, 协议类型: 'vless', 传输协议: 'ws', Fingerprint: 'chrome',
  完整节点路径: '/ws', ALPN: 'h2,http/1.1', SS: { TLS: true, 加密方式: 'aes-128-gcm' }, 优选订阅生成: { SUBNAME: 'test' } };
const before = JSON.stringify(config);
const expanded = '[2606:4700:0000:0000:0000:0000:0000:0001]';
const options = 校验链接预览选项({ 地址: expanded }, config, 'test.example');
assert.equal(options.地址, '[2606:4700::1]', '合法 IPv6 应规范化而非被拒绝');
assert.throws(() => 校验链接预览选项({ 地址: '[:]' }, config, 'test.example'), /入口地址/);
assert.throws(() => 校验链接预览选项({ 协议类型: 'ss', 传输协议: 'ws', 路径: '/ws;host=wrong.example' }, config, 'test.example'), /分号/);
const primary = new URL(生成主节点链接(config, uuid, 'test.example', options));
assert.equal(primary.searchParams.get('alpn'), 'h2,http/1.1', '主节点和预览必须保留 ALPN');
assert.equal(new URL(生成主节点链接({ ...config, ALPN: '' }, uuid, 'test.example')).searchParams.has('alpn'), false);
const batch = 生成批量节点链接([expanded + ':443#first', '[2606:4700::1]:443#duplicate', 'other.example:8443#second'], config, uuid, 'test.example', {}, 'add');
assert.equal(batch.节点.length, 2);
assert.equal(batch.重复, 1, '同一 IPv6 的不同写法应去重');
assert.equal(new URL(batch.节点[0].链接).searchParams.get('alpn'), 'h2,http/1.1');
const special = 生成批量节点链接(['1.1.1.1:443#special', '2.2.2.2:443#plain'], config, uuid, 'test.example', {}, 'preferred', ['1.1.1.1:443']);
assert.equal(special.跳过, 1, '逐节点反代规则不可静默丢弃');
assert.equal(special.节点[0].地址, '2.2.2.2');
const bounded = 生成批量节点链接(Array.from({ length: 102 }, (_, i) => `node${i}.example:443`), config, uuid, 'test.example', {}, 'add');
assert.equal(bounded.节点.length, 100);
assert.equal(bounded.超限, 2);
const invalid = 生成批量节点链接(Array(510).fill('invalid/path'), config, uuid, 'test.example', {}, 'add');
assert.equal(invalid.跳过, 500);
assert.equal(invalid.超限, 10);
assert.equal(JSON.stringify(config), before, '预览和批量生成不得修改生效配置');
const reference = 生成主节点链接(config, uuid, 'test.example');
for (const [协议类型, 传输协议] of [['vless','ws'], ['trojan','grpc'], ['vless','xhttp'], ['ss','ws']]) {
  const link = 生成主节点链接(config, uuid, 'test.example', { 协议类型, 传输协议 });
  const report = 检查节点链接(link, reference);
  assert.equal(report.valid, true, `${协议类型}/${传输协议} 参数应通过`);
  assert.equal(report.reachability, 'unverified', '参数正确不代表连通');
  assert.ok(!JSON.stringify(report).includes(uuid), '诊断报告不得展示认证凭据');
}
assert.equal(检查节点链接('https://test.example').valid, false);
for (const host of ['bad%20host', '999.999.999.999', 'bad_host']) {
  assert.equal(检查节点链接(reference.replace('@test.example:', '@' + host + ':')).valid, false, '不能把非法入口判为通过');
}
assert.equal(检查节点链接('vless://@test.example:443?type=ws').valid, false);
assert.equal(检查节点链接(reference.replace(uuid, 'not-a-uuid')).valid, false, 'VLESS 认证需为 UUID');
assert.equal(检查节点链接(reference.replace('sni=test.example', 'sni=%3Cimg%20src%3Dx%3E')).valid, false, '路由域名不能包含标记或空白');
assert.equal(检查节点链接(reference.replace('path=%2Fws', 'path=invalid')).valid, false, 'WS 路径应以 / 开头');
assert.equal(检查节点链接('ss://invalid@test.example:443').valid, false);
assert.equal(检查节点链接('x'.repeat(8193)).valid, false);
const foreign = 检查节点链接(reference.replace(uuid, '22222222-2222-4222-8222-222222222222'), reference);
assert.ok(foreign.checks.some(c => c.label === '实例认证' && c.status === 'warning'));
console.log('[test-links] IPv6 规范化/去重、ALPN、反代规则保护、资源上限与配置不变性通过');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/link-compat.json', import.meta.url), 'utf8'));
const originalRandom = Math.random;
const resetRandom = () => { let seed = 17; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); };
try {
  for (const c of fixture.cases) {
    const cfg = { ...fixture.base, ...c.patch };
    // 随机目录不属于稳定链接合同；其余字节仍保持历史兼容。
    const normalize = value => c.patch.随机路径 ? value.replace(/(path(?:=|%3D))(?:%2F[a-z0-9.-]+){1,3}(?=%2Fedge%3F)/g, '$1') : value;
    resetRandom();
    assert.equal(normalize(生成主节点链接(cfg, cfg.UUID, 'worker.example')), normalize(c.primary), c.name + ' 主节点输出兼容');
    resetRandom();
    assert.equal(normalize(生成节点链接文本(c.addresses || fixture.defaultAddresses, '', c.pool || [], cfg, cfg.协议类型, !!c.generator, !!c.loon, !!c.converter, cfg.UUID, c.ech, c.fragment)), normalize(c.subscription), c.name + ' 订阅输出兼容');
  }
} finally { Math.random = originalRandom; }
console.log('[test-links] 17 组历史链接兼容（2 组仅忽略随机目录前缀）');

try {
  for (const r of [0, 0.5, 0.999999]) {
    let calls = 0;
    Math.random = () => { calls++; return r; };
    const suffix = '/ws?ed=2560&x=a%2Cb';
    const path = 随机路径(suffix);
    assert.ok(path.endsWith(suffix), '保留完整路径和查询参数');
    const parts = path.slice(1, -suffix.length).split('/');
    assert.ok(parts.length >= 1 && parts.length <= 3);
    assert.equal(new Set(parts).size, parts.length, '抽样不得重复目录');
    assert.ok(calls <= 4, '每个节点最多四次随机抽样');
    assert.ok(!随机路径('/').endsWith('/'));
    assert.ok(!随机路径('/?ed=2560').includes('/?'));
  }
} finally { Math.random = originalRandom; }
