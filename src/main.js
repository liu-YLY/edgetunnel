import { MD5MD5 } from './core/crypto.js';
import { html1101, nginx, 登录页面 } from './admin/pages.js';
import { 请求日志记录 } from './admin/panel.js';
import { 管理面板HTML } from './admin/ui/index.js';
import { 失效配置缓存, 用量缓存 } from './config/cache.js';
import { 全局读取配置, 读取config_JSON } from './config/index.js';
import { 保存配置 } from './config/store.js';
import { 读取用量历史, 写入用量快照 } from './services/usage-history.js';
import { 执行自检 } from './services/self-check.js';
import { Pages静态页面, Version, 特征码字典 } from './core/constants.js';
import { log, 请求存储 } from './core/context.js';
import { base64SecretEncode, 是拦截UA } from './core/options.js';
import { 替换星号为随机字符, 获取叉HTTPPadding标识 } from './core/paths.js';
import { 识别运营商 } from './core/strings.js';
import { 处理gRPC请求 } from './protocol/grpc.js';
import { 处理WS请求 } from './protocol/ws.js';
import { 处理叉HTTP请求 } from './protocol/xhttp.js';
import { 获取SOCKS5账号, 获取代理默认端口 } from './proxy/account.js';
import { 反代参数获取 } from './proxy/options.js';
import { 生成随机IP, 请求优选API } from './proxy/preferred.js';
import { 允许登录, 同源写请求, 签发会话, 读取管理JSON, 限长文本, 验证会话 } from './security.js';
import { getCloudflareUsage } from './services/usage.js';
import { Clash订阅配置文件热补丁 } from './subscribe/format-clash.js';
import { Loon订阅配置文件热补丁 } from './subscribe/format-loon.js';
import { 生成原生订阅 } from './subscribe/format-native.js';
import { QuantumultX订阅配置文件热补丁 } from './subscribe/format-quanx.js';
import { 生成Shadowrocket订阅 } from './subscribe/format-shadowrocket.js';
import { Singbox订阅配置文件热补丁 } from './subscribe/format-singbox.js';
import { Surge订阅配置文件热补丁 } from './subscribe/format-surge.js';
import { 生成V2rayN订阅 } from './subscribe/format-v2rayn.js';
import { 生成节点链接文本, 获取订阅节点列表, 订阅转换器目标, 识别订阅类型 } from './subscribe/nodes.js';
import { httpConnect, socks5Connect, 创建请求TCP连接器, 代理建连采样, 连接复用采样, 黑洞超时采样 } from './transport/dial.js';
import { sstpConnect, turnConnect } from './transport/proxy.js';
///////////////////////////////////////////////////////全局常量和工具函数///////////////////////////////////////////////

// 单连接上行缓冲上限 1MB；不是并发容量承诺，需计入所有队列和运行时内存。
// 合包目标 20KB 不变, 1MB 队列仍容纳约 50 个合包周期, 正常流无感知


///////////////////////////////////////////////////////查杀特征码///////////////////////////////////////////////

///////////////////////////////////////////////////////M1-P1 订阅客户端生成（订阅类型解析 / 节点链接复用 / 直出客户端）///////////////////////////////////////////////
// 订阅类型映射表：查询参数优先，再按 UA 关键词（顺序敏感，长词在前）。
// 仅用于"读出订阅类型"，不改变任何既有生成逻辑；存量 clash/singbox/surge 行为逐字不变。


// 订阅类型 → 转换器 target（SUBAPI）名映射（结构简单的客户端 shadowrocket/v2rayn 走直出，不进入转换器）

// 获取订阅节点列表：复用原有"本地生成 / 优选订阅生成器"两条数据链路，供 mixed 与直出客户端共用。

// 生成节点链接文本：复用原有"协议类型://..." 链接生成器（LINK 系列），供 mixed 与直出客户端共用，勿重写。

export default {
 async fetch(request, env, ctx) {
  const 配置 = await 全局读取配置(env, request, new URL(request.url));
  return 请求存储.run({ ...配置.运行配置, ctx }, async () => {
   try { return await 处理请求(request, env, ctx, 配置); }
   catch (error) {
    console.error(JSON.stringify({ event: 'request_error', name: error.name }));
    return new Response('请求处理失败', { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } });
   }
  });
 }
};
async function 处理请求(request, env, ctx, 配置) {
        let config_JSON;
		let 请求URL文本 = request.url.replace(/%5[Cc]/g, '').replace(/\\/g, '');
		const 请求URL锚点索引 = 请求URL文本.indexOf('#');
		const 请求URL主体部分 = 请求URL锚点索引 === -1 ? 请求URL文本 : 请求URL文本.slice(0, 请求URL锚点索引);
		if (!请求URL主体部分.includes('?') && /%3f/i.test(请求URL主体部分)) {
			const 请求URL锚点部分 = 请求URL锚点索引 === -1 ? '' : 请求URL文本.slice(请求URL锚点索引);
			请求URL文本 = 请求URL主体部分.replace(/%3f/i, '?') + 请求URL锚点部分;
		}
		const url = new URL(请求URL文本);
		const UA = request.headers.get('User-Agent') || 'null';
		const upgradeHeader = (request.headers.get('Upgrade') || '').toLowerCase(), contentType = (request.headers.get('content-type') || '').toLowerCase();
		const { 管理员密码, 加密秘钥, userID, host, hosts, 默认反代IP, 默认反代兜底, 出站模式, 官方直连地址池, 官方直连端口, envUUID, BEST_SUB, KV可用, 伪装页URL } = 配置;
		const 出站配置 = { 模式: 出站模式, 地址池: 官方直连地址池, 端口: 官方直连端口 };
		const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
		const 访问路径 = url.pathname.slice(1).toLowerCase();
		const 访问IP = request.headers.get('CF-Connecting-IP') || request.headers.get('True-Client-IP') || request.headers.get('X-Real-IP') || request.headers.get('X-Forwarded-For') || request.headers.get('Fly-Client-IP') || request.headers.get('X-Appengine-Remote-Addr') || request.headers.get('X-Cluster-Client-IP') || '未知IP';
		if (访问路径 === 'version') {// 版本信息接口
			const 请求UUID = (url.searchParams.get('uuid') || '').toLowerCase();
			if (uuidRegex.test(请求UUID)) {
				const 目标UUID = String(userID).toLowerCase();
				let 请求前8总和 = 0, 目标前8总和 = 0;
				for (let i = 0; i < 8; i++) {
					const 请求码 = 请求UUID.charCodeAt(i);
					请求前8总和 += 请求码 <= 57 ? 请求码 - 48 : 请求码 - 87;
					const 目标码 = 目标UUID.charCodeAt(i);
					目标前8总和 += 目标码 <= 57 ? 目标码 - 48 : 目标码 - 87;
				}
				if (请求前8总和 === 目标前8总和 && 请求UUID.slice(-12) === 目标UUID.slice(-12)) return new Response(JSON.stringify({ Version: Number(String(Version).replace(/\D+/g, '')) }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
			}
		} else if (管理员密码 && upgradeHeader === 'websocket') {// WebSocket代理
			const 反代上下文 = await 反代参数获取(url, userID, 默认反代IP, 默认反代兜底, 出站配置);
			log(`[WebSocket] 命中请求: ${url.pathname}${url.search}`);
			return await 处理WS请求(request, userID, url, 反代上下文);
		} else if (管理员密码 && !访问路径.startsWith('admin/') && 访问路径 !== 'login' && request.method === 'POST') {// gRPC/叉HTTP代理
			const 反代上下文 = await 反代参数获取(url, userID, 默认反代IP, 默认反代兜底, 出站配置);
			const { 头: 本机Padding头, 键: 本机Padding键 } = 获取叉HTTPPadding标识(userID);
			const 命中叉HTTP特征 = !!request.headers.get(本机Padding头) || !!url.searchParams.get(本机Padding键);
			if (!命中叉HTTP特征 && contentType.startsWith('application/grpc')) {
				log(`[gRPC] 命中请求: ${url.pathname}${url.search}`);
				return await 处理gRPC请求(request, userID, 反代上下文);
			}
			log(`[叉HTTP] 命中请求: ${url.pathname}${url.search}`);
			return await 处理叉HTTP请求(request, userID, 反代上下文);
		} else {
			if (url.protocol === 'http:') return Response.redirect(url.href.replace(`http://${url.hostname}`, `https://${url.hostname}`), 301);
			if (!管理员密码) return new Response('请配置 ADMIN Secret', { status:503, headers:{ 'Cache-Control':'no-store' } });
			if (KV可用) {
				const 区分大小写访问路径 = url.pathname.slice(1);
				if (区分大小写访问路径 === 加密秘钥 && 加密秘钥 !== '勿动此默认密钥，有需求请自行通过添加变量KEY进行修改') {//快速订阅
					const params = new URLSearchParams(url.search);
					params.set('token', await MD5MD5(host + userID));
					return new Response('重定向中...', { status: 302, headers: { 'Location': `/sub?${params.toString()}` } });
				} else if (访问路径 === 'login') {//处理登录页面和登录请求
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					if (await 验证会话(authCookie, 管理员密码, 加密秘钥, UA, url.hostname)) return new Response('重定向中...', { status: 302, headers: { 'Location': '/admin' } });
					if (request.method === 'POST') {
						if (!同源写请求(request)) return new Response('Forbidden', { status:403 });
                        if (!await 允许登录(env, request)) return new Response('请求过于频繁', { status:429, headers:{ 'Retry-After':'60' } });
                        const formData = await 限长文本(request, 4096);
						const params = new URLSearchParams(formData);
						const 输入密码 = params.get('password');
						if (输入密码 === (typeof 管理员密码 === 'string' ? 管理员密码.replace(/[\r\n]/g, '') : 管理员密码)) {
							// 密码正确，设置cookie并返回成功标记
							const 响应 = request.headers.get('Accept')?.includes('text/html')
                                ? new Response(null, { status:303, headers:{ Location:'/admin' } })
                                : Response.json({ success:true });
							响应.headers.set('Set-Cookie', `auth=${await 签发会话(管理员密码, 加密秘钥, UA, url.hostname)}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`);
							return 响应;
						}
					}
					return 登录页面(request.method === 'POST' ? '密码错误，请重试。' : '', request.method === 'POST' ? 401 : 200);
				} else if (访问路径 === 'admin' || 访问路径.startsWith('admin/')) {//验证cookie后响应管理页面
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					// 没有cookie或cookie错误，跳转到/login页面
					if (!await 验证会话(authCookie, 管理员密码, 加密秘钥, UA, url.hostname)) return new Response('重定向中...', { status: 302, headers: { 'Location': '/login' } });
					if (request.method === 'POST' && !同源写请求(request)) return new Response('Forbidden', { status:403 });
                    if (访问路径 === 'admin/log.json') {// 读取日志内容
						const 读取日志内容 = '[]'; // 旧 KV 日志不再回传，日志位于 Workers Logs
						return new Response(读取日志内容, { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (区分大小写访问路径 === 'admin/getCloudflareUsage') {// 查询请求量
						try {
							if (request.method !== 'POST') return new Response('请使用 POST JSON，凭据不能放在 URL', { status:405, headers:{ Allow:'POST' } });
                            const body = await 读取管理JSON(request);
                            // 面板只发送空对象：KV 里的凭据在配置对象中是掩码后的，无法回传前端。
                            // 因此缺省时回退到 KV cf.json 的原始凭据，与后台自动刷新同口径；
                            // 否则查询会因凭据为 undefined 直接返回 total:0，刷新按钮等于失效。
                            let 查询凭据 = { Email: body.Email, GlobalAPIKey: body.GlobalAPIKey, AccountID: body.AccountID, APIToken: body.APIToken, UsageAPI: body.UsageAPI };
                            const 凭据齐全 = 查询凭据.UsageAPI || 查询凭据.APIToken || 查询凭据.AccountID || (查询凭据.Email && 查询凭据.GlobalAPIKey);
                            if (!凭据齐全) {
                                try {
                                    const CF_TXT = await env.KV.get('cf.json');
                                    if (CF_TXT) { const c = JSON.parse(CF_TXT); 查询凭据 = { Email: c.Email, GlobalAPIKey: c.GlobalAPIKey, AccountID: c.AccountID, APIToken: c.APIToken, UsageAPI: c.UsageAPI }; }
                                } catch (e) { /* 回退失败按未配置处理 */ }
                            }
                            if (!(查询凭据.UsageAPI || 查询凭据.APIToken || 查询凭据.AccountID || (查询凭据.Email && 查询凭据.GlobalAPIKey))) {
                                return new Response(JSON.stringify({ success: false, error: '未配置 Cloudflare 查询凭据：请在运维页填写 APIToken 或 Email + GlobalAPIKey' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
                            }
                            const Usage_JSON = 查询凭据.UsageAPI
                                ? await (await fetch(查询凭据.UsageAPI, { signal: AbortSignal.timeout(8000) })).json()
                                : await getCloudflareUsage(查询凭据.Email, 查询凭据.GlobalAPIKey, 查询凭据.AccountID, 查询凭据.APIToken);
                            if (Usage_JSON?.success === false) {
                                return new Response(JSON.stringify({ success: false, error: '用量查询失败：' + (Usage_JSON.msg || '未知原因') }), { status: 502, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
                            }
                            // 手工刷新后立即生效：写快照 + 覆盖 isolate 内用量缓存，否则面板要等 60s TTL 才更新。
                            ctx.waitUntil((async () => {
                                try {
                                    if (Usage_JSON?.total != null) await 写入用量快照(env, host, Usage_JSON);
                                } catch (e) { /* 快照失败不影响本次返回 */ }
                            })());
                            用量缓存.set(host, { time: Date.now(), value: Usage_JSON });
							return new Response(JSON.stringify(Usage_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
						} catch (err) {
							const errorResponse = { msg: '查询请求量失败，失败原因：' + err.message, error: err.message };
							return new Response(JSON.stringify(errorResponse, null, 2), { status: err.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					} else if (区分大小写访问路径 === 'admin/getADDAPI') {// 验证优选API
						if (url.searchParams.get('url')) {
							const 待验证优选URL = url.searchParams.get('url');
							try {
								new URL(待验证优选URL);
								const 请求优选API内容 = await 请求优选API([待验证优选URL], url.searchParams.get('port') || '443');
								let 优选API的IP = 请求优选API内容[0].length > 0 ? 请求优选API内容[0] : 请求优选API内容[1];
								优选API的IP = 优选API的IP.map(item => item.replace(/#(.+)$/, (_, remark) => '#' + decodeURIComponent(remark)));
								return new Response(JSON.stringify({ success: true, data: 优选API的IP }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (err) {
								const errorResponse = { msg: '验证优选API失败，失败原因：' + err.message, error: err.message };
								return new Response(JSON.stringify(errorResponse, null, 2), { status: err.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						}
						return new Response(JSON.stringify({ success: false, data: [] }, null, 2), { status: 403, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (访问路径 === 'admin/check') {// 代理检查
						const 代理协议 = ['socks5', 'http', 'https', 'turn', 'sstp'].find(类型 => url.searchParams.has(类型)) || null;
						if (!代理协议) return new Response(JSON.stringify({ error: '缺少代理参数' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						const 代理参数 = url.searchParams.get(代理协议);
						const startTime = Date.now();
						let 检测代理响应;
						try {
							const checkParsed = await 获取SOCKS5账号(代理参数, 获取代理默认端口(代理协议));
							const { username, password, hostname, port } = checkParsed;
							const 完整代理参数 = username && password ? `${username}:${password}@${hostname}:${port}` : `${hostname}:${port}`;
							try {
								const 检测主机 = 'example.com', 检测端口 = 443;
                                const TCP连接 = 创建请求TCP连接器(request);
                                let socket;
                                try {
                                    socket = 代理协议 === 'socks5' ? await socks5Connect(检测主机, 检测端口, new Uint8Array(), TCP连接, checkParsed)
                                        : 代理协议 === 'turn' ? await turnConnect(checkParsed, 检测主机, 检测端口, TCP连接)
                                        : 代理协议 === 'sstp' ? await sstpConnect(checkParsed, 检测主机, 检测端口, TCP连接)
                                        : await httpConnect(检测主机, 检测端口, new Uint8Array(), 代理协议 === 'https', TCP连接, checkParsed);
                                    检测代理响应 = { success:true, stage:'connect', message:'代理连接已建立；未检测出口 IP、地区或端到端 TLS', ip:'未检测', loc:'未检测', responseTime:Date.now()-startTime };
                                } finally { await socket?.close?.(); }

							} catch (error) {
								检测代理响应 = { success: false, error: error.message,  responseTime: Date.now() - startTime };
							}
						} catch (err) {
							检测代理响应 = { success: false, error: err.message,  responseTime: Date.now() - startTime };
						}
						return new Response(JSON.stringify(检测代理响应, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					}

                    if (访问路径 === 'admin/config/restore' && request.method === 'POST') {
                        const previous = await env.KV.get('cfg:' + host + ':previous');
                        if (!previous) return new Response('没有可恢复的版本', { status:404 });
                        const defaults = await 读取config_JSON(env, host, userID, UA);
                        await 保存配置(env, 'cfg:' + host, JSON.parse(previous), defaults);
                        return Response.json({ success:true, message:'已提交上一版本，跨区域传播需要时间' });
                    }
					config_JSON = await 读取config_JSON(env, host, userID, UA);

					if (访问路径 === 'admin/init') {// 重置配置为默认值
                        if (request.method !== 'POST') return new Response('Method Not Allowed', { status:405, headers:{ Allow:'POST' } });
						try {
							config_JSON = await 读取config_JSON(env, host, userID, UA, true);
							ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Init_Config', config_JSON));
							config_JSON.init = '配置已重置为默认值';
							return new Response(JSON.stringify(config_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						} catch (err) {
							const errorResponse = { msg: '配置重置失败，失败原因：' + err.message, error: err.message };
							return new Response(JSON.stringify(errorResponse, null, 2), { status: err.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					} else if (request.method === 'POST') {// 处理 KV 操作（POST 请求）
						if (访问路径 === 'admin/config.json') { // 保存config.json配置
							try {
								const newConfig = await 读取管理JSON(request);
								// 验证配置完整性
								if (!newConfig.UUID || !newConfig.HOST) return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });

								// 保存到 KV
								await 保存配置(env, 'config.json', newConfig, config_JSON);
								失效配置缓存(); // M2-P1: 失效 30s 内存缓存, 面板保存立即生效
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存配置失败:', error);
								return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), { status: error.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (访问路径 === 'admin/cf.json') { // 保存cf.json配置
							try {
								const newConfig = await 读取管理JSON(request);
								const CF_JSON = { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null };
								if (!newConfig.init || newConfig.init !== true) {
									if (newConfig.Email && newConfig.GlobalAPIKey) {
										CF_JSON.Email = newConfig.Email;
										CF_JSON.GlobalAPIKey = newConfig.GlobalAPIKey;
									} else if (newConfig.AccountID && newConfig.APIToken) {
										CF_JSON.AccountID = newConfig.AccountID;
										CF_JSON.APIToken = newConfig.APIToken;
									} else if (newConfig.UsageAPI) {
										CF_JSON.UsageAPI = newConfig.UsageAPI;
									} else {
										return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									}
								}

								// 保存到 KV
								await env.KV.put('cf.json', JSON.stringify(CF_JSON, null, 2));
                                失效配置缓存();
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存配置失败:', error);
								return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), { status: error.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (访问路径 === 'admin/tg.json') { // 保存tg.json配置
							try {
								const newConfig = await 读取管理JSON(request);
								if (newConfig.init && newConfig.init === true) {
									const TG_JSON = { BotToken: null, ChatID: null };
									await env.KV.put('tg.json', JSON.stringify(TG_JSON, null, 2));
                                    失效配置缓存();
								} else {
									if (!newConfig.BotToken || !newConfig.ChatID) return new Response(JSON.stringify({ error: '配置不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
									await env.KV.put('tg.json', JSON.stringify(newConfig, null, 2));
                                    失效配置缓存();
								}
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存配置失败:', error);
								return new Response(JSON.stringify({ error: '保存配置失败: ' + error.message }), { status: error.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (区分大小写访问路径 === 'admin/ADD.txt') { // 保存自定义优选IP
							try {
								const customIPs = await 限长文本(request);
								await env.KV.put('ADD.txt', customIPs);// 保存到 KV
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Custom_IPs', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '自定义IP已保存' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存自定义IP失败:', error);
								return new Response(JSON.stringify({ error: '保存自定义IP失败: ' + error.message }), { status: error.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else if (区分大小写访问路径 === 'admin/config') { // M1-P0 保存 KV 全量配置 cfg:{host}
							try {
								const newConfig = await 读取管理JSON(request);
								if (!newConfig || typeof newConfig !== 'object' || Array.isArray(newConfig)) return new Response(JSON.stringify({ error: '配置格式不完整' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
								await 保存配置(env, 'cfg:' + host, newConfig, config_JSON);
								失效配置缓存(); // M2-P1: 失效 30s 内存缓存
								ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Save_Config_KV', config_JSON));
								return new Response(JSON.stringify({ success: true, message: '配置已保存到 KV（cfg:' + host + '）' }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								console.error('保存KV全量配置失败:', error);
								return new Response(JSON.stringify({ error: '保存KV全量配置失败: ' + error.message }), { status: error.status || 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} else return new Response(JSON.stringify({ error: '不支持的POST请求路径' }), { status: 404, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (访问路径 === 'admin/config.json') {// 处理 admin/config.json 请求，返回JSON
						return new Response(JSON.stringify(config_JSON, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
					} else if (区分大小写访问路径 === 'admin/ADD.txt') {// 处理 admin/ADD.txt 请求，返回本地优选IP
						let 本地优选IP = await env.KV.get('ADD.txt') || 'null';
						if (本地优选IP == 'null') 本地优选IP = (await 生成随机IP(request, config_JSON.优选订阅生成.本地IP库.随机数量, config_JSON.优选订阅生成.本地IP库.指定端口))[1];
						return new Response(本地优选IP, { status: 200, headers: { 'Content-Type': 'text/plain;charset=utf-8', 'asn': request.cf.asn } });
					} else if (访问路径 === 'admin/cf.json') {// CF配置文件
						return new Response(JSON.stringify(request.cf, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (区分大小写访问路径 === 'admin/config') {// M1-P0 配置页（复用登录 cookie 鉴权）
						return new Response(管理面板HTML(env, config_JSON), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
					} else if (区分大小写访问路径 === 'admin/api/usage-history') {// 用量历史（30 天快照）
						return new Response(JSON.stringify(await 读取用量历史(env, host), null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
					} else if (区分大小写访问路径 === 'admin/api/self-check') {// 出口连通自检
						try {
							const 深度 = url.searchParams.get('deep') === '1';
							const 结果 = await 执行自检(request, env, 配置, 深度);
							if (深度) {
								// socket 采样原语属主在 transport/dial.js（架构守门），由编排层挂入 deep。
								const [复用率, 超时预算, 代理] = await Promise.all([
									连接复用采样(), 黑洞超时采样(6000), 代理建连采样(request, env, 配置),
								]);
								结果.deep = { ...结果.deep, 复用率, 超时预算, 代理 };
							}
							return new Response(JSON.stringify(结果, null, 2), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' } });
						} catch (error) {
							return new Response(JSON.stringify({ error: '自检执行失败: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					} else if (区分大小写访问路径 === 'admin/api/tcp-check') {// 目标 TCP 连通性抽测
						try {
							const host = url.searchParams.get('host');
							const port = parseInt(url.searchParams.get('port'), 10);
							if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
								return new Response(JSON.stringify({ error: 'host 或 port 参数非法' }), { status: 400, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
							const 起始 = Date.now();
							try {
								const TCP连接 = 创建请求TCP连接器(request);
								const socket = TCP连接({ hostname: host, port });
								await Promise.race([socket.opened, new Promise((r) => setTimeout(r, 3000))]);
								return new Response(JSON.stringify({ ok: true, ms: Date.now() - 起始 }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							} catch (error) {
								const 信息 = String(error?.message || error).slice(0, 100);
								return new Response(JSON.stringify({ ok: false, ms: Date.now() - 起始, error: 信息 }), { status: 200, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
							}
						} catch (error) {
							return new Response(JSON.stringify({ error: 'tcp-check 执行失败' }), { status: 500, headers: { 'Content-Type': 'application/json;charset=utf-8' } });
						}
					}

					ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Admin_Login', config_JSON));
					if (env.REMOTE_ADMIN === 'true') return fetch(Pages静态页面 + '/admin' + url.search, { signal:AbortSignal.timeout(8000) });
                    return new Response(管理面板HTML(env, config_JSON), { headers:{ 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'X-Frame-Options':'DENY', 'Referrer-Policy':'no-referrer' } });
				} else if (访问路径 === 'logout' || uuidRegex.test(访问路径)) {//清除cookie并跳转到登录页面
					const 响应 = new Response('重定向中...', { status: 302, headers: { 'Location': '/login' } });
					响应.headers.set('Set-Cookie', 'auth=; Path=/; Max-Age=0; HttpOnly');
					return 响应;
				} else if (访问路径 === 'sub') {//处理订阅请求
					const 订阅TOKEN = await MD5MD5(host + userID), 作为优选订阅生成器 = BEST_SUB && url.searchParams.get('host') === 'example.com' && url.searchParams.get('uuid') === '00000000-0000-4000-8000-000000000000' && UA.toLowerCase().includes('tunnel (https://github.com/' + 特征码字典[1] + '/edge');
					const 请求TOKEN = url.searchParams.get('token');
					const 用户客户端请求订阅 = 请求TOKEN === 订阅TOKEN;
					const 当前日序号 = Math.floor(Date.now() / 86400000);
					const 订阅转换后端TOKEN种子 = base64SecretEncode(订阅TOKEN, userID);
					const [今日订阅转换后端专属TOKEN, 昨日订阅转换后端专属TOKEN] = await Promise.all([
						MD5MD5(订阅转换后端TOKEN种子 + 当前日序号),
						MD5MD5(订阅转换后端TOKEN种子 + (当前日序号 - 1)),
					]);
					const 订阅转换后端请求订阅 = 请求TOKEN === 今日订阅转换后端专属TOKEN || 请求TOKEN === 昨日订阅转换后端专属TOKEN;
					if (用户客户端请求订阅 || 订阅转换后端请求订阅 || 作为优选订阅生成器) {
						config_JSON = await 读取config_JSON(env, host, userID, UA);
						if (作为优选订阅生成器) ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Get_Best_SUB', config_JSON, false));
						else ctx.waitUntil(请求日志记录(env, request, 访问IP, 'Get_SUB', config_JSON));
						const ua = UA.toLowerCase();
						const responseHeaders = {
							"content-type": "text/plain; charset=utf-8",
							"Profile-Update-Interval": config_JSON.优选订阅生成.SUBUpdateTime,
							"Profile-web-page-url": url.protocol + '//' + url.host + '/admin',
							"Cache-Control": "no-store",
						};
						if (config_JSON.CF.Usage.success) {
							const pagesSum = config_JSON.CF.Usage.pages;
							const workersSum = config_JSON.CF.Usage.workers;
							const total = Number.isFinite(config_JSON.CF.Usage.max) ? (config_JSON.CF.Usage.max / 1000) * 1024 : 1024 * 100;
							responseHeaders["Subscription-Userinfo"] = `upload=${pagesSum}; download=${workersSum}; total=${total}; expire=4102329600`; // 2099-12-31 到期时间
						}
						const isSubConverterRequest = url.searchParams.has('b64') || url.searchParams.has('base64') || request.headers.get('subconverter-request') || request.headers.get('subconverter-version') || ua.includes('subconverter') || ua.includes(('CF-Workers-SUB').toLowerCase()) || 作为优选订阅生成器;
						const 订阅类型 = isSubConverterRequest
							? 'mixed'
							: url.searchParams.has('target')
								? url.searchParams.get('target')
								: 识别订阅类型(ua, url);

						if (!ua.includes('mozilla')) responseHeaders["Content-Disposition"] = `attachment; filename*=utf-8''${encodeURIComponent(config_JSON.优选订阅生成.SUBNAME)}`;
						const 协议类型 = ((url.searchParams.has('surge') || ua.includes('surge')) && config_JSON.协议类型 !== 'ss') ? 'tro' + 'jan' : config_JSON.协议类型;
                        if (url.searchParams.get('native') === '1') {
                            const { 完整优选IP, 其他节点LINK, 反代IP池 } = await 获取订阅节点列表(config_JSON, url, request, env);
                            const links = 生成节点链接文本(完整优选IP, 其他节点LINK, 反代IP池, config_JSON, 协议类型, false, false, false, userID, '', '');
                            return new Response(生成原生订阅(订阅类型, links, config_JSON), { headers:{ ...responseHeaders, 'content-type':'application/json; charset=utf-8' } });
                        }
						let 订阅内容 = '';
						if (订阅类型 === 'mixed') {
							const TLS分片参数 = config_JSON.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : config_JSON.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
							const { 完整优选IP, 其他节点LINK, 反代IP池 } = await 获取订阅节点列表(config_JSON, url, request, env);
							const ECHLINK参数 = config_JSON.ECH ? `&ech=${encodeURIComponent((config_JSON.ECHConfig.SNI ? config_JSON.ECHConfig.SNI + '+' : '') + config_JSON.ECHConfig.DNS)}` : '';
							const isLoonOrSurge = ua.includes('loon') || ua.includes('surge');
							订阅内容 = 生成节点链接文本(完整优选IP, 其他节点LINK, 反代IP池, config_JSON, 协议类型, 作为优选订阅生成器, isLoonOrSurge, isSubConverterRequest, userID, ECHLINK参数, TLS分片参数);
						} else if (订阅类型 === 'shadowrocket' || 订阅类型 === 'v2rayn') { // 直出明文订阅（零转换器依赖，复用节点链接生成器）
							const TLS分片参数 = config_JSON.TLS分片 == 'Shadowrocket' ? `&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}` : config_JSON.TLS分片 == 'Happ' ? `&fragment=${encodeURIComponent('3,1,tlshello')}` : '';
							const { 完整优选IP, 其他节点LINK, 反代IP池 } = await 获取订阅节点列表(config_JSON, url, request, env);
							const ECHLINK参数 = config_JSON.ECH ? `&ech=${encodeURIComponent((config_JSON.ECHConfig.SNI ? config_JSON.ECHConfig.SNI + '+' : '') + config_JSON.ECHConfig.DNS)}` : '';
							const 链接文本 = 生成节点链接文本(完整优选IP, 其他节点LINK, 反代IP池, config_JSON, 协议类型, 作为优选订阅生成器, false, isSubConverterRequest, userID, ECHLINK参数, TLS分片参数);
							订阅内容 = 订阅类型 === 'shadowrocket'
								? 生成Shadowrocket订阅(链接文本, config_JSON.完整节点路径, config_JSON)
								: 生成V2rayN订阅(链接文本, config_JSON.完整节点路径, config_JSON);
						} else { // 订阅转换
							const 订阅转换URL = `${config_JSON.订阅转换配置.SUBAPI}/sub?target=${订阅转换器目标(订阅类型)}&url=${encodeURIComponent(url.protocol + '//' + url.host + '/sub?target=mixed&token=' + 今日订阅转换后端专属TOKEN + '&cnIspCode=' + 识别运营商(request) + (url.searchParams.has('sub') && url.searchParams.get('sub') != '' ? `&sub=${url.searchParams.get('sub')}` : ''))}&config=${encodeURIComponent(config_JSON.订阅转换配置.SUBCONFIG)}&emoji=${config_JSON.订阅转换配置.SUBEMOJI}&list=${config_JSON.订阅转换配置.SUBLIST}&scv=${config_JSON.跳过证书验证}&xudp=${config_JSON.订阅转换配置.XUDP}&udp=${config_JSON.订阅转换配置.UDP}&tls13=${config_JSON.订阅转换配置.TLS13}&append_type=${config_JSON.订阅转换配置.APPEND_TYPE}&sort=${config_JSON.订阅转换配置.SORT}`;
							try {
								const response = await fetch(订阅转换URL, { headers: { 'User-Agent': 'Subconverter for ' + 订阅转换器目标(订阅类型) + ' edge' + 'tunnel (https://github.com/' + 特征码字典[1] + '/edge' + 'tunnel)' }, signal: AbortSignal.timeout(10000) }); // M2-P0.5：订阅转换 10s 超时
								if (response.ok) {
									订阅内容 = await response.text();
									if (订阅类型 === 'surge') 订阅内容 = Surge订阅配置文件热补丁(订阅内容, url.protocol + '//' + url.host + '/sub?token=' + 订阅TOKEN + '&surge', config_JSON);
									else if (订阅类型 === 'loon') 订阅内容 = Loon订阅配置文件热补丁(订阅内容, url.protocol + '//' + url.host + '/sub?token=' + 订阅TOKEN + '&loon', config_JSON);
									else if (订阅类型 === 'quantumultx') 订阅内容 = QuantumultX订阅配置文件热补丁(订阅内容, url.protocol + '//' + url.host + '/sub?token=' + 订阅TOKEN + '&quanx', config_JSON);
								} else return new Response('订阅转换后端异常：' + response.statusText, { status: response.status });
							} catch (error) {
								return new Response('订阅转换后端异常：' + error.message, { status: 403 });
							}
						}

						if (!ua.includes('subconverter') && 用户客户端请求订阅) {
							const 打乱后HOSTS = [...config_JSON.HOSTS].sort(() => Math.random() - 0.5);
							let 替换域名计数 = 0, 当前随机HOST = null;
							订阅内容 = 订阅内容
								.replace(/00000000-0000-4000-8000-000000000000/g, config_JSON.UUID)
								.replace(/MDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAw/g, btoa(config_JSON.UUID))
								.replace(/example\.com/g, () => {
									if (替换域名计数 % 2 === 0) {
										const 原始host = 打乱后HOSTS[Math.floor(替换域名计数 / 2) % 打乱后HOSTS.length];
										当前随机HOST = 替换星号为随机字符(原始host);
									}
									替换域名计数++;
									return 当前随机HOST;
								});
						}

						if (订阅类型 === 'mixed' && (!ua.includes('mozilla') || url.searchParams.has('b64') || url.searchParams.has('base64'))) 订阅内容 = btoa(订阅内容);

						if (订阅类型 === 'singbox') {
							订阅内容 = await Singbox订阅配置文件热补丁(订阅内容, config_JSON);
							responseHeaders["content-type"] = 'application/json; charset=utf-8';
						} else if (订阅类型 === 'clash') {
							订阅内容 = Clash订阅配置文件热补丁(订阅内容, config_JSON);
							responseHeaders["content-type"] = 'application/x-yaml; charset=utf-8';
						}
						return new Response(订阅内容, { status: 200, headers: responseHeaders });
					}
				} else if (访问路径 === 'locations') {//反代locations列表
					const cookies = request.headers.get('Cookie') || '';
					const authCookie = cookies.split(';').find(c => c.trim().startsWith('auth='))?.split('=')[1];
					if (await 验证会话(authCookie, 管理员密码, 加密秘钥, UA, url.hostname)) return fetch(new Request('https://speed.cloudflare.com/locations', { headers: { 'Referer': 'https://speed.cloudflare.com/' } }));
				} else if (访问路径 === 'robots.txt') return new Response('User-agent: *\nDisallow: /', { status: 200, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });
			} else if (!envUUID) return new Response('请绑定 KV', { status:503, headers:{ 'Cache-Control':'no-store' } });
		}

		if (伪装页URL === '1101') return new Response(await html1101(url.host, 访问IP), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
		// ============ M2-P0.6 无效请求拦截（修订版）============
		// 仅拦截"明确声明的扫描/工具 UA"（curl/wget/python/...）：404 短路，不反代伪装页、不消耗出站子请求。
		// 监控探测 UA（uptimeflare/kuma 等）与未知/空 UA 一律放行走伪装页（回退改造前行为）。
		// 修订原因：初版"非浏览器 UA 一律 404"误伤 uptimeflare 探测（期望 2xx），造成代理故障误报。
		if (是拦截UA(UA)) {
			log(`[拦截] bot 工具请求短路: ${url.pathname}${url.search} | UA: ${UA} | IP: ${访问IP}`);
			return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' } });
		}
		try {
			const 反代URL = new URL(伪装页URL), 新请求头 = new Headers(request.headers);
			新请求头.delete('Cookie');
            新请求头.delete('Authorization');
            for (const key of ['token','password','key','uuid']) url.searchParams.delete(key);
			新请求头.set('Host', 反代URL.host);
			新请求头.set('Referer', 反代URL.origin);
			新请求头.set('Origin', 反代URL.origin);
			if (!新请求头.has('User-Agent') && UA && UA !== 'null') 新请求头.set('User-Agent', UA);
			const 反代响应 = await fetch(反代URL.origin + url.pathname + url.search, { method: request.method, headers: 新请求头, body: request.body, cf: request.cf, signal: AbortSignal.timeout(8000) }); // M2-P0.5：伪装页反代 8s 超时，失败走 nginx 兜底
			const 内容类型 = 反代响应.headers.get('content-type') || '';
			// 只处理文本类型的响应
			if (/text|javascript|json|xml/.test(内容类型)) {
				const 响应内容 = (await 反代响应.text()).replaceAll(反代URL.host, url.host);
				return new Response(响应内容, { status: 反代响应.status, headers: { ...Object.fromEntries(反代响应.headers), 'Cache-Control': 'no-store' } });
			}
			return 反代响应;
		} catch (error) { }
		return new Response(await nginx(), { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
