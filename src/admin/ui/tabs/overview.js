import { 转义HTML } from '../../../core/html.js';

// 概览 Tab：首屏时钟、用量仪表、趋势图容器与访问日志说明。
function 概览Tab(摘) {
  return `
<section class="page on" id="page-overview" role="tabpanel" data-page="overview">
  <div class="clock" id="clock"><span class="t" id="clock-local">--:--:--</span><span class="dim" id="clock-utc">UTC --:--:--</span></div>
  <div class="card">
    <h2>请求用量</h2>
    <div class="hero">
      <div class="gauge"><svg viewBox="0 0 120 120" width="120" height="120">
        <circle class="g-track" cx="60" cy="60" r="50" fill="none" stroke-width="12"/>
        <circle id="ubar-fill" class="g-fill" cx="60" cy="60" r="50" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="314" transform="rotate(-90 60 60)"/>
        <text id="utext" class="g-text" x="60" y="66" text-anchor="middle"></text>
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
    <div class="dim" id="usage-note">用量口径：今日 UTC 00:00 至今（Workers + Pages Functions 请求数）</div>
  </div>
  <div class="badges" id="badges"></div>
  <div class="card">
    <h2>近 30 天用量趋势</h2>
    <div id="chart" data-skeleton><div class="sk" style="width:92%"></div><div class="sk" style="width:74%"></div></div>
    <div id="chart-tip" role="tooltip"></div>
    <div class="dim">基于每日快照：仅记录当日有请求活动并触发用量刷新的日期，无活动日不会产生数据点。</div>
  </div>
  <div class="card">
    <h2>访问日志</h2>
    <p class="dim">访问日志不再写入 KV；请在 Cloudflare 控制台 → Workers → 本 Worker → Logs 查看结构化 access 事件（<a href="https://developers.cloudflare.com/workers/observability/logs/" rel="noopener" target="_blank">文档</a>）。</p>
  </div>
</section>`;
}

export { 概览Tab };
