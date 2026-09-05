/*# anchor: M1-P1 Shadowrocket 直出明文订阅（零转换器依赖，复用节点链接生成器） */
// 输入为现有"协议类型://..." 链接生成器产出的逐行节点（vless:// / trojan://，每行含 # 备注），
// 本函数仅过滤出合法节点行并拼为 text/plain。参数 完整节点路径 / config_JSON 保留以对齐统一签名。
function 生成Shadowrocket订阅(节点链接列表, 完整节点路径, config_JSON) {
	const 行数组 = (Array.isArray(节点链接列表) ? 节点链接列表 : String(节点链接列表).split('\n'))
		.map(行 => 行.trim())
		.filter(行 => 行.startsWith('vless://') || 行.startsWith('trojan://'));
	return 行数组.join('\n') + (行数组.length ? '\n' : '');
}