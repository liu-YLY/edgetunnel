import { 读取用量历史, 写入用量快照 } from '../src/services/usage-history.js';
import assert from 'node:assert/strict';

// 内存 KV mock（真实 KV 语义：get 返回 null 或字符串）
function 构造KV() {
  const map = new Map();
  return {
    KV: {
      async get(key) { return map.has(key) ? map.get(key) : null; },
      async put(key, val) { map.set(key, val); },
      async _raw(key) { return map.get(key); },
      _map: map,
    },
  };
}

;(async () => {
  // 1) 空历史
  let env = 构造KV();
  assert.deepEqual(await 读取用量历史(env, 'edt2.example.org'), [], '无历史时应返回空数组');

  // 2) 写入一条
  await 写入用量快照(env, 'edt2.example.org', { success: true, pages: 10, workers: 300, total: 310, max: 100000 });
  let rows = await 读取用量历史(env, 'edt2.example.org');
  assert.equal(rows.length, 1, '首次写入应产生 1 条');
  assert.equal(rows[0].total, 310, 'total 正确');
  assert.equal(rows[0].max, 100000, 'max 正确');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(rows[0].date), `date 为 YYYY-MM-DD 格式：${rows[0].date}`);
  assert.ok(rows[0].updatedAt, '应有 updatedAt');

  // 3) 同日去重：再写一次（仍是今天）只更新时间不新增条数
  await 写入用量快照(env, 'edt2.example.org', { success: true, pages: 12, workers: 400, total: 412, max: 100000 });
  rows = await 读取用量历史(env, 'edt2.example.org');
  assert.equal(rows.length, 1, '同日再次写入应去重为 1 条');
  assert.equal(rows[0].total, 412, '同日覆盖应更新 total');

  // 4) 跨日追加：注入昨天日期的一条后，再写入今天 → 2 条
  const 昨天 = new Date(Date.now() - 86400000);
  const 昨天串 = 昨天.getUTCFullYear() + '-' + String(昨天.getUTCMonth() + 1).padStart(2, '0') + '-' + String(昨天.getUTCDate()).padStart(2, '0');
  env.KV._map.set('usage:edt2.example.org', JSON.stringify([{ date: 昨天串, total: 100, max: 100000, pages: 0, workers: 100, updatedAt: 'x' }]));
  await 写入用量快照(env, 'edt2.example.org', { success: true, total: 500, max: 100000 });
  rows = await 读取用量历史(env, 'edt2.example.org');
  assert.equal(rows.length, 2, '昨日+今日应为 2 条');
  assert.equal(rows[0].date, 昨天串, '历史顺序保持（旧在前）');
  assert.equal(rows[1].total, 500, '今日为最新');

  // 5) 30 天滚动：预置 30 条旧记录后写入，长度保持 30 且最旧被淘汰
  const 旧30 = Array.from({ length: 30 }, (_, i) => ({ date: '1990-01-' + String(i + 1).padStart(2, '0'), total: i, max: 100000 }));
  env.KV._map.set('usage:edt2.example.org', JSON.stringify(旧30));
  await 写入用量快照(env, 'edt2.example.org', { success: true, total: 999, max: 100000 });
  rows = await 读取用量历史(env, 'edt2.example.org');
  assert.equal(rows.length, 30, '滚动后仍为 30 条');
  assert.equal(rows[0].date, '1990-01-02', '最旧一条已被淘汰');
  assert.equal(rows[29].total, 999, '最新一条为本次写入');

  // 6) 无 KV 环境安全：不抛异常
  await 写入用量快照({}, 'edt2.example.org', { total: 1 });
  assert.deepEqual(await 读取用量历史({}, 'edt2.example.org'), [], '无 KV 时读取返回空');

  // 7) KV 值损坏时容错
  env.KV._map.set('usage:edt2.example.org', '{broken');
  assert.deepEqual(await 读取用量历史(env, 'edt2.example.org'), [], '损坏 JSON 返回空');
  await 写入用量快照(env, 'edt2.example.org', { total: 7, max: 100000 });
  rows = await 读取用量历史(env, 'edt2.example.org');
  assert.equal(rows.length, 1, '损坏后首次写入重建 1 条');
  assert.equal(rows[0].total, 7, '重建条目值正确');

  console.log('[test-usage-history] 读取/写入/去重/滚动/容错断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-usage-history] FAIL:', e); process.exit(1); });