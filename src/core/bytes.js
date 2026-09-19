function 数据转Uint8Array(data) {
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return new Uint8Array(data || 0);
}

function 拼接字节数据(...chunkList) {
	if (!chunkList || chunkList.length === 0) return new Uint8Array(0);
	const chunks = chunkList.map(数据转Uint8Array);
	const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) { result.set(c, offset); offset += c.byteLength }
	return result;
}

function 有效数据长度(data) {
	if (!data) return 0;
	if (typeof data.byteLength === 'number') return data.byteLength;
	if (typeof data.length === 'number') return data.length;
	return 0;
}

// 可增长缓冲：流式帧重组用，避免"每收到一块就整段拷贝"的 O(n²) 累积。
// 追加时按需扩容并保留未消费区；读指针落后过多时原地前移，防止长期占用大背衬数组。
// 注意：视图() 返回的 subarray 指向内部背衬数组，跨 await 持有后若再次 追加() 可能失效；
// 调用方应在读取后立即提取独立副本或完成消费，再进入下一轮追加。
function 创建可增长缓冲(初始容量 = 1024) {
	let 数据 = new Uint8Array(初始容量), 读索引 = 0, 写索引 = 0;
	const 缓冲对象 = {
		get 剩余字节数() { return 写索引 - 读索引; },
		追加(chunk) {
			const 块 = 数据转Uint8Array(chunk);
			if (!块.byteLength) return;
			const 可用 = 数据.byteLength - 写索引;
			if (块.byteLength > 可用) {
				const 未消费 = 写索引 - 读索引;
				if (未消费 + 块.byteLength > 数据.byteLength) {
					const 新数据 = new Uint8Array(Math.max(数据.byteLength * 2, 未消费 + 块.byteLength));
					新数据.set(数据.subarray(读索引, 写索引), 0);
					数据 = 新数据;
					读索引 = 0;
					写索引 = 未消费;
				} else if (读索引 > 0) {
					数据.copyWithin(0, 读索引, 写索引);
					写索引 -= 读索引;
					读索引 = 0;
				}
			} else if (读索引 > 0 && 读索引 * 2 >= 写索引) {
				数据.copyWithin(0, 读索引, 写索引);
				写索引 -= 读索引;
				读索引 = 0;
			}
			数据.set(块, 写索引);
			写索引 += 块.byteLength;
		},
		消费(n) {
			读索引 = Math.min(写索引, 读索引 + n);
			if (读索引 >= 写索引) { 读索引 = 0; 写索引 = 0; }
		},
		视图() { return 数据.subarray(读索引, 写索引); },
	};
	return 缓冲对象;
}

function formatIdentifier(arr, offset = 0) {
	const hex = [...arr.slice(offset, offset + 16)].map(b => b.toString(16).padStart(2, '0')).join('');
	return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

export { 创建可增长缓冲, 拼接字节数据, 数据转Uint8Array, 有效数据长度 };
