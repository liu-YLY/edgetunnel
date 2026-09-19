// 客户端运行时：页面内 JS（IIFE），以字符串形式注入 <script>。
// 自包含：不 import 任何模块，也不引用构建期变量。
// 唯一的外部输入是页面里先于本脚本注入的 window.__ET__。

const 客户端脚本 = `
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

  // —— 主题与动效 ——
  function 当前主题() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function 设置主题(v) {
    var t = v || (当前主题() === 'dark' ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('et_admin_theme', t); } catch (e) {}
    toast('主题：' + (t === 'light' ? '浅色' : '深色'), true);
  }
  var 动效档 = ['full', 'lite', 'off'];
  function 当前动效() { var v = document.documentElement.getAttribute('data-motion'); return 动效档.indexOf(v) >= 0 ? v : 'full'; }
  function 设置动效(v) {
    var i = 动效档.indexOf(当前动效());
    var t = v || 动效档[(i + 1) % 动效档.length];
    document.documentElement.setAttribute('data-motion', t);
    try { localStorage.setItem('et_admin_motion', t); } catch (e) {}
    toast('动效：' + ({ full: '完整', lite: '精简', off: '关闭' })[t], true);
  }
  $('#btn-theme').addEventListener('click', function () { 设置主题(); });
  $('#btn-motion').addEventListener('click', function () { 设置动效(); });

  // —— 弹层焦点管理：打开时聚焦首元素，Tab 循环，Esc 关闭后聚焦回触发元素 ——
  var 焦点栈 = [];
  function 打开弹层(el, 首元素) {
    焦点栈.push(document.activeElement);
    el.classList.add('open');
    var f = 首元素 || el.querySelector('button,input,textarea,select,a[href]');
    if (f) f.focus();
  }
  function 关闭弹层(el) {
    el.classList.remove('open');
    var back = 焦点栈.pop();
    if (back && back.focus) back.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var open = document.querySelector('.open[role="dialog"]');
    if (!open) return;
    var els = open.querySelectorAll('button,input,textarea,select,a[href]');
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // —— 命令面板 ——
  var 动作表 = [
    { 名: '概览', 组: '切换', 跑: function () { 点('[data-tab="overview"]'); } },
    { 名: '节点与订阅', 组: '切换', 跑: function () { 点('[data-tab="nodes"]'); } },
    { 名: '配置', 组: '切换', 跑: function () { 点('[data-tab="config"]'); } },
    { 名: '运维', 组: '切换', 跑: function () { 点('[data-tab="ops"]'); } },
    { 名: '复制主节点链接', 组: '节点', 跑: function () { 点('#btn-copy-link'); } },
    { 名: '复制通用订阅', 组: '节点', 跑: function () { 点('#btn-copy-sub'); } },
    { 名: '复制 Clash 原生订阅', 组: '节点', 跑: function () { 点('#btn-copy-clash'); } },
    { 名: '复制 sing-box 原生订阅', 组: '节点', 跑: function () { 点('#btn-copy-singbox'); } },
    { 名: '打开二维码', 组: '节点', 跑: function () { 点('#btn-open-qr'); } },
    { 名: '下载二维码 PNG', 组: '节点', 跑: function () { 点('#btn-open-qr'); setTimeout(function () { 点('#btn-qr-download'); }, 120); } },
    { 名: '刷新用量', 组: '概览', 跑: function () { 点('#btn-refresh-usage'); } },
    { 名: '刷新全部', 组: '概览', 跑: function () { 点('#btn-refresh-top'); } },
    { 名: '配置：重新加载', 组: '配置', 跑: function () { 点('#btn-load-json'); } },
    { 名: '配置：保存到 KV', 组: '配置', 跑: function () { 点('[data-tab="config"]'); setTimeout(function () { 点('#btn-save-json'); }, 120); } },
    { 名: '配置：导出到剪贴板', 组: '配置', 跑: function () { 点('#btn-cfg-export'); } },
    { 名: '配置：从剪贴板导入', 组: '配置', 跑: function () { 点('#btn-cfg-import'); } },
    { 名: '配置：恢复上一版本', 组: '配置', 跑: function () { 点('#btn-restore'); } },
    { 名: '运维：保存 TG', 组: '运维', 跑: function () { 点('#btn-save-tg'); } },
    { 名: '运维：保存 CF 凭据', 组: '运维', 跑: function () { 点('#btn-save-cf'); } },
    { 名: '运维：保存优选 IP', 组: '运维', 跑: function () { 点('#btn-save-add'); } },
    { 名: '运维：复制诊断 JSON', 组: '运维', 跑: function () { 点('#btn-diag-copy'); } },
    { 名: '运维：重置配置为默认值', 组: '运维', 跑: function () { 点('#btn-init'); } },
    { 名: '切换主题', 组: '外观', 跑: function () { 设置主题(); } },
    { 名: '切换动效档位', 组: '外观', 跑: function () { 设置动效(); } },
    { 名: '打开快捷键帮助', 组: '外观', 跑: function () { 打开弹层($('#kbd-help')); } },
    { 名: '打开 Workers 日志控制台', 组: '外观', 跑: function () { window.open('https://dash.cloudflare.com/?to=/:account/workers/services/edit/edgetunnel/production/logs', '_blank', 'noopener'); } },
  ];
  function 点(sel) { var el = document.querySelector(sel); if (el) el.click(); return !!el; }

  // 子序列模糊匹配：按字符顺序命中即算匹配，返回命中位置用于高亮
  function 模糊(文本, 输入) {
    var t = 文本.toLowerCase(), q = 输入.toLowerCase(), pos = [], i = 0;
    for (var j = 0; j < q.length; j++) {
      var k = t.indexOf(q[j], i);
      if (k < 0) return null;
      pos.push(k); i = k + 1;
    }
    return pos;
  }
  function 高亮(文本, pos) {
    if (!pos || !pos.length) return 转义文本(文本);
    var out = '', set = {}, i;
    for (i = 0; i < pos.length; i++) set[pos[i]] = 1;
    for (i = 0; i < 文本.length; i++) out += set[i] ? '<b>' + 转义文本(文本[i]) + '</b>' : 转义文本(文本[i]);
    return out;
  }
  function 转义文本(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var 命令结果 = [], 命令选中 = 0;
  function 渲染命令(输入) {
    var hits = [];
    动作表.forEach(function (a) {
      if (!输入) { hits.push({ a: a, pos: null }); return; }
      var pos = 模糊(a.名, 输入);
      if (pos) hits.push({ a: a, pos: pos });
    });
    命令结果 = hits; 命令选中 = 0;
    var list = $('#cmd-list');
    list.innerHTML = hits.map(function (h, i) {
      return '<div class="item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '" role="option">' + 高亮(h.a.名, h.pos) + ' <span class="dim">· ' + 转义文本(h.a.组) + '</span></div>';
    }).join('');
    $('#cmd-empty').style.display = hits.length ? 'none' : '';
    Array.prototype.slice.call(list.querySelectorAll('.item')).forEach(function (el) {
      el.addEventListener('click', function () { 执行命令(Number(el.dataset.i)); });
    });
  }
  function 移动命令(步) {
    if (!命令结果.length) return;
    var list = $('#cmd-list'), els = list.querySelectorAll('.item');
    命令选中 = (命令选中 + 步 + 命令结果.length) % 命令结果.length;
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('sel', i === 命令选中);
    if (els[命令选中]) els[命令选中].scrollIntoView({ block: 'nearest' });
  }
  function 执行命令(i) {
    var hit = 命令结果[i];
    if (!hit) return;
    关闭弹层($('#cmdk'));
    hit.a.跑();
  }
  function 打开命令面板() { 渲染命令(''); $('#cmd-input').value = ''; 打开弹层($('#cmdk'), $('#cmd-input')); }
  $('#cmd-input').addEventListener('input', function () { 渲染命令(this.value.trim()); });
  $('#cmd-input').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); 移动命令(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); 移动命令(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); 执行命令(命令选中); }
  });
  $('#cmdk').addEventListener('click', function (e) { if (e.target === this) 关闭弹层($('#cmdk')); });

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
  function switchTab(btn) {
    tabs.forEach(function (b) { b.classList.toggle('on', b === btn); b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
    Array.prototype.slice.call(document.querySelectorAll('.page')).forEach(function (p) { p.classList.toggle('on', p.dataset.page === btn.dataset.tab); });
    try { localStorage.setItem('et_admin_tab', btn.dataset.tab); } catch (e) {}
    if (btn.dataset.tab === 'overview') loadOverview();
    if (btn.dataset.tab === 'config') loadConfig();
    if (btn.dataset.tab === 'ops') { loadOps(); loadDiag(); }
    if (btn.dataset.tab === 'nodes') loadNodes();
  }
  tabs.forEach(function (btn) { btn.addEventListener('click', function () { switchTab(btn); }); });
  (function () {
    var saved = null;
    try { saved = localStorage.getItem('et_admin_tab'); } catch (e) {}
    if (saved) { var b = document.querySelector('[data-tab="' + saved + '"]'); if (b) switchTab(b); }
  })();

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
    var qr = $('#qr'), big = $('#qr-big');
    try {
      qr.innerHTML = window.QRCode.generateSVG(S.link || 'no-link');
      qr.onclick = openQR; qr.style.cursor = 'pointer'; qr.title = '点击放大';
      if (big) big.innerHTML = window.QRCode.generateSVG(S.link || 'no-link', 4);
    } catch (e) { qr.innerHTML = '<p class="dim">二维码生成失败：' + e.message + '</p>'; }
    var fmts = [['clash', 'Clash'], ['singbox', 'sing-box'], ['surge', 'Surge'], ['loon', 'Loon'], ['quanx', 'Quantumult X'], ['v2rayn', 'v2rayN'], ['shadowrocket', 'Shadowrocket']];
    $('#fmt-links').innerHTML = fmts.map(function (f) {
      return '<button type="button" class="btn ghost" data-fmt="' + f[0] + '">' + f[1] + '</button>';
    }).join('');
    Array.prototype.slice.call(document.querySelectorAll('[data-fmt]')).forEach(function (b) {
      b.addEventListener('click', function () { copy('https://' + S.host + '/sub?token=' + S.token + '&target=' + b.dataset.fmt); });
    });
  }
  function openQR() { 打开弹层($('#qr-modal')); }
  function closeQR() { 关闭弹层($('#qr-modal')); }
  var _qrClose = document.getElementById('btn-qr-close');
  if (_qrClose) _qrClose.addEventListener('click', closeQR);
  var _qrModal = document.getElementById('qr-modal');
  if (_qrModal) _qrModal.addEventListener('click', function (e) { if (e.target === this) 关闭弹层($('#qr-modal')); });
  var _btnDl = document.getElementById('btn-qr-download');
  if (_btnDl) _btnDl.addEventListener('click', function () {
    var svg = document.querySelector('#qr-big svg');
    if (!svg) { toast('二维码未生成', false); return; }
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = Math.max(img.width || 180, 180) * 4; c.height = Math.max(img.height || 180, 180) * 4;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      try {
        var a = document.createElement('a'); a.download = 'edgetunnel-qr.png'; a.href = c.toDataURL('image/png');
        document.body.appendChild(a); a.click(); a.remove(); toast('二维码已下载', true);
      } catch (e2) { toast('下载失败：' + e2.message, false); }
    };
    img.onerror = function () { toast('二维码渲染失败', false); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  });
  $('#btn-open-qr').addEventListener('click', function () { 打开弹层($('#qr-modal')); });
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

  // 诊断信息
  function loadDiag() {
    api('/admin/config.json').then(function (cfg) {
      var d = {
        host: S.host, uuid: S.link ? (S.link.split('://')[1] || '').split('@')[0] : '',
        协议: (S.协议类型 || '') + '/' + (S.传输协议 || ''), 出站: S.出站 || '', path: S.path || '',
        Version: cfg.Version || '', UA: navigator.userAgent, generatedAt: new Date().toISOString()
      };
      $('#diag').textContent = JSON.stringify(d, null, 2);
      var note = $('#diag-note'); if (note) note.textContent = '版本 ' + (cfg.Version || '未知');
    }).catch(function (e) { $('#diag').textContent = '诊断数据加载失败：' + e.message; });
  }
  $('#btn-diag-copy').addEventListener('click', function () { copy($('#diag').textContent || ''); });

  // JSON 导出 / 导入
  $('#btn-cfg-export').addEventListener('click', function () {
    if (!$('#cfg').value) { toast('先点击「重新加载」获取配置', false); return; }
    copy($('#cfg').value);
  });
  $('#btn-cfg-import').addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { toast('浏览器不支持剪贴板读取', false); return; }
    navigator.clipboard.readText().then(function (t) {
      var v;
      try { v = JSON.stringify(JSON.parse(t), null, 2); } catch (e) { toast('剪贴板内容不是合法 JSON', false); return; }
      $('#cfg').value = v; statusCfg('已导入，请核对后点击保存');
    }).catch(function () { toast('无法读取剪贴板', false); });
  });

  // 快捷键
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); $('#cmdk').classList.contains('open') ? 关闭弹层($('#cmdk')) : 打开命令面板(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('#cmdk').classList.contains('open')) return;
    var tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape') { 关所有弹层(); return; }
    var map = { '1': 'overview', '2': 'nodes', '3': 'config', '4': 'ops' };
    if (map[e.key]) { 点('[data-tab="' + map[e.key] + '"]'); }
    else if (e.key === 'c' || e.key === 'C') { 点('#btn-copy-link'); }
    else if (e.key === 'r' || e.key === 'R') { 点('#btn-refresh-usage'); }
    else if (e.key === '?') { var h = $('#kbd-help'); h.classList.contains('open') ? 关闭弹层(h) : 打开弹层(h); }
  });
  function 关所有弹层() {
    ['#kbd-help', '#qr-modal', '#cmdk', '#diff-modal'].forEach(function (s) { var el = $(s); if (el && el.classList.contains('open')) 关闭弹层(el); });
  }
  var _kbdClose = document.getElementById('btn-kbd-close');
  if (_kbdClose) _kbdClose.addEventListener('click', function () { 关闭弹层($('#kbd-help')); });
  var _kbd = document.getElementById('kbd-help');
  if (_kbd) _kbd.addEventListener('click', function (e) { if (e.target === this) 关闭弹层($('#kbd-help')); });

  // 回到页面自动刷新用量；header 刷新
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') loadOverview();
  });
  $('#btn-refresh-top').addEventListener('click', function () { loadOverview(); loadNodes(); loadDiag(); toast('已刷新', true); });
  loadDiag();

  renderBadges(); loadOverview(); loadNodes(); loadConfig(); loadOps();
})();
`;

export { 客户端脚本 };
