import { 失效配置缓存 } from './cache.js';
import { 验证配置 } from './validation.js';
async function 保存配置(env, key, value, reference) {
 验证配置(value, reference);
 const previous = await env.KV.get(key);
 if (previous !== null) await env.KV.put(key + ':previous', previous);
 const saved = { ...value, 配置版本: crypto.randomUUID(), 更新时间: new Date().toISOString() };
 await env.KV.put(key, JSON.stringify(saved));
 失效配置缓存();
 return saved;
}

export { 保存配置 };
