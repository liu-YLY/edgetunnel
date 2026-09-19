// 管理面板渲染入口：拼装 head（主题/样式）+ shell + 各 Tab + 客户端脚本。
// 依赖 core/html.js（转义、掩码）、admin/qr.js（二维码运行时）、
// 同目录 theme/styles/icons/client 与 tabs/*。
import { 掩码敏感信息, 转义HTML } from '../../core/html.js';
import { 二维码运行时 } from '../qr.js';
import { 主题CSS, 动效CSS } from './theme.js';
import { 样式CSS } from './styles.js';
import { 图标 } from './icons.js';
import { 客户端脚本 } from './client.js';
import { 概览Tab } from './tabs/overview.js';
import { 节点Tab } from './tabs/nodes.js';
import { 配置Tab } from './tabs/config.js';
import { 运维Tab } from './tabs/ops.js';
import { 自检Tab } from './tabs/check.js';

// 面板渲染入口：env（只读 env 展示）+ config_JSON（生效配置，含掩码凭据）
// + 运行态（可选，运行时实际生效值：出站模式/并发拨号数/各开关）。
// 传运行态是必要的：DEBUG 等开关在代码里按 ['1','true'] 解析、TCP 并发拨号默认值随
// 运营商变化（中国移动为 1），若只按 env 原始值推导会在面板上显示错误数值。
function 管理面板HTML(env, config_JSON, 运行态 = null) {
  const 三态布尔 = (v) => ['1', 'true'].includes(String(v));
  const 开关 = (v) => (v ? '开启' : '关闭');
  const 生效 = (键, 兜底) => (运行态 && 运行态[键] != null ? 运行态[键] : 兜底);
  const 候选列表 = env.PROXYIP ? String(env.PROXYIP).split(/[,，\s]+/).filter(Boolean) : [];
  const 出站 = 候选列表.length
    ? 'manual(' + (候选列表.length > 1 ? 候选列表.length + ' 个候选' : 掩码敏感信息(候选列表[0])) + ')'
    : String(生效('出站模式', String(env.出站模式 || env.EGRESS_MODE || 'auto').toLowerCase()));
  const 摘 = {
    host: config_JSON.HOST || '',
    link: config_JSON.LINK || '',
    subname: config_JSON.优选订阅生成?.SUBNAME || 'edgetunnel',
    token: config_JSON.优选订阅生成?.TOKEN || '',
    出站,
    // 反代 IP 的实际来源：manual 模式取 env.PROXYIP，其余取 KV 配置中的默认反代。
    反代: 候选列表.length ? 掩码敏感信息(候选列表[0]) : (config_JSON.反代?.PROXYIP || 'auto'),
    path: config_JSON.完整节点路径 || '/',
    协议类型: config_JSON.协议类型, 传输协议: config_JSON.传输协议, gRPC模式: config_JSON.gRPC模式 || 'gun',
    Fingerprint: config_JSON.Fingerprint || 'chrome', ECH: !!config_JSON.ECH, 启用0RTT: !!config_JSON.启用0RTT,
    TLS分片: config_JSON.TLS分片 || '', ALPN: config_JSON.ALPN || '',
    SS: { 加密方式: config_JSON.SS?.加密方式 || 'aes-128-gcm', TLS: !!config_JSON.SS?.TLS },
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
    ['出站模式（生效）', 出站],
    ['URL', env.URL || 'nginx'],
    ['PATH', env.PATH || '/'],
    ['GO2SOCKS5', env.GO2SOCKS5 || '（未配置）'],
    ['DEBUG（生效）', 开关(生效('调试日志打印', 三态布尔(env.DEBUG)))],
    ['BEST_SUB（生效）', 开关(生效('BEST_SUB', 三态布尔(env.BEST_SUB)))],
    ['PRELOAD_RACE_DIAL（生效）', 开关(生效('预加载竞速拨号', 三态布尔(env.PRELOAD_RACE_DIAL)))],
    ['PROXY_CONCURRENT_DIAL（生效）', 生效('反代并发拨号数', env.PROXY_CONCURRENT_DIAL || '1')],
    ['TCP_CONCURRENT_DIAL（生效）', 生效('TCP并发拨号数', env.TCP_CONCURRENT_DIAL || '2')],
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
  <div class="row">
    <button type="button" class="iconbtn" id="btn-theme" title="切换深色/浅色主题">${图标('theme')}主题</button>
    <button type="button" class="iconbtn" id="btn-motion" title="切换动效档位">${图标('motion')}动效</button>
    <button type="button" class="iconbtn" id="btn-refresh-top" title="刷新状态与用量">${图标('refresh')}刷新</button>
    <a class="lnk" href="#top">${图标('up')}置顶</a>
    <a class="lnk" href="/logout">${图标('logout')}退出登录</a>
  </div>
</header>`;
}

// 导航项：[data-tab, 完整名, 移动端短名, 图标名]。
// 可访问名称用 aria-label 固定为完整名：移动端只显示短名，若靠可见文本命名，
// 桌面端会把「完整名+短名」拼成一个名字读出来。
const 导航项 = [
  ['overview', '概览', '概览', 'gauge'],
  ['nodes', '节点与订阅', '节点', 'link'],
  ['check', '自检', '自检', 'shield'],
  ['config', '配置', '配置', 'sliders'],
  ['ops', '运维', '运维', 'tool'],
];

function 主导航() {
  const 按钮 = 导航项.map(([键, 全, 短, 图], i) => `<button type="button"${i === 0 ? ' class="on"' : ''} role="tab" aria-selected="${i === 0}" aria-controls="page-${键}" aria-label="${全}" data-tab="${键}">${图标(图)}<span class="lb">${全}</span><span class="ls">${短}</span></button>`);
  return `<nav role="tablist" aria-label="面板分区">
  ${按钮.join('\n  ')}
</nav>`;
}

export { 管理面板HTML };
