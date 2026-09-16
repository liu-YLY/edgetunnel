import { 输入错误 } from '../core/errors.js';
function 验证配置(value, reference = null, path = '', depth = 0) {
 if (depth > 12) throw 输入错误('配置嵌套过深');
 if (!path && (!value || typeof value !== 'object' || Array.isArray(value))) throw 输入错误('配置必须是对象');
 if (typeof value === 'string' && value.length > 8192) throw 输入错误('配置字符串过长');
 if (Array.isArray(value) && value.length > 512) throw 输入错误('配置数组过长');
 if (value && typeof value === 'object') {
  for (const [key, item] of Object.entries(value)) {
   if (['__proto__', 'constructor', 'prototype'].includes(key)) throw 输入错误('禁止的配置字段');
   const next = path ? path + '.' + key : key;
   const expected = reference?.[key];
   if (expected !== undefined && expected !== null) {
    if (Array.isArray(expected) ? !Array.isArray(item) : typeof item !== typeof expected || (typeof expected === 'object' && (!item || Array.isArray(item)))) throw 输入错误('配置类型错误: ' + next);
   }
   验证配置(item, expected, next, depth + 1);
  }
 }
 const enums = { 协议类型: ['vless','trojan','ss'], 传输协议: ['ws','grpc','xhttp'], gRPC模式: ['gun','multi'], 'SS.加密方式': ['aes-128-gcm','aes-256-gcm'] };
 if (enums[path] && !enums[path].includes(value)) throw 输入错误('配置枚举错误: ' + path);
 if (path === '优选订阅生成.本地IP库.随机数量' && (!Number.isInteger(value) || value < 1 || value > 100)) throw 输入错误('节点数量必须为 1–100');
 if (path === '优选订阅生成.SUBUpdateTime' && (!Number.isFinite(value) || value < 1 || value > 168)) throw 输入错误('订阅间隔必须为 1–168 小时');
 if (path === '优选订阅生成.本地IP库.指定端口' && (!Number.isInteger(value) || (value !== -1 && (value < 1 || value > 65535)))) throw 输入错误('端口无效');
 if (path === 'HOSTS' && (!Array.isArray(value) || !value.length || value.some(x => typeof x !== 'string' || /[\s/@?#]/.test(x)))) throw 输入错误('HOSTS 无效');
 if (path === 'PATH' && (typeof value !== 'string' || !value.startsWith('/'))) throw 输入错误('PATH 必须以 / 开头');
 return value;
}

export { 验证配置 };
