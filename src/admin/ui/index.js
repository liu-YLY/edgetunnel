// 管理面板渲染入口：拼装 head（主题/样式）+ shell + 各 Tab + 客户端脚本。
// 依赖 core/html.js（转义、掩码）、admin/qr.js（二维码运行时）、
// 同目录 theme/styles/client 与 tabs/*。
import { 掩码敏感信息, 转义HTML } from '../../core/html.js';
import { 二维码运行时 } from '../qr.js';
import { 主题CSS, 动效CSS } from './theme.js';
import { 样式CSS } from './styles.js';
import { 客户端脚本 } from './client.js';
import { 概览Tab } from './tabs/overview.js';
import { 节点Tab } from './tabs/nodes.js';
import { 配置Tab } from './tabs/config.js';
import { 运维Tab } from './tabs/ops.js';
import { 自检Tab } from './tabs/check.js';

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
<html lang="zh-CN" data-theme="dark" data-motion="full">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>edgetunnel 管理面板 · ${sse}</title>
<script>(function(){try{
var d=document.documentElement,t=localStorage.getItem('et_admin_theme'),m=localStorage.getItem('et_admin_motion');
var light=t?t==='light':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches);
d.setAttribute('data-theme',light?'light':'dark');
if(!m)m=(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'off':'full';
d.setAttribute('data-motion',m);
}catch(e){}})();</script>
<style>${主题CSS()}${样式CSS()}${动效CSS()}</style>
</head>
<body>
<div id="toast" role="status" aria-live="polite"></div>
${快捷键帮助浮层()}
${命令面板()}
${差异浮层()}
<div class="wrap" id="top">
${页头(sse)}
${主导航()}
${概览Tab(摘)}
${节点Tab()}
${自检Tab()}
${配置Tab(摘, env只读行)}
${运维Tab(摘)}
</div>
<script>window.__ET__=${JSON.stringify(摘).replace(/</g, '\\u003c')};</script>
<script>${二维码运行时}</script>
<script>${客户端脚本}</script>
</body>
</html>`;
}

function 快捷键帮助浮层() {
  return `<div id="kbd-help" role="dialog" aria-modal="true" aria-label="快捷键">
  <div class="box">
    <div class="row" style="justify-content:space-between"><b>键盘快捷键</b><button type="button" class="iconbtn" id="btn-kbd-close">关闭</button></div>
    <table>
      <tbody>
        <tr><td><kbd>1</kbd>−<kbd>5</kbd></td><td>切换 Tab（概览/节点/自检/配置/运维）</td></tr>
        <tr><td><kbd>c</kbd></td><td>复制主节点链接</td></tr>
        <tr><td><kbd>r</kbd></td><td>立即刷新用量</td></tr>
        <tr><td><kbd>?</kbd></td><td>打开/关闭本帮助</td></tr>
        <tr><td><kbd>⌘K</kbd></td><td>打开命令面板</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>关闭弹窗</td></tr>
      </tbody>
    </table>
  </div>
</div>`;
}

function 命令面板() {
  return `<div id="cmdk" role="dialog" aria-modal="true" aria-label="命令面板">
  <div class="box">
    <input id="cmd-input" type="text" placeholder="输入动作名称…（↑↓ 选择，Enter 执行，Esc 关闭）" autocomplete="off" spellcheck="false" />
    <div class="list" id="cmd-list" role="listbox"></div>
    <div class="empty" id="cmd-empty" style="display:none">无匹配动作</div>
  </div>
</div>`;
}

function 差异浮层() {
  return `<div id="diff-modal" role="dialog" aria-modal="true" aria-label="保存前差异预览">
  <div class="box">
    <div class="row" style="justify-content:space-between"><b>保存前差异预览</b><span class="dim" id="diff-count"></span></div>
    <div id="diff-view"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px">
      <button type="button" class="btn ghost" id="btn-diff-cancel">取消</button>
      <button type="button" class="btn" id="btn-diff-confirm">确认保存</button>
    </div>
  </div>
</div>`;
}

function 页头(sse) {
  return `<header>
  <h1>edgetunnel 管理面板 <small>${sse}</small></h1>
  <div class="row"><button type="button" class="iconbtn" id="btn-theme" title="切换深色/浅色">◐ 主题</button><button type="button" class="iconbtn" id="btn-motion" title="切换动效档位">≋ 动效</button><button type="button" class="iconbtn" id="btn-refresh-top" title="刷新状态与用量">⟳ 刷新</button><a href="#top" style="color:var(--mut)">↑ 置顶</a> · <a href="/logout">退出登录</a></div>
</header>`;
}

function 主导航() {
  return `<nav role="tablist" aria-label="面板分区">
  <button type="button" class="on" role="tab" aria-selected="true" aria-controls="page-overview" data-tab="overview">概览</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="page-nodes" data-tab="nodes">节点与订阅</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="page-check" data-tab="check">自检</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="page-config" data-tab="config">配置</button>
  <button type="button" role="tab" aria-selected="false" aria-controls="page-ops" data-tab="ops">运维</button>
</nav>`;
}

export { 管理面板HTML };
