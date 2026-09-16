import { 掩码敏感信息, 转义HTML } from '../core/html.js';
import { 安全日志URL } from '../security.js';
async function 请求日志记录(env, request, 访问IP, 请求类型 = "Get_SUB", config_JSON, 是否写入KV日志 = true) {
	try {
		const 当前时间 = new Date();
		const 日志内容 = { TYPE: 请求类型, IP: 访问IP, ASN: `AS${request.cf?.asn || '0'} ${request.cf?.asOrganization || 'Unknown'}`, CC: `${request.cf?.country || 'N/A'} ${request.cf?.city || 'N/A'}`, URL: 安全日志URL(request.url), UA: request.headers.get('User-Agent') || 'Unknown', TIME: 当前时间.getTime() };
		if (config_JSON.TG.启用) {
			try {
				const TG_TXT = await env.KV.get('tg.json');
				const TG_JSON = JSON.parse(TG_TXT);
				if (TG_JSON?.BotToken && TG_JSON?.ChatID) {
					const 请求时间 = new Date(日志内容.TIME).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
					const 请求URL = new URL(日志内容.URL);
					const msg = `<b>#${config_JSON.优选订阅生成.SUBNAME} 日志通知</b>\n\n` +
						`📌 <b>类型：</b>#${日志内容.TYPE}\n` +
						`🌐 <b>IP：</b><code>${日志内容.IP}</code>\n` +
						`📍 <b>位置：</b>${日志内容.CC}\n` +
						`🏢 <b>ASN：</b>${日志内容.ASN}\n` +
						`🔗 <b>域名：</b><code>${请求URL.host}</code>\n` +
						`🔍 <b>路径：</b><code>${请求URL.pathname + 请求URL.search}</code>\n` +
						`🤖 <b>UA：</b><code>${日志内容.UA}</code>\n` +
						`📅 <b>时间：</b>${请求时间}\n` +
						`${config_JSON.CF.Usage.success ? `📊 <b>请求用量：</b>${config_JSON.CF.Usage.total}/${config_JSON.CF.Usage.max} <b>${((config_JSON.CF.Usage.total / config_JSON.CF.Usage.max) * 100).toFixed(2)}%</b>\n` : ''}`;
					await fetch(`https://api.telegram.org/bot${TG_JSON.BotToken}/sendMessage?chat_id=${TG_JSON.ChatID}&parse_mode=HTML&text=${encodeURIComponent(msg)}`, {
						method: 'GET',
						headers: {
							'Accept': 'text/html,application/xhtml+xml,application/xml;',
							'Accept-Encoding': 'gzip, deflate, br',
							'User-Agent': 日志内容.UA || 'Unknown',
						},
						signal: AbortSignal.timeout(5000), // M2-P0.5：TG 通知 5s 超时
					});
				}
			} catch (error) { console.error(`读取tg.json出错: ${error.message}`) }
		}
		是否写入KV日志 = ['1', 'true'].includes(env.OFF_LOG) ? false : 是否写入KV日志;
		if (!是否写入KV日志) return;
		console.log(JSON.stringify({ event: 'access', ...日志内容 }));
	} catch (error) { console.error(`日志记录失败: ${error.message}`) }
}


///////////////////////////////////////////////////////M1-P0 配置页（/admin/config）///////////////////////////////////////////////////////
// 复用登录 cookie 鉴权；表单编辑 KV 全量配置（cfg:{host}），env 配置只读展示。默认值兜底、缺键不崩溃。
function 管理面板配置页HTML(env, config_JSON) {
	const 只读env字段 = [
		['ADMIN', env.ADMIN ? '已配置（用于登录）' : '未配置'],
		['KEY', env.KEY ? 掩码敏感信息(String(env.KEY)) : '未配置'],
		['HOST', env.HOST || '（默认取访问域名）'],
		['UUID', env.UUID || '（自动生成）'],
		['PROXYIP', env.PROXYIP || '（未配置）'],
		['URL', env.URL || 'nginx'],
		['PATH', env.PATH || '/'],
		['GO2SOCKS5', env.GO2SOCKS5 || '（未配置）'],
		['DEBUG', (env.DEBUG ? '已开启' : '关闭')],
		['BEST_SUB', (env.BEST_SUB ? '已开启' : '关闭')],
		['PROXY_CONCURRENT_DIAL', env.PROXY_CONCURRENT_DIAL || '1'],
		['TCP_CONCURRENT_DIAL', env.TCP_CONCURRENT_DIAL || '2'],
	];
	const 只读env行 = 只读env字段.map(([名, 值]) => `<tr><td class="mn">${名}</td><td>${转义HTML(String(值))}</td></tr>`).join('');
	return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>配置管理 - edgetunnel</title><style>
*{box-sizing:border-box}body{font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#0f1420;color:#e6e8ee}
.wrap{max-width:960px;margin:0 auto;padding:24px}h1{font-size:20px;margin:0 0 4px}h1 small{font-size:13px;color:#8b93a7;font-weight:400}
.sub{color:#8b93a7;font-size:13px;margin:0 0 20px}.card{background:#1a2130;border:1px solid #2a3346;border-radius:10px;padding:16px;margin-bottom:16px}
.card h2{font-size:15px;margin:0 0 12px;color:#c9d2e3}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
textarea{width:100%;height:360px;background:#0f1420;color:#d8e0ee;border:1px solid #2a3346;border-radius:8px;padding:10px;font:12px/1.5 monospace;resize:vertical}
table{width:100%;border-collapse:collapse;font-size:13px}td{overflow-wrap:anywhere;padding:6px 8px;border-bottom:1px solid #232c3e}td.mn{width:220px;color:#8b93a7}
button{min-height:44px;background:#2f81f7;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:14px;cursor:pointer}button:hover{background:#1f6bd6}
a{color:#8abaff}button.ghost{background:#2a3346}.tag{font-size:12px;color:#6fd18a}
#status{margin-left:10px;font-size:13px;color:#8b93a7;word-break:break-all}</style></head><body><div class="wrap">
<h1>配置管理 <small>路径优先级：path 参数 &gt; KV(cfg:{host}) &gt; env &gt; 默认值</small></h1>
<p class="sub">编辑下方 JSON 并保存，即写入当前访问域名的 KV 全量配置（<code>cfg:{host}</code>）；保存后清除本地缓存；其他地区可能需要 60 秒或更久传播。留空/缺键回退到环境变量与默认值。</p>
<div class="card"><h2>订阅与日志</h2><p><a href="/sub?token=${encodeURIComponent(config_JSON.优选订阅生成.TOKEN)}">通用订阅</a> · <a href="/sub?token=${encodeURIComponent(config_JSON.优选订阅生成.TOKEN)}&amp;target=clash&amp;native=1">Clash 原生订阅</a> · <a href="/sub?token=${encodeURIComponent(config_JSON.优选订阅生成.TOKEN)}&amp;target=singbox&amp;native=1">sing-box 原生订阅</a> · <a href="/logout">退出登录</a></p><p>原生订阅为最小配置，不包含自定义分流规则。访问日志请在 Cloudflare Workers Logs 查看。</p></div>
<div class="card"><div class="row"><h2>KV 全量配置（可编辑）</h2><div><button onclick="saveCfg()">保存到 KV</button> <button class="ghost" onclick="restoreCfg()">恢复上一版本</button><span id="status" role="status" aria-live="polite"></span></div></div>
<label for="cfg">当前配置 JSON</label><textarea id="cfg" spellcheck="false" placeholder="正在加载当前生效配置…"></textarea></div>
<div class="card"><h2>环境变量（只读）<span class="tag">亮起优先于默认值，KV 配置优先于 env</span></h2><table>${只读env行}</table></div>
</div><script>
async function loadCfg(){try{const r=await fetch('/admin/config.json');if(!r.ok)throw new Error('HTTP '+r.status);const cfg=await r.json();document.getElementById('cfg').value=JSON.stringify(cfg,null,2);d('已加载当前生效配置（KV>env>默认值）');}catch(e){document.getElementById('cfg').placeholder='加载失败：'+e.message;}}
async function saveCfg(){d('正在保存…');try{const el=document.getElementById('cfg');let obj;try{obj=JSON.parse(el.value);}catch(e){d('JSON 解析失败：'+e.message);return;}const r=await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});let res={};try{res=await r.json();}catch(_){}d(r.ok?('保存成功：'+ (res.message||'')):('保存失败：'+JSON.stringify(res)));}catch(e){d('保存失败：'+e.message);}}
async function restoreCfg(){try{const r=await fetch('/admin/config/restore',{method:'POST'});if(!r.ok)throw new Error(await r.text());d('已提交恢复，请稍后刷新配置');}catch(e){d('恢复失败：'+e.message);}}
function d(m){const s=document.getElementById('status');s.textContent=m;}
loadCfg();
</script></body></html>`;
}

export { 管理面板配置页HTML, 请求日志记录 };
