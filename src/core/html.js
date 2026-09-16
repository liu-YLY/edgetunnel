function 掩码敏感信息(文本, 前缀长度 = 3, 后缀长度 = 2) {
	if (!文本 || typeof 文本 !== 'string') return 文本;
	if (文本.length <= 前缀长度 + 后缀长度) return 文本; // 如果长度太短，直接返回

	const 前缀 = 文本.slice(0, 前缀长度);
	const 后缀 = 文本.slice(-后缀长度);
	const 星号数量 = 文本.length - 前缀长度 - 后缀长度;

	return `${前缀}${'*'.repeat(星号数量)}${后缀}`;
}

function 转义HTML(value) { return value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

export { 掩码敏感信息, 转义HTML };
