// 自检 Tab：一键出口连通自检（国内/国外/CF CDN/落地IP）与深度通道诊断
//（建连复用、超时判定、伪装页、反代建连）。
// 数据来自 GET /admin/api/self-check（?deep=1 含 deep）。
function 自检Tab() {
  return `
<section class="page" id="page-check" role="tabpanel" data-page="check">
  <div class="card chk-panel">
    <div class="chk-head">
      <button type="button" class="btn" id="btn-run-check">运行自检</button>
      <button type="button" class="btn ghost" id="btn-run-deep" title="含建连复用/超时判定/伪装页/反代建连采样">深度诊断</button>
      <button type="button" class="iconbtn" id="btn-copy-check" title="复制完整诊断 JSON，便于反馈">复制 JSON</button>
      <span class="dim" id="chk-note">未检测</span>
    </div>
    <div class="chk-bar" id="chk-bar"><i></i></div>
    <div class="chk-sum">
      <span class="pill" id="chk-overall">未检测</span>
      <span class="dim" id="chk-summary">点击“运行自检”检查本 Worker 的出口连通性</span>
      <span class="dim" id="chk-at"></span>
    </div>
    <div id="chk-err"></div>
  </div>
  <div class="chk-grid">
    <div class="card chk" id="chk-cn">
      <div class="chk-top"><span class="chk-name">国内连通</span><span class="pill" id="chk-cn-pill">未检测</span></div>
      <div class="chk-val" id="chk-cn-val">—</div>
      <div class="chk-kv dim" id="chk-cn-detail">点击“运行自检”查看</div>
    </div>
    <div class="card chk" id="chk-ow">
      <div class="chk-top"><span class="chk-name">国外连通</span><span class="pill" id="chk-ow-pill">未检测</span></div>
      <div class="chk-val" id="chk-ow-val">—</div>
      <div class="chk-kv dim" id="chk-ow-detail">点击“运行自检”查看</div>
    </div>
    <div class="card chk" id="chk-cf">
      <div class="chk-top"><span class="chk-name">Cloudflare CDN</span><span class="pill" id="chk-cf-pill">未检测</span></div>
      <div class="chk-val" id="chk-cf-val">—</div>
      <div class="chk-kv dim" id="chk-cf-detail">点击“运行自检”查看</div>
    </div>
    <div class="card chk" id="chk-tw">
      <div class="chk-top"><span class="chk-name">Twitter / X</span><span class="pill" id="chk-tw-pill">未检测</span></div>
      <div class="chk-val" id="chk-tw-val">—</div>
      <div class="chk-kv dim" id="chk-tw-detail">点击“运行自检”查看</div>
    </div>
    <div class="card chk" id="chk-cg">
      <div class="chk-top"><span class="chk-name">ChatGPT</span><span class="pill" id="chk-cg-pill">未检测</span></div>
      <div class="chk-val" id="chk-cg-val">—</div>
      <div class="chk-kv dim" id="chk-cg-detail">点击“运行自检”查看</div>
    </div>
    <div class="card chk" id="chk-ip">
      <div class="chk-top"><span class="chk-name">落地 IP</span><span class="pill" id="chk-ip-pill">未检测</span></div>
      <div class="chk-val" id="chk-ip-val">—</div>
      <div class="chk-kv dim" id="chk-ip-detail">点击“运行自检”查看</div>
    </div>
  </div>
  <p class="dim chk-legend" id="chk-legend">💡 各检测项含义：<b>国内</b> 由分流规则决定；<b>国外</b> 反映优选 IP 出口；<b>CF CDN</b>、<b>Twitter/X</b>、<b>ChatGPT</b> 走 Cloudflare 与目标站点，能体现代理落地可达性；<b>落地 IP</b> 是当前出口地址。</p>
  <div class="card chk chk-wide" id="chk-deep">
    <div class="chk-top">
      <span class="chk-name">通道诊断</span>
      <span class="pill" id="chk-deep-pill">未检测</span>
    </div>
    <div class="chk-kv dim" id="chk-deep-detail">
      <div class="chk-row"><b>建连复用</b><span>深度诊断未启用</span></div>
      <div class="chk-row"><b>超时判定</b><span>深度诊断未启用</span></div>
      <div class="chk-row"><b>伪装页</b><span>深度诊断未启用</span></div>
      <div class="chk-row"><b>反代建连</b><span>深度诊断未启用</span></div>
    </div>
    <p class="dim" id="chk-deep-hint">通道诊断：真实建连采样的复用命中率、超时判定、伪装页与反代响应，用于判断是否调整握手超时预算与连接复用策略。（约 5–20 秒）</p>
  </div>
</section>`;
}

export { 自检Tab };
