import { 生成原生订阅 } from '../src/subscribe/format-native.js';
import { 有限代理握手, 创建请求TCP连接器, httpConnect } from '../src/transport/dial.js';
import { 失效配置缓存, config缓存映射 } from '../src/config/cache.js';
import { 读取config_JSON, 全局读取配置 } from '../src/config/index.js';
import { 请求存储, 当前请求配置 } from '../src/core/context.js';
import { 验证配置 } from '../src/config/validation.js';
import { 保存配置 } from '../src/config/store.js';
import { 签发会话, 验证会话, 限长文本, 允许登录, 安全日志URL } from '../src/security.js';
import { 解析魏烈思请求, 获取UUID字节 } from '../src/protocol/vless.js';
import { 解析木马请求 } from '../src/protocol/trojan.js';
import { sha224 } from '../src/core/crypto.js';
import { SSAEAD加密, SSAEAD解密 } from '../src/protocol/ss.js';
import { forwardataTCP } from '../src/transport/forward.js';
import { 请求日志记录 } from '../src/admin/panel.js';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import { setSocketConnector } from './fixtures/sockets.mjs';
const api = { 生成原生订阅, 有限代理握手, 失效配置缓存, 读取config_JSON, config缓存映射, 全局读取配置, 请求存储, 当前请求配置, 创建请求TCP连接器, httpConnect, 验证配置, 保存配置, 签发会话, 验证会话, 限长文本, 允许登录, 安全日志URL, 解析魏烈思请求, 获取UUID字节, 解析木马请求, sha224, SSAEAD加密, SSAEAD解密, forwardataTCP, 请求日志记录 };
const realDigest = crypto.subtle.digest.bind(crypto.subtle);
crypto.subtle.digest = (algo, bytes) => (typeof algo === 'string' ? algo : algo.name).toUpperCase() === 'MD5' ? Promise.resolve(nodeCrypto.createHash('md5').update(new Uint8Array(bytes)).digest()) : realDigest(algo, bytes);
const uuid = '11111111-1111-4111-8111-111111111111';
const encoder = new TextEncoder();
const tests = [];
function test(name, body) { tests.push([name, body]); }
function kv() { const data = new Map(); return { data, get:async k => data.get(k) ?? null, put:async (k,v) => data.set(k,v) }; }
function socket(chunks = []) { let closed = false; return { opened:Promise.resolve(), closed:Promise.resolve(), writable:new WritableStream({ write(){} }), readable:new ReadableStream({ start(c){ for(const x of chunks)c.enqueue(x); c.close(); } }), close:async()=>{closed=true;}, get wasClosed(){return closed;} }; }
function deadline(p, ms = 1000) { let timer; return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('test timeout')),ms);})]).finally(()=>clearTimeout(timer)); }
test('两个 host 在 KV await 交错后仍各自返回和缓存独立配置', async()=>{
 let release, reached; const gate=new Promise(r=>release=r), paused=new Promise(r=>reached=r);
 const a=kv(), b=kv(); const get=a.get; a.get=async k=>{if(k==='cfg:a.example'){reached();await gate;}return get(k);};
 const pa=api.读取config_JSON({KV:a},'a.example',uuid,'ua'); await paused;
 const cb=await api.读取config_JSON({KV:b},'b.example',uuid,'ua'); release(); const ca=await pa;
 assert.equal(ca.HOST,'a.example'); assert.equal(cb.HOST,'b.example'); assert.notEqual(ca,cb);
 ca.PATH='/mutated'; const again=await api.读取config_JSON({KV:a},'a.example',uuid,'ua'); assert.notEqual(again.PATH,'/mutated');
});
test('异步上下文隔离、拨号数有限、标准 socket 注入接口', async()=>{
 const req=new Request('https://example.com'); const a=await api.全局读取配置({ADMIN:'x',DEBUG:'true',TCP_CONCURRENT_DIAL:'99'},req,new URL(req.url));
 const b=await api.全局读取配置({ADMIN:'x'},req,new URL(req.url)); assert.equal(a.运行配置.TCP并发拨号数,3);
 await Promise.all([a,b].map(c=>api.请求存储.run(c.运行配置,async()=>{await Promise.resolve();assert.equal(api.当前请求配置(),c.运行配置);}))); assert.equal(b.运行配置.调试日志打印,false);
 const expected=socket(); assert.equal(api.创建请求TCP连接器(req,()=>expected)({hostname:'example.com',port:443}),expected);
});
test('会话拒绝过期、篡改、不同 host/UA、旧摘要；限流边界',async()=>{
 const token=await api.签发会话('password','key','ua','a.example',1000);
 assert.equal(await api.验证会话(token,'password','key','ua','a.example',1001),true);
 for(const [t,u,h,n] of [[token,'ua','a.example',86401000],[token+'x','ua','a.example',1001],[token,'ua','b.example',1001],[token,'other','a.example',1001],['old-md5','ua','a.example',1001]]) assert.equal(await api.验证会话(t,'password','key',u,h,n),false);
 const req=new Request('https://rate.example/login'); for(let i=0;i<5;i++)assert.equal(await api.允许登录({},req,1000),true); assert.equal(await api.允许登录({},req,1000),false); assert.equal(await api.允许登录({},req,61000),true);
});
test('配置校验、请求体上限、上一版本保存、敏感 URL 脱敏',async()=>{
 assert.throws(()=>api.验证配置({反代:null},{反代:{}})); assert.throws(()=>api.验证配置({协议类型:'oops'}));
 assert.throws(()=>api.验证配置(JSON.parse('{"__proto__":{"polluted":true}}')));
 const store=kv(); await store.put('cfg:x','{"PATH":"/old"}'); await api.保存配置({KV:store},'cfg:x',{PATH:'/new'},{PATH:'/'});assert.equal(await store.get('cfg:x:previous'),'{"PATH":"/old"}');
 await assert.rejects(api.限长文本(new Request('https://x',{method:'POST',body:'12345'}),4),e=>e.status===413);
 assert.equal(api.安全日志URL('https://x/sub?token=secret'),'https://x/sub'); assert.equal(api.安全日志URL('https://x/secret-key'),'https://x/[redacted]');
});
test('HTTP CONNECT 分片响应和紧跟头部的首包不丢失、不死锁；HTTPS 开启原生 TLS',async()=>{
 let options; const conn=socket([encoder.encode('HTTP/1.1 200 OK\r\n'),encoder.encode('\r\nhello'),encoder.encode('world')]);
 const out=await deadline(api.httpConnect('target.example',443,new Uint8Array(),true,(_,init)=>{options=init;return conn;},{hostname:'proxy.example',port:443}));
 assert.equal(options.secureTransport,'on');assert.equal(await new Response(out.readable).text(),'helloworld');
 const bad=socket([encoder.encode('HTTP/1.1 407 Nope\r\n\r\n')]);await assert.rejects(api.httpConnect('x',443,null,false,()=>bad,{})); assert.equal(bad.wasClosed,true);
});
test('auto 失败不拨 Cloudflare 候选；成功竞速会关闭败者',async()=>{
 globalThis.WebSocket={OPEN:1}; let addresses=[];
 setSocketConnector(({hostname})=>{addresses.push(hostname); const s=socket();s.opened=Promise.reject(new Error('refused'));return s;});
 await assert.rejects(api.forwardataTCP('target.example',443,new Uint8Array(),{readyState:1,close(){}},null,{},uuid,new Request('https://x'),{出站模式:'auto'},false,null,true));
 assert.ok(addresses.length<=3);assert.ok(addresses.every(x=>x==='target.example'));
 const sockets=[];setSocketConnector(()=>{const s=socket();sockets.push(s);return s;});
 const winner=await api.forwardataTCP('target.example',443,new Uint8Array(),{readyState:1,close(){}},null,{},uuid,new Request('https://x'),{},false,null,true); await Promise.resolve();
 assert.ok(sockets.filter(s=>s!==winner).every(s=>s.wasClosed));await winner.close();
});
test('VLESS/Trojan 字节帧、截断、错误认证和 SS AEAD 防篡改',async()=>{
 const header=Uint8Array.from([0,...api.获取UUID字节(uuid),0,1,1,187,1,1,2,3,4]);const frame=Uint8Array.from([...header,42]);
 const parsed=api.解析魏烈思请求(frame,uuid);assert.equal(parsed.hostname,'1.2.3.4');assert.equal(parsed.port,443);assert.deepEqual([...parsed.rawClientData],[42]);
 for(let i=0;i<header.length;i++)assert.equal(api.解析魏烈思请求(header.slice(0,i),uuid).hasError,true);
 assert.equal(api.解析魏烈思请求(frame,'22222222-2222-4222-8222-222222222222').hasError,true);
 const trojan=Uint8Array.from([...encoder.encode(api.sha224('pw')+'\r\n'),1,1,1,2,3,4,1,187,13,10,42]);
 assert.equal(api.解析木马请求(trojan,'pw').hostname,'1.2.3.4'); const badTrojan=trojan.slice();badTrojan[67]=0;assert.equal(api.解析木马请求(badTrojan,'pw').hasError,true); assert.equal(api.解析木马请求(trojan,'wrong').hasError,true);
 const key=await crypto.subtle.importKey('raw',new Uint8Array(16),'AES-GCM',false,['encrypt','decrypt']);
 const encrypted=await api.SSAEAD加密(key,new Uint8Array(12),encoder.encode('payload'));assert.equal(new TextDecoder().decode(await api.SSAEAD解密(key,new Uint8Array(12),encrypted)),'payload');encrypted[0]^=1;await assert.rejects(api.SSAEAD解密(key,new Uint8Array(12),encrypted));
});
test('原生订阅生成及不支持配置明确拒绝',async()=>{
 const config={HOST:'my.example',UUID:uuid,跳过证书验证:false};
 const links='vless://00000000-0000-4000-8000-000000000000@1.2.3.4:443?security=tls&type=ws&host=example.com&sni=example.com&path=%2Fabc#test';
 const clash=JSON.parse(api.生成原生订阅('clash',links,config));assert.equal(clash.proxies[0].uuid,uuid);assert.equal(clash.proxies[0]['ws-opts'].headers.Host,'my.example');
 const sb=JSON.parse(api.生成原生订阅('singbox',links,config));assert.equal(sb.outbounds[1].tls.server_name,'my.example');assert.equal(sb.outbounds[1].transport.path,'/abc');
 assert.throws(()=>api.生成原生订阅('surge',links,config));assert.throws(()=>api.生成原生订阅('clash',links,{...config,ECH:true}));
});
test('慢代理超时关闭连接；用量查询不阻塞配置；旧加载不回填失效缓存',async()=>{
 const s=socket();await assert.rejects(api.有限代理握手(c=>{c({});return new Promise(()=>{});},()=>s,5));assert.equal(s.wasClosed,true);
 const store=kv();await store.put('cf.json',JSON.stringify({UsageAPI:'https://usage.invalid'}));
 const oldFetch=globalThis.fetch;let resolveFetch, task;globalThis.fetch=()=>new Promise(r=>resolveFetch=r);
 try {
  const config=await deadline(api.请求存储.run({SOCKS5白名单:[],ctx:{waitUntil(p){task=p;}}},()=>api.读取config_JSON({KV:store},'usage.example',uuid,'test')));
  assert.equal(config.CF.Usage.success,false);assert.ok(resolveFetch);resolveFetch(Response.json({success:true,total:1}));await task;
 } finally {globalThis.fetch=oldFetch;}
 let release,reached;const gate=new Promise(r=>release=r),paused=new Promise(r=>reached=r);const get=store.get;
 store.get=async key=>{if(key==='cfg:stale.example'){reached();await gate;}return get(key);};
 const p=api.读取config_JSON({KV:store},'stale.example',uuid,'test');await paused;api.失效配置缓存();release();await p;
 assert.equal([...api.config缓存映射.keys()].some(k=>k.startsWith('stale.example|')),false);
});
(async()=>{for(const [name,body] of tests){await body();console.log('[PASS]',name);}console.log(`${tests.length} regression groups passed`);})().catch(e=>{console.error(e);process.exitCode=1;});
