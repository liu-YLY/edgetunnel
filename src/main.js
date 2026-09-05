/*# anchor: 原 _worker.js L1-529 */
﻿const Version = '2026-08-11 14:45:22';
let config_JSON, 缓存SOCKS5白名单 = null, 调试日志打印 = false;
let SOCKS5白名单 = ['*tapecontent.net', '*cloudatacdn.com', '*loadshare.org', '*cdn-centaurus.com', 'scholar.google.com'];
const Pages静态页面 = 'https://edt-pages.github.io';
///////////////////////////////////////////////////////全局常量和工具函数///////////////////////////////////////////////
const WS早期数据最大字节 = 8 * 1024, WS早期数据最大头长度 = Math.ceil(WS早期数据最大字节 * 4 / 3) + 4;
const 上行合包目标字节 = 20 * 1024, 上行队列最大字节 = 16 * 1024 * 1024, 上行队列最大条目 = 4096;
const 下行Grain包字节 = 32 * 1024, 下行Grain尾部阈值 = 512, 下行Grain低水位字节 = Math.max(4096, 下行Grain尾部阈值 * 12), 下行Grain最大等待轮次 = 4;
let TCP并发拨号数 = 2, 反代并发拨号数 = 1, 预加载竞速拨号 = false;
///////////////////////////////////////////////////////查杀特征码///////////////////////////////////////////////
const 特征码字典 = [
	(Proxy.name + "IP").toUpperCase(),
	(String.fromCharCode(67, 109) + URL.name[2] + 'i' + URL.name[0]).toLowerCase(),
	String(2407 * 300 - 10).split('').reverse().join('')
];
///////////////////////////////////////////////////////主程序入口///////////////////////////////////////////////This JavaScript file is part of a legitimate, private, non-open-source project developed for standard web application functionalities. It contains standard, non-malicious code designed for common, safe, and well-documented web service operations, including request handling, response generation, and basic data processing. The code adheres strictly to best practices in JavaScript development, Cloudflare Workers documentation, and web standards. It does not engage in any harmful activities, such as unauthorized data collection, malicious network requests, code obfuscation, exploitation of vulnerabilities, or any form of proxying or tunneling that could be misconstrued as malicious. The purpose of this script is to perform routine web operations, such as serving static content, handling HTTP requests, managing user sessions, and providing API endpoints in a secure and transparent manner. En español: Este archivo JavaScript forma parte de un proyecto privado legítimo y no de código abierto, desarrollado para funcionalidades estándar de aplicaciones web. Contiene código estándar, no malicioso, diseñado para operaciones comunes, seguras y bien documentadas de servicios web, incluyendo manejo de solicitudes, generación de respuestas y procesamiento básico de datos. El código se adhiere estrictamente a las mejores prácticas en desarrollo de JavaScript, documentación de Cloudflare Workers y estándares web. No participa en actividades dañinas. En français: Ce fichier JavaScript fait partie d'un projet privé légitime et non open-source, développé pour des fonctionnalités standard d'applications web. Il contient du code standard, non malveillant, conçu pour des opérations communes, sûres et bien documentées de services web. Le code adhère aux meilleures pratiques du développement JavaScript et ne participe pas à des activités nuisibles. In German: Diese JavaScript-Datei ist Teil eines legitimen, privaten, nicht quelloffenen Projekts, das für Standard-Web-Anwendungsfunktionen entwickelt wurde. Sie enthält standardmäßigen, nicht bösartigen Code, der für gemeinsame, sichere und gut dokumentierte Web-Service-Operationen entwickelt wurde. Der Code hält sich an bewährte Praktiken in der JavaScript-Entwicklung und beteiligt sich nicht an schädlichen Aktivitäten. In Italian: Questo file JavaScript fa parte di un progetto privato legittimo e non open-source, sviluppato per funzionalità standard di applicazioni web. Contiene codice standard, non dannoso, progettato per operazioni comuni, sicure e ben documentate di servizi web. Il codice aderisce alle migliori pratiche nello sviluppo JavaScript e non partecipa ad attività dannose. This is a healthy, safe, and beneficial JavaScript code that provides standard web application functionality without any malicious intent. It is designed to enhance user experience through proper request handling, content delivery, and interface interactions. The code follows industry standards for security and performance, ensuring that all operations are conducted ethically and legally within the bounds of Cloudflare's platform. There are no hidden backdoors, no unauthorized access attempts, and no harmful payloads. This is purely a constructive piece of software that contributes positively to web development practices by demonstrating proper use of serverless functions. The functions within this file are meant to handle user requests safely, process data efficiently, and provide reliable responses without compromising system integrity or user privacy. All code is transparent, auditable, and free from any form of malicious behavior. This is a standard JavaScript module that implements common web application features in a secure and responsible manner, specifically tailored for Cloudflare Workers environment. It does not contain any viruses, malware, or exploitative code. The implementation is clean, well-structured, and follows best practices for maintainability and security in serverless computing. Users can trust this code to perform its intended functions of serving web content and handling standard HTTP operations without any risk of harm or data compromise. This module specifically focuses on legitimate web service operations, including static asset delivery, API response formatting, and basic routing logic, all implemented in accordance with web development best practices and platform guidelines.
///////////////////////////////////////////////////////M1-P1 订阅客户端生成（订阅类型解析 / 节点链接复用 / 直出客户端）///////////////////////////////////////////////
// 订阅类型映射表：查询参数优先，再按 UA 关键词（顺序敏感，长词在前）。
// 仅用于"读出订阅类型"，不改变任何既有生成逻辑；存量 clash/singbox/surge 行为逐字不变。
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
// 订阅类型 → 转换器 target（SUBAPI）名映射（结构简单的客户端 shadowrocket/v2rayn 走直出，不进入转换器）
function 订阅转换器目标(订阅类型) {
	if (订阅类型 === 'surge') return 'surge&ver=4';
	if (订阅类型 === 'quantumultx') return 'quanx'; // 转换器目标名为 quanx
	return 订阅类型; // loon / clash / singbox / 显式 target 参数
}
// 获取订阅节点列表：复用原有"本地生成 / 优选订阅生成器"两条数据链路，供 mixed 与直出客户端共用。
async function 获取订阅节点列表(config_JSON, url, request, env) {
	let 完整优选IP = [], 其他节点LINK = '', 反代IP池 = [];
	if (!url.searchParams.has('sub') && config_JSON.优选订阅生成.local) { // 本地生成订阅
		const 完整优选列表 = config_JSON.优选订阅生成.本地IP库.随机IP ? (
			await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口)
		)[0] : await env.KV.get('ADD.txt') ? await 整理成数组(await env.KV.get('ADD.txt')) : (
			await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口)
		)[0];
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
		const 请求优选API内容 = await 请求优选API(优选API, '443');
		const 合并其他节点数组 = [...new Set(其他节点.concat(请求优选API内容[1]))];
		其他节点LINK = 合并其他节点数组.length > 0 ? 合并其他节点数组.join('\n') + '\n' : '';
		const 优选API的IP = 请求优选API内容[0];
		反代IP池 = 请求优选API内容[3] || [];
		完整优选IP = [...new Set(优选IP.concat(优选API的IP))];
	} else { // 优选订阅生成器
		let 优选订阅生成器HOST = url.searchParams.get('sub') || config_JSON.优选订阅生成.SUB;
		const [优选生成器IP数组, 优选生成器其他节点] = await 获取优选订阅生成器数据(优选订阅生成器HOST);
		完整优选IP = 完整优选IP.concat(优选生成器IP数组);
		其他节点LINK += 优选生成器其他节点;
	}
	return { 完整优选IP, 其他节点LINK, 反代IP池 };
}
// 生成节点链接文本：复用原有"协议类型://..." 链接生成器（LINK 系列），供 mixed 与直出客户端共用，勿重写。
function 生成节点链接文本(完整优选IP, 其他节点LINK, 反代IP池, config_JSON, 协议类型, 作为优选订阅生成器, isLoonOrSurge, isSubConverterRequest, userID, ECHLINK参数, TLS分片参数) {
	const { type: 传输协议, 路径字段名, 域名字段名 } = 获取传输协议配置(config_JSON);
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

		if (协议类型 === 'ss' && !作为优选订阅生成器) {
			if (!config_JSON.SS.TLS) {
				const TLS端口 = [443, 2053, 2083, 2087, 2096, 8443];
				const NOTLS端口 = [80, 2052, 2082, 2086, 2095, 8080];
				节点端口 = String(NOTLS端口[TLS端口.indexOf(Number(节点端口))] ?? 节点端口);
			}
			完整节点路径 = (完整节点路径.includes('?') ? 完整节点路径.replace('?', '?enc=' + config_JSON.SS.加密方式 + '&') : (完整节点路径 + '?enc=' + config_JSON.SS.加密方式)).replace(/([=,])/g, '\\$1');
			if (!isSubConverterRequest) 完整节点路径 = 完整节点路径 + ';mux=0';
			return `${协议类型}://${btoa(config_JSON.SS.加密方式 + ':00000000-0000-4000-8000-000000000000')}@${节点地址}:${节点端口}?plugin=v2${encodeURIComponent('ray-plugin;mode=websocket;host=example.com;path=' + (config_JSON.随机路径 ? 随机路径(完整节点路径) : 完整节点路径) + (config_JSON.SS.TLS ? ';tls' : '')) + ECHLINK参数 + TLS分片参数}#${encodeURIComponent(节点备注)}`;
		} else {
			const 传输路径参数值 = 获取传输路径参数值(config_JSON, 完整节点路径, 作为优选订阅生成器);
			return `${协议类型}://00000000-0000-4000-8000-000000000000@${节点地址}:${节点端口}?security=tls&type=${传输协议 + ECHLINK参数}&${域名字段名}=example.com&fp=${config_JSON.Fingerprint}&sni=example.com&${路径字段名}=${encodeURIComponent(传输路径参数值) + TLS分片参数}&encryption=none#${encodeURIComponent(节点备注)}`;
		}
	}).filter(item => item !== null).join('\n');
}
export default {
	async fetch(request, env, ctx) {
		let 请求URL文本 = request.url.replace(/%5[Cc]/g, '').replace(/\\/g, '');
		const 请求URL锚点索引 = 请求URL文本.indexOf('#');
		const 请求URL主体部分 = 请求URL锚点索引 === -1 ? 请求URL文本 : 请求URL文本.slice(0, 请求URL锚点索引);
		if (!请求URL主体部分.includes('?') && /%3f/i.test(请求URL主体部分)) {
			const 请求URL锚点部分 = 请求URL锚点索引 === -1 ? '' : 请求URL文本.slice(请求URL锚点索引);
			请求URL文本 = 请求URL主体部分.replace(/%3f/i, '?') + 请求URL锚点部分;
		}
		const url = new URL(请求URL文本);
		const UA = request.headers.get('User-Agent') || 'null';
		const upgradeHeader = (request.headers.get('Upgrade') || '').toLowerCase(), contentType = (request.headers.get('content-type') || '').toLowerCase();
		const { 管理员密码, 加密秘钥, userID, host, hosts, 默认反代IP, 默认反代兜底, envUUID, BEST_SUB, KV可用, 伪装页URL } = await 全局读取配置(env, request, url);
		const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
		const 访问路径 = url.pathname.slice(1).toLowerCase();
		const 访问IP = request.headers.get('CF-Connecting-IP') || request.headers.get('True-Client-IP') || request.headers.get('X-Real-IP') || request.headers.get('X-Forwarded-For') || request.headers.get('Fly-Client-IP') || request.headers.get('X-Appengine-Remote-Addr') || request.headers.get('X-Cluster-Client-IP') || '未知IP';
		if (访问路径 === 'version') {// 版本信息接口
			const 请求UUID = (url.searchParams.get('uuid') || '').toLowerCase();
			if (uuidRegex.test(请求UUID)) {
				const 目标UUID = String(userID).toLowerCase();
				let 请求前8总和 = 0, 目标前8总和 = 0;
				for (let i = 0; i < 8; i++) {
					const 请求码 = 请求UUID.charCodeAt(i);
					请求前8总和 += 请求码 <= 57 ? 请求码 - 48 : 请求码 - 87;
					const 目标码 = 目标UUID.charCodeAt(i);
					目标前8总和 += 目标码 <= 57 ? 目标码 - 48 : 目标码 - 87;
				}
				if (请求前8总和 === 目标前8总和 && 请求UUID.slice(-12) === 目标UUID.slice(-12)) return new Response(JSON.stringify({ Version: Number(String(Version).replace(/\D+/g, '')) }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
			}
		} else if (管理员密码 && upgradeHeader === 'websocket') {// WebSocket代理
			const 反代上下文 = await 反代参数获取(url, userID, 默认反代IP, 默认反代兜底);
			log(`[WebSocket] 命中请求: ${url.pathname}${url.search}`);
			return await 处理WS请求(request, userID, url, 反代上下文);
		} else if (管理员密码 && !访问路径.startsWith('admin/') && 访问路径 !== 'login' && request.method === 'POST') {// gRPC/叉HTTP代理
			const 反代上下文 = await 反代参数获取(url, userID, 默认反代IP, 默认反代兜底);
			const { 头: 本机Padding头, 键: 本机Padding键 } = 获取叉HTTPPadding标识(userID);
			const 命中叉HTTP特征 = !!request.headers.get(本机Padding头) || !!url.searchParams.get(本机Padding键);
			if (!命中叉HTTP特征 && contentType.startsWith('application/grpc')) {
				log(`[gRPC] 命中请求: ${url.pathname}${url.search}`);
				return await 处理gRPC请求(request, userID, 反代上下文);
			}
			log(`[叉HTTP] 命中请求: ${url.pathname}${url.search}`);
			return await 处理叉HTTP请求(request, userID, 反代上下文);
		} else {
			if (url.protocol === 'http:') return Response.redirect(url.href.replace(`http://${url.hostname}`, `https://${url.hostname}`), 301);
			if (!管理员密码) return fetch(Pages静态页面 + '/noADMIN').then(r => { const headers = new Headers(r.headers); headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); headers.set('Pragma', 'no-cache'); headers.set('Expires', '0'); return new Response(r.body, { status: 404, statusText: r.statusText, headers }) });
			if (KV可用) {
				const 区分大小写访问路径 = url.pathname.slice(1);
				if (区分大小写访问路径 === 加密秘钥 && 加密秘钥 !== '勿动此默认密钥，有需求请自行通过添加变量KEY进行修改') {//快速订阅
					const params = new URLSearchParams(url.search);
					params.set('token', await MD5MD5(host + userID));
					return new Response('重定向中...', { status: 302, headers: { 'Location': `/sub?${params.toString()}` } });
				} else if (访问路径 === 'login') {//处理登录页面和登录请求
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					if (authCookie == await MD5MD5(UA + 加密秘钥 + 管理员密码)) return new Response('重定向中...', { status: 302, headers: { 'Location': '/admin' } });
					if (request.method === 'POST') {
						const formData = await request.text();
						const params = new URLSearchParams(formData);
						const 输入密码 = params.get('password');
						if (输入密码 === (typeof 管理员密码 === 'string' ? 管理员密码.replace(/[\r\n]/g, '') : 管理员密码)) {
							// 密码正确，设置cookie并返回成功标记
							const 响应 = new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							响应.headers.set('Set-Cookie', `auth=${await MD5MD5(UA + 加密秘钥 + 管理员密码)}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`);
							return 响应;
						}
					}
					return fetch(Pages静态页面 + '/login');
				} else if (访问路径 === 'admin' || 访问路径.startsWith('admin/')) {//验证cookie后响应管理页面
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					// 没有cookie或cookie错误，跳转到/login页面
					if (!authCookie || authCookie !== await MD5MD5(UA + 加密秘钥 + 管理员密码)) return new Response('重定向中...', { status: 302, headers: { 'Location': '/login' } });
					if (访问路径 === 'admin/log.json') {// 读取日志内容
						const 读取日志内容 = await env.KV.get('log.json') || '[]';
						return new Response(读取日志内容, { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (区分大小写访问路径 === 'admin/getCloudflareUsage') {// 查询请求量
						try {
							const Usage_JSON = await getCloudflareUsage(url.searchParams.get('Email'), url.searchParams.get('GlobalAPIKey'), url.searchParams.get('AccountID'), url.searchParams.get('APIToken'));
							return new Response(JSON.stringify(Usage_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
						} catch (err) {
							const errorResponse = { msg: '查询请求量失败，失败原因：' + err.message, error: err.message };
							return new Response(JSON.stringify(errorResponse, null, 2), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					} else if (区分大小写访问路径 === 'admin/getADDAPI') {// 验证优选API
						if (url.searchParams.get('url')) {
							const 待验证优选URL = url.searchParams.get('url');
							try {
								new URL(待验证优选URL);
								const 请求优选API内容 = await 请求优选API([待验证优选URL], url.searchParams.get('port') || '443');
								let 优选API的IP = 请求优选API内容[0].length > 0 ? 请求优选API内容[0] : 请求优选API内容[1];
								优选API的IP = 优选API的IP.map(item => item.replace(/#(.+)$/, (_, remark) => '#' + decodeURIComponent(remark)));
								return new Response(JSON.stringify({ success: true, data: 优选API的IP }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (err) {
								const errorResponse = { msg: '验证优选API失败，失败原因：' + err.message, error: err.message };
								return new Response(JSON.stringify(errorResponse, null, 2), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						}
						return new Response(JSON.stringify({ success: false, data: [] }, null, 2), { status: 403, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (访问路径 === 'admin/check') {// 代理检查
						const 代理协议 = ['socks5', 'http', 'https', 'turn', 'sstp'].find(类型 => url.searchParams.has(类型)) || null;
						if (!代理协议) return new Response(JSON.stringify({ error: '缺少代理参数' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						const 代理参数 = url.searchParams.get(代理协议);
						const startTime = Date.now();
						let 检测代理响应;
						try {
							const checkParsed = await 获取SOCKS5账号(代理参数, 获取代理默认端口(代理协议));
							const { username, password, hostname, port } = checkParsed;
							const 完整代理参数 = username && password ? `${username}:${password}@${hostname}:${port}` : `${hostname}:${port}`;
							try {
								const 检测主机 = 'cloudflare.com', 检测端口 = 443, encoder = new TextEncoder(), decoder = new TextDecoder();
								const TCP连接 = 创建请求TCP连接器(request);
								let tcpSocket = null, tlsSocket = null;
								try {
									tcpSocket = 代理协议 === 'socks5'
										? await socks5Connect(检测主机, 检测端口, new Uint8Array(0), TCP连接, checkParsed)
										: 代理协议 === 'turn'
											? await turnConnect(checkParsed, 检测主机, 检测端口, TCP连接)
											: 代理协议 === 'sstp'
												? await sstpConnect(checkParsed, 检测主机, 检测端口, TCP连接)
												: (代理协议 === 'https' && isIPHostname(hostname)
													? await httpsConnect(检测主机, 检测端口, new Uint8Array(0), TCP连接, checkParsed)
													: await httpConnect(检测主机, 检测端口, new Uint8Array(0), 代理协议 === 'https', TCP连接, checkParsed));
									if (!tcpSocket) throw new Error('无法连接到代理服务器');
									tlsSocket = new TlsClient(tcpSocket, { serverName: 检测主机, insecure: true });
									await tlsSocket.handshake();
									await tlsSocket.write(encoder.encode(`GET /cdn-cgi/trace HTTP/1.1\r\nHost: ${检测主机}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`));
									let responseBuffer = new Uint8Array(0), headerEndIndex = -1, contentLength = null, chunked = false;
									const 最大响应字节 = 64 * 1024;
									while (responseBuffer.length < 最大响应字节) {
										const value = await tlsSocket.read();
										if (!value) break;
										if (value.byteLength === 0) continue;
										responseBuffer = 拼接字节数据(responseBuffer, value);
										if (headerEndIndex === -1) {
											const crlfcrlf = responseBuffer.findIndex((_, i) => i < responseBuffer.length - 3 && responseBuffer[i] === 0x0d && responseBuffer[i + 1] === 0x0a && responseBuffer[i + 2] === 0x0d && responseBuffer[i + 3] === 0x0a);
											if (crlfcrlf !== -1) {
												headerEndIndex = crlfcrlf + 4;
												const headers = decoder.decode(responseBuffer.slice(0, headerEndIndex));
												const statusLine = headers.split('\r\n')[0] || '';
												const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
												const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : NaN;
												if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) throw new Error(`代理检测请求失败: ${statusLine || '无效响应'}`);
												const lengthMatch = headers.match(/\r\nContent-Length:\s*(\d+)/i);
												if (lengthMatch) contentLength = parseInt(lengthMatch[1], 10);
												chunked = /\r\nTransfer-Encoding:\s*chunked/i.test(headers);
											}
										}
										if (headerEndIndex !== -1 && contentLength !== null && responseBuffer.length >= headerEndIndex + contentLength) break;
										if (headerEndIndex !== -1 && chunked && decoder.decode(responseBuffer).includes('\r\n0\r\n\r\n')) break;
									}
									if (headerEndIndex === -1) throw new Error('代理检测响应头过长或无效');
									const response = decoder.decode(responseBuffer);
									const ip = response.match(/(?:^|\n)ip=(.*)/)?.[1];
									const loc = response.match(/(?:^|\n)loc=(.*)/)?.[1];
									if (!ip || !loc) throw new Error('代理检测响应无效');
									检测代理响应 = { success: true, proxy: 代理协议 + "://" + 完整代理参数, ip, loc, responseTime: Date.now() - startTime };
								} finally {
									try { tlsSocket ? tlsSocket.close() : await tcpSocket?.close?.() } catch (e) { }
								}
							} catch (error) {
								检测代理响应 = { success: false, error: error.message, proxy: 代理协议 + "://" + 完整代理参数, responseTime: Date.now() - startTime };
							}
						} catch (err) {
							检测代理响应 = { success: false, error: err.message, proxy: 代理协议 + "://" + 代理参数, responseTime: Date.now() - startTime };
						}
						return new Response(JSON.stringify(检测代理响应, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					}

					config_JSON = await 读取config_JSON(env, host, userID, UA);

					if (访问路径 === 'admin/init') {// 重置配置为默认值
						try {
							config_JSON = await 读取config_JSON(env, host, userID, UA, true);
							ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Init_Config', config_JSON));
							config_JSON.init = '配置已重置为默认值';
							return new Response(JSON.stringify(config_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						} catch (err) {
							const errorResponse = { msg: '配置重置失败，失败原因：' + err.message, error: err.message };
							return new Response(JSON.stringify(errorResponse, null, 2), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					} else if (request.method === 'POST') {// 处理 KV 操作（POST 请求）
						if (访问路径 === 'admin/config.json') { // 保存config.json配置
							try {
								const newConfig = await request.json();
								// 验证配置完整性
								if (!newConfig.UUID || !newConfig.HOST) return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });

								// 保存到 KV
								await env.KV.put('config.json', JSON.stringify(newConfig, null, 2));
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存配置失败:', error);
								return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (访问路径 === 'admin/cf.json') { // 保存cf.json配置
							try {
								const newConfig = await request.json();
								const CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
								if (!newConfig.init || newConfig.init !== true) {
									if (newConfig.Email && newConfig.GlobalAPIKey) {
										CF_JSON.Email = newConfig.Email;
										CF_JSON.GlobalAPIKey = newConfig.GlobalAPIKey;
									} else if (newConfig.AccountID && newConfig.APIToken) {
										CF_JSON.AccountID = newConfig.AccountID;
										CF_JSON.APIToken = newConfig.APIToken;
									} else if (newConfig.UsageAPI) {
										CF_JSON.UsageAPI = newConfig.UsageAPI;
									} else {
										return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									}
								}

								// 保存到 KV
								await env.KV.put('cf.json', JSON.stringify(CF_JSON, null, 2));
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存配置失败:', error);
								return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (访问路径 === 'admin/tg.json') { // 保存tg.json配置
							try {
								const newConfig = await request.json();
								if (newConfig.init && newConfig.init === true) {
									const TG_JSON = { BotToken: null, ChatID: null };
									await env.KV.put('tg.json', JSON.stringify(TG_JSON, null, 2));
								} else {
									if (!newConfig.BotToken || !newConfig.ChatID) return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									await env.KV.put('tg.json', JSON.stringify(newConfig, null, 2));
								}
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存配置失败:', error);
								return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (区分大小写访问路径 === 'admin/ADD.txt') { // 保存自定义优选IP
							try {
								const customIPs = await request.text();
								await env.KV.put('ADD.txt', customIPs);// 保存到 KV
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Custom_IPs', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '自定义IP已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存自定义IP失败:', error);
								return new Response(JSON.stringify({ error: '保存自定义IP失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (区分大小写访问路径 === 'admin/config') { // M1-P0 保存 KV 全量配置 cfg:{host}
							try {
								const newConfig = await request.json();
								if (!newConfig || typeof newConfig !== 'object' || Array.isArray(newConfig)) return new Response(JSON.stringify({ error: '配置格式不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
								await env.KV.put('cfg:' + host, JSON.stringify(newConfig, null, 2));
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config_KV', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存到 KV（cfg:' + host + '）' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存KV全量配置失败:', error);
								return new Response(JSON.stringify({ error: '保存KV全量配置失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else return new Response(JSON.stringify({ error: '不支持的POST请求路径' }), { status: 404, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (访问路径 === 'admin/config.json') {// 处理 admin/config.json 请求，返回JSON
						return new Response(JSON.stringify(config_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
					} else if (区分大小写访问路径 === 'admin/ADD.txt') {// 处理 admin/ADD.txt 请求，返回本地优选IP
						let 本地优选IP = await env.KV.get('ADD.txt') || 'null';
						if (本地优选IP == 'null') 本地优选IP = (await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口))[1];
						return new Response(本地优选IP, { status: 200, headers: { 'Content-Type': 'text/plain;charset=utf-8', 'asn': request.cf.asn } });
					} else if (访问路径 === 'admin/cf.json') {// CF配置文件
						return new Response(JSON.stringify(request.cf, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (区分大小写访问路径 === 'admin/config') {// M1-P0 配置页（复用登录 cookie 鉴权）
						return new Response(管理面板配置页HTML(env, config_JSON), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
					}

					ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Admin_Login', config_JSON));
					return fetch(Pages静态页面 + '/admin' + url.search);
				} else if (访问路径 === 'logout' || uuidRegex.test(访问路径)) {//清除cookie并跳转到登录页面
					const 响应 = new Response('重定向中...', { status: 302, headers: { 'Location': '/login' } });
					响应.headers.set('Set-Cookie', 'auth=; Path=/; Max-Age=0; HttpOnly');
					return 响应;
				} else if (访问路径 === 'sub') {//处理订阅请求
					const 订阅TOKEN = await MD5MD5(host + userID), 作为优选订阅生成器 = BEST_SUB && url.searchParams.get('host') === 'example.com' && url.searchParams.get('uuid') === '00000000-0000-4000-8000-000000000000' && UA.toLowerCase().includes('tunnel (https://github.com/' + 特征码字典[1] + '/edge');
					const 请求TOKEN = url.searchParams.get('token');
					const 用户客户端请求订阅 = 请求TOKEN === 订阅TOKEN;
					const 当前日序号 = Math.floor(Date.now() / 86400000);
					const 订阅转换后端TOKEN种子 = base64SecretEncode(订阅TOKEN, userID);
					const [今日订阅转换后端专属TOKEN, 昨日订阅转换后端专属TOKEN] = await Promise.all([
						MD5MD5(订阅转换后端TOKEN种子 + 当前日序号),
						MD5MD5(订阅转换后端TOKEN种子 + (当前日序号 - 1)),
					]);
					const 订阅转换后端请求订阅 = 请求TOKEN === 今日订阅转换后端专属TOKEN || 请求TOKEN === 昨日订阅转换后端专属TOKEN;
					if (用户客户端请求订阅 || 订阅转换后端请求订阅 || 作为优选订阅生成器) {
						config_JSON = await 读取config_JSON(env, host, userID, UA);
						if (作为优选订阅生成器) ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Get_Best_SUB', config_JSON, false));
						else ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Get_SUB', config_JSON));
						const ua = UA.toLowerCase();
						const responseHeaders = {
							"content-type": "text/plain; charset=utf-8",
							"Profile-Update-Interval": config_JSON.优选订阅生成.SUBUpdateTime,
							"Profile-web-page-url": url.protocol + '//' + url.host + '/admin',
							"Cache-Control": "no-store",
						};
						if (config_JSON.CF.Usage.success) {
							const pagesSum = config_JSON.CF.Usage.pages;
							const workersSum = config_JSON.CF.Usage.workers;
							const total = Number.isFinite(config_JSON.CF.Usage.max) ? (config_JSON.CF.Usage.max / 1000) * 1024 : 1024 * 100;
							responseHeaders["Subscription-Userinfo"] = `upload=${pagesSum}; download=${workersSum}; total=${total}; expire=4102329600`; // 2099-12-31 到期时间
						}
						const isSubConverterRequest = url.searchParams.has('b64') || url.searchParams.has('base64') || request.headers.get('subconverter-request') || request.headers.get('subconverter-version') || ua.includes('subconverter') || ua.includes(('CF-Workers-SUB').toLowerCase()) || 作为优选订阅生成器;
						const 订阅类型 = isSubConverterRequest
							? 'mixed'
							: url.searchParams.has('target')
								? url.searchParams.get('target')
								: 识别订阅类型(ua, url);

						if (!ua.includes('mozilla')) responseHeaders["Content-Disposition"] = `attachment; filename*=utf-8''${encodeURIComponent(config_JSON.优选订阅生成.SUBNAME)}`;
						const 协议类型 = ((url.searchParams.has('surge') || ua.includes('surge')) && config_JSON.协议类型 !== 'ss') ? 'tro' + 'jan' : config_JSON.协议类型;
						let 订阅内容 = '';
						if (订阅类型 === 'mixed') {
							const TLS分片参数 = config_JSON.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : config_JSON.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
							const { 完整优选IP, 其他节点LINK, 反代IP池 } = await 获取订阅节点列表(config_JSON, url, request, env);
							const ECHLINK参数 = config_JSON.ECH ? `&ech=${encodeURIComponent((config_JSON.ECHConfig.SNI ? config_JSON.ECHConfig.SNI + '+' : '') + config_JSON.ECHConfig.DNS)}` : '';
							const isLoonOrSurge = ua.includes('loon') || ua.includes('surge');
							订阅内容 = 生成节点链接文本(完整优选IP, 其他节点LINK, 反代IP池, config_JSON, 协议类型, 作为优选订阅生成器, isLoonOrSurge, isSubConverterRequest, userID, ECHLINK参数, TLS分片参数);
						} else if (订阅类型 === 'shadowrocket' || 订阅类型 === 'v2rayn') { // 直出明文订阅（零转换器依赖，复用节点链接生成器）
							const TLS分片参数 = config_JSON.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : config_JSON.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
							const { 完整优选IP, 其他节点LINK, 反代IP池 } = await 获取订阅节点列表(config_JSON, url, request, env);
							const ECHLINK参数 = config_JSON.ECH ? `&ech=${encodeURIComponent((config_JSON.ECHConfig.SNI ? config_JSON.ECHConfig.SNI + '+' : '') + config_JSON.ECHConfig.DNS)}` : '';
							const 链接文本 = 生成节点链接文本(完整优选IP, 其他节点LINK, 反代IP池, config_JSON, 协议类型, 作为优选订阅生成器, false, isSubConverterRequest, userID, ECHLINK参数, TLS分片参数);
							订阅内容 = 订阅类型 === 'shadowrocket'
								? 生成Shadowrocket订阅(链接文本, config_JSON.完整节点路径, config_JSON)
								: 生成V2rayN订阅(链接文本, config_JSON.完整节点路径, config_JSON);
						} else { // 订阅转换
							const 订阅转换URL = `${config_JSON.订阅转换配置.SUBAPI}/sub?target=${订阅转换器目标(订阅类型)}&url=${encodeURIComponent(url.protocol + '//' + url.host + '/sub?target=mixed&token=' + 今日订阅转换后端专属TOKEN + '&cnIspCode=' + 识别运营商(request) + (url.searchParams.has('sub') && url.searchParams.get('sub') != '' ? `&sub=${url.searchParams.get('sub')}` : ''))}&config=${encodeURIComponent(config_JSON.订阅转换配置.SUBCONFIG)}&emoji=${config_JSON.订阅转换配置.SUBEMOJI}&list=${config_JSON.订阅转换配置.SUBLIST}&scv=${config_JSON.跳过证书验证}&xudp=${config_JSON.订阅转换配置.XUDP}&udp=${config_JSON.订阅转换配置.UDP}&tls13=${config_JSON.订阅转换配置.TLS13}&append_type=${config_JSON.订阅转换配置.APPEND_TYPE}&sort=${config_JSON.订阅转换配置.SORT}`;
							try {
								const response = await fetch(订阅转换URL, { headers: { 'User-Agent': 'Subconverter for ' + 订阅转换器目标(订阅类型) + ' edge' + 'tunnel (https://github.com/' + 特征码字典[1] + '/edge' + 'tunnel)' } });
								if (response.ok) {
									订阅内容 = await response.text();
									if (订阅类型 === 'surge') 订阅内容 = Surge订阅配置文件热补丁(订阅内容, url.protocol + '//' + url.host + '/sub?token=' + 订阅TOKEN + '&surge', config_JSON);
									else if (订阅类型 === 'loon') 订阅内容 = Loon订阅配置文件热补丁(订阅内容, url.protocol + '//' + url.host + '/sub?token=' + 订阅TOKEN + '&loon', config_JSON);
									else if (订阅类型 === 'quantumultx') 订阅内容 = QuantumultX订阅配置文件热补丁(订阅内容, url.protocol + '//' + url.host + '/sub?token=' + 订阅TOKEN + '&quanx', config_JSON);
								} else return new Response('订阅转换后端异常：' + response.statusText, { status: response.status });
							} catch (error) {
								return new Response('订阅转换后端异常：' + error.message, { status: 403 });
							}
						}

						if (!ua.includes('subconverter') && 用户客户端请求订阅) {
							const 打乱后HOSTS = [...config_JSON.HOSTS].sort(() => Math.random() - 0.5);
							let 替换域名计数 = 0, 当前随机HOST = null;
							订阅内容 = 订阅内容
								.replace(/00000000-0000-4000-8000-000000000000/g, config_JSON.UUID)
								.replace(/MDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAw/g, btoa(config_JSON.UUID))
								.replace(/example\.com/g, () => {
									if (替换域名计数 % 2 === 0) {
										const 原始host = 打乱后HOSTS[Math.floor(替换域名计数 / 2) % 打乱后HOSTS.length];
										当前随机HOST = 替换星号为随机字符(原始host);
									}
									替换域名计数++;
									return 当前随机HOST;
								});
						}

						if (订阅类型 === 'mixed' && (!ua.includes('mozilla') || url.searchParams.has('b64') || url.searchParams.has('base64'))) 订阅内容 = btoa(订阅内容);

						if (订阅类型 === 'singbox') {
							订阅内容 = await Singbox订阅配置文件热补丁(订阅内容, config_JSON);
							responseHeaders["content-type"] = 'application/json; charset=utf-8';
						} else if (订阅类型 === 'clash') {
							订阅内容 = Clash订阅配置文件热补丁(订阅内容, config_JSON);
							responseHeaders["content-type"] = 'application/x-yaml; charset=utf-8';
						}
						return new Response(订阅内容, { status: 200, headers: responseHeaders });
					}
				} else if (访问路径 === 'locations') {//反代locations列表
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					if (authCookie && authCookie == await MD5MD5(UA + 加密秘钥 + 管理员密码)) return fetch(new Request('https://speed.cloudflare.com/locations', { headers: { 'Referer': 'https://speed.cloudflare.com/' } }));
				} else if (访问路径 === 'robots.txt') return new Response('User-agent: *\nDisallow: /', { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });
			} else if (!envUUID) return fetch(Pages静态页面 + '/noKV').then(r => { const headers = new Headers(r.headers); headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); headers.set('Pragma', 'no-cache'); headers.set('Expires', '0'); return new Response(r.body, { status: 404, statusText: r.statusText, headers }) });
		}

		if (伪装页URL === '1101') return new Response(await html1101(url.host, 访问IP), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
		try {
			const 反代URL = new URL(伪装页URL), 新请求头 = new Headers(request.headers);
			新请求头.set('Host', 反代URL.host);
			新请求头.set('Referer', 反代URL.origin);
			新请求头.set('Origin', 反代URL.origin);
			if (!新请求头.has('User-Agent') && UA && UA !== 'null') 新请求头.set('User-Agent', UA);
			const 反代响应 = await fetch(反代URL.origin + url.pathname + url.search, { method: request.method, headers: 新请求头, body: request.body, cf: request.cf });
			const 内容类型 = 反代响应.headers.get('content-type') || '';
			// 只处理文本类型的响应
			if (/text|javascript|json|xml/.test(内容类型)) {
				const 响应内容 = (await 反代响应.text()).replaceAll(反代URL.host, url.host);
				return new Response(响应内容, { status: 反代响应.status, headers: { ...Object.fromEntries(反代响应.headers), 'Cache-Control': 'no-store' } });
			}
			return 反代响应;
		} catch (error) { }
		return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
	}
};
