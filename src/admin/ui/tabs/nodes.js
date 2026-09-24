// 节点工作区：生成、批量导出、订阅与浏览器本地参数检查。
function 节点Tab() {
  return `
<section class="page" id="page-nodes" role="tabpanel" data-page="nodes">
  <div class="node-heading">
    <div><p class="node-eyebrow">节点工作区</p><h2>连接，从这里开始</h2><p class="dim">生成节点、导出订阅，或检查已有链接的参数。</p></div>
    <div class="node-jumps" aria-label="节点页快捷入口"><a href="#node-builder">生成链接</a><a href="#node-batch">批量导出</a><a href="#node-diagnostics">检查链接</a></div>
  </div>
  <div class="card node-quick">
    <div class="card-head"><div><h2>当前主节点</h2><p class="dim">使用当前配置，直接复制到客户端。</p></div><div class="row"><button type="button" class="btn ghost" id="btn-copy-link">复制主节点</button><button type="button" class="btn ghost" id="btn-open-qr">二维码</button></div></div>
    <details class="node-details"><summary>查看主节点链接</summary><div class="mono" id="nlink-code"></div><div class="qr" id="qr" aria-label="节点二维码"></div></details>
  </div>
  <div class="node-workspace">
    <div class="card" id="node-builder">
      <div class="card-head"><h2>生成链接</h2><span class="pill">仅预览，不修改配置</span></div>
      <form id="n-link-form" novalidate>
        <div class="node-form-grid">
          <div class="field"><label class="ctl" for="n-link-protocol">代理协议</label><select id="n-link-protocol"><option value="vless">VLESS</option><option value="trojan">Trojan</option><option value="ss">Shadowsocks</option></select></div>
          <div class="field"><label class="ctl" for="n-link-transport">传输方式</label><select id="n-link-transport" aria-describedby="n-transport-help"><option value="ws">WebSocket</option><option value="grpc">gRPC</option><option value="xhttp">XHTTP</option></select></div>
          <div class="field node-field-wide"><label class="ctl" for="n-link-address">入口地址</label><input id="n-link-address" type="text" required spellcheck="false" autocomplete="off" placeholder="域名、IPv4 或 [IPv6]" aria-describedby="n-address-help" /><span class="hint" id="n-address-help">支持域名、IPv4 和带方括号的 IPv6。</span></div>
          <div class="field"><label class="ctl" for="n-link-port">端口</label><input id="n-link-port" type="number" required min="1" max="65535" step="1" inputmode="numeric" /></div>
          <div class="field"><label class="ctl" for="n-link-remark">节点备注</label><input id="n-link-remark" type="text" required maxlength="80" /></div>
        </div>
        <p class="dim" id="n-transport-help">VLESS / Trojan 支持三种传输；SS 仅支持 WebSocket。</p>
        <details class="node-details" id="n-advanced"><summary>高级参数</summary><div class="field"><label class="ctl" for="n-link-path">路径 / 服务名称</label><input id="n-link-path" type="text" required maxlength="1024" spellcheck="false" /></div><p class="dim">默认沿用当前配置的路径、认证与 TLS 设置。</p></details>
        <div class="node-form-feedback"><p id="n-form-error" class="err-inline" role="alert" tabindex="-1" hidden></p></div>
        <button type="submit" class="btn node-submit" id="btn-generate-link">生成预览</button>
      </form>
    </div>
    <div class="card node-preview" id="n-preview-panel" aria-busy="false">
      <div class="card-head"><h2>生成结果</h2><span class="pill" id="n-preview-badge">等待生成</span></div>
      <p id="n-preview-status" class="dim" role="status" aria-live="polite">填写左侧参数，生成可复制的节点链接。</p>
      <dl id="n-preview-summary" class="node-facts"></dl>
      <details class="node-details"><summary>查看完整链接</summary><div class="mono" id="n-generated-link">尚未生成链接</div></details>
      <div class="node-actions"><button type="button" class="btn" id="btn-copy-generated" disabled>复制链接</button><button type="button" class="btn ghost" id="btn-qr-generated" disabled>二维码</button><button type="button" class="btn ghost" id="btn-inspect-generated" disabled>检查参数</button></div>
      <p class="node-note">生成成功仅表示参数可用。实际连通需在代理客户端中验证。</p>
    </div>
  </div>
  <div class="card" id="node-batch">
    <div class="card-head"><div><h2>批量节点</h2><p class="dim">沿用上方协议和路径，保留来源地址与备注。</p></div><span class="pill">最多 100 条</span></div>
    <div class="node-toolbar"><div class="row"><button type="button" class="btn ghost" id="btn-batch-add">读取 ADD.txt</button><button type="button" class="btn ghost" id="btn-batch-preferred">读取当前优选</button></div><div class="row"><button type="button" class="btn ghost" id="btn-batch-copy" disabled>复制全部</button><button type="button" class="btn ghost" id="btn-batch-download" disabled>下载 TXT</button></div></div>
    <p class="dim" id="n-batch-status" role="status" aria-live="polite">选择一个来源开始生成。ADD.txt 使用已保存的内容。</p>
    <details id="n-source-panel" class="node-details" hidden><summary>优选来源诊断</summary><ul id="n-batch-sources" class="node-checks"></ul></details>
    <div class="node-search"><label class="ctl" for="n-batch-search">查找节点</label><input id="n-batch-search" type="search" placeholder="搜索地址或备注" autocomplete="off" disabled /><span class="dim" id="n-batch-filter-status"></span></div>
    <div id="n-batch-list" class="node-list"><p class="node-empty">节点列表将在这里显示。</p></div>
    <button type="button" class="btn ghost" id="btn-batch-more" hidden>显示更多</button>
    <details class="node-details"><summary>来源与导出说明</summary><p class="dim">当前优选可能请求远端优选源。无法保留反代规则的候选会跳过；筛选仅用于查找，复制与下载始终包含本次生成的全部节点。</p></details>
  </div>
  <div class="card" id="node-subscriptions">
    <div class="card-head"><div><h2>客户端订阅</h2><p class="dim">将订阅地址添加到客户端，以便后续更新节点。</p></div></div>
    <div class="row"><button type="button" class="btn ghost" id="btn-copy-sub">通用订阅</button><button type="button" class="btn ghost" id="btn-copy-clash">Clash 最小配置</button><button type="button" class="btn ghost" id="btn-copy-singbox">sing-box 最小配置</button></div>
    <details class="node-details"><summary>更多客户端格式与订阅地址</summary><div class="row" id="fmt-links"></div><div class="mono" id="sub-link"></div><p class="dim">Clash 默认订阅包含代理组和精简分流规则；最小配置适合自行管理规则。其他客户端格式可能使用订阅转换器。</p></details>
  </div>
  <div class="card" id="node-diagnostics">
    <div class="card-head"><div><h2>检查已有链接</h2><p class="dim">在本地浏览器检查格式与实例配置，不发送节点链接。</p></div><span class="pill">不测试网络</span></div>
    <form id="n-inspect-form"><label for="n-inspect-input">节点链接</label><textarea id="n-inspect-input" rows="3" maxlength="8192" required spellcheck="false" placeholder="粘贴 vless://、trojan:// 或 ss:// 链接"></textarea><div class="node-actions"><button type="submit" class="btn ghost" id="btn-inspect-link">检查参数</button></div></form>
    <p class="dim" id="n-inspect-status" role="status" aria-live="polite" tabindex="-1">也可以从生成结果或批量节点中直接检查。</p>
    <div id="n-inspect-result"></div>
  </div>
  <details class="card node-details node-egress">
    <summary>出站代理通道测试</summary>
    <p class="dim">供已配置 SOCKS5 / HTTP 等出站代理时使用。测试由 Worker 建立代理通道，不代表上方节点入口或端到端连接可用。</p>
    <div class="node-form-grid">
      <div class="field"><label class="ctl" for="n-proto">出站协议</label><select id="n-proto"><option value="socks5">SOCKS5</option><option value="http">HTTP</option><option value="https">HTTPS</option><option value="turn">TURN</option><option value="sstp">SSTP</option></select></div>
      <div class="field"><label class="ctl" for="n-test-uri">代理地址</label><input id="n-test-uri" type="text" placeholder="user:pass@host:port" spellcheck="false" /></div>
    </div>
    <div class="node-actions"><button type="button" class="btn ghost" id="btn-node-test">测试通道</button><span class="pill" id="n-test-result">未测试</span></div>
  </details>
  <div id="qr-modal" role="dialog" aria-modal="true" aria-label="节点二维码"><div class="box"><div class="row" style="justify-content:space-between"><b>节点二维码</b><button type="button" class="iconbtn" id="btn-qr-close">关闭</button></div><div id="qr-big"></div><div class="row" style="justify-content:center;margin-top:12px"><button type="button" class="btn" id="btn-qr-download">下载 PNG</button></div></div></div>
</section>`;
}

export { 节点Tab };
