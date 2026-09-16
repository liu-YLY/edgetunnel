import { 拼接字节数据 } from './core/bytes.js';
import { 输入错误 } from './core/errors.js';
// 管理端输入、会话和日志边界。会话过期由服务端验证，不依赖浏览器 Cookie 到期。
const 会话有效毫秒 = 24 * 60 * 60 * 1000;
const 登录窗口 = new Map();

async function 限长文本(request, max = 64 * 1024) {
 if (Number(request.headers.get('content-length')) > max) throw 输入错误('请求体过大', 413);
 if (!request.body) return '';
 const reader = request.body.getReader(), chunks = []; let size = 0;
 try {
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
   if (size > max) { await reader.cancel(); throw 输入错误('请求体过大', 413); } chunks.push(value); }
 } finally { reader.releaseLock(); }
 return new TextDecoder().decode(拼接字节数据(...chunks));
}
async function 读取管理JSON(request) {
 try { return JSON.parse(await 限长文本(request)); }
 catch (error) { if (error.status) throw error; throw 输入错误('无效 JSON'); }
}


function 同源写请求(request) {
 const origin = request.headers.get('Origin');
 return (!origin || origin === new URL(request.url).origin) && request.headers.get('Sec-Fetch-Site') !== 'cross-site';
}
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function 解码base64url(value) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)); }
async function 会话密钥(password, key) {
 return crypto.subtle.importKey('raw', new TextEncoder().encode(JSON.stringify([password,key])), { name:'HMAC', hash:'SHA-256' }, false, ['sign','verify']);
}
async function 签发会话(password, key, ua, host, now = Date.now()) {
 const body = base64url(new TextEncoder().encode(JSON.stringify({ exp: now + 会话有效毫秒, iat: now, ua, host, nonce: crypto.randomUUID() })));
 const signature = await crypto.subtle.sign('HMAC', await 会话密钥(password,key), new TextEncoder().encode(body));
 return body + '.' + base64url(new Uint8Array(signature));
}
async function 验证会话(token, password, key, ua, host, now = Date.now()) {
 try {
  if (!token || token.length > 8192) return false;
  const parts = token.split('.'); if (parts.length !== 2) return false;
  if (!await crypto.subtle.verify('HMAC', await 会话密钥(password,key), 解码base64url(parts[1]), new TextEncoder().encode(parts[0]))) return false;
  const data = JSON.parse(new TextDecoder().decode(解码base64url(parts[0])));
  return data.host === host && data.ua === ua && Number.isFinite(data.exp) && Number.isFinite(data.iat) && data.iat <= now && data.exp > now && data.exp - data.iat === 会话有效毫秒;
 } catch { return false; }
}
async function 允许登录(env, request, now = Date.now()) {
 const key = new URL(request.url).hostname + ':' + (request.headers.get('CF-Connecting-IP') || 'unknown');
 if (env.LOGIN_RATE_LIMITER) return (await env.LOGIN_RATE_LIMITER.limit({ key })).success;
 // 未绑定限流器时的有界本地保护，仅对当前 isolate 生效。
 let entry = 登录窗口.get(key);
 if (!entry || entry.until <= now) { if (登录窗口.size >= 1000) 登录窗口.delete(登录窗口.keys().next().value); entry = { count:0, until:now + 60000 }; 登录窗口.set(key, entry); }
 return ++entry.count <= 5;
}
function 安全日志URL(url) { const u = new URL(url); return u.origin + (['/sub','/admin','/login'].some(p => u.pathname === p || u.pathname.startsWith(p + '/')) ? u.pathname : '/[redacted]'); }

export { 允许登录, 同源写请求, 安全日志URL, 签发会话, 读取管理JSON, 限长文本, 验证会话 };
