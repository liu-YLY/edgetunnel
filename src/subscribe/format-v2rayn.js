/*# anchor: M1-P1 V2rayN / V2rayNG 直出明文订阅（零转换器依赖，复用节点链接生成器） */
// 输入为现有"协议类型://..." 链接生成器产出的逐行节点（vless:// / trojan://），
// V2rayN / V2rayNG 原生支持 vless 链接列表，本函数仅过滤合法节点行并拼为 text/plain。
function 生成V2rayN订阅(节点链接列表, 完整节点路径, config_JSON) {
	const 行数组 = (Array.isArray(节点链接列表) ? 节点链接列表 : String(节点链接列表).split('\n'))
		.map(行 => 行.trim())
		.filter(行 => 行.startsWith('vless://') || 行.startsWith('trojan://'));
	return 行数组.join('\n') + (行数组.length ? '\n' : '');
}