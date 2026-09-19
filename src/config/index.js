import { MD5MD5 } from '../core/crypto.js';
import { config缓存TTL, config缓存映射, 用量缓存, 配置缓存世代 } from './cache.js';
import { 验证配置 } from './validation.js';
import { 特征码字典, 默认SOCKS5白名单 } from '../core/constants.js';
import { 当前请求配置 } from '../core/context.js';
import { 掩码敏感信息 } from '../core/html.js';
import { 获取传输协议配置, 获取传输路径参数值 } from '../core/options.js';
import { 整理成数组, 识别运营商 } from '../core/strings.js';
import { getCloudflareUsage } from '../services/usage.js';
import { 写入用量快照 } from '../services/usage-history.js';
// auto 仅连接原始目标；不将 Cloudflare 地址当成通用代理出口。
const 官方直连地址池 = Object.freeze([]); // 兼容旧配置字段，禁止内置候选
const 官方直连端口 = 443;

// ============ M2-P1 最小版: config_JSON 30s 内存缓存 ============
// 订阅/管理路径每请求 4×KV 串行读 + UsageAPI 查询, 高频刷新时延迟与配额放大。
// 以 host|userID 为键缓存 30s; 面板保存配置(admin/config.json、admin/config、
// admin/cf.json)时主动 clear()。WS 代理路径不经过此函数, 不受影响。
// 缓存保存快照；调用方总是持有独立副本。KV 跨区域仍为最终一致。


async function 读取config_JSON(env, hostname, userID, UA = "Mozilla/5.0", 重置配置 = false) {
	let config_JSON;
    const 加载世代 = 配置缓存世代;
	const 缓存键 = hostname + '|' + userID + '|' + UA;
	const 缓存命中 = (!重置配置) && config缓存映射.get(缓存键);
	if (缓存命中 && Date.now() - 缓存命中.t < config缓存TTL) return structuredClone(缓存命中.v);
	const _p = 特征码字典[0];
	const host = hostname, Ali_DoH = "https://dns.alidns.com/dns-query", ECH_SNI = "cloudflare-ech.com", 占位符 = '{{IP:PORT}}', 初始化开始时间 = performance.now(), 默认配置JSON = {
		TIME: new Date().toISOString(),
		HOST: host,
		HOSTS: [hostname],
		UUID: userID,
		PATH: "/",
		协议类型: "v" + "le" + "ss",
		传输协议: "ws",
		gRPC模式: "gun",
		gRPCUserAgent: UA,
		跳过证书验证: false,
		启用0RTT: false,
		TLS分片: null,
		随机路径: false,
		ECH: false,
		ECHConfig: {
			DNS: Ali_DoH,
			SNI: ECH_SNI,
		},
		SS: {
			加密方式: "aes-128-gcm",
			TLS: true,
		},
		Fingerprint: "chrome",
		ALPN: "", // 空则不生成 alpn 参数；可设 h2 / http/1.1 等（来源于上游 cmliu 移植）
		优选订阅生成: {
			local: true, // true: 基于本地的优选地址  false: 优选订阅生成器
			本地IP库: {
				随机IP: true, // 当 随机IP 为true时生效，启用随机IP的数量，否则使用KV内的ADD.txt
				随机数量: 16,
				指定端口: -1,
			},
			SUB: null,
			SUBNAME: "edge" + "tunnel",
			SUBUpdateTime: 3, // 订阅更新时间（小时）
			TOKEN: await MD5MD5(hostname + userID),
		},
		订阅转换配置: {
			SUBAPI: `https://SUBAPI.${特征码字典[1]}ssss.net`,
			SUBCONFIG: `https://raw.githubusercontent.com/${特征码字典[1]}/ACL4SSR/refs/heads/main/Clash/config/ACL4SSR_Online_Mini_MultiMode_CF.ini`,
			SUBEMOJI: false,
			SUBLIST: false, //仅输出节点信息
			UDP: false, // 启用 UDP
			XUDP: false, // 启用 XUDP
			TLS13: false, // 启用 TLS 1.3
			APPEND_TYPE: false, // 插入节点类型
			SORT: false, // 基础节点排序
		},
		反代: {
			[_p]: "auto",
			SOCKS5: {
				启用: null,
				全局: false,
				账号: '',
				白名单: 当前请求配置().SOCKS5白名单,
			},
			路径模板: {
				[_p]: "proxyip=" + 占位符,
				SOCKS5: {
					全局: "socks5://" + 占位符,
					标准: "socks5=" + 占位符
				},
				HTTP: {
					全局: "http://" + 占位符,
					标准: "http=" + 占位符
				},
				HTTPS: {
					全局: "https://" + 占位符,
					标准: "https=" + 占位符
				},
				TURN: {
					全局: "turn://" + 占位符,
					标准: "turn=" + 占位符
				},
				SSTP: {
					全局: "sstp://" + 占位符,
					标准: "sstp=" + 占位符
				},
			},
		},
		TG: {
			启用: false,
			BotToken: null,
			ChatID: null,
		},
		CF: {
			Email: null,
			GlobalAPIKey: null,
			AccountID: null,
			APIToken: null,
			UsageAPI: null,
			Usage: {
				success: false,
				pages: 0,
				workers: 0,
				total: 0,
				max: 100000,
			},
		}
	};

	try {
		let configJSON = await env.KV.get('config.json');
		if (!configJSON || 重置配置 == true) {
			await env.KV.put('config.json', JSON.stringify(默认配置JSON, null, 2));
			config_JSON = 默认配置JSON;
		} else {
			const stored = 验证配置(JSON.parse(configJSON), 默认配置JSON);
            config_JSON = 深合并配置(structuredClone(默认配置JSON), stored);
		}
	} catch (error) {
		console.error(`读取config_JSON出错: ${error.message}`);
		config_JSON = 默认配置JSON;
	}

	if (!config_JSON.订阅转换配置.SUBLIST) config_JSON.订阅转换配置.SUBLIST = false;
	if (!config_JSON.订阅转换配置.UDP) config_JSON.订阅转换配置.UDP = false;
	if (!config_JSON.订阅转换配置.XUDP) config_JSON.订阅转换配置.XUDP = false;
	if (!config_JSON.订阅转换配置.TLS13) config_JSON.订阅转换配置.TLS13 = false;
	if (!config_JSON.订阅转换配置.APPEND_TYPE) config_JSON.订阅转换配置.APPEND_TYPE = false;
	if (!config_JSON.订阅转换配置.SORT) config_JSON.订阅转换配置.SORT = false;
	if (!config_JSON.gRPCUserAgent) config_JSON.gRPCUserAgent = UA;
	config_JSON.HOST = host;
	if (!config_JSON.HOSTS) config_JSON.HOSTS = [hostname];
	if (env.HOST) config_JSON.HOSTS = (await 整理成数组(env.HOST)).map(h => h.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0]);
	config_JSON.UUID = userID;
	if (!config_JSON.随机路径) config_JSON.随机路径 = false;
	if (!config_JSON.启用0RTT) config_JSON.启用0RTT = false;

	if (env.PATH) config_JSON.PATH = env.PATH.startsWith('/') ? env.PATH : '/' + env.PATH;
	else if (!config_JSON.PATH) config_JSON.PATH = '/';

	if (!config_JSON.gRPC模式) config_JSON.gRPC模式 = 'gun';
	if (!config_JSON.SS) config_JSON.SS = { 加密方式: "aes-128-gcm", TLS: false };

	if (!config_JSON.反代.路径模板?.[_p]) {
		config_JSON.反代.路径模板 = {
			[_p]: "proxyip=" + 占位符,
			SOCKS5: {
				全局: "socks5://" + 占位符,
				标准: "socks5=" + 占位符
			},
			HTTP: {
				全局: "http://" + 占位符,
				标准: "http=" + 占位符
			},
			HTTPS: {
				全局: "https://" + 占位符,
				标准: "https=" + 占位符
			},
			TURN: {
				全局: "turn://" + 占位符,
				标准: "turn=" + 占位符
			},
			SSTP: {
				全局: "sstp://" + 占位符,
				标准: "sstp=" + 占位符
			},
		};
	}
	if (!config_JSON.反代.路径模板.HTTPS) config_JSON.反代.路径模板.HTTPS = { 全局: "https://" + 占位符, 标准: "https=" + 占位符 };
	if (!config_JSON.反代.路径模板.TURN) config_JSON.反代.路径模板.TURN = { 全局: "turn://" + 占位符, 标准: "turn=" + 占位符 };
	if (!config_JSON.反代.路径模板.SSTP) config_JSON.反代.路径模板.SSTP = { 全局: "sstp://" + 占位符, 标准: "sstp=" + 占位符 };

	// ============ M1-P0 KV 全量配置 cfg:{host}（优先级：KV > env > 默认值）============
	// 以访问域名分桶；存在则整体覆盖 env/默认值，缺失回落 env/默认值；与旧 config.json 键互不冲突。
	try {
		const KV全量配置名 = 'cfg:' + host;
		const KV全量配置文本 = await env.KV.get(KV全量配置名);
		if (KV全量配置文本) {
			const KV全量配置对象 = JSON.parse(KV全量配置文本);
			验证配置(KV全量配置对象, 默认配置JSON);
            深合并配置(config_JSON, KV全量配置对象);
		}
	} catch (error) {
		console.error(`读取KV全量配置 cfg:${host} 出错: ${error.message}`);
	}

	const 代理配置 = config_JSON.反代.路径模板[config_JSON.反代.SOCKS5.启用?.toUpperCase()];

	let 路径反代参数 = '';
	if (代理配置 && config_JSON.反代.SOCKS5.账号) 路径反代参数 = (config_JSON.反代.SOCKS5.全局 ? 代理配置.全局 : 代理配置.标准).replace(占位符, config_JSON.反代.SOCKS5.账号);
	else if (config_JSON.反代[_p] !== 'auto') 路径反代参数 = config_JSON.反代.路径模板[_p].replace(占位符, config_JSON.反代[_p]);

	let 反代查询参数 = '';
	if (路径反代参数.includes('?')) {
		const [反代路径部分, 反代查询部分] = 路径反代参数.split('?');
		路径反代参数 = 反代路径部分;
		反代查询参数 = 反代查询部分;
	}

	config_JSON.PATH = config_JSON.PATH.replace(路径反代参数, '').replace('//', '/');
	const normalizedPath = config_JSON.PATH === '/' ? '' : config_JSON.PATH.replace(/\/+(?=\?|$)/, '').replace(/\/+$/, '');
	const [路径部分, ...查询数组] = normalizedPath.split('?');
	const 查询部分 = 查询数组.length ? '?' + 查询数组.join('?') : '';
	const 最终查询部分 = 反代查询参数 ? (查询部分 ? 查询部分 + '&' + 反代查询参数 : '?' + 反代查询参数) : 查询部分;
	config_JSON.完整节点路径 = (路径部分 || '/') + (路径部分 && 路径反代参数 ? '/' : '') + 路径反代参数 + 最终查询部分 + (config_JSON.启用0RTT ? (最终查询部分 ? '&' : '?') + 'ed=2560' : '');

	if (!config_JSON.TLS分片 && config_JSON.TLS分片 !== null) config_JSON.TLS分片 = null;
	const TLS分片参数 = config_JSON.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : config_JSON.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
	if (!config_JSON.Fingerprint) config_JSON.Fingerprint = "chrome";
	if (!config_JSON.ECH) config_JSON.ECH = false;
	if (!config_JSON.ECHConfig) config_JSON.ECHConfig = { DNS: Ali_DoH, SNI: ECH_SNI };
	const ECHLINK参数 = config_JSON.ECH ? `&ech=${encodeURIComponent((config_JSON.ECHConfig.SNI ? config_JSON.ECHConfig.SNI + '+' : '') + config_JSON.ECHConfig.DNS)}` : '';
	const { type: 传输协议, 路径字段名, 域名字段名 } = 获取传输协议配置(config_JSON);
	const 传输路径参数值 = 获取传输路径参数值(config_JSON, config_JSON.完整节点路径);
	config_JSON.LINK = config_JSON.协议类型 === 'ss'
		? `${config_JSON.协议类型}://${btoa(config_JSON.SS.加密方式 + ':' + userID)}@${host}:${config_JSON.SS.TLS ? '443' : '80'}?plugin=v2${encodeURIComponent(`ray-plugin;mode=websocket;host=${host};path=${((config_JSON.完整节点路径.includes('?') ? config_JSON.完整节点路径.replace('?', '?enc=' + config_JSON.SS.加密方式 + '&') : (config_JSON.完整节点路径 + '?enc=' + config_JSON.SS.加密方式)) + (config_JSON.SS.TLS ? ';tls' : ''))};mux=0`) + ECHLINK参数}#${encodeURIComponent(config_JSON.优选订阅生成.SUBNAME)}`
		: `${config_JSON.协议类型}://${userID}@${host}:443?security=tls&type=${传输协议 + ECHLINK参数}&${域名字段名}=${host}&fp=${config_JSON.Fingerprint}&sni=${host}&${路径字段名}=${encodeURIComponent(传输路径参数值) + TLS分片参数}&encryption=none#${encodeURIComponent(config_JSON.优选订阅生成.SUBNAME)}`;
	config_JSON.优选订阅生成.TOKEN = await MD5MD5(hostname + userID);

	const 初始化TG_JSON = { BotToken: null, ChatID: null };
	config_JSON.TG = { 启用: config_JSON.TG.启用 ? config_JSON.TG.启用 : false, ...初始化TG_JSON };
	try {
		const TG_TXT = await env.KV.get('tg.json');
		if (!TG_TXT) {
			await env.KV.put('tg.json', JSON.stringify(初始化TG_JSON, null, 2));
		} else {
			const TG_JSON = JSON.parse(TG_TXT);
			config_JSON.TG.ChatID = TG_JSON.ChatID ? TG_JSON.ChatID : null;
			config_JSON.TG.BotToken = TG_JSON.BotToken ? 掩码敏感信息(TG_JSON.BotToken) : null;
		}
	} catch (error) {
		console.error(`读取tg.json出错: ${error.message}`);
	}

	const 初始化CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
	config_JSON.CF = { ...初始化CF_JSON, Usage: { success: false, pages: 0, workers: 0, total: 0, max: 100000 } };
	try {
		const CF_TXT = await env.KV.get('cf.json');
		if (!CF_TXT) {
			await env.KV.put('cf.json', JSON.stringify(初始化CF_JSON, null, 2));
		} else {
			const CF_JSON = JSON.parse(CF_TXT);
            config_JSON.CF.Email = CF_JSON.Email || null;
            for (const key of ['GlobalAPIKey','AccountID','APIToken']) config_JSON.CF[key] = CF_JSON[key] ? 掩码敏感信息(CF_JSON[key]) : null;
            const usageKey = host;
            const cached = 用量缓存.get(usageKey);
            if (cached?.value) config_JSON.CF.Usage = structuredClone(cached.value);
            if (当前请求配置().ctx && (!cached || Date.now() - cached.time > 60000) && !cached?.pending) {
                const entry = { time:Date.now(), value:cached?.value, pending:true };
                if (用量缓存.size >= 50) 用量缓存.delete(用量缓存.keys().next().value);
                用量缓存.set(usageKey, entry);
                当前请求配置().ctx.waitUntil((async () => {
                    try {
                        entry.value = CF_JSON.UsageAPI ? await (await fetch(CF_JSON.UsageAPI, { signal:AbortSignal.timeout(8000) })).json()
                            : await getCloudflareUsage(CF_JSON.Email, CF_JSON.GlobalAPIKey, CF_JSON.AccountID, CF_JSON.APIToken);
                        if (entry.value?.total != null) await 写入用量快照(env, host, entry.value).catch(() => {});
                    } catch { console.error(JSON.stringify({ event:'usage_refresh_failed' })); }
                    finally { entry.pending = false; entry.time = Date.now(); }
                })());
            }
		}
	} catch (error) {
		console.error(`读取cf.json出错: ${error.message}`);
	}

	config_JSON.加载时间 = (performance.now() - 初始化开始时间).toFixed(2) + 'ms';
	if (config缓存映射.size > 50) config缓存映射.clear();
	if (加载世代 === 配置缓存世代) config缓存映射.set(缓存键, { t: Date.now(), v: structuredClone(config_JSON) });
	return config_JSON;
}

///////////////////////////////////////////////////////统一配置读取入口（M0-3）///////////////////////////////////////////////
// 收敛 fetch 主流程里的散落 env 读取，组合"env 读取 + KV 可用性"。行为与旧代码逐字段一致，不引入新逻辑。
async function 全局读取配置(env, request, url) {
	const 管理员密码 = env.ADMIN || env.admin || env.PASSWORD || env.password || env.pswd || env.TOKEN || env.KEY || env.UUID || env.uuid;
	const 加密秘钥 = env.KEY || '勿动此默认密钥，有需求请自行通过添加变量KEY进行修改';
	const userIDMD5 = await MD5MD5(管理员密码 + 加密秘钥);
	const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
	const envUUID = env.UUID || env.uuid;
	const userID = (envUUID && uuidRegex.test(envUUID)) ? envUUID.toLowerCase() : [userIDMD5.slice(0, 8), userIDMD5.slice(8, 12), '4' + userIDMD5.slice(13, 16), '8' + userIDMD5.slice(17, 20), userIDMD5.slice(20)].join('-');
	const hosts = env.HOST ? (await 整理成数组(env.HOST)).map(h => h.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0]) : [url.hostname];
	const host = hosts[0];
	const 运行配置 = Object.freeze({
        调试日志打印: ['1', 'true'].includes(env.DEBUG),
        预加载竞速拨号: ['1', 'true'].includes(env.PRELOAD_RACE_DIAL),
        反代并发拨号数: 限制拨号数(env.PROXY_CONCURRENT_DIAL, 1),
        TCP并发拨号数: 限制拨号数(env.TCP_CONCURRENT_DIAL, 识别运营商(request) === 'cmcc' ? 1 : 2),
        SOCKS5白名单: Object.freeze([...new Set([...默认SOCKS5白名单, ...(env.GO2SOCKS5 ? await 整理成数组(env.GO2SOCKS5) : [])])]),
    });
	// ============ M2-P0 出站模式三层选择 ============
	// auto（默认）：原始目标直连，不再生成第三方 {colo}.SsSs.nEt 反代域名，运行时零外部依赖；
	// manual：env.PROXYIP 手填（随机取一 + 兜底关闭，与旧版行为逐字一致）；
	// region：env.出站模式/EGRESS_MODE 显式设为 region 时，path wk 指定地区走旧 colo 反代域名模板。
	let 出站模式 = 'auto', 默认反代IP = '', 默认反代兜底 = true;
	const env出站模式 = String(env.出站模式 || env.EGRESS_MODE || '').toLowerCase();
	if (env.PROXYIP) {
		出站模式 = 'manual';
		const proxyIPs = await 整理成数组(env.PROXYIP);
		默认反代IP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];
		默认反代兜底 = false;
	} else if (env出站模式 === 'region') {
		出站模式 = 'region'; // 默认反代IP 留空，由 path wk 在 反代参数获取 中消费；无 wk 时仅直连目标
	}
	let 伪装页URL = env.URL || 'nginx';
	if (伪装页URL && 伪装页URL !== 'nginx' && 伪装页URL !== '1101') {
		伪装页URL = 伪装页URL.trim().replace(/\/$/, '');
		if (!伪装页URL.match(/^https?:\/\//i)) 伪装页URL = 'https://' + 伪装页URL;
		if (伪装页URL.toLowerCase().startsWith('http://')) 伪装页URL = 'https://' + 伪装页URL.substring(7);
		try { const u = new URL(伪装页URL); 伪装页URL = u.protocol + '//' + u.host } catch (e) { 伪装页URL = 'nginx' }
	}
	return { 运行配置, 管理员密码, 加密秘钥, userID, host, hosts, 默认反代IP, 默认反代兜底, 出站模式, 官方直连地址池, 官方直连端口, envUUID, BEST_SUB: ['1', 'true'].includes(env.BEST_SUB), KV可用: !!(env.KV && typeof env.KV.get === 'function'), 伪装页URL };
}

///////////////////////////////////////////////////////M1-P0 KV 全量配置深合并工具///////////////////////////////////////////////////////
// 将来源对象递归合并到目标对象（来源值覆盖目标值）。数组/非对象整体替换，undefined 跳过。
function 深合并配置(目标, 来源) {
	if (!目标 || !来源 || typeof 目标 !== 'object' || typeof 来源 !== 'object') return 目标;
	if (Array.isArray(来源)) return 目标;
	for (const 键 of Object.keys(来源)) {
        if (['__proto__', 'constructor', 'prototype'].includes(键)) continue;
		const 值 = 来源[键];
		if (值 === undefined) continue;
		if (值 && typeof 值 === 'object' && !Array.isArray(值) &&
			目标[键] && typeof 目标[键] === 'object' && !Array.isArray(目标[键])) {
			深合并配置(目标[键], 值);
		} else {
			目标[键] = 值;
		}
	}
	return 目标;
}


function 限制拨号数(value, fallback) { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.min(3, Math.max(1, Math.floor(n))) : fallback; }

export { 全局读取配置, 读取config_JSON };
