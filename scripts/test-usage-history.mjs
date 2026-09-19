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
  let 结果 = await 记录用量快照({ KV: kv }, 'a.example.com', usage);
  assert.ok(Array.isArray(结果) && 结果.length === 1, '首次快照为一条');
  assert.strictEqual(结果[0].date, 日期字符串(), '日期为今日');
  assert.strictEqual(结果[0].total, 101, 'total 记录正确');

  // 2) 同日重复写入：当日覆盖更新，不新增条目
  结果 = await 记录用量快照({ KV: kv }, 'a.example.com', { ...usage, total: 202 }, new Date('2026-09-19T03:00:00Z'));
  assert.strictEqual(结果.length, 1, '同日快照去重：仍一条');
  assert.strictEqual(结果[0].total, 202, '同日更新为最新值');

  // 3) 手动日期快照：两个不同日期按升序
  结果 = await 记录用量快照({ KV: kv }, 'a.example.com', usage, new Date('2026-09-18T03:00:00Z'));
  assert.strictEqual(结果.length, 2, '新增一天共两条');
  assert.strictEqual(结果[0].date, '2026-09-18', '老日期在前');
  assert.strictEqual(结果[1].date, '2026-09-19', '新日期在后');

  // 4) 30 天滚动裁剪：写入 35 天，只留最近 30 条
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2026, 8, 1 + i)); // 2026-09-01 起逐日
    await 记录用量快照({ KV: kv }, 'a.example.com', usage, d);
  }
  结果 = await 读取用量历史({ KV: kv }, 'a.example.com');
  assert.ok(结果.length <= 30, '超过 30 天被裁剪');
  assert.strictEqual(结果[结果.length - 1].date, 日期字符串(new Date(Date.UTC(2026, 9, 10))), '最新一天仍在');
  assert.ok(结果.every((r, i) => i === 0 || 结果[i - 1].date <= r.date), '按日期升序');

  // 5) 不同 host 互不影响
  assert.strictEqual((await 读取用量历史({ KV: kv }, 'b.example.com')).length, 0, 'b 域无数据');

  // 6) 非成功结果不写快照
  await 记录用量快照({ KV: kv }, 'a.example.com', { success: false, total: 99 }, new Date('2026-09-19T05:00:00Z'));
  assert.strictEqual((await 读取用量历史({ KV: kv }, 'a.example.com')).length, 30, '失败结果不新增快照');

  // 7) KV 中脏数据返回空数组而不是崩溃
  kvStore.set('usage:bad.example.com', '{not json');
  assert.deepStrictEqual(await 读取用量历史({ KV: kv }, 'bad.example.com'), [], '脏数据返回空数组');
  kvStore.set('usage:obj.example.com', '{"a":1}');
  assert.deepStrictEqual(await 读取用量历史({ KV: kv }, 'obj.example.com'), [], '非数组 JSON 返回空数组');

  console.log('[test-ui] usage-history 全部断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });