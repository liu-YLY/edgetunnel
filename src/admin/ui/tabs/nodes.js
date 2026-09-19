// 节点与订阅 Tab：主节点、订阅链接、客户端格式与二维码弹层。
function 节点Tab() {
  return `
<section class="page" data-page="nodes">
  <div class="card">
    <h2>主节点</h2>
    <div class="mono" id="nlink-code"></div>
    <div class="row">
      <button type="button" class="btn" id="btn-copy-link">复制链接</button>
      <button type="button" class="btn ghost" id="btn-copy-sub">复制通用订阅</button>
      <button type="button" class="btn ghost" id="btn-copy-clash">复制 Clash 原生</button>
      <button type="button" class="btn ghost" id="btn-copy-singbox">复制 sing-box 原生</button>
      <button type="button" class="btn ghost" id="btn-open-qr">查看二维码</button>
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
  <div id="qr-modal" role="dialog" aria-modal="true" aria-label="节点二维码">
    <div class="box">
      <div class="row" style="justify-content:space-between"><b>节点二维码</b><button type="button" class="iconbtn" id="btn-qr-close">关闭</button></div>
      <div id="qr-big"></div>
      <div class="row" style="justify-content:center;margin-top:12px"><button type="button" class="btn" id="btn-qr-download">下载 PNG</button></div>
    </div>
  </div>
</section>`;
}

export { 节点Tab };
