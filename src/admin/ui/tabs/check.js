// 自检 Tab：一键自检（国内/国外/CF CDN/落地IP）与深度诊断（通道复用、超时、伪装页、代理）。
// 数据来自 GET /admin/api/self-check（?deep=1 含 deep）。
function 自检Tab() {
  return `
<section class="page" id="page-check" role="tabpanel" data-page="check">
  <div class="row">
    <button type="button" class="btn" id="btn-run-check">运行自检</button>
    <button type="button" class="btn ghost" id="btn-run-deep">深度诊断（约 8–20 秒）</button>
    <span class="dim" id="chk-note"></span>
  </div>
  <div class="chk-grid">
    <div class="card chk">
      <h2>国内连通</h2>
      <span class="pill" id="chk-cn-pill" data-chk="cn">未检测</span>
      <div class="mono dim" id="chk-cn-detail" data-skeleton>点击“运行自检”查看<div class="sk"></div></div>
    </div>
    <div class="card chk">
      <h2>国外连通</h2>
      <span class="pill" id="chk-ow-pill" data-chk="ow">未检测</span>
      <div class="mono dim" id="chk-ow-detail" data-skeleton>点击“运行自检”查看<div class="sk"></div></div>
    </div>
    <div class="card chk">
      <h2>CF CDN</h2>
      <span class="pill" id="chk-cf-pill" data-chk="cf">未检测</span>
      <div class="mono dim" id="chk-cf-detail" data-skeleton>点击“运行自检”查看<div class="sk"></div></div>
    </div>
    <div class="card chk">
      <h2>落地IP</h2>
      <span class="pill" id="chk-ip-pill" data-chk="ip">未检测</span>
      <div class="mono dim" id="chk-ip-detail" data-skeleton>点击“运行自检”查看<div class="sk"></div></div>
    </div>
    <div class="card chk">
      <h2>通道诊断</h2>
      <span class="pill" id="chk-deep-pill" data-chk="deep">未检测</span>
      <div class="mono dim" id="chk-deep-detail" data-skeleton>深度诊断未启用<div class="sk"></div></div>
    </div>
  </div>
  <div class="mono dim" id="chk-summary"></div>
</section>`;
}

export { 自检Tab };