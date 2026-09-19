// 节点与订阅 Tab：主节点、订阅链接、客户端格式与二维码弹层。
function 节点Tab() {
  return `
<section class="page" id="page-nodes" role="tabpanel" data-page="nodes">
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
  <div class="card">
    <h2>代理连通测试</h2>
    <div class="fld-grid">
      <div class="field" style="min-width:140px"><label class="ctl" for="n-proto">协议</label><select id="n-proto">
        <option value="socks5" selected>socks5</option>
        <option value="http">http</option>
        <option value="https">https</option>
        <option value="turn">turn</option>
        <option value="sstp">sstp</option>
      </select></div>
      <div class="field" style="grid-column:span 2;min-width:260px"><label class="ctl" for="n-test-uri">代理地址</label><input id="n-test-uri" type="text" placeholder="user:pass@host:port（缺省端口按协议默认）" spellcheck="false" /></div>
    </div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn" id="btn-node-test">测试</button><span class="pill" id="n-test-result">未测试</span></div>
    <p class="dim">复用 /admin/check：在 Worker 边缘实际建连，验证代理通道可用性与响应时间。</p>
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
