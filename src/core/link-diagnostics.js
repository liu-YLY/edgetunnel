import { 规范入口地址 } from './link.js';
// 纯参数检查，可在浏览器运行。不会建立连接、读取配置或返回认证凭据。
function 检查节点链接(内容, 当前节点 = '') {
  const checks = [], fields = [];
  const add = (label, status, detail) => checks.push({ label, status, detail });
  const finish = () => ({ checks, fields, valid: !checks.some(c => c.status === 'error'), reachability: 'unverified' });
  if (typeof 内容 !== 'string' || !内容.trim() || 内容.length > 8192) {
    add('链接内容', 'error', '请粘贴一条不超过 8192 字符的节点链接'); return finish();
  }
  let u;
  try { u = new URL(内容.trim()); } catch (_) { add('链接格式', 'error', '无法解析链接，请检查协议前缀与入口地址'); return finish(); }
  const protocol = u.protocol.slice(0, -1);
  if (!['vless', 'trojan', 'ss'].includes(protocol)) {
    add('代理协议', 'error', '支持 VLESS、Trojan 和带 v2ray-plugin 的 Shadowsocks 链接'); return finish();
  }
  fields.push(['协议', protocol.toUpperCase()], ['入口', u.hostname + (u.port ? ':' + u.port : '')]);
  let credential = '', transport, domain, path, tls;
  try {
    if (protocol === 'ss') {
      const decoded = atob(decodeURIComponent(u.username).replace(/-/g, '+').replace(/_/g, '/'));
      const separator = decoded.indexOf(':');
      credential = separator < 0 ? '' : decoded.slice(separator + 1);
      const method = separator < 0 ? '' : decoded.slice(0, separator);
      if (!['aes-128-gcm', 'aes-256-gcm'].includes(method)) add('加密方式', 'error', '当前实例仅支持 aes-128-gcm 和 aes-256-gcm');
      const plugin = (u.searchParams.get('plugin') || '').split(/(?<!\\);/);
      const values = Object.fromEntries(plugin.slice(1).map(s => { const i = s.indexOf('='); return i < 0 ? [s, true] : [s.slice(0, i), s.slice(i + 1)]; }));
      if (plugin[0] !== 'v2ray-plugin' || values.mode !== 'websocket') add('传输方式', 'error', '当前 SS 节点需要 v2ray-plugin 的 WebSocket 模式');
      transport = 'ws'; domain = values.host; path = values.path; tls = values.tls === true;
    } else {
      credential = decodeURIComponent(u.username);
      transport = u.searchParams.get('type');
      domain = u.searchParams.get(transport === 'grpc' ? 'authority' : 'host');
      path = u.searchParams.get(transport === 'grpc' ? 'serviceName' : 'path');
      tls = u.searchParams.get('security') === 'tls';
      if (!['ws', 'grpc', 'xhttp'].includes(transport)) add('传输方式', 'error', '当前实例支持 WebSocket、gRPC 和 XHTTP');
    }
  } catch (_) { add('认证与插件参数', 'error', '认证编码或插件参数无法解析'); return finish(); }
  const validCredential = !!credential && (protocol !== 'vless' || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(credential));
  add('认证字段', validCredential ? 'ok' : 'error', validCredential ? '已包含认证信息（不在报告中展示）' : '缺少有效认证信息，VLESS 需要标准 UUID');
  const port = Number(u.port);
  let validEndpoint = false;
  try { 规范入口地址(u.hostname); validEndpoint = !!u.port && Number.isInteger(port) && port >= 1 && port <= 65535; } catch (_) { /* 自定义 URL scheme 本身不会严格校验 hostname */ }
  add('入口地址', validEndpoint ? 'ok' : 'error', validEndpoint ? '入口地址与端口格式有效' : '需要有效的入口地址和 1–65535 端口');
  const validPath = typeof path === 'string' && path.length > 0 && !/[\x00-\x1f\x7f]/.test(path) && (transport === 'grpc' || path.startsWith('/'));
  add('传输路径', validPath ? 'ok' : 'error', validPath ? '已提供路径或服务名称' : '检查 path 或 serviceName；WS/XHTTP 路径需以 / 开头');
  const sni = protocol === 'ss' ? domain : u.searchParams.get('sni');
  const validHost = value => {
    if (typeof value !== 'string' || value.length > 260 || /[\s/@?#\\]/.test(value)) return false;
    try {
      const hostname = new URL('https://' + value).hostname;
      return hostname.startsWith('[') || hostname.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part));
    } catch (_) { return false; }
  };
  if ((domain && !validHost(domain)) || (sni && (!validHost(sni) || (!sni.startsWith('[') && sni.includes(':'))))) add('路由域名格式', 'error', 'Host / Authority / SNI 包含无效字符，请核对域名');
  add('域名与 TLS', tls && domain && sni ? 'ok' : 'warning', tls ? (domain && sni ? '已提供 TLS 路由域名' : '域名字段不完整，请核对 Host / SNI') : '未启用 TLS，请确认部署入口允许明文连接');
  fields.push(['传输', transport || '未指定'], ['TLS', tls ? '开启' : '关闭'], ['Host / Authority', domain || '未指定'], ['SNI', sni || '未指定'], ['路径 / 服务', path || '未指定'], ['ALPN', u.searchParams.get('alpn') || '客户端默认']);
  if (当前节点) {
    try {
      const reference = new URL(当前节点);
      let expected = decodeURIComponent(reference.username);
      if (reference.protocol === 'ss:') { const decoded = atob(expected.replace(/-/g, '+').replace(/_/g, '/')); expected = decoded.slice(decoded.indexOf(':') + 1); }
      add('实例认证', credential === expected ? 'ok' : 'warning', credential === expected ? '与当前实例认证一致' : '认证信息与当前实例不同，请确认链接所属实例');
      const expectedDomain = reference.searchParams.get('sni') || (reference.searchParams.get('plugin') || '').match(/(?:^|;)host=([^;]+)/)?.[1];
      if (expectedDomain && sni !== expectedDomain) add('实例域名', 'warning', 'SNI 与当前主节点不同，请确认该域名已绑定到实例');
    } catch (_) { add('实例比对', 'warning', '当前主节点无法解析，仅完成链接自身检查'); }
  }
  return finish();
}

export { 检查节点链接 };
