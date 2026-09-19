import { 管理面板HTML } from '../src/admin/ui/index.js';
import { readFileSync } from 'node:fs';
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

  // 1.5) P2 自检 Tab / 代理连通测试 / 优选 IP 统计元素
  for (const 标记 of ['id="page-check"', 'id="btn-run-check"', 'id="btn-run-deep"', 'id="btn-copy-check"', 'id="chk-overall"', 'id="chk-bar"', 'id="chk-err"', 'id="chk-cn-pill"', 'id="chk-cn-val"', 'id="chk-ip-pill"', 'id="chk-ip-val"', 'id="chk-deep-pill"', 'id="chk-deep-detail"', 'id="chk-summary"', 'id="btn-node-test"', 'id="n-proto"', 'id="n-test-uri"', 'id="n-test-result"', 'id="o-add-stats"', 'id="btn-o-test-add"', 'id="o-add-test-out"']) {
    assert.ok(html.includes(标记), `HTML 应包含 P2 元素 ${标记}`);
  }
  // 自检 Tab 的状态类名必须存在于样式中（warn/run 态缺样式会静默失效）
  for (const 类名 of ['.pill.ok', '.pill.warn', '.pill.err', '.pill.run', '.chk-row span.bad', '.chk-row span.warn', '.chk-bar.on', '.chk-val']) {
    assert.ok(html.includes(类名), `样式应包含 ${类名}`);
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

  // 4) 命令面板
  for (const 标记 of ['id="cmdk"', 'id="cmd-input"', 'id="cmd-list"', 'id="cmd-empty"']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }

  // 5) 配置编辑器增强（内联校验 / diff 预览）
  for (const 标记 of ['id="cfg-check"', 'id="diff-modal"', 'id="diff-view"', 'id="btn-diff-confirm"']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }

  // 6) Task6 骨架屏标记
  for (const 标记 of ['class="sk"', 'data-skeleton']) {
    assert.ok(html.includes(标记), `HTML 应包含 ${标记}`);
  }

  // 7) 每个内联 <script> 段都必须语法正确（覆盖 client.js 模板字符串转义问题）
  const 内联段 = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(内联段.length >= 3, `应有至少 3 个内联脚本段，实际 ${内联段.length}`);
  内联段.forEach((段, i) => {
    try { new Function(段); } catch (e) { assert.fail(`第 ${i + 1} 个内联脚本语法错误：${e.message}`); }
  });

  // 8) client.js 引用的元素 id 必须都出现在产物 HTML 中，
  //    否则运行时会 null.addEventListener 崩溃（静态断言，无需浏览器）
  const 客户端源码 = readFileSync(new URL('../src/admin/ui/client.js', import.meta.url), 'utf8');
  const 引用id = new Set([
    ...[...客户端源码.matchAll(/\$\('#([^']+)'\)/g)].map((m) => m[1]),
    ...[...客户端源码.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]),
  ]);
  const 缺失id = [...引用id].filter((x) => !html.includes(`id="${x}"`));
  assert.deepEqual(缺失id, [], `client.js 引用了产物中不存在的 id：${缺失id.join(', ')}`);

  console.log('[test-ui] ui.html 结构 / XSS 断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });