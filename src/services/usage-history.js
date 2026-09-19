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