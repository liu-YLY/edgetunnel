import { 转义HTML } from '../../../core/html.js';

// 配置 Tab：常用字段、KV 全量配置编辑器与环境变量只读表。
function 配置Tab(摘, env只读行) {
  return `
<section class="page" id="page-config" role="tabpanel" data-page="config">
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
    <div class="row"><button type="button" class="btn" id="btn-save-json">保存到 KV</button><button type="button" class="btn ghost" id="btn-restore">恢复上一版本</button> <button type="button" class="btn ghost" id="btn-load-json">重新加载</button><button type="button" class="btn ghost" id="btn-cfg-export">导出到剪贴板</button><button type="button" class="btn ghost" id="btn-cfg-import">从剪贴板导入</button><span id="cfg-status" class="dim"></span></div>
    <label for="cfg">当前配置 JSON</label>
    <textarea id="cfg" rows="14" spellcheck="false" placeholder="点击『重新加载』获取当前生效配置…"></textarea>
    <div id="cfg-check" role="status" aria-live="polite"></div>
  </div>
  <div class="card">
    <h2>环境变量（只读）</h2>
    <table><thead><tr><th scope="col" class="mn">变量</th><th scope="col">当前值</th></tr></thead><tbody>${env只读行}</tbody></table>
  </div>
</section>`;
}

export { 配置Tab };
