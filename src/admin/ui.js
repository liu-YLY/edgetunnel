// 本地内嵌管理面板：单一导出，返回完整 HTML（内联 CSS + SPA 客户端 JS + 内嵌二维码运行时）。
// 零外部依赖。依赖 core/html.js（转义/掩码）与 admin/qr.js（二维码运行时字符串）。
import { 掩码敏感信息, 转义HTML } from '../core/html.js';
import { 二维码运行时 } from './qr.js';

const CSS = `
:root{--bg1:#0b1020;--bg2:#131a2e;--bg3:#0e1424;--glass-bg:rgba(255,255,255,.04);--glass-line:rgba(255,255,255,.09);--fg:#e6e8ee;--mut:#8b93a7;--acc:#6e8bff;--acc2:#22d3ee;--ok:#3fb950;--err:#f85149;--r:18px;--shadow:0 12px 32px rgba(0,0,0,.35)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;color:var(--fg);font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;min-height:100vh;background:linear-gradient(160deg,var(--bg1),var(--bg2) 55%,var(--bg3));background-attachment:fixed}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(900px 500px at 15% -10%,rgba(110,139,255,.22),transparent 60%),radial-gradient(700px 420px at 90% 0%,rgba(34,211,238,.16),transparent 60%)}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 84px;position:relative;z-index:1}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
h1{font-size:19px;margin:0;letter-spacing:.2px}h1 small{color:var(--mut);font-weight:400;font-size:13px}
a{color:#9db8ff;text-decoration:none}a:hover{text-decoration:underline}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
nav button{background:transparent;border:1px solid var(--glass-line);color:var(--mut);border-radius:999px;padding:8px 16px;font-size:14px;cursor:pointer;transition:all .18s ease}
nav button:hover{color:var(--fg);border-color:rgba(255,255,255,.22)}
nav button.on{background:linear-gradient(135deg,var(--acc),var(--acc2));border-color:transparent;color:#fff;box-shadow:0 4px 18px rgba(110,139,255,.4)}
.page{display:none;opacity:0;transform:translateY(6px);transition:opacity .22s ease,transform .22s ease}
.page.on{display:block;opacity:1;transform:none}
.card,.glass-card{background:var(--glass-bg);border:1px solid var(--glass-line);border-radius:var(--r);padding:18px;margin-bottom:14px;backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);box-shadow:var(--shadow);transition:transform .18s ease}
.card:hover,.glass-card:hover{transform:translateY(-2px)}
.card h2,.glass-card h2{font-size:15px;margin:0 0 12px;color:#c9d2e3}
.hero{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.gauge{flex:0 0 120px}
label{font-size:12px;color:var(--mut);display:block;margin:10px 0 4px}
input,select,textarea{width:100%;background:rgba(11,16,32,.5);color:#d8e0ee;border:1px solid var(--glass-line);border-radius:10px;padding:9px 10px;font-size:13px;outline:none;transition:border-color .15s ease,box-shadow .15s ease}
input:focus,select:focus,textarea:focus{border-color:rgba(110,139,255,.6);box-shadow:0 0 0 3px rgba(110,139,255,.18)}
textarea{font:12px/1.5 monospace;resize:vertical}
button.btn{min-height:44px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;border:0;border-radius:10px;padding:9px 18px;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(110,139,255,.28);transition:all .18s ease}
button.btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
button.btn:active{transform:translateY(0) scale(.98)}
button.ghost{background:var(--glass-bg);color:var(--fg);border:1px solid var(--glass-line);box-shadow:none}
button.ghost:hover{background:rgba(255,255,255,.08)}
button.iconbtn{min-height:36px;background:var(--glass-bg);color:var(--fg);border:1px solid var(--glass-line);border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer}
button.iconbtn:hover{background:rgba(255,255,255,.08)}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:13px}td{overflow-wrap:anywhere;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06)}td.mn{width:200px;color:var(--mut)}
.qr svg{max-width:180px;height:auto;background:#fff;padding:8px;border-radius:10px}
.mono{font:12px/1.5 monospace;word-break:break-all;background:rgba(11,16,32,.5);border:1px solid var(--glass-line);border-radius:10px;padding:10px;margin:6px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.kvList{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.kvList .item{background:rgba(11,16,32,.5);border:1px solid var(--glass-line);border-radius:12px;padding:10px}
.kvList .item b{display:block;font-size:12px;color:var(--mut);margin-bottom:4px}
.dim{color:var(--mut);font-size:13px}
/* 概览增强 */
.clock{display:flex;gap:10px;align-items:baseline;justify-content:flex-end;font-variant-numeric:tabular-nums;font-size:14px;margin-bottom:10px}
.clock .t{font-weight:600;letter-spacing:1px}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.badge{font-size:12px;color:#d8e0ee;background:rgba(110,139,255,.14);border:1px solid rgba(110,139,255,.35);border-radius:999px;padding:4px 10px}
#chart{position:relative}
#chart svg{width:100%;height:auto}
#chart-tip{position:absolute;display:none;pointer-events:none;background:rgba(11,16,32,.92);border:1px solid var(--glass-line);border-radius:8px;padding:6px 10px;font-size:12px;z-index:5;white-space:nowrap;box-shadow:var(--shadow)}
/* 节点 Modal */
#qr-modal{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:rgba(6,9,18,.6);backdrop-filter:blur(6px)}
#qr-modal.open{display:flex}
#qr-modal .box{background:#fff;border-radius:14px;padding:18px;max-width:88vw;box-shadow:0 24px 60px rgba(0,0,0,.5)}
#qr-modal .box svg{width:100%;max-width:280px;height:auto}
/* 快捷键帮助浮层 */
#kbd-help{position:fixed;inset:0;z-index:19;display:none;align-items:center;justify-content:center;background:rgba(6,9,18,.6);backdrop-filter:blur(6px)}
#kbd-help.open{display:flex}
#kbd-help .box{background:var(--glass-bg);border:1px solid var(--glass-line);border-radius:var(--r);padding:20px;max-width:88vw;backdrop-filter:blur(20px)}
#kbd-help table{font-size:13px}
#kbd-help kbd{font:12px ui-monospace,monospace;background:rgba(255,255,255,.1);border:1px solid var(--glass-line);border-bottom-width:2px;border-radius:6px;padding:2px 6px}
#toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:rgba(11,16,32,.92);border:1px solid var(--glass-line);border-radius:999px;padding:10px 18px;font-size:14px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:30;max-width:86vw;box-shadow:var(--shadow)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
#toast.ok{border-color:var(--ok);color:#baf0c3}#toast.ok::before{content:"✓ "}
#toast.err{border-color:var(--err);color:#ffb3b0}#toast.err::before{content:"✕ "}
@media(max-width:640px){.hero{flex-direction:column}
nav{position:fixed;bottom:0;left:0;right:0;z-index:8;margin:0;padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:rgba(11,16,32,.85);backdrop-filter:blur(20px);justify-content:space-around}
nav button{flex:1;padding:8px 6px}.wrap{padding-bottom:96px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto}}
`;

// 面板渲染入口：env（只读 env 展示/出站模式推导）+ config_JSON（生效配置，含掩码凭据）
function 管理面板HTML(env, config_JSON) {
  const 出站 = env.PROXYIP ? 'manual(' + (String(env.PROXYIP).includes(',') ? '多候选' : 掩码敏感信息(String(env.PROXYIP))) + ')' : String(env.出站模式 || env.EGRESS_MODE || 'auto');
  const 摘 = {
    host: config_JSON.HOST || '',
    link: config_JSON.LINK || '',
    subname: config_JSON.优选订阅生成?.SUBNAME || 'edgetunnel',
    token: config_JSON.优选订阅生成?.TOKEN || '',
    出站,
    path: config_JSON.完整节点路径 || '/',
    协议类型: config_JSON.协议类型, 传输协议: config_JSON.传输协议, gRPC模式: config_JSON.gRPC模式 || 'gun',
    Fingerprint: config_JSON.Fingerprint || 'chrome', ECH: !!config_JSON.ECH, 启用0RTT: !!config_JSON.启用0RTT,
    TLS分片: config_JSON.TLS分片 || '', ALPN: config_JSON.ALPN || '',
    SS: { 加密方式: config_JSON.SS?.加密方式 || 'aes-128-gcm', TLS: !!config_JSON.SS?.TLS },
    反代: config_JSON.反代?.PROXYIP || 'auto',
    用量: { ...{ success: false, pages: 0, workers: 0, total: 0, max: 100000 }, ...config_JSON.CF?.Usage },
    TG: config_JSON.TG || { 启用: false, BotToken: null, ChatID: null },
    CF: config_JSON.CF || {},
  };
  const 订阅链接 = 'https://' + 摘.host + '/sub?token=' + encodeURIComponent(摘.token);
  const sse = 转义HTML(摘.host);
  const env只读行 = [
    ['ADMIN', env.ADMIN ? '已配置' : '未配置'],
    ['KEY', env.KEY ? 掩码敏感信息(String(env.KEY)) : '未配置'],
    ['HOST', env.HOST || '（默认访问域名）'],
    ['UUID', env.UUID || '（自动派生）'],
    ['PROXYIP', env.PROXYIP ? 掩码敏感信息(String(env.PROXYIP)) : '（未配置）'],
    ['出站模式/EGRESS_MODE', env.出站模式 || env.EGRESS_MODE || 'auto'],
    ['URL', env.URL || 'nginx'],
    ['PATH', env.PATH || '/'],
    ['GO2SOCKS5', env.GO2SOCKS5 || '（未配置）'],
    ['DEBUG', env.DEBUG ? '开启' : '关闭'],
    ['BEST_SUB', env.BEST_SUB ? '开启' : '关闭'],
    ['PRELOAD_RACE_DIAL', env.PRELOAD_RACE_DIAL ? '开启' : '关闭'],
    ['PROXY_CONCURRENT_DIAL', env.PROXY_CONCURRENT_DIAL || '1'],
    ['TCP_CONCURRENT_DIAL', env.TCP_CONCURRENT_DIAL || '2'],
  ].map(([名, 值]) => `<tr><td class="mn">${名}</td><td>${转义HTML(String(值))}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="glass">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>edgetunnel 管理面板 · ${sse}</title>
<style>${CSS}</style>
</head>
<body>
<div id="toast" role="status" aria-live="polite"></div>
<div class="wrap" id="top">
<header>
  <h1>edgetunnel 管理面板 <small>${sse}</small></h1>
  <div class="row"><a href="/admin/config">经典 JSON 页</a> · <a href="/logout">退出登录</a></div>
</header>
<nav>
  <button type="button" class="on" data-tab="overview">概览</button>
  <button type="button" data-tab="nodes">节点与订阅</button>
  <button type="button" data-tab="config">配置</button>
  <button type="button" data-tab="ops">运维</button>
</nav>

<section class="page on" data-page="overview">
  <div class="clock" id="clock"><span class="t" id="clock-local">--:--:--</span><span class="dim" id="clock-utc">UTC --:--:--</span></div>
  <div class="card">
    <h2>请求用量</h2>
    <div class="hero">
      <div class="gauge"><svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#2a3346" stroke-width="12"/>
        <circle id="ubar-fill" cx="60" cy="60" r="50" fill="none" stroke="#2f81f7" stroke-width="12" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="314" transform="rotate(-90 60 60)"/>
        <text id="utext" x="60" y="66" text-anchor="middle" font-size="12" fill="#e6e8ee"></text>
      </svg></div>
      <div style="flex:1;min-width:240px">
        <div class="kvList">
          <div class="item"><b>协议 / 传输</b>${转义HTML(摘.协议类型)} / ${转义HTML(摘.传输协议)}</div>
          <div class="item"><b>gRPC 模式</b>${转义HTML(摘.gRPC模式)}</div>
          <div class="item"><b>Fingerprint</b>${转义HTML(摘.Fingerprint)}</div>
          <div class="item"><b>路径</b>${转义HTML(摘.path)}</div>
          <div class="item"><b>出站模式</b>${转义HTML(摘.出站)}</div>
          <div class="item"><b>反代</b>${转义HTML(摘.反代)}</div>
          <div class="item"><b>ECH / 0RTT</b>${摘.ECH ? '开' : '关'} / ${摘.启用0RTT ? '开' : '关'}</div>
          <div class="item"><b>SS</b>${转义HTML(摘.SS.加密方式)} / TLS ${摘.SS.TLS ? '开' : '关'}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="badges" id="badges"></div>
  <div class="card">
    <h2>近 30 天用量趋势</h2>
    <div id="chart"><p class="dim">加载中…</p></div>
    <div id="chart-tip" role="tooltip"></div>
  </div>
  <div class="card">
    <h2>访问日志</h2>
    <p class="dim">访问日志不再写入 KV；请在 Cloudflare 控制台 → Workers → 本 Worker → Logs 查看结构化 access 事件（<a href="https://developers.cloudflare.com/workers/observability/logs/" rel="noopener" target="_blank">文档</a>）。</p>
  </div>
</section>

<section class="page" data-page="nodes">
  <div class="card">
    <h2>主节点</h2>
    <div class="mono" id="nlink-code"></div>
    <div class="row">
      <button type="button" class="btn" id="btn-copy-link">复制链接</button>
      <button type="button" class="btn ghost" id="btn-copy-sub">复制通用订阅</button>
      <button type="button" class="btn ghost" id="btn-copy-clash">复制 Clash 原生</button>
      <button type="button" class="btn ghost" id="btn-copy-singbox">复制 sing-box 原生</button>
    </div>
    <div class="qr" id="qr" aria-label="节点二维码"></div>
  </div>
  <div class="card">
    <h2>订阅链接</h2>
    <div class="mono" id="sub-link"></div>
    <p class="dim">订阅更新周期：每 3 小时提示一次；原生订阅为最小配置（Clash/sing-box），不含自定义分流规则。</p>
  </div>
  <div class="card">
    <h2>客户端格式</h2>
    <p class="dim">以下链接在已登录会话下可直接复制（?target=clash/singbox/surge/loon/quanx/v2rayn/shadowrocket）。</p>
    <div class="row" id="fmt-links"></div>
  </div>
</section>

<section class="page" data-page="config">
  <div class="card">
    <h2>常用字段</h2>
    <div class="kvList">
      <div><label>协议类型</label><select id="c-协议类型"><option>vless</option><option>trojan</option><option>ss</option></select></div>
      <div><label>传输协议</label><select id="c-传输协议"><option>ws</option><option>grpc</option><option>xhttp</option></select></div>
      <div><label>PATH</label><input id="c-PATH" /></div>
      <div><label>Fingerprint</label><input id="c-Fingerprint" /></div>
      <div><label>ALPN（空则不生成）</label><input id="c-ALPN" placeholder="h2" /></div>
      <div><label>TLS 分片</label><select id="c-TLS分片"><option value="">关闭</option><option value="Shadowrocket">Shadowrocket</option><option value="Happ">Happ</option></select></div>
      <div class="row" style="grid-column:1/-1"><label><input id="c-ECH" type="checkbox" /> ECH</label><label><input id="c-启用0RTT" type="checkbox" /> 启用 0RTT</label></div>
    </div>
    <div class="row"><button type="button" class="btn" id="btn-save-ess">保存常用字段</button><span class="dim">写入 KV cfg:{host}，跨区传播需时间</span></div>
  </div>
  <div class="card">
    <h2>KV 全量配置（JSON）</h2>
    <div class="row"><button type="button" class="btn" id="btn-save-json">保存到 KV</button><button type="button" class="btn ghost" id="btn-restore">恢复上一版本</button> <button type="button" class="btn ghost" id="btn-load-json">重新加载</button><span id="cfg-status" class="dim"></span></div>
    <label for="cfg">当前配置 JSON</label>
    <textarea id="cfg" rows="14" spellcheck="false" placeholder="点击『重新加载』获取当前生效配置…"></textarea>
  </div>
  <div class="card">
    <h2>环境变量（只读）</h2>
    <table><thead><tr><th scope="col" class="mn">变量</th><th scope="col">当前值</th></tr></thead><tbody>${env只读行}</tbody></table>
  </div>
</section>

<section class="page" data-page="ops">
  <div class="card">
    <h2>Telegram 通知</h2>
    <label>BotToken（留空保持不变）</label><input id="o-tg-bot" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.TG.BotToken || '')) || '未配置')}" />
    <label>ChatID</label><input id="o-tg-chat" value="${转义HTML(String(摘.TG.ChatID || ''))}" />
    <div class="row"><button type="button" class="btn" id="btn-save-tg">保存 TG</button></div>
  </div>
  <div class="card">
    <h2>Cloudflare API 凭据</h2>
    <label>AccountID（留空保持不变）</label><input id="o-cf-account" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.AccountID || '')) || '未配置')}" />
    <label>APIToken（留空保持不变）</label><input id="o-cf-token" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.APIToken || '')) || '未配置')}" />
    <label>Email（备选认证）</label><input id="o-cf-email" value="${转义HTML(String(摘.CF.Email || ''))}" />
    <label>GlobalAPIKey（备选认证）</label><input id="o-cf-gkey" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.GlobalAPIKey || '')) || '未配置')}" />
    <label>UsageAPI（可选，覆盖自动查询）</label><input id="o-cf-usageapi" value="${转义HTML(String(摘.CF.UsageAPI || ''))}" />
    <p class="dim">凭据仅保存在服务端 KV；页面始终掩码展示。留空的字段不会被提交覆盖。</p>
    <div class="row"><button type="button" class="btn" id="btn-save-cf">保存 CF</button><button type="button" class="btn ghost" id="btn-refresh-usage">立即刷新用量</button></div>
  </div>
  <div class="card">
    <h2>自定义优选 IP（ADD.txt）</h2>
    <textarea id="o-add" rows="6" placeholder="每行一个 IP:端口，留空使用自动优选"></textarea>
    <div class="row"><button type="button" class="btn" id="btn-save-add">保存优选 IP</button></div>
  </div>
  <div class="card">
    <h2>危险区</h2>
    <div class="row"><button type="button" class="btn" id="btn-init">重置配置为默认值</button><span class="dim">将清空 KV cfg:{host}，恢复默认；请先备份。</span></div>
  </div>
</section>
</div>
<script>window.__ET__=${JSON.stringify(摘).replace(/</g, '\\u003c')};</script>
<script>${二维码运行时}</script>
<script>
'use strict';
(function () {
  var S = window.__ET__;
  function $(s) { return document.querySelector(s); }
  function toast(msg, ok) {
    var t = $('#toast'); t.textContent = msg; t.className = 'show ' + (ok ? 'ok' : 'err');
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, 3200);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { toast('已复制'); }, function () { toast('复制失败'); }); }
    else {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败'); }
      ta.remove();
    }
  }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var m = (j && (j.error || j.msg)) || ('HTTP ' + r.status); throw new Error(m); }
        return j;
      });
    });
  }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString() : String(n || 0); }

  // 概览增强：实时时钟（Task2）
  function tickClock() {
    var d = new Date(), pad = function (v) { return (v < 10 ? '0' : '') + v; };
    var local = $('#clock-local'); if (local) local.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    var utc = $('#clock-utc'); if (utc) utc.textContent = 'UTC ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }
  setInterval(tickClock, 1000);

  // 概览增强：状态徽章（Task2，textContent 防 XSS）
  function renderBadges() {
    var box = $('#badges'); if (!box) return;
    var rows = [
      ['协议类型', S.协议类型], ['传输协议', S.传输协议], ['gRPC模式', S.gRPC模式], ['Fingerprint', S.Fingerprint],
      ['出站', S.出站], ['反代', S.反代], ['ECH', S.ECH ? '开' : '关'], ['启用0RTT', S.启用0RTT ? '开' : '关']
    ];
    box.innerHTML = '';
    rows.forEach(function (p) {
      var b = document.createElement('span');
      b.className = 'badge';
      b.textContent = p[0] + ': ' + (p[1] === undefined ? '' : p[1]);
      box.appendChild(b);
    });
  }

  // Tab 切换
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) { b.classList.toggle('on', b === btn); });
      Array.prototype.slice.call(document.querySelectorAll('.page')).forEach(function (p) { p.classList.toggle('on', p.dataset.page === btn.dataset.tab); });
      if (btn.dataset.tab === 'overview') loadOverview();
      if (btn.dataset.tab === 'config') loadConfig();
      if (btn.dataset.tab === 'ops') loadOps();
    });
  });

  // 概览
  function loadOverview() {
    var use = S.用量 || {}, max = use.max || 1, total = use.total || 0;
    var c = $('#ubar-fill'); if (c) c.setAttribute('stroke-dashoffset', String(314 - 314 * Math.min(1, total / max)));
    var t = $('#utext'); if (t) t.textContent = fmt(total) + ' / ' + fmt(max) + ' ' + ((total / max) * 100).toFixed(1) + '%';
    api('/admin/api/usage-history').then(function (rows) {
      var box = $('#chart'); if (!box) return;
      if (!rows || !rows.length) { box.innerHTML = '<p class="dim">暂无历史数据（下次用量刷新后写入）</p>'; return; }
      var W = 640, H = 180, pad = 24;
      var maxV = rows.reduce(function (m, r) { return Math.max(m, r.total || 0); }, 1);
      var bw = (W - pad * 2) / rows.length, bars = '', ticks = '';
      rows.forEach(function (r, i) {
        var h = Math.max(2, ((r.total || 0) / maxV) * (H - pad * 2));
        var x = pad + i * bw, y = H - pad - h;
        bars += '<rect x="' + x + '" y="' + y + '" width="' + Math.max(2, bw - 3) + '" height="' + h + '" rx="2" fill="#6e8bff" data-date="' + (r.date || '') + '" data-val="' + (r.total || 0) + '"></rect>';
        if (i % 5 === 0) ticks += '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" font-size="9" fill="#8b93a7" text-anchor="middle">' + (r.date || '').slice(5) + '</text>';
      });
      box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近30天用量">' + bars + ticks + '</svg>';
      bindBarTips(box.querySelector('svg'));
    }).catch(function (e) { var box = $('#chart'); if (box) box.innerHTML = '<p class="dim">用量历史不可用：' + e.message + '</p>'; });
  }

  // 概览增强：趋势图 hover tooltip（Task2）
  function bindBarTips(svg) {
    if (!svg) return;
    var tip = $('#chart-tip'); if (!tip) return;
    Array.prototype.slice.call(svg.querySelectorAll('rect[data-date]')).forEach(function (rect) {
      rect.addEventListener('mousemove', function (ev) {
        var rc = svg.getBoundingClientRect();
        tip.textContent = rect.getAttribute('data-date') + ': ' + fmt(Number(rect.getAttribute('data-val')));
        tip.style.display = 'block';
        tip.style.left = (ev.clientX - rc.left + 12) + 'px';
        tip.style.top = (ev.clientY - rc.top - 30) + 'px';
      });
      rect.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    });
  }

  // 节点与订阅
  function loadNodes() {
    $('#nlink-code').textContent = S.link || '';
    $('#sub-link').textContent = 'https://' + S.host + '/sub?token=' + S.token;
    var qr = $('#qr');
    try { qr.innerHTML = window.QRCode.generateSVG(S.link || 'no-link'); qr.style.display = ''; }
    catch (e) { qr.innerHTML = '<p class="dim">二维码生成失败：' + e.message + '</p>'; }
    var fmts = [['clash', 'Clash'], ['singbox', 'sing-box'], ['surge', 'Surge'], ['loon', 'Loon'], ['quanx', 'Quantumult X'], ['v2rayn', 'v2rayN'], ['shadowrocket', 'Shadowrocket']];
    $('#fmt-links').innerHTML = fmts.map(function (f) {
      return '<button type="button" class="btn ghost" data-fmt="' + f[0] + '">' + f[1] + '</button>';
    }).join('');
    Array.prototype.slice.call(document.querySelectorAll('[data-fmt]')).forEach(function (b) {
      b.addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token + '&target=' + b.dataset.fmt); });
    });
  }
  $('#btn-copy-link').addEventListener('click', function () { copy(S.link || ''); });
  $('#btn-copy-sub').addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token); });
  $('#btn-copy-clash').addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token + '&target=clash&native=1'); });
  $('#btn-copy-singbox').addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token + '&target=singbox&native=1'); });

  // 配置
  function loadConfig() {
    api('/admin/config.json').then(function (cfg) {
      $('#cfg').value = JSON.stringify(cfg, null, 2);
      var p = cfg.协议类型; if (p) $('#c-协议类型').value = p;
      var t = cfg.传输协议; if (t) $('#c-传输协议').value = t;
      $('#c-PATH').value = cfg.PATH || '';
      $('#c-Fingerprint').value = cfg.Fingerprint || '';
      $('#c-ALPN').value = cfg.ALPN || '';
      var ts = cfg.TLS分片; $('#c-TLS分片').value = (ts === 'Shadowrocket' || ts === 'Happ') ? ts : '';
      $('#c-ECH').checked = !!cfg.ECH;
      $('#c-启用0RTT').checked = !!cfg.启用0RTT;
    }).catch(function (e) { statusCfg('加载失败：' + e.message); });
  }
  function statusCfg(m) { var s = $('#cfg-status'); if (s) s.textContent = m; }
  $('#btn-load-json').addEventListener('click', function () { loadConfig(); statusCfg(''); });
  $('#btn-save-json').addEventListener('click', function () {
    var obj; try { obj = JSON.parse($('#cfg').value); } catch (e) { statusCfg('JSON 解析失败：' + e.message); return; }
    statusCfg('正在保存…');
    api('/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
      .then(function (r) { statusCfg('保存成功：' + (r.message || '')); toast('配置已保存', true); })
      .catch(function (e) { statusCfg('保存失败：' + e.message); });
  });
  $('#btn-restore').addEventListener('click', function () {
    if (!confirm('恢复上一版本将覆盖当前配置，继续？')) return;
    api('/admin/config/restore', { method: 'POST' }).then(function (r) { statusCfg('已提交：' + (r.message || '')); }).catch(function (e) { statusCfg('恢复失败：' + e.message); });
  });
  $('#btn-save-ess').addEventListener('click', function () {
    api('/admin/config.json').then(function (cfg) {
      cfg.协议类型 = $('#c-协议类型').value; cfg.传输协议 = $('#c-传输协议').value;
      cfg.PATH = $('#c-PATH').value; cfg.Fingerprint = $('#c-Fingerprint').value;
      cfg.ALPN = $('#c-ALPN').value || '';
      cfg.TLS分片 = $('#c-TLS分片').value || null;
      cfg.ECH = $('#c-ECH').checked; cfg.启用0RTT = $('#c-启用0RTT').checked;
      return api('/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    }).then(function (r) { toast('常用字段已保存', true); statusCfg('已保存：' + (r.message || '')); })
      .catch(function (e) { toast('保存失败：' + e.message, false); });
  });

  // 运维
  function loadOps() {
    api('/admin/ADD.txt').then(function (t) { if (typeof t === 'string') $('#o-add').value = t; })
      .catch(function () { $('#o-add').placeholder = '加载失败'; });
  }
  $('#btn-save-tg').addEventListener('click', function () {
    var body = { BotToken: $('#o-tg-bot').value.trim(), ChatID: $('#o-tg-chat').value.trim() };
    if (!body.BotToken && !body.ChatID) { toast('至少填写 BotToken 或 ChatID', false); return; }
    api('/admin/tg.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { toast('TG 已保存', true); }).catch(function (e) { toast('保存失败：' + e.message, false); });
  });
  $('#btn-save-cf').addEventListener('click', function () {
    var body = { AccountID: $('#o-cf-account').value.trim(), APIToken: $('#o-cf-token').value.trim(), Email: $('#o-cf-email').value.trim(), GlobalAPIKey: $('#o-cf-gkey').value.trim(), UsageAPI: $('#o-cf-usageapi').value.trim() };
    api('/admin/cf.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { toast('CF 凭据已保存', true); }).catch(function (e) { toast('保存失败：' + e.message, false); });
  });
  $('#btn-refresh-usage').addEventListener('click', function () {
    api('/admin/getCloudflareUsage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { toast('用量结果：' + fmt(r.total) + ' / ' + fmt(r.max), true); })
      .catch(function (e) { toast('刷新失败：' + e.message, false); });
  });
  $('#btn-save-add').addEventListener('click', function () {
    fetch('/admin/ADD.txt', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: $('#o-add').value })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (r) { toast(r.message || '已保存', true); }).catch(function (e) { toast('保存失败：' + e.message, false); });
  });
  $('#btn-init').addEventListener('click', function () {
    if (!confirm('确认将配置重置为默认值？此操作不可撤销。')) return;
    api('/admin/init', { method: 'POST' }).then(function (r) { toast('配置已重置', true); loadConfig(); }).catch(function (e) { toast('重置失败：' + e.message, false); });
  });

  renderBadges(); loadOverview(); loadNodes(); loadConfig(); loadOps();
})();
</script>
</body>
</html>`;
}

export { 管理面板HTML };