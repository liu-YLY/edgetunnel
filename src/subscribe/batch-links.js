import { 生成主节点链接, 校验链接预览选项 } from '../core/link.js';

// 只处理普通地址候选。外部订阅 URI、优选 API 和路径代理指令需要原订阅流水线解析，
// 不在批量预览中静默转换成可能失效的普通节点。
function 生成批量节点链接(候选列表, 配置, 用户ID, host, 原始选项, 来源, 反代IP池 = []) {
  const 公共选项 = 校验链接预览选项(原始选项, 配置, host);
  const 节点 = [], 已见 = new Set();
  let 跳过 = 0, 重复 = 0, 超限 = 0;
  const 待处理 = 候选列表.slice(0, 500);
  超限 = Math.max(0, 候选列表.length - 待处理.length);
  for (const 原始行 of 待处理) {
    const 行 = String(原始行).trim();
    if (!行) continue;
    if (节点.length >= 100) { 超限++; continue; }
    if (行.includes('://') || /\$|\bsub\s*=|\bproxyip\s*=|\*/i.test(行)) { 跳过++; continue; }
    const 分隔 = 行.indexOf('#');
    const 地址端口 = (分隔 < 0 ? 行 : 行.slice(0, 分隔)).trim();
    const 备注 = 分隔 < 0 ? 公共选项.备注 : 行.slice(分隔 + 1).trim();
    const 匹配 = 地址端口.match(/^(\[[0-9a-fA-F:]+\]|[^:\s#]+)(?::(\d+))?$/);
    if (!匹配) { 跳过++; continue; }
    // 与订阅生成器的逐节点反代匹配保持相同边界；不把特殊出口节点变成普通直连节点。
    if (反代IP池.some(p => p.includes(匹配[1]))) { 跳过++; continue; }
    try {
      const 选项 = 校验链接预览选项({ ...公共选项, 地址: 匹配[1], 端口: 匹配[2] ?? 公共选项.端口, 备注 }, 配置, host);
      const 键 = 选项.地址.toLowerCase() + ':' + 选项.端口;
      if (已见.has(键)) { 重复++; continue; }
      已见.add(键);
      节点.push({ 地址: 选项.地址, 端口: 选项.端口, 备注: 选项.备注, 来源, 链接: 生成主节点链接(配置, 用户ID, host, 选项) });
    } catch (_) { 跳过++; }
  }
  return { 来源, 节点, 跳过, 重复, 超限 };
}

export { 生成批量节点链接 };
