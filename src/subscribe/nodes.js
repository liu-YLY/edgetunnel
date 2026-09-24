import { 创建节点模型, 序列化节点链接 } from '../core/link.js';
import { base64SecretEncode } from '../core/options.js';
import { 替换星号为随机字符 } from '../core/paths.js';
import { 整理成数组 } from '../core/strings.js';
import { 获取SOCKS5账号, 获取代理默认端口 } from '../proxy/account.js';
import { 优选来源结果 } from '../proxy/source-fetch.js';
import { 生成随机IP, 获取优选订阅生成器数据, 请求优选API } from '../proxy/preferred.js';
const 订阅类型映射表 = [
	{ 类型: 'loon', 参数: ['loon'], UA: ['loon'] },
	{ 类型: 'quantumultx', 参数: ['qx', 'quanx'], UA: ['quantumult%20x', 'quantumult x'] },
	{ 类型: 'shadowrocket', 参数: ['shadowrocket'], UA: ['shadowrocket'] },
	{ 类型: 'v2rayn', 参数: ['v2rayn', 'v2rayng'], UA: ['v2rayn', 'v2rayng'] },
	{ 类型: 'clash', 参数: ['clash', 'meta', 'mihomo'], UA: ['clash', 'meta', 'mihomo'] },
	{ 类型: 'singbox', 参数: ['sb', 'singbox'], UA: ['singbox', 'sing-box'] },
	{ 类型: 'surge', 参数: ['surge'], UA: ['surge'] },
];

function 识别订阅类型(ua小写, url) {
	for (const 项 of 订阅类型映射表) {
		if (项.参数.some(p => url.searchParams.has(p))) return 项.类型;
		if (项.UA.some(k => ua小写.includes(k))) return 项.类型;
	}
	return 'mixed'; // 默认保持旧行为（与重构前 /sub 默认 mixed 一致）
}

function 订阅转换器目标(订阅类型) {
	if (订阅类型 === 'surge') return 'surge&ver=4';
	if (订阅类型 === 'quantumultx') return 'quanx'; // 转换器目标名为 quanx
	return 订阅类型; // loon / clash / singbox / 显式 target 参数
}

async function 获取订阅节点列表(config_JSON, url, request, env, 最大外部源数 = 8) {
	let 完整优选IP = [], 其他节点LINK = '', 反代IP池 = [];
	let 未请求优选API数量 = 0;
	const 来源诊断 = [];
	if (!url.searchParams.has('sub') && config_JSON.优选订阅生成.local) { // 本地生成订阅
		const 保存的地址 = config_JSON.优选订阅生成.本地IP库.随机IP ? null : await env.KV.get('ADD.txt');
		let 完整优选列表;
		if (保存的地址) 完整优选列表 = await 整理成数组(保存的地址);
		else {
			const 随机结果 = await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口);
			完整优选列表 = 随机结果[0]; 来源诊断.push(随机结果[2]);
		}
		const 优选API = [], 优选IP = [], 其他节点 = [];
		for (const 元素 of 完整优选列表) {
			if (元素.toLowerCase().startsWith('sub://')) {
				优选API.push(元素);
			} else {
				const 备注位置 = 元素.indexOf('#');
				const 地址部分 = 备注位置 > -1 ? 元素.slice(0, 备注位置) : 元素;
				const 备注部分 = 备注位置 > -1 ? 元素.slice(备注位置) : '';
				const subMatch = 元素.match(/sub\s*=\s*([^\s&#]+)/i);
				if (subMatch && subMatch[1].trim().includes('.')) {
					const 优选IP作为反代IP = 元素.toLowerCase().includes('proxyip=true');
					if (优选IP作为反代IP) 优选API.push('sub://' + subMatch[1].trim() + "?proxyip=true" + (元素.includes('#') ? ('#' + 元素.split('#')[1]) : ''));
					else 优选API.push('sub://' + subMatch[1].trim() + (元素.includes('#') ? ('#' + 元素.split('#')[1]) : ''));
				} else if (地址部分.toLowerCase().startsWith('https://')) {
					优选API.push(元素);
				} else if (地址部分.toLowerCase().includes('://')) {
					if (元素.includes('#')) {
						const 地址备注分离 = 元素.split('#');
						其他节点.push(地址备注分离[0] + '#' + encodeURIComponent(decodeURIComponent(地址备注分离[1])));
					} else 其他节点.push(元素);
				} else {
					if (地址部分.includes('*')) {
						优选IP.push(替换星号为随机字符(地址部分) + 备注部分);
					} else 优选IP.push(元素);
				}
			}
		}
		未请求优选API数量 = Math.max(0, 优选API.length - 最大外部源数);
		const 请求优选API内容 = await 请求优选API(优选API.slice(0, 最大外部源数), '443');
		来源诊断.push(...请求优选API内容[4]);
		if (未请求优选API数量) 来源诊断.push(优选来源结果('其余优选源', 'limited', 未请求优选API数量));
		const 合并其他节点数组 = [...new Set(其他节点.concat(请求优选API内容[1]))];
		其他节点LINK = 合并其他节点数组.length > 0 ? 合并其他节点数组.join('\n') + '\n' : '';
		const 优选API的IP = 请求优选API内容[0];
		反代IP池 = 请求优选API内容[3] || [];
		完整优选IP = [...new Set(优选IP.concat(优选API的IP))];
	} else { // 优选订阅生成器
		let 优选订阅生成器HOST = url.searchParams.get('sub') || config_JSON.优选订阅生成.SUB;
		const [优选生成器IP数组, 优选生成器其他节点, 状态] = await 获取优选订阅生成器数据(优选订阅生成器HOST);
		来源诊断.push(状态);
		完整优选IP = 完整优选IP.concat(优选生成器IP数组);
		其他节点LINK += 优选生成器其他节点;
	}
	return { 完整优选IP, 其他节点LINK, 反代IP池, 未请求优选API数量, 来源诊断 };
}

function 生成节点链接文本(完整优选IP, 其他节点LINK, 反代IP池, config_JSON, 协议类型, 作为优选订阅生成器, isLoonOrSurge, isSubConverterRequest, userID, ECHLINK参数, TLS分片参数) {
	return 其他节点LINK + 完整优选IP.map(原始地址 => {
		// 统一正则: 匹配 域名/IPv4/IPv6地址 + 可选端口 + 可选备注
		// 示例:
		//   - 域名: hj.xmm1993.top:2096#备注 或 example.com
		//   - IPv4: 166.0.188.128:443#Los Angeles 或 166.0.188.128
		//   - IPv6: [2606:4700::]:443#CMCC 或 [2606:4700::]
		const regex = /^(\[[\da-fA-F:]+\]|[\d.]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*)(?::(\d+))?(?:#(.+))?$/;
		const match = 原始地址.match(regex);

		let 节点地址, 节点端口 = "443", 节点备注;

		if (match) {
			节点地址 = match[1];  // IP地址或域名(可能带方括号)
			节点端口 = match[2] ? match[2] : '443';  // 端口默认443，SS noTLS在生成链接时再映射
			节点备注 = match[3] || 节点地址;  // 备注,默认为地址本身
		} else {
			// 不规范的格式，跳过处理返回null
			console.warn(`[订阅内容] 不规范的IP格式已忽略: ${原始地址}`);
			return null;
		}

		let 完整节点路径 = config_JSON.完整节点路径;

		const 链式代理匹配 = 节点备注.match(/\$(socks5|http|https|turn|sstp):\/\/([^#\s]+)/i);
		if (链式代理匹配) {
			try {
				const 代理协议 = 链式代理匹配[1].toLowerCase(), 代理参数 = 链式代理匹配[2];
				const 链式代理数据 = { type: 代理协议, ...获取SOCKS5账号(代理参数, 获取代理默认端口(代理协议)) };
				完整节点路径 = `/video/${base64SecretEncode(JSON.stringify(链式代理数据), userID) + (config_JSON.启用0RTT ? '?ed=2560' : '')}`;
				节点备注 = 节点备注.replace(链式代理匹配[0], '').trim() || 节点地址;
			} catch (error) {
				console.warn(`[订阅内容] 链式代理解析失败，已忽略该指令: ${链式代理匹配[0]} (${error && error.message ? error.message : error})`);
			}
		} else if (反代IP池.length > 0) {
			const 匹配到的反代IP = 反代IP池.find(p => p.includes(节点地址));
			if (匹配到的反代IP) 完整节点路径 = (`${config_JSON.PATH}/proxyip=${匹配到的反代IP}`).replace(/\/\//g, '/') + (config_JSON.启用0RTT ? '?ed=2560' : '');
		}
		if (isLoonOrSurge) 完整节点路径 = 完整节点路径.replace(/,/g, '%2C');

		return 序列化节点链接(创建节点模型(config_JSON, '00000000-0000-4000-8000-000000000000', 'example.com', {
			协议类型, 地址: 节点地址, 端口: 节点端口, 路径: 完整节点路径, 备注: 节点备注,
		}, { 订阅: true, 订阅生成器: 作为优选订阅生成器, 转换器请求: isSubConverterRequest, ECH参数: ECHLINK参数, TLS分片参数 }));
	}).filter(item => item !== null).join('\n');
}

export { 生成节点链接文本, 获取订阅节点列表, 订阅转换器目标, 识别订阅类型 };
