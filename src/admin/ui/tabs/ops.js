import { 掩码敏感信息, 转义HTML } from '../../../core/html.js';

// 运维 Tab：诊断、Telegram、Cloudflare 凭据、自定义优选 IP 与危险区。
function 运维Tab(摘) {
  return `
<section class="page" id="page-ops" role="tabpanel" data-page="ops">
  <div class="card">
    <h2>诊断信息</h2>
    <div class="mono" id="diag" data-skeleton><div class="sk"></div><div class="sk"></div></div>
    <div class="row"><button type="button" class="btn ghost" id="btn-diag-copy">复制诊断 JSON</button><span class="dim" id="diag-note"></span></div>
    <p class="dim" style="margin-top:10px">登录/写接口受 IP 限流（60 秒）与同源校验保护；会话绑定 UA 与 host，24 小时过期。</p>
  </div>
  <div class="card">
    <h2>Telegram 通知</h2>
    <div class="fld-grid">
      <div class="field"><label class="ctl" for="o-tg-bot">BotToken</label><input id="o-tg-bot" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.TG.BotToken || '')) || '未配置')}" /><span class="hint">留空保持不变</span></div>
      <div class="field"><label class="ctl" for="o-tg-chat">ChatID</label><input id="o-tg-chat" value="${转义HTML(String(摘.TG.ChatID || ''))}" /></div>
    </div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn" id="btn-save-tg">保存 TG</button></div>
  </div>
  <div class="card">
    <h2>Cloudflare API 凭据</h2>
    <div class="fld-grid">
      <div class="field"><label class="ctl" for="o-cf-account">AccountID</label><input id="o-cf-account" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.AccountID || '')) || '未配置')}" /><span class="hint">留空保持不变</span></div>
      <div class="field"><label class="ctl" for="o-cf-token">APIToken</label><input id="o-cf-token" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.APIToken || '')) || '未配置')}" /><span class="hint">推荐；留空保持不变</span></div>
      <div class="field"><label class="ctl" for="o-cf-email">Email</label><input id="o-cf-email" value="${转义HTML(String(摘.CF.Email || ''))}" /><span class="hint">备选认证</span></div>
      <div class="field"><label class="ctl" for="o-cf-gkey">GlobalAPIKey</label><input id="o-cf-gkey" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.GlobalAPIKey || '')) || '未配置')}" /><span class="hint">备选认证</span></div>
      <div class="field"><label class="ctl" for="o-cf-usageapi">UsageAPI</label><input id="o-cf-usageapi" value="${转义HTML(String(摘.CF.UsageAPI || ''))}" /><span class="hint">可选，覆盖自动查询</span></div>
    </div>
    <p class="dim">凭据仅保存在服务端 KV；页面始终掩码展示。留空的字段不会被提交覆盖。</p>
    <div class="row" style="margin-top:14px"><button type="button" class="btn" id="btn-save-cf">保存 CF</button><button type="button" class="btn ghost" id="btn-refresh-usage">立即刷新用量</button></div>
  </div>
  <div class="card">
    <h2>自定义优选 IP（ADD.txt）</h2>
    <div class="row" style="align-items:center"><span class="dim" id="o-add-stats"></span><button type="button" class="btn ghost" id="btn-o-test-add">逐个测试（前10条）</button></div>
    <div class="mono dim" id="o-add-test-out" style="display:none;margin:6px 0"></div>
    <div id="o-add-sk" data-skeleton><div class="sk"></div><div class="sk"></div></div>
    <textarea id="o-add" data-skeleton rows="6" placeholder="每行一个 IP:端口，留空使用自动优选"></textarea>
    <div class="row"><button type="button" class="btn" id="btn-save-add">保存优选 IP</button></div>
  </div>
  <div class="card">
    <h2>危险区</h2>
    <div class="row"><button type="button" class="btn" id="btn-init">重置配置为默认值</button><span class="dim">将清空 KV cfg:{host}，恢复默认；请先备份。</span></div>
  </div>
</section>`;
}

export { 运维Tab };
