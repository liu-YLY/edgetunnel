// 在 workerd 中执行生产构建；KV 及凭据均为本地临时测试值。
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const uuid = '11111111-1111-4111-8111-111111111111';
(async()=>{
 const sockets = new Set();
 const echo = net.createServer(s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));s.pipe(s);});
 await new Promise((resolve,reject)=>{echo.once('error',reject);echo.listen(0,'127.0.0.1',resolve);});
 let mf;
 try {
 mf = new Miniflare(convertV4MiniflareOptions({ cf:false, workers:[{ name:"test", modules:true,scriptPath:path.join(__dirname,'../_worker.js'), compatibilityDate:'2025-11-04',compatibilityFlags:['nodejs_als'],kvNamespaces:['KV'], bindings:{ADMIN:'runtime-test-password',KEY:'runtime-test-key',UUID:uuid,OFF_LOG:'true'} }] }));
  const call=(pathname,init={})=>mf.dispatchFetch('https://runtime.example'+pathname,{redirect:'manual',...init,headers:{'User-Agent':'runtime-test',...init.headers}});
  assert.equal((await call('/login')).status,200);
  assert.equal((await call('/admin')).status,302);
  const login=await call('/login',{method:'POST',body:'password=runtime-test-password'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(cookie.startsWith('auth='));
  const config=await call('/admin/config.json',{headers:{Cookie:cookie}});assert.equal(config.status,200);assert.equal((await config.json()).HOST,'runtime.example');
  assert.equal((await call('/admin/config',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
  assert.ok((await (await call('/admin',{headers:{Cookie:cookie}})).text()).includes('edgetunnel 管理面板'));
  const invalid=await call('/admin/config',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{"反代":null}'});assert.equal(invalid.status,400);
  const valid=await call('/admin/config',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{"PATH":"/runtime"}'});assert.equal(valid.status,200);
  const saved=await (await mf.getKVNamespace('KV')).get('cfg:runtime.example','json');assert.equal(saved.PATH,'/runtime');assert.ok(saved.配置版本);
  // VLESS -> Workers cloudflare:sockets -> 本地 TCP echo；真实 WS 分帧与双向数据。
  const response=await call('/',{headers:{Upgrade:'websocket'}}); assert.equal(response.status,101);
  const ws=response.webSocket;ws.accept();
  const port=echo.address().port;
  const frame=Uint8Array.from([0,...Buffer.from(uuid.replaceAll('-',''),'hex'),0,1,port>>8,port&255,1,127,0,0,1,...Buffer.from('runtime-echo')]);
  const data = await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('WebSocket echo timeout')),5000);
   ws.addEventListener('message',e=>{clearTimeout(timer);resolve(Buffer.from(e.data));},{once:true});
   ws.addEventListener('error',e=>{clearTimeout(timer);reject(e.error||new Error('WS error'));},{once:true});
   ws.send(frame.slice(0,10));ws.send(frame.slice(10));
  });
  assert.equal(data.subarray(2).toString(),'runtime-echo');ws.close(1000);
  // Trojan 同样经过真实 workerd socket，独立于 VLESS 解析。
  const trojanResponse=await call('/',{headers:{Upgrade:'websocket'}});const tws=trojanResponse.webSocket;tws.accept();
  const tframe=Buffer.concat([Buffer.from(require('node:crypto').createHash('sha224').update(uuid).digest('hex')+'\r\n'),Buffer.from([1,1,127,0,0,1,port>>8,port&255,13,10]),Buffer.from('trojan-echo')]);
  const tdata=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Trojan timeout')),5000);tws.addEventListener('message',e=>{clearTimeout(timer);resolve(Buffer.from(e.data));},{once:true});tws.send(tframe.slice(0,20));tws.send(tframe.slice(20));});
  assert.equal(tdata.toString(),'trojan-echo');tws.close(1000);
  // SS AES-128-GCM 使用独立 Node crypto 编码/解码，避免实现自证。
  const cryptoNode=require('node:crypto'),salt=Buffer.alloc(16,7),master=cryptoNode.createHash('md5').update(uuid).digest();
  const sessionKey=salt=>Buffer.from(cryptoNode.hkdfSync('sha1',master,salt,Buffer.from('ss-subkey'),16));
  const seal=(key,n,data)=>{const nonce=Buffer.alloc(12);nonce.writeUInt32LE(n);const cipher=cryptoNode.createCipheriv('aes-128-gcm',key,nonce);return Buffer.concat([cipher.update(data),cipher.final(),cipher.getAuthTag()]);};
  const open=(key,n,data)=>{const nonce=Buffer.alloc(12);nonce.writeUInt32LE(n);const cipher=cryptoNode.createDecipheriv('aes-128-gcm',key,nonce);cipher.setAuthTag(data.subarray(-16));return Buffer.concat([cipher.update(data.subarray(0,-16)),cipher.final()]);};
  const plain=Buffer.concat([Buffer.from([1,127,0,0,1,port>>8,port&255]),Buffer.from('ss-echo')]);const length=Buffer.alloc(2);length.writeUInt16BE(plain.length);
  const ssframe=Buffer.concat([salt,seal(sessionKey(salt),0,length),seal(sessionKey(salt),1,plain)]);
  const ssResponse=await call('/?enc=aes-128-gcm',{headers:{Upgrade:'websocket'}});const sws=ssResponse.webSocket;sws.accept();
  const ssdata=await new Promise((resolve,reject)=>{let chunks=Buffer.alloc(0);const timer=setTimeout(()=>reject(new Error('SS timeout')),5000);sws.addEventListener('message',e=>{chunks=Buffer.concat([chunks,Buffer.from(e.data)]);if(chunks.length>=34){const k=sessionKey(chunks.subarray(0,16));const n=open(k,0,chunks.subarray(16,34)).readUInt16BE();if(chunks.length>=34+n+16){clearTimeout(timer);resolve(open(k,1,chunks.subarray(34,34+n+16)));}}});sws.send(ssframe.slice(0,10));sws.send(ssframe.slice(10));});
  assert.equal(ssdata.toString(),'ss-echo');sws.close(1000);
  // P2 后端自检：/admin/api/self-check（quick 与 deep）与 /admin/api/tcp-check 参数校验。
  const sc = await call('/admin/api/self-check',{headers:{Cookie:cookie}});assert.equal(sc.status,200);
  const scBody = await sc.json();assert.ok(scBody && scBody.quick);
  for (const k of ['国内','国外','cf','ip']) assert.ok(k in scBody.quick,`self-check quick 缺 ${k}`);
  const scDeep = await call('/admin/api/self-check?deep=1',{headers:{Cookie:cookie}});assert.equal(scDeep.status,200);
  const scDeepBody = await scDeep.json();assert.ok(scDeepBody && scDeepBody.deep);
  for (const k of ['复用率','超时预算']) assert.ok(k in scDeepBody.deep,`self-check deep 缺 ${k}`);
  assert.ok('hits' in scDeepBody.deep['复用率'],'self-check deep 复用率 缺 hits');
  const tcBad = await call('/admin/api/tcp-check',{headers:{Cookie:cookie}});assert.equal(tcBad.status,400);
  const tcOk = await call('/admin/api/tcp-check?host=example.com&port=443',{headers:{Cookie:cookie}});assert.equal(tcOk.status,200);
  assert.ok('ok' in (await tcOk.json()),'tcp-check 缺 ok 字段');
  console.log('[PASS] workerd 登录/鉴权/配置校验/KV 写入/跨站拒绝/分帧 VLESS/Trojan/SS WebSocket→原生 TCP→回传');
 } finally { await mf?.dispose(); for(const s of sockets)s.destroy(); await new Promise(r=>echo.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
