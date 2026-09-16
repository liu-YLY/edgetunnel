import { 特征码字典 } from '../core/constants.js';
import { log } from '../core/context.js';
import { base64SecretDecode } from '../core/options.js';
import { 反代协议默认端口, 获取SOCKS5账号, 获取代理默认端口 } from './account.js';
import { 解析木马反代地址 } from '../transport/trojan-relay.js';
async function 反代参数获取(url, uuid, 默认反代IP = '', 默认反代兜底 = true, 出站配置 = null) {
	const { searchParams } = url;
	const pathname = decodeURIComponent(url.pathname);
	const pathLower = pathname.toLowerCase();
	let 反代IP = 默认反代IP, 启用SOCKS5反代 = null, 启用SOCKS5全局反代 = false, 我的SOCKS5账号 = '', parsedSocks5Address = {}, 启用反代兜底 = 默认反代兜底;
	// ============ M2-P0 出站配置透传（模式/官方地址池）============
	// 模式默认 auto：连接原始目标；region：由 env.出站模式 显式开启，wk 指定地区走旧 colo 反代域名模板。
	const 出站模式 = 出站配置?.模式 || 'auto';
	const 官方地址池 = Array.isArray(出站配置?.地址池) ? 出站配置.地址池 : [];
	const 反代上下文 = { 木马反代地址: null, 反代IP, 代理类型: null, 代理账号: '', 代理全局: false, 代理参数: {}, 反代兜底: 启用反代兜底, 出站模式, 官方地址池 };
	// ============ M1-P0 path 逐节点覆盖白名单（p/wk/rm/s）============
	// 白名单外的查询参数一律忽略；p 与 wk 互斥：写 p 则地区匹配整体跳过。
	// M2-P0：wk 从预留字段转为端到端生效——region 模式下按 wk 生成旧 colo 反代域名模板；auto 模式忽略 wk 走官方直连。
	const p覆盖 = searchParams.get('p');
	const wk覆盖 = searchParams.get('wk');
	const rm覆盖 = searchParams.get('rm');
	const s覆盖 = searchParams.get('s');
	反代上下文.覆盖参数 = { p: p覆盖, wk: wk覆盖, rm: rm覆盖, s: s覆盖 };
	const 写入了p = p覆盖 !== null;
	反代上下文.跳过地区匹配 = 写入了p;
	反代上下文.地区 = 写入了p ? null : wk覆盖;      // 地区覆盖（写 p 时置空，地区匹配跳过）
	// M2-P0 rm 语义修正：rm=no 强制关闭地区匹配；缺省/yes/true/on 视为开启（由出站模式下决定是否真正生效）
	反代上下文.地区匹配 = 写入了p ? false : (rm覆盖 === 'no' ? false : true);
	if (写入了p && p覆盖)反代IP = p覆盖;           // p（ProxyIP）：直接覆盖连接级反代IP，并关闭兜底
	if (写入了p)启用反代兜底 = false;
	// ============ M2-P0-2 wk 消费：region 模式下 wk 指定地区出口 ============
	// 仅当未写 p（互斥）且 出站模式==='region' 且 wk 有效时启用旧 colo 模板；
	// auto 模式保持 反代IP 为空 -> forward 走官方直连；rm=no 时地区匹配整体关闭。
	if (!写入了p && 出站模式 === 'region' && 反代上下文.地区匹配 && 反代上下文.地区) {
		const wk地区 = String(反代上下文.地区).toLowerCase().replace(/[^a-z0-9]/g, '');
		if (wk地区) {
			反代IP = `${wk地区}.${特征码字典[0]}.${特征码字典[1]}SsSs.nEt`;
			启用反代兜底 = true; // 地区模板不可控，保留直连兜底（与旧版默认一致）
			log(`[出站] region 模式：wk=${wk地区} -> 地区反代模板 ${反代IP}`);
		}
	} else if (!写入了p && 出站模式 === 'auto' && 反代上下文.地区) {
		log(`[出站] auto 模式忽略 wk=${反代上下文.地区}（目标直连，不依赖地区反代域名；如需地区出口请设置 env.出站模式=region）`);
	}
	const 保存快照 = () => {
		反代上下文.反代IP = 反代IP;
		反代上下文.代理类型 = 启用SOCKS5反代;
		反代上下文.代理账号 = 我的SOCKS5账号;
		反代上下文.代理全局 = 启用SOCKS5全局反代;
		反代上下文.代理参数 = { ...parsedSocks5Address };
		反代上下文.反代兜底 = 启用反代兜底;
	};

	const 链式代理路径匹配 = pathname.match(/\/video\/(.+)$/i);
	if (链式代理路径匹配) {
		try {
			const 链式代理明文 = base64SecretDecode(链式代理路径匹配[1].replace(/\/+$/, ''), uuid);
			const { type, ...链式代理地址 } = JSON.parse(链式代理明文);
			if (!type || !反代协议默认端口[String(type).toLowerCase()]) throw new Error('链式代理类型无效');
			if (!链式代理地址.hostname || !链式代理地址.port) throw new Error('链式代理地址缺少 hostname 或 port');
			我的SOCKS5账号 = '';
			反代IP = '链式代理';
			启用反代兜底 = false;
			启用SOCKS5全局反代 = true;
			启用SOCKS5反代 = String(type).toLowerCase();
			parsedSocks5Address = {
				username: 链式代理地址.username,
				password: 链式代理地址.password,
				hostname: 链式代理地址.hostname,
				port: Number(链式代理地址.port)
			};
			if (isNaN(parsedSocks5Address.port)) throw new Error('链式代理端口无效');
			保存快照();
			return 反代上下文;
		} catch (err) {
			console.error('解析链式代理参数失败:', err.message);
		}
	}

	我的SOCKS5账号 = searchParams.get('socks5') || searchParams.get('http') || searchParams.get('https') || searchParams.get('turn') || searchParams.get('sstp') || null;
	启用SOCKS5全局反代 = searchParams.has('globalproxy');
	if (searchParams.get('socks5')) 启用SOCKS5反代 = 'socks5';
	else if (searchParams.get('http')) 启用SOCKS5反代 = 'http';
	else if (searchParams.get('https')) 启用SOCKS5反代 = 'https';
	else if (searchParams.get('turn')) 启用SOCKS5反代 = 'turn';
	else if (searchParams.get('sstp')) 启用SOCKS5反代 = 'sstp';

	const 解析代理URL = (值, 强制全局 = true) => {
		const 匹配 = /^(socks5|http|https|turn|sstp):\/\/(.+)$/i.exec(值 || '');
		if (!匹配) return false;
		启用SOCKS5反代 = 匹配[1].toLowerCase();
		我的SOCKS5账号 = 匹配[2].split('/')[0];
		if (强制全局) 启用SOCKS5全局反代 = true;
		return true;
	};

	const 设置反代IP = (值) => {
		反代IP = 值;
		启用SOCKS5反代 = null;
		启用反代兜底 = false;
	};

	const 提取路径值 = (值) => {
		if (!值.includes('://')) {
			const 斜杠索引 = 值.indexOf('/');
			return 斜杠索引 > 0 ? 值.slice(0, 斜杠索引) : 值;
		}
		const 协议拆分 = 值.split('://');
		if (协议拆分.length !== 2) return 值;
		const 斜杠索引 = 协议拆分[1].indexOf('/');
		return 斜杠索引 > 0 ? `${协议拆分[0]}://${协议拆分[1].slice(0, 斜杠索引)}` : 值;
	};

	const 木马路径匹配 = /\/trojan=([^?#\s]+)/i.exec(pathname);
	if (木马路径匹配) {
		try {
			反代上下文.木马反代地址 = 解析木马反代地址(木马路径匹配[1].replace(/\/+$/, ''));
		} catch (err) {
			console.error('解析木马反代地址失败:', err.message);
			反代上下文.木马反代地址 = null;
		}
	}

	const 查询反代IP = searchParams.get('proxyip');
	if (查询反代IP !== null) {
		if (!解析代理URL(查询反代IP)) {
			设置反代IP(查询反代IP);
			保存快照();
			return 反代上下文;
		}
	} else {
		let 匹配 = /\/(socks5?|http|https|turn|sstp):\/?\/?([^/?#\s]+)/i.exec(pathname);
		if (匹配) {
			const 类型 = 匹配[1].toLowerCase();
			启用SOCKS5反代 = 类型 === 'sock' || 类型 === 'socks' ? 'socks5' : 类型;
			我的SOCKS5账号 = 匹配[2].split('/')[0];
			启用SOCKS5全局反代 = true;
		} else if ((匹配 = /\/(g?s5|socks5|g?http|g?https|g?turn|g?sstp)=([^/?#\s]+)/i.exec(pathname))) {
			const 类型 = 匹配[1].toLowerCase();
			我的SOCKS5账号 = 匹配[2].split('/')[0];
			启用SOCKS5反代 = 类型.includes('sstp') ? 'sstp' : (类型.includes('turn') ? 'turn' : (类型.includes('https') ? 'https' : (类型.includes('http') ? 'http' : 'socks5')));
			if (类型.startsWith('g')) 启用SOCKS5全局反代 = true;
		} else if ((匹配 = /\/(proxyip[.=]|pyip=|ip=)([^?#\s]+)/.exec(pathLower))) {
			const 路径反代值 = 提取路径值(匹配[2]);
			if (!解析代理URL(路径反代值)) {
				设置反代IP(路径反代值);
				保存快照();
				return 反代上下文;
			}
		}
	}

	// M1-P0 path 覆盖 s（出站代理）：解析为链式代理 URL，或作为反代IP（p 优先）
	if (s覆盖 !== null && s覆盖) {
		if (解析代理URL(s覆盖, true)) {
			启用反代兜底 = false;
			反代上下文.覆盖参数.出站代理 = s覆盖;
		} else if (!写入了p) {
			设置反代IP(s覆盖);
			反代上下文.覆盖参数.出站代理 = s覆盖;
		}
	}

	if (!我的SOCKS5账号) {
		启用SOCKS5反代 = null;
		保存快照();
		return 反代上下文;
	}

	try {
		parsedSocks5Address = await 获取SOCKS5账号(我的SOCKS5账号, 获取代理默认端口(启用SOCKS5反代));
		if (searchParams.get('socks5')) 启用SOCKS5反代 = 'socks5';
		else if (searchParams.get('http')) 启用SOCKS5反代 = 'http';
		else if (searchParams.get('https')) 启用SOCKS5反代 = 'https';
		else if (searchParams.get('turn')) 启用SOCKS5反代 = 'turn';
		else if (searchParams.get('sstp')) 启用SOCKS5反代 = 'sstp';
		else 启用SOCKS5反代 = 启用SOCKS5反代 || 'socks5';
	} catch (err) {
		console.error('解析SOCKS5地址失败:', err.message);
		启用SOCKS5反代 = null;
	}
	保存快照();
	return 反代上下文;
}

export { 反代参数获取 };
