import { 管理面板HTML } from '../src/admin/ui/index.js';
import assert from 'node:assert/strict';

;(async () => {
  const 正常配置 = {
    HOST: 'edt2.example.org', LINK: 'vless://aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee@edt2.example.org:443?security=tls&type=ws#edgetunnel',
    PATH: '/', 协议类型: 'vless', 传输协议: 'ws', gRPC模式: 'gun', Fingerprint: 'chrome', ECH: false, 启用0RTT: false,
    完整节点路径: '/', SS: { 加密方式: 'aes-128-gcm', TLS: true },
    优选订阅生成: { TOKEN: 'tok123', SUBNAME: 'edgetunnel', SUBUpdateTime: 3, local: true, 本地IP库: { 随机IP: true, 随机数量: 16, 指定端口: -1 } },
    订阅转换配置: { SUBAPI: 'https://SUBAPI.example.net', SUBCONFIG: 'https://raw.example/cfg.ini', SUBEMOJI: false, SUBLIST: false, UDP: false, XUDP: false, TLS13: false, APPEND_TYPE: false, SORT: false },
    反代: { PROXYIP: 'auto', SOCKS5: { 启用: null, 全局: false, 账号: '', 白名单: [] } },
    TG: { 启用: false, BotToken: null, ChatID: null },
    CF: { Email: null, GlobalAPIKey: null, AccountID: null, APIToken: null, UsageAPI: null, Usage: { success: true, pages: 10, workers: 300, total: 310, max: 100000 } },
  };

  // 1) 四个 Tab + 首屏数据注入 + QR 运行时 + 客户端脚本
  const html = 管理面板HTML({}, 正常配置);
  for (const 需包含 of ['data-tab="overview"', 'data-tab="nodes"', 'data-tab="config"', 'data-tab="ops"', '__ET__', 'window.QRCode', 'usage-history']) {
    assert.ok(html.includes(需包含), `HTML 应包含 ${需包含}`);
  }
  // 2) 订阅链接与节点链接出现在页面（server-render 或 __ET__ 数据中）
  assert.ok(html.includes('tok123') && html.includes('edt2.example.org'), '注入的 token 与 host 出现');

  // 1.1) 动效降级标记（CSS 层；glassmorphism 标记已由 P1 深蓝令牌取代）
  for (const 标记 of ['prefers-reduced-motion']) {
    assert.ok(html.includes(标记), `HTML 应包含主题标记 ${标记}`);
  }

  // 1.2) 概览增强元素标记（Task2：时钟 / 徽章 / 趋势 tooltip）
  for (const id of ['id="clock"', 'id="clock-local"', 'id="clock-utc"', 'id="badges"', 'id="chart-tip"']) {
    assert.ok(html.includes(id), `HTML 应包含概览增强元素 ${id}`);
  }

  // 1.3) 节点体验增强元素
  for (const 标记 of ['id="qr-modal"', 'id="qr-big"', 'id="btn-qr-download"', 'id="btn-open-qr"']) {
    assert.ok(html.includes(标记), `HTML 应包含节点增强元素 ${标记}`);
  }

  // 1.4) 运维/交互增强元素
  for (const 标记 of ['id="diag"', 'id="btn-diag-copy"', 'id="btn-cfg-export"', 'id="btn-cfg-import"', 'id="kbd-help"', 'id="btn-refresh-top"', 'id="top"']) {
    assert.ok(html.includes(标记), `HTML 应包含运维/交互增强元素 ${标记}`);
  }

  // 3) XSS：恶意值必须被转义
  const 恶意 = {
    ...正常配置,
    HOST: '<script>alert(1)</script>', LINK: 'vless://x" onmouseover="alert(1)@evil.test#t',
    优选订阅生成: { ...正常配置.优选订阅生成, SUBNAME: '<b>sub</b>' },
  };
  const html恶 = 管理面板HTML({}, 恶意);
  assert.ok(!html恶.includes('<script>alert(1)</script>'), '未转义的 script 注入不得出现');
  assert.ok(html恶.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'host 以转义形式出现');
  assert.ok(!html恶.includes(' onmouseover="alert(1)'), '属性注入被转义');
  assert.ok(!html恶.includes('<b>sub</b>'), 'SUBNAME 转义');

  // 4) 出站模式摘要：无 PROXYIP 显示 auto
  assert.ok(html.includes('auto'), 'env 无 PROXYIP 时摘要求 auto');

  // 2) P1 视觉与主题标记
  for (const 标记 of ['data-theme="dark"', 'data-motion="full"', '--cut:', 'et_admin_theme', 'et_admin_motion', '[data-theme="light"]', '[data-motion="off"]']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }

  // 3) 主题/动效切换入口与 Tab 可访问性
  for (const 标记 of ['id="btn-theme"', 'id="btn-motion"', 'role="tablist"', 'role="tabpanel"', 'aria-selected']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }

  console.log('[test-ui] ui.html 结构 / XSS 断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });