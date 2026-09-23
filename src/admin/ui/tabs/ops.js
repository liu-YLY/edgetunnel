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
    <h2>优选 API</h2>
    <div class="fld-grid">
      <div class="field" style="grid-column:1/-1"><label class="ctl" for="o-pref-api">API 地址</label><input id="o-pref-api" type="text" placeholder="https://example.com/ip.txt 或 sub://订阅生成器地址" spellcheck="false" /><span class="hint">仅验证解析结果，不写入配置；通过后可把该行原样写进下方 ADD.txt，由订阅时解析</span></div>
      <div class="field"><label class="ctl" for="o-pref-port">默认端口</label><input id="o-pref-port" type="text" inputmode="numeric" value="443" /><span class="hint">结果行内已带端口时以行内为准</span></div>
    </div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn" id="btn-verify-api">验证优选 API</button><span class="pill" id="o-api-result">未验证</span></div>
    <div class="mono" id="o-api-out" style="display:none;margin:8px 0 0;white-space:pre-wrap"></div>
  </div>
  <div class="card">
    <h2>本地 IP 库</h2>
    <div class="fld-grid">
      <div class="field"><label class="ctl">随机 IP</label><label class="switch"><input id="o-lib-random" type="checkbox" /><i></i><span>启用随机 IP</span></label><span class="hint">关闭时改用下方 ADD.txt 的自定义列表</span></div>
      <div class="field"><label class="ctl" for="o-lib-count">随机数量</label><input id="o-lib-count" type="text" inputmode="numeric" value="16" /><span class="hint">1–100</span></div>
      <div class="field"><label class="ctl" for="o-lib-port">指定端口</label><input id="o-lib-port" type="text" inputmode="numeric" value="-1" /><span class="hint">-1 表示在 CF 常用端口内随机</span></div>
    </div>
    <div class="row" style="margin-top:14px"><button type="button" class="btn" id="btn-save-lib">保存到配置</button><span class="dim" id="o-lib-note"></span></div>
  </div>
  <div class="card">
    <h2>自定义优选 IP（ADD.txt）</h2>
    <div class="row" style="align-items:center"><span class="dim" id="o-add-stats"></span></div>
    <div id="o-add-sk" data-skeleton><div class="sk"></div><div class="sk"></div></div>
    <textarea id="o-add" data-skeleton rows="6" placeholder="每行一个 IP:端口，留空使用自动优选"></textarea>
    <div class="row"><button type="button" class="btn" id="btn-save-add">保存优选 IP</button><button type="button" class="btn ghost" id="btn-o-test-add">批量测速并排序</button><span class="dim" id="o-add-test-note"></span></div>
    <p class="dim">测速为边缘建连延迟（TCP connect），不是带宽；最多测前 100 条，按延迟升序排列，不可达置后。</p>
    <div class="mono dim" id="o-add-test-out" style="display:none;margin:6px 0"></div>
  </div>
  <div class="card">
    <h2>危险区</h2>
    <div class="row"><button type="button" class="btn" id="btn-init">重置配置为默认值</button><span class="dim">将清空 KV cfg:{host}，恢复默认；请先备份。</span></div>
  </div>
</section>`;
}

export { 运维Tab };
