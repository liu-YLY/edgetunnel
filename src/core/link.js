import { 获取传输协议配置, 获取传输路径参数值 } from './options.js';
import { 随机路径 } from './paths.js';
import { 输入错误 } from './errors.js';

function 规范入口地址(input) {
  let 地址 = String(input ?? '').trim();
  let IPv6 = false;
  if (/^\[[0-9a-fA-F:]+\]$/.test(地址)) {
    try { 地址 = new URL('https://' + 地址).hostname; IPv6 = true; } catch (_) { /* 非法 IPv6 */ }
  }
  const IPv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(地址) && 地址.split('.').every(n => Number(n) <= 255);
  const 域名 = 地址.length <= 253 && !/^[\d.]+$/.test(地址) && 地址.split('.').every(s => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(s));
  if (!IPv6 && !IPv4 && !域名) throw 输入错误('入口地址必须是域名、IPv4 或带方括号的 IPv6');
  return 地址;
}

function 校验链接预览选项(原始, 配置, host) {
  if (!原始 || typeof 原始 !== 'object' || Array.isArray(原始)) throw 输入错误('预览参数必须是对象');
  const 协议类型 = 原始.协议类型 ?? 配置.协议类型;
  const 传输协议 = 原始.传输协议 ?? 配置.传输协议;
  if (!['vless', 'trojan', 'ss'].includes(协议类型)) throw 输入错误('不支持的代理协议');
  if (!['ws', 'grpc', 'xhttp'].includes(传输协议)) throw 输入错误('不支持的传输方式');
  let 地址 = String(原始.地址 ?? host).trim();
  const 端口 = Number(原始.端口 ?? (协议类型 === 'ss' && !配置.SS.TLS ? 80 : 443));
  const 路径 = String(原始.路径 ?? 配置.完整节点路径);
  const 备注 = String(原始.备注 ?? 配置.优选订阅生成.SUBNAME).trim();
  地址 = 规范入口地址(地址);
  if (!Number.isInteger(端口) || 端口 < 1 || 端口 > 65535) throw 输入错误('端口必须在 1–65535 之间');
  if (!路径.startsWith('/') || 路径.length > 1024 || /[\s#\\]/.test(路径)) throw 输入错误('路径必须以 / 开头，且不能包含空格、# 或反斜杠');
  if (协议类型 === 'ss' && 路径.includes(';')) throw 输入错误('SS 路径不能包含分号，请使用 %3B 编码');
  if (!备注 || 备注.length > 80 || /[\x00-\x1f\x7f]/.test(备注)) throw 输入错误('备注必须为 1–80 个字符，且不能包含控制字符');
  if (协议类型 === 'ss' && 传输协议 !== 'ws') throw 输入错误('SS 链接仅支持 WebSocket 传输');
  return { 协议类型, 传输协议, 地址, 端口, 路径, 备注 };
}

function 获取链接附加参数(配置) {
  return {
    ECH参数: 配置.ECH ? `&ech=${encodeURIComponent((配置.ECHConfig.SNI ? 配置.ECHConfig.SNI + '+' : '') + 配置.ECHConfig.DNS)}` : '',
    TLS分片参数: 配置.TLS分片 === 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : 配置.TLS分片 === 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '',
  };
}

// 所有入口使用同一节点模型和序列化器。订阅兼容项仅保留转换器要求的历史编码。
function 创建节点模型(配置, 用户ID, host, 选项 = {}, 兼容 = {}) {
  const 有效配置 = { ...配置, 协议类型: 选项.协议类型 || 配置.协议类型, 传输协议: 选项.传输协议 || 配置.传输协议 };
  const 附加参数 = 获取链接附加参数(配置);
  const model = {
    protocol: 有效配置.协议类型, credential: 用户ID, address: 选项.地址 || host, domain: 选项.域名 || host,
    port: String(选项.端口 || (有效配置.协议类型 === 'ss' && !配置.SS.TLS ? 80 : 443)),
    remark: 选项.备注 ?? 配置.优选订阅生成.SUBNAME, fingerprint: 配置.Fingerprint, alpn: 配置.ALPN || '',
    ech: 兼容.ECH参数 ?? 附加参数.ECH参数,
    fragment: 兼容.TLS分片参数 ?? 附加参数.TLS分片参数,
  };
  let path = 选项.路径 || 配置.完整节点路径;
  if (model.protocol === 'ss' && !兼容.订阅生成器) {
    model.method = 配置.SS.加密方式;
    if (兼容.订阅 && !配置.SS.TLS) {
      const tls = [443, 2053, 2083, 2087, 2096, 8443], plain = [80, 2052, 2082, 2086, 2095, 8080];
      model.port = String(plain[tls.indexOf(Number(model.port))] ?? model.port);
    }
    path = path.includes('?') ? path.replace('?', '?enc=' + model.method + '&') : path + '?enc=' + model.method;
    if (兼容.订阅) {
      path = path.replace(/([=,])/g, '\\$1');
      if (!兼容.转换器请求) path += ';mux=0';
      if (配置.随机路径) path = 随机路径(path);
      model.plugin = 'ray-plugin;mode=websocket;host=' + model.domain + ';path=' + path + (配置.SS.TLS ? ';tls' : '');
    } else {
      model.plugin = 'ray-plugin;mode=websocket;host=' + model.domain + ';path=' + path + (配置.SS.TLS ? ';tls' : '') + ';mux=0';
      model.fragment = ''; // 主节点历史上不输出 SS fragment；订阅客户端由兼容配置控制。
    }
  } else {
    const transport = 获取传输协议配置(有效配置);
    model.type = transport.type; model.hostKey = transport.域名字段名; model.pathKey = transport.路径字段名;
    model.path = 获取传输路径参数值(有效配置, path, !!兼容.订阅生成器);
  }
  return model;
}

function 序列化节点链接(model) {
  if (model.plugin !== undefined) return `${model.protocol}://${btoa(model.method + ':' + model.credential)}@${model.address}:${model.port}?plugin=v2${encodeURIComponent(model.plugin) + model.ech + model.fragment}#${encodeURIComponent(model.remark)}`;
  return `${model.protocol}://${model.credential}@${model.address}:${model.port}?security=tls&type=${model.type + model.ech}&${model.hostKey}=${model.domain}&fp=${model.fingerprint}&sni=${model.domain}&${model.pathKey}=${encodeURIComponent(model.path) + model.fragment}&encryption=none${model.alpn ? '&alpn=' + encodeURIComponent(model.alpn) : ''}#${encodeURIComponent(model.remark)}`;
}

function 生成主节点链接(配置, 用户ID, host, 选项 = {}) {
  return 序列化节点链接(创建节点模型(配置, 用户ID, host, 选项));
}

export { 生成主节点链接, 校验链接预览选项, 规范入口地址, 创建节点模型, 序列化节点链接, 获取链接附加参数 };
