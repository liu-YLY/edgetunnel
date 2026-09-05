/*# anchor: 原 _worker.js L5833-6294 */
function 识别运营商(request) {
	const cf = request?.cf;
	const ASN运营商映射 = {
		'4134': 'ct',
		'4809': 'ct',
		'4811': 'ct',
		'4812': 'ct',
		'4815': 'ct',
		'4837': 'cu',
		'4814': 'cu',
		'9929': 'cu',
		'17623': 'cu',
		'17816': 'cu',
		'9808': 'cmcc',
		'24400': 'cmcc',
		'56040': 'cmcc',
		'56041': 'cmcc',
		'56044': 'cmcc',
	};
	const 运营商关键词映射 = [
		{ code: 'ct', pattern: /chinanet|chinatelecom|china telecom|cn2|shtel/ },
		{ code: 'cmcc', pattern: /cmi|cmnet|chinamobile|china mobile|cmcc|mobile communications/ },
		{ code: 'cu', pattern: /china169|china unicom|chinaunicom|cucc|cncgroup|cuii|netcom/ },
	];
	if (String(cf?.country || '').toLowerCase() !== 'cn') return 'cf';
	const 组织名称 = String(cf?.asOrganization || '').toLowerCase();
	const 命中运营商 = 运营商关键词映射.find(({ pattern }) => pattern.test(组织名称))?.code;
	return 命中运营商 || ASN运营商映射[String(cf?.asn || '')] || 'cf';
}

async function 生成随机IP(request, count = 16, 指定端口 = -1) {
	const url = new URL(request.url);
	const 查询参数运营商 = String(url.searchParams.get('cnIspCode') || '').toLowerCase();
	const 运营商文件标识 = ['ct', 'cu', 'cmcc', 'cf'].includes(查询参数运营商) ? 查询参数运营商 : 识别运营商(request);
	const 运营商名称映射 = {
		cmcc: 'CF移动优选',
		cu: 'CF联通优选',
		ct: 'CF电信优选',
		cf: 'CF官方优选',
	};
	const cidr_url = 运营商文件标识 === 'cf' ? `https://raw.githubusercontent.com/${特征码字典[1]}/${特征码字典[1]}/main/CF-CIDR.txt` : `https://raw.githubusercontent.com/${特征码字典[1]}/${特征码字典[1]}/main/CF-CIDR/${运营商文件标识}.txt`;
	const cfname = 运营商名称映射[运营商文件标识] || 'CF官方优选';
	const cfport = [443, 2053, 2083, 2087, 2096, 8443];
	let cidrList = [];
	try { const res = await fetch(cidr_url); cidrList = res.ok ? await 整理成数组(await res.text()) : ['104.16.0.0/13'] } catch { cidrList = ['104.16.0.0/13'] }

	const generateRandomIPFromCIDR = (cidr) => {
		const [baseIP, prefixLength] = cidr.split('/'), prefix = parseInt(prefixLength), hostBits = 32 - prefix;
		const ipInt = baseIP.split('.').reduce((a, p, i) => a | (parseInt(p) << (24 - i * 8)), 0);
		const randomOffset = Math.floor(Math.random() * Math.pow(2, hostBits));
		const mask = (0xFFFFFFFF << hostBits) >>> 0, randomIP = (((ipInt & mask) >>> 0) + randomOffset) >>> 0;
		return [(randomIP >>> 24) & 0xFF, (randomIP >>> 16) & 0xFF, (randomIP >>> 8) & 0xFF, randomIP & 0xFF].join('.');
	};
	const randomIPs = Array.from({ length: count }, (_, index) => {
		const ip = generateRandomIPFromCIDR(cidrList[Math.floor(Math.random() * cidrList.length)]);
		const 目标端口 = 指定端口 === -1
			? cfport[Math.floor(Math.random() * cfport.length)]
			: 指定端口;
		return `${ip}:${目标端口}#${cfname}${index + 1}`;
	});
	return [randomIPs, randomIPs.join('\n')];
}

async function 整理成数组(内容) {
	var 替换后的内容 = 内容.replace(/[	"'\r\n]+/g, ',').replace(/,+/g, ',');
	if (替换后的内容.charAt(0) == ',') 替换后的内容 = 替换后的内容.slice(1);
	if (替换后的内容.charAt(替换后的内容.length - 1) == ',') 替换后的内容 = 替换后的内容.slice(0, 替换后的内容.length - 1);
	const 地址数组 = 替换后的内容.split(',');
	return 地址数组;
}

async function 获取优选订阅生成器数据(优选订阅生成器HOST) {
	let 优选IP = [], 其他节点LINK = '', 格式化HOST = 优选订阅生成器HOST.replace(/^sub:\/\//i, 'https://').split('#')[0].split('?')[0];
	if (!/^https?:\/\//i.test(格式化HOST)) 格式化HOST = `https://${格式化HOST}`;

	try {
		const url = new URL(格式化HOST);
		格式化HOST = url.origin;
	} catch (error) {
		优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST}优选订阅生成器格式化异常:${error.message}`);
		return [优选IP, 其他节点LINK];
	}

	const 优选订阅生成器URL = `${格式化HOST}/sub?host=example.com&uuid=00000000-0000-4000-8000-000000000000`;

	try {
		const response = await fetch(优选订阅生成器URL, {
			headers: { 'User-Agent': 'v2rayN/edge' + 'tunnel (https://github.com/' + 特征码字典[1] + '/edge' + 'tunnel)' }
		});

		if (!response.ok) {
			优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST}优选订阅生成器异常:${response.statusText}`);
			return [优选IP, 其他节点LINK];
		}

		const 优选订阅生成器返回订阅内容 = atob(await response.text());
		const 订阅行列表 = 优选订阅生成器返回订阅内容.includes('\r\n')
			? 优选订阅生成器返回订阅内容.split('\r\n')
			: 优选订阅生成器返回订阅内容.split('\n');

		for (const 行内容 of 订阅行列表) {
			if (!行内容.trim()) continue; // 跳过空行
			if (行内容.includes('00000000-0000-4000-8000-000000000000') && 行内容.includes('example.com')) {
				// 这是优选IP行，提取 域名:端口#备注
				const 地址匹配 = 行内容.match(/:\/\/[^@]+@([^?]+)/);
				if (地址匹配) {
					let 地址端口 = 地址匹配[1], 备注 = ''; // 域名:端口 或 IP:端口
					const 备注匹配 = 行内容.match(/#(.+)$/);
					if (备注匹配) 备注 = '#' + decodeURIComponent(备注匹配[1]);
					优选IP.push(地址端口 + 备注);
				}
			} else {
				其他节点LINK += 行内容 + '\n';
			}
		}
	} catch (error) {
		优选IP.push(`127.0.0.1:1234#${优选订阅生成器HOST}优选订阅生成器异常:${error.message}`);
	}

	return [优选IP, 其他节点LINK];
}

async function 请求优选API(urls, 默认端口 = '443', 超时时间 = 3000) {
	if (!urls?.length) return [[], [], [], []];
	const results = new Set(), 反代IP池 = new Set();
	let 订阅链接响应的明文LINK内容 = '', 需要订阅转换订阅URLs = [];
	await Promise.allSettled(urls.map(async (url) => {
		// 检查URL是否包含备注名
		const hashIndex = url.indexOf('#');
		const urlWithoutHash = hashIndex > -1 ? url.substring(0, hashIndex) : url;
		const API备注名 = hashIndex > -1 ? decodeURIComponent(url.substring(hashIndex + 1)) : null;
		const 优选IP作为反代IP = url.toLowerCase().includes('proxyip=true');
		if (urlWithoutHash.toLowerCase().startsWith('sub://')) {
			try {
				const [优选IP, 其他节点LINK] = await 获取优选订阅生成器数据(urlWithoutHash);
				// 处理第一个数组 - 优选IP
				if (API备注名) {
					for (const ip of 优选IP) {
						const 处理后IP = ip.includes('#')
							? `${ip} [${API备注名}]`
							: `${ip}#[${API备注名}]`;
						results.add(处理后IP);
						if (优选IP作为反代IP) 反代IP池.add(ip.split('#')[0]);
					}
				} else {
					for (const ip of 优选IP) {
						results.add(ip);
						if (优选IP作为反代IP) 反代IP池.add(ip.split('#')[0]);
					}
				}
				// 处理第二个数组 - 其他节点LINK
				if (其他节点LINK && typeof 其他节点LINK === 'string' && API备注名) {
					const 处理后LINK内容 = 其他节点LINK.replace(/([a-z][a-z0-9+\-.]*:\/\/[^\r\n]*?)(\r?\n|$)/gi, (match, link, lineEnd) => {
						const 完整链接 = link.includes('#')
							? `${link}${encodeURIComponent(` [${API备注名}]`)}`
							: `${link}${encodeURIComponent(`#[${API备注名}]`)}`;
						return `${完整链接}${lineEnd}`;
					});
					订阅链接响应的明文LINK内容 += 处理后LINK内容;
				} else if (其他节点LINK && typeof 其他节点LINK === 'string') {
					订阅链接响应的明文LINK内容 += 其他节点LINK;
				}
			} catch (e) { }
			return;
		}

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 超时时间);
			const response = await fetch(urlWithoutHash, { signal: controller.signal });
			clearTimeout(timeoutId);
			let text = '';
			try {
				const buffer = await response.arrayBuffer();
				const contentType = (response.headers.get('content-type') || '').toLowerCase();
				const charset = contentType.match(/charset=([^\s;]+)/i)?.[1]?.toLowerCase() || '';

				// 根据 Content-Type 响应头判断编码优先级
				let decoders = ['utf-8', 'gb2312']; // 默认优先 UTF-8
				if (charset.includes('gb') || charset.includes('gbk') || charset.includes('gb2312')) {
					decoders = ['gb2312', 'utf-8']; // 如果明确指定 GB 系编码，优先尝试 GB2312
				}

				// 尝试多种编码解码
				let decodeSuccess = false;
				for (const decoder of decoders) {
					try {
						const decoded = new TextDecoder(decoder).decode(buffer);
						// 验证解码结果的有效性
						if (decoded && decoded.length > 0 && !decoded.includes('\ufffd')) {
							text = decoded;
							decodeSuccess = true;
							break;
						} else if (decoded && decoded.length > 0) {
							// 如果有替换字符 (U+FFFD)，说明编码不匹配，继续尝试下一个编码
							continue;
						}
					} catch (e) {
						// 该编码解码失败，尝试下一个
						continue;
					}
				}

				// 如果所有编码都失败或无效，尝试 response.text()
				if (!decodeSuccess) {
					text = await response.text();
				}

				// 如果返回的是空或无效数据，返回
				if (!text || text.trim().length === 0) {
					return;
				}
			} catch (e) {
				console.error('Failed to decode response:', e);
				return;
			}

			// 预处理订阅内容
			/*
			if (text.includes('proxies:') || (text.includes('outbounds"') && text.includes('inbounds"'))) {// Clash Singbox 配置
				需要订阅转换订阅URLs.add(url);
				return;
			}
			*/

			let 预处理订阅明文内容 = text;
			const cleanText = typeof text === 'string' ? text.replace(/\s/g, '') : '';
			if (cleanText.length > 0 && cleanText.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(cleanText)) {
				try {
					const bytes = new Uint8Array(atob(cleanText).split('').map(c => c.charCodeAt(0)));
					预处理订阅明文内容 = new TextDecoder('utf-8').decode(bytes);
				} catch { }
			}
			if (预处理订阅明文内容.split('#')[0].includes('://')) {
				// 处理LINK内容
				if (API备注名) {
					const 处理后LINK内容 = 预处理订阅明文内容.replace(/([a-z][a-z0-9+\-.]*:\/\/[^\r\n]*?)(\r?\n|$)/gi, (match, link, lineEnd) => {
						const 完整链接 = link.includes('#')
							? `${link}${encodeURIComponent(` [${API备注名}]`)}`
							: `${link}${encodeURIComponent(`#[${API备注名}]`)}`;
						return `${完整链接}${lineEnd}`;
					});
					订阅链接响应的明文LINK内容 += 处理后LINK内容 + '\n';
				} else {
					订阅链接响应的明文LINK内容 += 预处理订阅明文内容 + '\n';
				}
				return;
			}

			const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
			const isCSV = lines.length > 1 && lines[0].includes(',');
			const IPV6_PATTERN = /^[^\[\]]*:[^\[\]]*:[^\[\]]/;
			const parsedUrl = new URL(urlWithoutHash);
			if (!isCSV) {
				lines.forEach(line => {
					const lineHashIndex = line.indexOf('#');
					const [hostPart, remark] = lineHashIndex > -1 ? [line.substring(0, lineHashIndex), line.substring(lineHashIndex)] : [line, ''];
					let hasPort = false;
					if (hostPart.startsWith('[')) {
						hasPort = /\]:(\d+)$/.test(hostPart);
					} else {
						const colonIndex = hostPart.lastIndexOf(':');
						hasPort = colonIndex > -1 && /^\d+$/.test(hostPart.substring(colonIndex + 1));
					}
					const port = parsedUrl.searchParams.get('port') || 默认端口;
					const ipItem = hasPort ? line : `${hostPart}:${port}${remark}`;
					// 处理第一个数组 - 优选IP
					if (API备注名) {
						const 处理后IP = ipItem.includes('#')
							? `${ipItem} [${API备注名}]`
							: `${ipItem}#[${API备注名}]`;
						results.add(处理后IP);
					} else {
						results.add(ipItem);
					}
					if (优选IP作为反代IP) 反代IP池.add(ipItem.split('#')[0]);
				});
			} else {
				const headers = lines[0].split(',').map(h => h.trim());
				const dataLines = lines.slice(1);
				if (headers.includes('IP地址') && headers.includes('端口') && headers.includes('数据中心')) {
					const ipIdx = headers.indexOf('IP地址'), portIdx = headers.indexOf('端口');
					const remarkIdx = headers.indexOf('国家') > -1 ? headers.indexOf('国家') :
						headers.indexOf('城市') > -1 ? headers.indexOf('城市') : headers.indexOf('数据中心');
					const tlsIdx = headers.indexOf('TLS');
					dataLines.forEach(line => {
						const cols = line.split(',').map(c => c.trim());
						if (tlsIdx !== -1 && cols[tlsIdx]?.toLowerCase() !== 'true') return;
						const wrappedIP = IPV6_PATTERN.test(cols[ipIdx]) ? `[${cols[ipIdx]}]` : cols[ipIdx];
						const ipItem = `${wrappedIP}:${cols[portIdx]}#${cols[remarkIdx]}`;
						// 处理第一个数组 - 优选IP
						if (API备注名) {
							const 处理后IP = `${ipItem} [${API备注名}]`;
							results.add(处理后IP);
						} else {
							results.add(ipItem);
						}
						if (优选IP作为反代IP) 反代IP池.add(`${wrappedIP}:${cols[portIdx]}`);
					});
				} else if (headers.some(h => h.includes('IP')) && headers.some(h => h.includes('延迟')) && headers.some(h => h.includes('下载速度'))) {
					const ipIdx = headers.findIndex(h => h.includes('IP'));
					const delayIdx = headers.findIndex(h => h.includes('延迟'));
					const speedIdx = headers.findIndex(h => h.includes('下载速度'));
					const port = parsedUrl.searchParams.get('port') || 默认端口;
					dataLines.forEach(line => {
						const cols = line.split(',').map(c => c.trim());
						const wrappedIP = IPV6_PATTERN.test(cols[ipIdx]) ? `[${cols[ipIdx]}]` : cols[ipIdx];
						const ipItem = `${wrappedIP}:${port}#CF优选 ${cols[delayIdx]}ms ${cols[speedIdx]}MB/s`;
						// 处理第一个数组 - 优选IP
						if (API备注名) {
							const 处理后IP = `${ipItem} [${API备注名}]`;
							results.add(处理后IP);
						} else {
							results.add(ipItem);
						}
						if (优选IP作为反代IP) 反代IP池.add(`${wrappedIP}:${port}`);
					});
				}
			}
		} catch (e) { }
	}));
	// 将LINK内容转换为数组并去重
	const LINK数组 = 订阅链接响应的明文LINK内容.trim() ? [...new Set(订阅链接响应的明文LINK内容.split(/\r?\n/).filter(line => line.trim() !== ''))] : [];
	return [Array.from(results), LINK数组, 需要订阅转换订阅URLs, Array.from(反代IP池)];
}

async function 反代参数获取(url, uuid, 默认反代IP = '', 默认反代兜底 = true) {
	const { searchParams } = url;
	const pathname = decodeURIComponent(url.pathname);
	const pathLower = pathname.toLowerCase();
	let 反代IP = 默认反代IP, 启用SOCKS5反代 = null, 启用SOCKS5全局反代 = false, 我的SOCKS5账号 = '', parsedSocks5Address = {}, 启用反代兜底 = 默认反代兜底;
	const 反代上下文 = { 木马反代地址: null, 反代IP, 代理类型: null, 代理账号: '', 代理全局: false, 代理参数: {}, 反代兜底: 启用反代兜底 };
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

