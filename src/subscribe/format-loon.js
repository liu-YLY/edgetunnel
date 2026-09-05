/*# anchor: M1-P1 Loon 订阅热补丁（转换器输出 → 字段级修正，可靠性优先） */
// Loon 配置文件为注册表式（[section] + key = value 行）。本函数只做字段级修正，不做整段重写：
//  1) [Proxy] 节点行的服务器（host）域名为裸 IPv6 时补方括号；
//  2) 需要跳过证书验证时补齐 skip-cert-verify=true（trojan/vless/vmess 行）。
//  其余内容原样透传。策略组/规则集由 SUBAPI 转换器输出携带（Loon 目标自带 [Proxy Group]）。
function Loon订阅配置文件热补丁(content, url, config_JSON) {
	if (typeof content !== 'string') content = String(content);
	const 行 = content.replace(/\r\n/g, '\n').split('\n');
	let 在Proxy段 = false;
	const 输出 = 行.map(原行 => {
		const 剥离 = 原行.trim();
		if (/^\[Proxy\]\s*$/i.test(剥离)) { 在Proxy段 = true; return 原行; }
		if (/^\[[a-z0-9_ -]+\]\s*$/i.test(剥离)) { 在Proxy段 = /^\[Proxy\]\s*$/i.test(剥离); return 原行; }
		if (在Proxy段 && /,/.test(剥离) && /^\S+\s*=/.test(剥离) && !/^#/.test(剥离)) {
			return 修正Loon节点行(原行, config_JSON);
		}
		return 原行;
	});
	let 结果 = 输出.join('\n');
	if (结果.length && !结果.endsWith('\n')) 结果 += '\n';
	return 结果;
}
function 修正Loon节点行(原行, config_JSON) {
	const 等号 = 原行.indexOf('=');
	if (等号 === -1) return 原行;
	let 服务器段 = 原行.slice(等号 + 1);
	const 逗号分段 = 服务器段.split(',');
	if (逗号分段.length >= 3) {
		// 逗号分段[0]=type, [1]=HOST, [2]=PORT，其后为 opt=val
		let HOST = 逗号分段[1].trim();
		if (HOST.includes(':') && !(HOST.startsWith('[') && HOST.endsWith(']'))) HOST = '[' + HOST + ']';
		逗号分段[1] = HOST;
		let 尾段 = 逗号分段.slice(2).join(',');
		if (config_JSON && config_JSON.跳过证书验证 && /(trojan|vless|vmess)/i.test(逗号分段[0]) && !/\bskip-cert-verify\s*=\s*true/i.test(尾段)) {
			尾段 = 尾段.trim().replace(/\s+$/, '');
			尾段 = 尾段 + (尾段 ? ', ' : '') + 'skip-cert-verify=true';
		}
		服务器段 = 逗号分段[0] + ',' + 逗号分段[1] + ',' + 尾段;
	}
	return 原行.slice(0, 等号 + 1) + 服务器段;
}