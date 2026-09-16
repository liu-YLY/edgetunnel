import { 输入错误 } from '../core/errors.js';
// 显式 ?native=1：最小 Clash/Mihomo 或 sing-box 配置，无远程规则、无转换器。
// 保留默认转换链，避免默默丢弃已有 SUBCONFIG 的分流语义。
function 生成原生订阅(target, links, config) {
 if (!['clash','singbox'].includes(target)) throw 输入错误('原生订阅当前支持 clash、singbox');
 if (config.ECH || config.TLS分片) throw 输入错误('原生订阅暂不支持 ECH/TLS 分片，请使用现有转换链');
 const lines = links.split('\n').filter(Boolean);
 if (!lines.length || lines.length > 100) throw 输入错误('原生订阅节点数必须为 1–100');
 const nodes = lines.map((line, i) => {
  const u = new URL(line), type = u.protocol.slice(0,-1), q = u.searchParams;
  if (!['vless','trojan'].includes(type) || !['ws','grpc'].includes(q.get('type'))) throw 输入错误('原生订阅支持 VLESS/Trojan 的 WS/gRPC 传输');
  if (q.has('flow') || q.get('security') !== 'tls' || (q.get('encryption') && q.get('encryption') !== 'none')) throw 输入错误('原生订阅不支持该节点的加密选项');
  const host = q.get('sni') === 'example.com' ? config.HOST : q.get('sni');
  const authority = q.get('host') === 'example.com' || q.get('authority') === 'example.com' ? config.HOST : (q.get('host') || q.get('authority') || host);
  const password = u.username === '00000000-0000-4000-8000-000000000000' ? config.UUID : decodeURIComponent(u.username);
  return { type, server:u.hostname.replace(/^\[|\]$/g,''), port:Number(u.port)||443, name:(decodeURIComponent(u.hash.slice(1)) || 'node')+'-'+(i+1), host, authority, password, network:q.get('type'), path:q.get('path') || '/', service:q.get('serviceName') || '' };
 });
 if (target === 'clash') {
  const proxies=nodes.map(n=>({name:n.name,type:n.type,server:n.server,port:n.port,[n.type==='vless'?'uuid':'password']:n.password,tls:true,servername:n.host,'skip-cert-verify':Boolean(config.跳过证书验证),network:n.network,...(n.network==='ws'?{'ws-opts':{path:n.path,headers:{Host:n.authority}}}:{'grpc-opts':{'grpc-service-name':n.service}})}));
  // JSON 是 YAML 1.2 子集，省去手写 YAML 转义与额外运行时依赖。
  return JSON.stringify({'mixed-port':7890,'allow-lan':false,mode:'rule',proxies,'proxy-groups':[{name:'PROXY',type:'select',proxies:nodes.map(n=>n.name)}],rules:['MATCH,PROXY']},null,2);
 }
 const outbounds=nodes.map(n=>({type:n.type,tag:n.name,server:n.server,server_port:n.port,[n.type==='vless'?'uuid':'password']:n.password,tls:{enabled:true,server_name:n.host,insecure:Boolean(config.跳过证书验证)},transport:n.network==='ws'?{type:'ws',path:n.path,headers:{Host:n.authority}}:{type:'grpc',service_name:n.service},...(n.type==='vless'?{packet_encoding:''}:{})}));
 return JSON.stringify({inbounds:[{type:'mixed',tag:'mixed-in',listen:'127.0.0.1',listen_port:7890}],outbounds:[{type:'selector',tag:'PROXY',outbounds:nodes.map(n=>n.name)},...outbounds],route:{final:'PROXY'}},null,2);
}

export { 生成原生订阅 };
