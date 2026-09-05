/*# anchor: 原 _worker.js L5326-5423 */
async function 请求日志记录(env, request, 访问IP, 请求类型 = "Get_SUB", config_JSON, 是否写入KV日志 = true) {
	try {
		const 当前时间 = new Date();
		const 日志内容 = { TYPE: 请求类型, IP: 访问IP, ASN: `AS${request.cf.asn || '0'} ${request.cf.asOrganization || 'Unknown'}`, CC: `${request.cf.country || 'N/A'} ${request.cf.city || 'N/A'}`, URL: request.url, UA: request.headers.get('User-Agent') || 'Unknown', TIME: 当前时间.getTime() };
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
						}
					});
				}
			} catch (error) { console.error(`读取tg.json出错: ${error.message}`) }
		}
		是否写入KV日志 = ['1', 'true'].includes(env.OFF_LOG) ? false : 是否写入KV日志;
		if (!是否写入KV日志) return;
		let 日志数组 = [];
		const 现有日志 = await env.KV.get('log.json'), KV容量限制 = 4;//MB
		if (现有日志) {
			try {
				日志数组 = JSON.parse(现有日志);
				if (!Array.isArray(日志数组)) { 日志数组 = [日志内容] }
				else if (请求类型 !== "Get_SUB") {
					const 三十分钟前时间戳 = 当前时间.getTime() - 30 * 60 * 1000;
					if (日志数组.some(log => log.TYPE !== "Get_SUB" && log.IP === 访问IP && log.URL === request.url && log.UA === (request.headers.get('User-Agent') || 'Unknown') && log.TIME >= 三十分钟前时间戳)) return;
					日志数组.push(日志内容);
					while (JSON.stringify(日志数组, null, 2).length > KV容量限制 * 1024 * 1024 && 日志数组.length > 0) 日志数组.shift();
				} else {
					日志数组.push(日志内容);
					while (JSON.stringify(日志数组, null, 2).length > KV容量限制 * 1024 * 1024 && 日志数组.length > 0) 日志数组.shift();
				}
			} catch (e) { 日志数组 = [日志内容] }
		} else { 日志数组 = [日志内容] }
		await env.KV.put('log.json', JSON.stringify(日志数组, null, 2));
	} catch (error) { console.error(`日志记录失败: ${error.message}`) }
}

function 掩码敏感信息(文本, 前缀长度 = 3, 后缀长度 = 2) {
	if (!文本 || typeof 文本 !== 'string') return 文本;
	if (文本.length <= 前缀长度 + 后缀长度) return 文本; // 如果长度太短，直接返回

	const 前缀 = 文本.slice(0, 前缀长度);
	const 后缀 = 文本.slice(-后缀长度);
	const 星号数量 = 文本.length - 前缀长度 - 后缀长度;

	return `${前缀}${'*'.repeat(星号数量)}${后缀}`;
}

async function MD5MD5(文本) {
	const 编码器 = new TextEncoder();

	const 第一次哈希 = await crypto.subtle.digest('MD5', 编码器.encode(文本));
	const 第一次哈希数组 = Array.from(new Uint8Array(第一次哈希));
	const 第一次十六进制 = 第一次哈希数组.map(字节 => 字节.toString(16).padStart(2, '0')).join('');

	const 第二次哈希 = await crypto.subtle.digest('MD5', 编码器.encode(第一次十六进制.slice(7, 27)));
	const 第二次哈希数组 = Array.from(new Uint8Array(第二次哈希));
	const 第二次十六进制 = 第二次哈希数组.map(字节 => 字节.toString(16).padStart(2, '0')).join('');

	return 第二次十六进制.toLowerCase();
}

function 随机路径(完整节点路径 = "/") {
	const 常用路径目录 = ["about", "account", "acg", "act", "activity", "ad", "ads", "ajax", "album", "albums", "anime", "api", "app", "apps", "archive", "archives", "article", "articles", "ask", "auth", "avatar", "bbs", "bd", "blog", "blogs", "book", "books", "bt", "buy", "cart", "category", "categories", "cb", "channel", "channels", "chat", "china", "city", "class", "classify", "clip", "clips", "club", "cn", "code", "collect", "collection", "comic", "comics", "community", "company", "config", "contact", "content", "course", "courses", "cp", "data", "detail", "details", "dh", "directory", "discount", "discuss", "dl", "dload", "doc", "docs", "document", "documents", "doujin", "download", "downloads", "drama", "edu", "en", "ep", "episode", "episodes", "event", "events", "f", "faq", "favorite", "favourites", "favs", "feedback", "file", "files", "film", "films", "forum", "forums", "friend", "friends", "game", "games", "gif", "go", "go.html", "go.php", "group", "groups", "help", "home", "hot", "htm", "html", "image", "images", "img", "index", "info", "intro", "item", "items", "ja", "jp", "jump", "jump.html", "jump.php", "jumping", "knowledge", "lang", "lesson", "lessons", "lib", "library", "link", "links", "list", "live", "lives", "m", "mag", "magnet", "mall", "manhua", "map", "member", "members", "message", "messages", "mobile", "movie", "movies", "music", "my", "new", "news", "note", "novel", "novels", "online", "order", "out", "out.html", "out.php", "outbound", "p", "page", "pages", "pay", "payment", "pdf", "photo", "photos", "pic", "pics", "picture", "pictures", "play", "player", "playlist", "post", "posts", "product", "products", "program", "programs", "project", "qa", "question", "rank", "ranking", "read", "readme", "redirect", "redirect.html", "redirect.php", "reg", "register", "res", "resource", "retrieve", "sale", "search", "season", "seasons", "section", "seller", "series", "service", "services", "setting", "settings", "share", "shop", "show", "shows", "site", "soft", "sort", "source", "special", "star", "stars", "static", "stock", "store", "stream", "streaming", "streams", "student", "study", "tag", "tags", "task", "teacher", "team", "tech", "temp", "test", "thread", "tool", "tools", "topic", "topics", "torrent", "trade", "travel", "tv", "txt", "type", "u", "upload", "uploads", "url", "urls", "user", "users", "v", "version", "videos", "view", "vip", "vod", "watch", "web", "wenku", "wiki", "work", "www", "zh", "zh-cn", "zh-tw", "zip"];
	const 随机数 = Math.floor(Math.random() * 3 + 1);
	const 随机路径 = 常用路径目录.sort(() => 0.5 - Math.random()).slice(0, 随机数).join('/');
	if (完整节点路径 === "/") return `/${随机路径}`;
	else return `/${随机路径 + 完整节点路径.replace('/?', '?')}`;
}

function 替换星号为随机字符(内容) {
	if (typeof 内容 !== 'string' || !内容.includes('*')) return 内容;
	const 字符集 = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return 内容.replace(/\*/g, () => {
		let s = '';
		for (let i = 0; i < Math.floor(Math.random() * 14) + 3; i++) s += 字符集[Math.floor(Math.random() * 字符集.length)];
		return s;
	});
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
	const 只读env行 = 只读env字段.map(([名, 值]) => `<tr><td class="mn">${名}</td><td>${值}</td></tr>`).join('');
	return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>配置管理 - edgetunnel</title><style>
*{box-sizing:border-box}body{font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#0f1420;color:#e6e8ee}
.wrap{max-width:960px;margin:0 auto;padding:24px}h1{font-size:20px;margin:0 0 4px}h1 small{font-size:13px;color:#8b93a7;font-weight:400}
.sub{color:#8b93a7;font-size:13px;margin:0 0 20px}.card{background:#1a2130;border:1px solid #2a3346;border-radius:10px;padding:16px;margin-bottom:16px}
.card h2{font-size:15px;margin:0 0 12px;color:#c9d2e3}.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
textarea{width:100%;height:360px;background:#0f1420;color:#d8e0ee;border:1px solid #2a3346;border-radius:8px;padding:10px;font:12px/1.5 monospace;resize:vertical}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #232c3e}td.mn{width:220px;color:#8b93a7}
button{background:#2f81f7;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:14px;cursor:pointer}button:hover{background:#1f6bd6}
button.ghost{background:#2a3346}.tag{font-size:12px;color:#6fd18a}
#status{margin-left:10px;font-size:13px;color:#8b93a7;word-break:break-all}</style></head><body><div class="wrap">
<h1>配置管理 <small>路径优先级：path 参数 &gt; KV(cfg:{host}) &gt; env &gt; 默认值</small></h1>
<p class="sub">编辑下方 JSON 并保存，即写入当前访问域名的 KV 全量配置（<code>cfg:{host}</code>）；保存后立即生效。留空/缺键回退到环境变量与默认值。</p>
<div class="card"><div class="row"><h2>KV 全量配置（可编辑）</h2><div><button onclick="saveCfg()">保存到 KV</button><span id="status"></span></div></div>
<textarea id="cfg" spellcheck="false" placeholder="正在加载当前生效配置…"></textarea></div>
<div class="card"><h2>环境变量（只读）<span class="tag">亮起优先于默认值，KV 配置优先于 env</span></h2><table>${只读env行}</table></div>
</div><script>
async function loadCfg(){try{const r=await fetch('/admin/config.json');if(!r.ok)throw new Error('HTTP '+r.status);const cfg=await r.json();document.getElementById('cfg').value=JSON.stringify(cfg,null,2);d('已加载当前生效配置（KV>env>默认值）');}catch(e){document.getElementById('cfg').placeholder='加载失败：'+e.message;}}
async function saveCfg(){const el=document.getElementById('cfg');let obj;try{obj=JSON.parse(el.value);}catch(e){d('JSON 解析失败：'+e.message);return;}const r=await fetch('/admin/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});let res={};try{res=await r.json();}catch(_){}d(r.ok?('保存成功：'+ (res.message||'')):('保存失败：'+JSON.stringify(res)));}
function d(m){const s=document.getElementById('status');s.textContent=m;}
loadCfg();
</script></body></html>`;
}

