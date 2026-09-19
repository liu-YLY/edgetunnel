import { 掩码敏感信息, 转义HTML } from '../../../core/html.js';

// 运维 Tab：诊断、Telegram、Cloudflare 凭据、自定义优选 IP 与危险区。
function 运维Tab(摘) {
  return `
<section class="page" id="page-ops" role="tabpanel" data-page="ops">
  <div class="card">
    <h2>诊断信息</h2>
    <div class="mono" id="diag"></div>
    <div class="row"><button type="button" class="btn ghost" id="btn-diag-copy">复制诊断 JSON</button><span class="dim" id="diag-note"></span></div>
    <p class="dim" style="margin-top:10px">登录/写接口受 IP 限流（60 秒）与同源校验保护；会话绑定 UA 与 host，24 小时过期。</p>
  </div>
  <div class="card">
    <h2>Telegram 通知</h2>
    <label>BotToken（留空保持不变）</label><input id="o-tg-bot" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.TG.BotToken || '')) || '未配置')}" />
    <label>ChatID</label><input id="o-tg-chat" value="${转义HTML(String(摘.TG.ChatID || ''))}" />
    <div class="row"><button type="button" class="btn" id="btn-save-tg">保存 TG</button></div>
  </div>
  <div class="card">
    <h2>Cloudflare API 凭据</h2>
    <label>AccountID（留空保持不变）</label><input id="o-cf-account" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.AccountID || '')) || '未配置')}" />
    <label>APIToken（留空保持不变）</label><input id="o-cf-token" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.APIToken || '')) || '未配置')}" />
    <label>Email（备选认证）</label><input id="o-cf-email" value="${转义HTML(String(摘.CF.Email || ''))}" />
    <label>GlobalAPIKey（备选认证）</label><input id="o-cf-gkey" type="password" placeholder="${转义HTML(掩码敏感信息(String(摘.CF.GlobalAPIKey || '')) || '未配置')}" />
    <label>UsageAPI（可选，覆盖自动查询）</label><input id="o-cf-usageapi" value="${转义HTML(String(摘.CF.UsageAPI || ''))}" />
    <p class="dim">凭据仅保存在服务端 KV；页面始终掩码展示。留空的字段不会被提交覆盖。</p>
    <div class="row"><button type="button" class="btn" id="btn-save-cf">保存 CF</button><button type="button" class="btn ghost" id="btn-refresh-usage">立即刷新用量</button></div>
  </div>
  <div class="card">
    <h2>自定义优选 IP（ADD.txt）</h2>
    <textarea id="o-add" rows="6" placeholder="每行一个 IP:端口，留空使用自动优选"></textarea>
    <div class="row"><button type="button" class="btn" id="btn-save-add">保存优选 IP</button></div>
  </div>
  <div class="card">
    <h2>危险区</h2>
    <div class="row"><button type="button" class="btn" id="btn-init">重置配置为默认值</button><span class="dim">将清空 KV cfg:{host}，恢复默认；请先备份。</span></div>
  </div>
</section>`;
}

export { 运维Tab };
