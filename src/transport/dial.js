import { 数据转Uint8Array, 有效数据长度 } from '../core/bytes.js';
import { log } from '../core/context.js';
import { connect as cloudflareConnect } from 'cloudflare:sockets';
function isSpeedTestSite(hostname) {
	const speedTestDomains = ['speed.cloudflare.com', 'cp.cloudflare.com'];
	hostname = hostname.toLowerCase();
	return speedTestDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
}

function 构造本地204响应(respHeader = null) {
	const 本地204响应 = new TextEncoder().encode(
		'HTTP/1.1 204 No Content\r\n' +
		'Content-Length: 0\r\n' +
		'Connection: close\r\n' +
		'\r\n'
	);
	if (有效数据长度(respHeader) === 0) return 本地204响应;
	const 协议响应头 = 数据转Uint8Array(respHeader);
	const response = new Uint8Array(协议响应头.byteLength + 本地204响应.byteLength);
	response.set(协议响应头, 0);
	response.set(本地204响应, 协议响应头.byteLength);
	log(`[TCP转发] 构造本地204响应: ${response.byteLength}B`);
	return response;
}

function 构造WS本地204响应(respHeader = null) {
	const WS本地204响应 = new TextEncoder().encode(
		'HTTP/1.1 204 No Content\r\n' +
		'Content-Length: 0\r\n' +
		'Connection: keep-alive\r\n' +
		'\r\n'
	);
	if (有效数据长度(respHeader) === 0) return WS本地204响应;
	const 协议响应头 = 数据转Uint8Array(respHeader);
	const response = new Uint8Array(协议响应头.byteLength + WS本地204响应.byteLength);
	response.set(协议响应头, 0);
	response.set(WS本地204响应, 协议响应头.byteLength);
	return response;
}

///////////////////////////////////////////////////////SOCKS5/HTTP函数///////////////////////////////////////////////
async function socks5ConnectRaw(targetHost, targetPort, initialData, TCP连接, parsedSocks5) {
	const { username, password, hostname, port } = parsedSocks5 || {};
	const socket = TCP连接({ hostname, port }), writer = socket.writable.getWriter(), reader = socket.readable.getReader();
	try {
		const authMethods = username && password ? new Uint8Array([0x05, 0x02, 0x00, 0x02]) : new Uint8Array([0x05, 0x01, 0x00]);
		await writer.write(authMethods);
		let response = await reader.read();
		if (response.done || response.value.byteLength < 2) throw new Error('S5 method selection failed');

		const selectedMethod = new Uint8Array(response.value)[1];
		if (selectedMethod === 0x02) {
			if (!username || !password) throw new Error('S5 requires authentication');
			const userBytes = new TextEncoder().encode(username), passBytes = new TextEncoder().encode(password);
			const authPacket = new Uint8Array([0x01, userBytes.length, ...userBytes, passBytes.length, ...passBytes]);
			await writer.write(authPacket);
			response = await reader.read();
			if (response.done || new Uint8Array(response.value)[1] !== 0x00) throw new Error('S5 authentication failed');
		} else if (selectedMethod !== 0x00) throw new Error(`S5 unsupported auth method: ${selectedMethod}`);

		const hostBytes = new TextEncoder().encode(targetHost);
		const connectPacket = new Uint8Array([0x05, 0x01, 0x00, 0x03, hostBytes.length, ...hostBytes, targetPort >> 8, targetPort & 0xff]);
		await writer.write(connectPacket);
		response = await reader.read();
		if (response.done || new Uint8Array(response.value)[1] !== 0x00) throw new Error('S5 connection failed');

		if (有效数据长度(initialData) > 0) await writer.write(initialData);
		writer.releaseLock(); reader.releaseLock();
		return socket;
	} catch (error) {
		try { writer.releaseLock() } catch (e) { }
		try { reader.releaseLock() } catch (e) { }
		try { socket.close() } catch (e) { }
		throw error;
	}
}

async function httpConnectRaw(targetHost, targetPort, initialData, HTTPS代理 = false, TCP连接, parsedSocks5) {
	const { username, password, hostname, port } = parsedSocks5 || {};
	const socket = HTTPS代理
		? TCP连接({ hostname, port }, { secureTransport: 'on', allowHalfOpen: false })
		: TCP连接({ hostname, port });
	const writer = socket.writable.getWriter(), reader = socket.readable.getReader();
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	try {
		if (HTTPS代理) await socket.opened;

		const auth = username && password ? `Proxy-Authorization: Basic ${btoa(`${username}:${password}`)}\r\n` : '';
		const request = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n${auth}User-Agent: Mozilla/5.0\r\nConnection: keep-alive\r\n\r\n`;
		await writer.write(encoder.encode(request));
		writer.releaseLock();

		let responseBuffer = new Uint8Array(0), headerEndIndex = -1, bytesRead = 0;
		while (headerEndIndex === -1 && bytesRead < 8192) {
			const { done, value } = await reader.read();
			if (done || !value) throw new Error(`${HTTPS代理 ? 'HTTPS' : 'HTTP'} 代理在返回 CONNECT 响应前关闭连接`);
			responseBuffer = new Uint8Array([...responseBuffer, ...value]);
			bytesRead = responseBuffer.length;
			const crlfcrlf = responseBuffer.findIndex((_, i) => i < responseBuffer.length - 3 && responseBuffer[i] === 0x0d && responseBuffer[i + 1] === 0x0a && responseBuffer[i + 2] === 0x0d && responseBuffer[i + 3] === 0x0a);
			if (crlfcrlf !== -1) headerEndIndex = crlfcrlf + 4;
		}

		if (headerEndIndex === -1) throw new Error('代理 CONNECT 响应头过长或无效');
		const statusMatch = decoder.decode(responseBuffer.slice(0, headerEndIndex)).split('\r\n')[0].match(/HTTP\/\d\.\d\s+(\d+)/);
		const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : NaN;
		if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) throw new Error(`Connection failed: HTTP ${statusCode}`);

		reader.releaseLock();

		if (有效数据长度(initialData) > 0) {
			const 远端写入器 = socket.writable.getWriter();
			await 远端写入器.write(initialData);
			远端写入器.releaseLock();
		}

		// CONNECT 响应头后可能夹带隧道数据，先回灌到可读流，避免首包被吞。
		if (bytesRead > headerEndIndex) {
            const upstream = socket.readable.getReader();
            const readable = new ReadableStream({
                start(controller) { controller.enqueue(responseBuffer.subarray(headerEndIndex, bytesRead)); },
                async pull(controller) {
                    try { const { done, value } = await upstream.read(); if (done) { upstream.releaseLock(); controller.close(); } else controller.enqueue(value); }
                    catch (error) { controller.error(error); await socket.close(); }
                },
                async cancel(reason) { try { await upstream.cancel(reason); } finally { upstream.releaseLock(); await socket.close(); } }
            });
			return { readable, writable: socket.writable, closed: socket.closed, close: () => socket.close() };
		}

		return socket;
	} catch (error) {
		try { writer.releaseLock() } catch (e) { }
		try { reader.releaseLock() } catch (e) { }
		try { socket.close() } catch (e) { }
		throw error;
	}
}

// HTTPS 统一由 Workers 原生 TLS 验证证书，不再使用自实现 TLS。
async function httpsConnect(targetHost, targetPort, initialData, TCP连接, parsedSocks5) {
 return httpConnect(targetHost, targetPort, initialData, true, TCP连接, parsedSocks5);
}

function 创建请求TCP连接器(request, connector = cloudflareConnect) {
 const deadline = Date.now() + 10000; let attempts = 0;
 return (options, init) => {
  if (++attempts > 8 || Date.now() >= deadline) throw new Error('出站连接预算耗尽');
  return connector(options, init);
 };
}

// 覆盖 SOCKS/HTTP 协商的总时限，网络对端不回包时也能释放 socket。
async function 有限代理握手(action, connector, timeoutMs = 10000) {
 const sockets = new Set(); let expired = false, timer;
 const scopedConnect = (...args) => {
  if (expired) throw new Error('代理握手超时');
  const socket = connector(...args); sockets.add(socket); return socket;
 };
 const task = action(scopedConnect);
 try {
  return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => {
   expired = true; for (const s of sockets) Promise.resolve(s.close()).catch(()=>{});
   reject(new Error('代理握手超时'));
  }, timeoutMs); })]);
 } finally { clearTimeout(timer); task.then(s=>{if(expired) return s?.close?.();}).catch(()=>{}); }
}

function socks5Connect(host, port, data, connector, proxy) { return 有限代理握手(c => socks5ConnectRaw(host, port, data, c, proxy), connector); }
function httpConnect(host, port, data, tls, connector, proxy) { return 有限代理握手(c => httpConnectRaw(host, port, data, tls, c, proxy), connector); }

// M1-P2：面板测速用 TCP 连通探测。只做 connect 计时（I/O 等待），不发送数据；
// cloudflare:sockets 仍只在 dial.js 导入（MODULES.md 边界）。连接失败也返回耗时供前端展示。
async function TCP连接延迟(主机, 端口, 超时毫秒 = 3000) {
	const 开始 = performance.now();
	try {
		const socket = cloudflareConnect({ hostname: 主机, port: 端口 });
		await Promise.race([
			socket.opened,
			new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 超时毫秒)),
		]);
		const ms = Math.max(0, Math.round(performance.now() - 开始));
		setTimeout(() => { try { socket.close(); } catch (e) { } }, 0);
		return { ok: true, ms };
	} catch (error) {
		return { ok: false, ms: Math.max(0, Math.round(performance.now() - 开始)), error: String(error?.message || error).slice(0, 120) };
	}
}

export { httpConnect, isSpeedTestSite, socks5Connect, 创建请求TCP连接器, 有限代理握手, TCP连接延迟, 构造WS本地204响应, 构造本地204响应 };
