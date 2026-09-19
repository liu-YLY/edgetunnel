// 用量历史快照：按日 1 条/域名，30 天滚动，存储于 KV `usage:{host}`。
// 读-改-写无原子追加：极端并发下可能丢同日快照，面板场景可接受（有意为之，不上 D1/DO）。
const 历史键 = (host) => 'usage:' + host;

function 今日日期() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

async function 读取用量历史(env, host) {
  if (!env?.KV || !host) return [];
  try {
    const raw = await env.KV.get(历史键(host));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function 写入用量快照(env, host, usage) {
  if (!env?.KV || !host) return;
  const date = 今日日期();
  const total = usage?.total ?? 0;
  const max = usage?.max ?? 0;
  const workers = usage?.workers ?? 0;
  const pages = usage?.pages ?? 0;
  const rows = await 读取用量历史(env, host);
  const last = rows[rows.length - 1];
  if (last && last.date === date) {
    // 同日去重：仅更新时间与数值
    last.pages = pages; last.workers = workers; last.total = total; last.max = max; last.updatedAt = new Date().toISOString();
  } else {
    rows.push({ date, pages, workers, total, max, updatedAt: new Date().toISOString() });
    if (rows.length > 30) rows.splice(0, rows.length - 30);
  }
  await env.KV.put(历史键(host), JSON.stringify(rows));
}

export { 读取用量历史, 写入用量快照 };