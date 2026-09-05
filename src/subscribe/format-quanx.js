/*# anchor: M1-P1 QuantumultX 订阅热补丁（转换器输出 → 字段级修正，可靠性优先） */
// QuanX 配置为 [server_local]+[filter_remote] 结构，节点行为 `KEY = 类型, HOST:PORT, opt=val,...`。
// 本函数只做字段级修正，不做整段重写：
//  1) over-tls 的 ws 节点补齐 ws-path / ws-headers（若缺失）；
//  2) 需要跳过证书验证时补齐 skip-cert-verify=true。
//  其余内容原样透传；远端规则由 SUBAPI 转换器输出的 [filter_remote] 携带（ACL4SSR 提供）。
function QuantumultX订阅配置文件热补丁(content, url, config_JSON) {
	if (typeof content !== 'string') content = String(content);
	const 路径值 = config_JSON && config_JSON.随机路径 ? 随机路径(config_JSON.完整节点路径) : (config_JSON && config_JSON.完整节点路径);
	const 行 = content.replace(/\r\n/g, '\n').split('\n');
	let 在服务器段 = false;
	const 输出 = 行.map(原行 => {
		const 剥离 = 原行.trim();
		if (/^\[server_local\]\s*$/i.test(剥离)) { 在服务器段 = true; return 原行; }
		if (/^\[[a-z0-9_ -]*\]\s*$/i.test(剥离)) { 在服务器段 = /^\[server_local\]\s*$/i.test(剥离); return 原行; }
		if (在服务器段 && /^\S+\s*=/.test(剥离) && !/^#/.test(剥离)) {
			const 等号 = 原行.indexOf('=');
			const 剩余 = 原行.slice(等号 + 1);
			if (/(trojan|vmess|vless)/i.test(剩余) && /over-tls\s*=\s*true/i.test(剩余)) {
				let 修正 = 剩余;
				if (/ws\s*=\s*true/i.test(修正) && !/ws-path\s*=/i.test(修正) && 路径值) {
					修正 = 修正.trim().replace(/\s+$/, '') + ', ws-path=' + String(路径值).replace(/,/g, '%2C') + ', ws-headers=Host:example.com';
				}
				if (config_JSON && config_JSON.跳过证书验证 && !/skip-cert-verify\s*=/i.test(修正)) {
					修正 = 修正.trim().replace(/\s+$/, '') + (修正.trim() ? ', ' : '') + 'skip-cert-verify=true';
				}
				return 原行.slice(0, 等号 + 1) + 修正;
			}
		}
		return 原行;
	});
	let 结果 = 输出.join('\n');
	if (结果.length && !结果.endsWith('\n')) 结果 += '\n';
	return 结果;
}