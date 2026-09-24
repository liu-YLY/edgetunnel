import { 规范入口地址 } from '../core/link.js';
import { 读取优选响应, 优选来源结果, 优选错误 } from './source-fetch.js';
import { 特征码字典 } from '../core/constants.js';
import { 整理成数组, 识别运营商 } from '../core/strings.js';


async function 生成随机IP(request, count = 16, 指定端口 = -1) {
	const url = new URL(request.url);
	const 查询参数运营商 = String(url.searchParams.get('cnIspCode') || '').toLowerCase();
	const 运营商文件标识 = ['ct', 'cu', 'cmcc', 'cf'].includes(查询参数运营商) ? 查询参数运营商 : 识别运营商(request);
	const 运营商名称映射 = {
		cmcc: 'CF移动优选',
		cu: 'CF联通优选',
		ct: 'CF电信优选',
		cf: 'CF官方优选',
	};
	const cidr_url = 运营商文件标识 === 'cf' ? `https://raw.githubusercontent.com/${特征码字典[1]}/${特征码字典[1]}/main/CF-CIDR.txt` : `https://raw.githubusercontent.com/${特征码字典[1]}/${特征码字典[1]}/main/CF-CIDR/${运营商文件标识}.txt`;
	const cfname = 运营商名称映射[运营商文件标识] || 'CF官方优选';
	const cfport = [443, 2053, 2083, 2087, 2096, 8443];
	let cidrList = [];
	let 来源状态 = 优选来源结果('随机 IP 库', 'ok');
	try {
		const { bytes } = await 读取优选响应(cidr_url, 5000);
		const text = new TextDecoder().decode(bytes);
		cidrList = (await 整理成数组(text)).map(s => s.trim()).filter(s => {
			const parts = s.split('/');
			return parts.length === 2 && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(parts[0]) && parts[0].split('.').every(n => Number(n) <= 255) && /^\d+$/.test(parts[1]) && Number(parts[1]) <= 32;
		});
		if (!cidrList.length) throw 优选错误(text.trim() ? 'parse_error' : 'empty');
	} catch (error) {
		cidrList = ['104.16.0.0/13'];
		const 原因 = 优选来源结果('随机 IP 库', error.sourceState || 'network_error', 0, error.httpStatus);
		来源状态 = { ...优选来源结果('随机 IP 库', 'fallback'), message: 原因.message + '；已使用内置地址段兜底' };
	}

	const generateRandomIPFromCIDR = (cidr) => {
		const [baseIP, prefixLength] = cidr.split('/'), prefix = parseInt(prefixLength), hostBits = 32 - prefix;
		const ipInt = baseIP.split('.').reduce((a, p, i) => a | (parseInt(p) << (24 - i * 8)), 0);
		const randomOffset = Math.floor(Math.random() * Math.pow(2, hostBits));
		const mask = prefix === 0 ? 0 : (0xFFFFFFFF << hostBits) >>> 0, randomIP = (((ipInt & mask) >>> 0) + randomOffset) >>> 0;
		return [(randomIP >>> 24) & 0xFF, (randomIP >>> 16) & 0xFF, (randomIP >>> 8) & 0xFF, randomIP & 0xFF].join('.');
	};
	const randomIPs = Array.from({ length: count }, (_, index) => {
		const ip = generateRandomIPFromCIDR(cidrList[Math.floor(Math.random() * cidrList.length)]);
		const 目标端口 = 指定端口 === -1
			? cfport[Math.floor(Math.random() * cfport.length)]
			: 指定端口;
		return `${ip}:${目标端口}#${cfname}${index + 1}`;
	});
	return [randomIPs, randomIPs.join('\n'), { ...来源状态, count: randomIPs.length }];
}


async function 获取优选订阅生成器数据(input, timeout = 8000) {
  const ips = [], links = [];
  try {
    if (typeof input !== 'string' || !input.trim()) throw 优选错误('invalid_url');
    let address = input.replace(/^sub:\/\//i, 'https://').split('#')[0].split('?')[0];
    if (!/^https?:\/\//i.test(address)) address = 'https://' + address;
    let origin;
    try { origin = new URL(address).origin; } catch (_) { throw 优选错误('invalid_url'); }
    const { bytes } = await 读取优选响应(origin + '/sub?host=example.com&uuid=00000000-0000-4000-8000-000000000000', timeout, { 'User-Agent': 'v2rayN/edgetunnel (https://github.com/' + 特征码字典[1] + '/edge' + 'tunnel)' });
    const raw = new TextDecoder().decode(bytes).trim();
    if (!raw) return [ips, '', 优选来源结果('订阅生成器', 'empty')];
    let text;
    try { text = new TextDecoder().decode(Uint8Array.from(atob(raw), c => c.charCodeAt(0))); }
    catch (_) { throw 优选错误('parse_error'); }
    let invalid = 0;
    for (const line of text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(line)) { invalid++; continue; }
      if (line.includes('00000000-0000-4000-8000-000000000000') && line.includes('example.com')) {
        const match = line.match(/:\/\/[^@]+@([^?]+)/);
        try {
          if (!match) throw 优选错误('parse_error');
          const remark = line.match(/#(.+)$/);
          const parsed = 解析优选文本(match[1] + (remark ? '#' + decodeURIComponent(remark[1]) : ''), '443');
          if (parsed.invalid || parsed.ips.length !== 1) throw 优选错误('parse_error');
          ips.push(parsed.ips[0]);
        } catch (_) { invalid++; }
      } else links.push(line);
    }
    const count = ips.length + links.length;
    return [ips, links.length ? links.join('\n') + '\n' : '', 优选来源结果('订阅生成器', count ? (invalid ? 'partial' : 'ok') : (invalid ? 'parse_error' : 'empty'), count)];
  } catch (error) {
    return [[], '', 优选来源结果('订阅生成器', error.sourceState || 'parse_error', 0, error.httpStatus)];
  }
}

function 解析优选文本(text, defaultPort) {
  let decoded = text;
  const clean = text.replace(/\s/g, '');
  if (clean && clean.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    try { decoded = new TextDecoder().decode(Uint8Array.from(atob(clean), c => c.charCodeAt(0))); } catch (_) { /* 尝试原文本 */ }
  }
  const ips = [], links = []; let invalid = 0;
  const add = (host, port, remark = '') => {
    try {
      const address = 规范入口地址(host);
      if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) throw 优选错误('parse_error');
      if (!address.includes('.') && !address.startsWith('[')) throw 优选错误('parse_error');
      ips.push(address + ':' + port + remark);
    } catch (_) { invalid++; }
  };
  if (!decoded.trim() || decoded.trim() === '[]') return { ips, links, invalid };
  const lines = decoded.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const headers = lines[0].split(',').map(s => s.trim());
  if (headers.includes('IP地址') && headers.includes('端口') && headers.includes('数据中心')) {
    const ip = headers.indexOf('IP地址'), port = headers.indexOf('端口'), tls = headers.indexOf('TLS');
    const name = headers.indexOf('国家') >= 0 ? headers.indexOf('国家') : headers.indexOf('城市') >= 0 ? headers.indexOf('城市') : headers.indexOf('数据中心');
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map(s => s.trim());
      if (tls >= 0 && cols[tls]?.toLowerCase() !== 'true') continue;
      const host = cols[ip] || '';
      add(host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host, cols[port], '#' + (cols[name] || host));
    }
  } else if (headers.some(s => s.includes('IP')) && headers.some(s => s.includes('延迟')) && headers.some(s => s.includes('下载速度'))) {
    const ip = headers.findIndex(s => s.includes('IP')), delay = headers.findIndex(s => s.includes('延迟')), speed = headers.findIndex(s => s.includes('下载速度'));
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map(s => s.trim()), host = cols[ip] || '';
      add(host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host, defaultPort, `#CF优选 ${cols[delay]}ms ${cols[speed]}MB/s`);
    }
  } else {
    for (const line of lines) {
      if (/^(?:vless|trojan|ss|vmess|hysteria2?|hy2|tuic|wireguard):\/\//i.test(line)) { links.push(line); continue; }
      const hash = line.indexOf('#'), hostPort = (hash < 0 ? line : line.slice(0, hash)).trim(), remark = hash < 0 ? '' : line.slice(hash);
      if (!hostPort.startsWith('[') && (hostPort.match(/:/g) || []).length > 1) { add('[' + hostPort + ']', defaultPort, remark); continue; }
      const match = hostPort.match(/^(\[[^\]]+\]|[^:\s]+)(?::(\d+))?$/);
      if (match) add(match[1], match[2] || defaultPort, remark); else invalid++;
    }
  }
  return { ips, links, invalid };
}

async function 请求优选API(urls, 默认端口 = '443', 超时时间 = 3000) {
  if (!urls?.length) return [[], [], [], [], []];
  const outputs = new Array(urls.length); let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const index = cursor++, source = '优选源 ' + (index + 1), input = urls[index];
      try {
        const hash = input.indexOf('#'), url = hash < 0 ? input : input.slice(0, hash), name = hash < 0 ? '' : decodeURIComponent(input.slice(hash + 1));
        let ips, links, status;
        if (url.toLowerCase().startsWith('sub://')) {
          const result = await 获取优选订阅生成器数据(url, 超时时间);
          ips = result[0]; links = result[1].trim() ? result[1].trim().split(/\r?\n/) : []; status = { ...result[2], source };
        } else {
          const { bytes, contentType } = await 读取优选响应(url, 超时时间);
          const charset = contentType.toLowerCase().includes('charset=gb') ? ['gb2312','utf-8'] : ['utf-8','gb2312'];
          let text = '';
          for (const encoding of charset) { try { const value = new TextDecoder(encoding, { fatal: true }).decode(bytes); text = value; break; } catch (_) { /* 尝试下个编码 */ } }
          if (bytes.length && !text) throw 优选错误('parse_error');
          const parsed = 解析优选文本(text, new URL(url).searchParams.get('port') || 默认端口);
          ips = parsed.ips; links = parsed.links;
          const count = ips.length + links.length;
          status = 优选来源结果(source, count ? (parsed.invalid ? 'partial' : 'ok') : (parsed.invalid ? 'parse_error' : 'empty'), count);
        }
        const pool = input.toLowerCase().includes('proxyip=true') ? ips.map(s => s.split('#')[0]) : [];
        outputs[index] = { ips: name ? ips.map(s => s.includes('#') ? s + ' [' + name + ']' : s + '#[' + name + ']') : ips,
          links: name ? links.map(s => s.includes('#') ? s + encodeURIComponent(' [' + name + ']') : s + '#' + encodeURIComponent('[' + name + ']')) : links, pool, status };
      } catch (error) { outputs[index] = { ips: [], links: [], pool: [], status: 优选来源结果(source, error.sourceState || 'parse_error', 0, error.httpStatus) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, () => worker()));
  return [[...new Set(outputs.flatMap(s => s.ips))], [...new Set(outputs.flatMap(s => s.links))], [], [...new Set(outputs.flatMap(s => s.pool))], outputs.map(s => s.status)];
}

export { 生成随机IP, 获取优选订阅生成器数据, 请求优选API };
