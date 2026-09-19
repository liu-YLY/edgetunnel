// 连通自检（fetch 类）：quick 并行检查外站可达性 + 落地IP识别 + 伪装页可达性。
// 注意：本模块属于 services 层，禁止直接使用 'cloudflare:sockets' 或引用 transport 层
//（依赖边界由 scripts/check-modules.cjs 强制）——socket 采样原语在 src/transport/dial.js，
// 由 main.js 编排时挂到 deep 结果上。

// quick 项：并行 fetch 检查某个外站的可达性。单项失败不抛错，统一记 { ok:false, error, ms }。
// 可达：拿到任何 HTTP 响应即视为网络可达（403/401 也能证明 TCP+TLS+HTTP 栈通）；
// ok：响应属于 2xx–3xx（对 baidu 等目标，403 反爬不应被当作"不可达"）。
async function 快捷访达检查(name, url) {
	const 起始 = Date.now();
	try {
		const 响应 = await fetch(url, { signal: AbortSignal.timeout(5000) });
		return {
			name,
			url,
			可达: true,
			ok: 响应.status >= 200 && 响应.status < 400,
			status: 响应.status,
			ms: Date.now() - 起始,
		};
	} catch (error) {
		const 是超时 = error?.name === 'TimeoutError' || /timeout/i.test(String(error?.message || error));
		return { name, url, 可达: false, ok: false, status: null, ms: Date.now() - 起始, error: 是超时 ? 'timeout' : String(error?.message || error) };
	}
}

// quick 落地识别：依次尝试多个 IP 服务，取首个成功；只健壮取数，容错优先。
async function 落地IP识别() {
	const 服务 = [
		{
			url: 'https://ipinfo.io/json',
			提取(json) { // { ip, city, country }
				const ip = json?.ip;
				if (!ip) return null;
				const 地区 = [json?.country, json?.city].filter(Boolean).join(' ');
				return { ip, 地区 };
			},
		},
		{
			url: 'https://api.ip.sb/geoip',
			提取(json) { // { ip, country_code, country_name }
				const ip = json?.ip;
				if (!ip) return null;
				const 地区 = [json?.country_name || json?.country].filter(Boolean).join(' ');
				return { ip, 地区 };
			},
		},
		{
			url: 'https://myip.ipip.net',
			提取(text) { // text，正则提取 IP
				const 匹配 = String(text).match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
				if (!匹配) return null;
				return { ip: 匹配[1], 地区: '' };
			},
		},
	];
	for (const 项 of 服务) {
		const 起始 = Date.now();
		try {
			const 响应 = await fetch(项.url, { signal: AbortSignal.timeout(5000) });
			if (!响应.ok) continue;
			const 内容 = 项.url.includes('ipip.net') ? await 响应.text() : await 响应.json();
			const 结果 = 项.提取(内容);
			if (结果) return { ...结果, ok: true, ms: Date.now() - 起始 };
		} catch (error) { /* 尝试下一个 */ }
	}
	return { ok: false, error: '全部 IP 服务不可达' };
}

// deep 伪装页：配置了伪装页才 fetch，采关键头。
async function 伪装页(配置) {
	if (!配置?.伪装页URL) return { ok: true, 跳过: '未配置伪装页URL' };
	try {
		const 响应 = await fetch(配置.伪装页URL, { signal: AbortSignal.timeout(5000) });
		return {
			ok: true,
			status: 响应.status,
			headers: {
				'content-type': 响应.headers.get('content-type'),
				server: 响应.headers.get('server'),
				有cfray: !!响应.headers.get('cf-ray'),
			},
		};
	} catch (error) {
		return { ok: false, status: null, error: String(error?.message || error) };
	}
}

export async function 执行自检(request, env, 配置, 深度 = false) {
	const quick = {};
	[quick['国内'], quick['国外'], quick['cf'], quick['twitter'], quick['chatgpt']] = await Promise.all([
		快捷访达检查('国内', 'https://www.baidu.com'),
		快捷访达检查('国外', 'https://www.gstatic.com/generate_204'),
		快捷访达检查('cf', 'https://cp.cloudflare.com/generate_204'),
		快捷访达检查('twitter', 'https://x.com'),
		快捷访达检查('chatgpt', 'https://chatgpt.com/'),
	]);
	quick['ip'] = await 落地IP识别();

	// deep 的 socket 采样（复用率/超时预算/代理建连）由 main.js 编排时从 transport/dial.js 挂入。
	return { at: new Date().toISOString(), quick, deep: 深度 ? { 伪装页: await 伪装页(配置) } : null };
}