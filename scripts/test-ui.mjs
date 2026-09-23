import { 管理面板HTML } from '../src/admin/ui/index.js';
import { 登录页面 } from '../src/admin/pages.js';
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

  // 1.2) 概览增强元素标记（Task2：时钟 / 用量大数字 / 趋势 tooltip）
  for (const id of ['id="clock"', 'id="clock-local"', 'id="clock-utc"', 'id="uval"', 'id="chart-tip"']) {
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
  for (const 标记 of ['id="page-check"', 'id="btn-run-check"', 'id="btn-run-deep"', 'id="btn-copy-check"', 'id="chk-overall"', 'id="chk-bar"', 'id="chk-err"', 'id="chk-cn-pill"', 'id="chk-cn-val"', 'id="chk-ip-pill"', 'id="chk-ip-val"', 'id="chk-tw-pill"', 'id="chk-cg-pill"', 'id="chk-deep-pill"', 'id="chk-deep-detail"', 'id="chk-summary"', 'id="chk-legend"', 'id="btn-node-test"', 'id="n-proto"', 'id="n-test-uri"', 'id="n-test-result"', 'id="o-add-stats"', 'id="btn-o-test-add"', 'id="o-add-test-out"']) {
    assert.ok(html.includes(标记), `HTML 应包含 P2 元素 ${标记}`);
  }
  // 自检 Tab 的状态类名必须存在于样式中（warn/run 态缺样式会静默失效）
  for (const 类名 of ['.pill.ok', '.pill.warn', '.pill.err', '.pill.run', '.chk-row span.bad', '.chk-row span.warn', '.chk-bar.on', '.chk-val']) {
    assert.ok(html.includes(类名), `样式应包含 ${类名}`);
  }

  // 1.5.1) 优选：API 验证 / 本地 IP 库 / 批量测速排序（面板内入口，后端复用既有路由）
  for (const 标记 of ['id="o-pref-api"', 'id="o-pref-port"', 'id="btn-verify-api"', 'id="o-api-result"', 'id="o-api-out"', 'id="o-lib-random"', 'id="o-lib-count"', 'id="o-lib-port"', 'id="btn-save-lib"', 'id="o-lib-note"', 'id="o-add-test-note"']) {
    assert.ok(html.includes(标记), `HTML 应包含优选元素 ${标记}`);
  }
  assert.ok(html.includes('批量测速并排序'), 'ADD.txt 测速按钮文案应为批量测速并排序');
  // 测速结果与 API 结果都是多行文本：容器必须保留换行/分行渲染，否则会被折叠成一行
  assert.ok(/id="o-api-out"[^>]*white-space:pre-wrap/.test(html), '优选 API 结果容器须保留换行');

  // 1.6) 用量卡说明 + SVG 走主题变量（硬编码浅色会让浅色主题下的数值不可见）
  for (const 标记 of ['id="usage-note"', '.g-text', '.g-fill', '.g-track', '.g-base', '#chart rect{fill:var(--acc)}']) {
    assert.ok(html.includes(标记), `HTML/样式应包含 ${标记}`);
  }
  assert.ok(!html.includes('#e6e8ee'), 'SVG 不应再硬编码浅色文字（浅色主题下不可见）');
  // 用量环：半径/周长改过就必须同步 JS 里的进度算法，故断言 JS 从元素读周长而不是写死数字
  const 环周长 = Number((html.match(/id="ubar-fill"[^>]*stroke-dasharray="(\d+)"/) || [])[1]);
  assert.ok(环周长 > 300, `用量环应有显式周长，实际 ${环周长}`);
  assert.ok(html.includes("c.getAttribute('stroke-dasharray')"), '进度算法应从元素读取周长，避免与标记失配');
  // 趋势图 viewBox 宽度须按容器实测宽度生成，写死会在宽屏被等比放大成"柱子高得离谱"
  assert.ok(html.includes('box.clientWidth'), '趋势图 viewBox 宽度应跟随容器实测宽度');

  // 1.7) 生效值展示：运行时值必须覆盖 env 原始值推导。
  // 背景：DEBUG 等开关实际按 ['1','true'] 解析（env='false' 曾显示成"开启"）；
  // TCP 并发拨号默认值随运营商变化（中国移动为 1），不能硬编码 2。
  const 生效HTML = 管理面板HTML({ DEBUG: 'false', TCP_CONCURRENT_DIAL: '' }, 正常配置, { 出站模式: 'region', BEST_SUB: true, 调试日志打印: false, 预加载竞速拨号: true, 反代并发拨号数: 1, TCP并发拨号数: 1 });
  assert.ok(生效HTML.includes('出站模式（生效）') && 生效HTML.includes('region'), '应显示生效出站模式 region');
  assert.ok(生效HTML.includes('DEBUG（生效）</td><td>关闭'), 'DEBUG=false 必须显示关闭，而不是按真值判断的开启');
  assert.ok(生效HTML.includes('TCP_CONCURRENT_DIAL（生效）</td><td>1'), 'TCP 并发拨号应显示生效值 1（非硬编码 2）');
  assert.ok(生效HTML.includes('PRELOAD_RACE_DIAL（生效）</td><td>开启'), '预加载竞速拨号应显示生效值');
  assert.ok(生效HTML.includes('PROXY_CONCURRENT_DIAL（生效）</td><td>1'), '反代并发拨号应显示生效值');

  // 1.8) HUD 表单组件：字段组 / 科幻开关 / 双列网格 / 优雅 select。
  // 开关必须是 <label class="switch"> 内含 checkbox（id 与 checked 语义不变），
  // 否则 client.js 的 $('#c-ECH').checked 赋值会失效。
  for (const 类 of ['.fld-grid', '.field', '.field .ctl', '.field .hint', '.switch', '.switch input:checked + i', 'button.btn::after']) {
    assert.ok(html.includes(类), `样式应包含 HUD 表单组件 ${类}`);
  }
  assert.ok(html.includes('<label class="switch"><input id="c-ECH" type="checkbox"'), 'ECH 必须是 switch 结构中的 checkbox');
  assert.ok(html.includes('<label class="switch"><input id="c-启用0RTT" type="checkbox"'), '0RTT 必须是 switch 结构中的 checkbox');
  assert.ok(html.includes('appearance:none'), 'select 必须去除原生外观换自定义箭头');
  assert.ok(html.includes('id="c-协议类型"') && html.includes('id="c-传输协议"') && html.includes('id="c-TLS分片"'), '常用字段 select id 必须保留');
  assert.ok(html.includes('id="o-tg-bot"') && html.includes('id="o-cf-token"') && html.includes('id="o-cf-usageapi"'), '凭据字段 id 必须保留');
  assert.ok(html.includes('id="n-proto"') && html.includes('id="n-test-uri"'), '代理测试字段 id 必须保留');

  // 1.9) JSON 编辑器升级：行号列 + overlay 高亮层 + 状态栏 + 弹窗装饰
  for (const 标记 of ['id="cfg-ln"', 'id="cfg-hl"', 'id="cfg-pos"', 'id="cfg-state"', '.cfg-editor textarea', '.tk-key', '.tk-str', '.tk-num', '@keyframes pop-in', 'id="cfg"']) {
    assert.ok(html.includes(标记), `HTML/样式应包含编辑器组件 ${标记}`);
  }
  // 行号栏必须 white-space:pre：默认 normal 会把 "1\n2\n3…" 折叠成一行再自动换行，
  // 45 个行号糊成一团数字，行号列等于失效。
  assert.ok(/\.cfg-editor \.cfg-ln\{[^}]*white-space:pre/.test(html), '行号栏须 white-space:pre，否则行号会被折叠换行');
  // 三层（行号 / 高亮 / textarea）的左边界必须严格衔接，错 1px 就会逐行漂移
  const 行号宽 = Number((html.match(/\.cfg-editor \.cfg-ln\{[^}]*width:(\d+)px/) || [])[1]);
  const 高亮左 = Number((html.match(/\.cfg-editor pre\{[^}]*left:(\d+)px/) || [])[1]);
  const 编辑左 = Number((html.match(/\.cfg-editor textarea\{[^}]*padding-left:(\d+)px/) || [])[1]);
  assert.equal(高亮左, 行号宽 + 1, `高亮层 left(${高亮左}px) 应等于行号宽+1px 边框(${行号宽 + 1}px)`);
  assert.equal(编辑左, 高亮左 + 11, `textarea 左内边距(${编辑左}px) 应与高亮层文字起点一致(${高亮左 + 11}px)`);
  // textarea 须 wrap=off 才能与不换行的 <pre> 高亮层逐像素对齐
  assert.ok(html.includes('<textarea id="cfg" rows="14" wrap="off"'), 'JSON 编辑器须 wrap=off');

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
  for (const 标记 of ['data-theme="dark"', 'data-motion="full"', '--btnfg:', 'et_admin_theme', 'et_admin_motion', '[data-theme="light"]', '[data-motion="off"]']) {
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

  // 6.1) 图标系统：顶栏不得再用 ◐ / ≋ / ⟳ / ↑ 这类几何字形当图标
  for (const 字形 of ['◐', '≋', '⟳']) {
    assert.ok(!html.includes(字形), `顶栏不应再用字形 ${字形} 充当图标，应使用内联 SVG`);
  }
  assert.ok(html.includes('<svg class="ic"'), '应存在内联 SVG 图标（class="ic"）');
  // 顶栏 3 个按钮 + 2 个链接 + 导航 5 项 = 10 个图标，少于 10 说明有位置漏改
  assert.ok([...html.matchAll(/<svg class="ic"/g)].length >= 10, '图标数量应覆盖顶栏与全部导航项');
  assert.ok(html.includes('aria-hidden="true"'), '装饰性图标须对辅助技术隐藏');
  assert.ok(html.includes('.ic{'), '样式应包含图标基类 .ic');
  assert.ok(html.includes('stroke:currentColor'), '图标应继承 currentColor 以随主题变色');

  // 6.2) 导航全称/短名双标签：移动端底栏用短名，且按钮有固定可访问名称
  for (const 标记 of ['class="lb"', 'class="ls"', '.ls{display:none}', 'aria-label="节点与订阅"']) {
    assert.ok(html.includes(标记), `导航应包含 ${标记}`);
  }

  // 6.3) 无障碍与触控：几何语言收敛为圆角，不得再引入切角（clip-path 会同时裁掉焦点环、
  // 阴影与 hover 反馈，且在浅色主题下被读成"缺角/渲染错误"）
  assert.ok(!html.includes('clip-path'), '不应再用 clip-path 切角');
  assert.ok(!html.includes('--cut:'), '未使用的 --cut 令牌应已删除');
  assert.ok(/button:focus-visible[^}]*outline:2px solid var\(--acc2\)[^}]*outline-offset:2px/.test(html), '焦点环应走常规外偏移（圆角下不再被裁切）');
  assert.ok(html.includes('@media(max-width:640px)'), '应保留移动端媒体查询');
  assert.ok(/min-height:44px/.test(html), '移动端触控目标须达到 44px');
  assert.ok(html.includes('button.iconbtn{display:inline-flex'), 'iconbtn 应为 flex 以便与图标对齐');

  // 6.4) 表面层级令牌：三档语义令牌齐备，且不再由 --bg1 现场派生
  for (const 令牌名 of ['--surf:', '--sunken:', '--raised:', '--shadow-lg:']) {
    assert.ok(html.includes(令牌名), `主题应定义表面层级令牌 ${令牌名}`);
  }
  assert.ok(html.includes('var(--sunken)'), '组件应引用表面层级令牌');
  const 层级派生次数 = [...html.matchAll(/color-mix\(in srgb,var\(--bg1\)/g)].length;
  assert.equal(层级派生次数, 0, `表面层级应为显式令牌，不应在组件里现场派生，实际 ${层级派生次数} 处`);

  // 6.6) 概览去重：同一批规格不得同时出现在卡内 kv 与 badges 行
  assert.ok(!html.includes('id="badges"'), '重复的 badges 行应已删除（与卡内 kv 列表重复）');
  assert.ok(html.includes('class="kvList kv-main"') && html.includes('class="kvList kv-sub"'), '规格应分主/次两级');
  assert.ok(html.includes('.kv-main .item{font-size:14px'), '主指标应用更大的字号拉开层级');

  // 6.7) 版面秩序：自检 6 卡按 3 列排 2 行；客户端格式按钮等宽成网格
  assert.ok(/\.chk-grid\{[^}]*minmax\(280px/.test(html), '自检卡应 ≥280px 断点，6 张卡排 3 列成 2 行，避免 4+2 留空格');
  assert.ok(/#fmt-links\{[^}]*display:grid/.test(html), '客户端格式按钮应等宽成网格，而非长短不一的一排');

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

  // 6.5) 登录页：表单字段名是 main.js 解析密码的契约，CSP 放宽范围也必须固定
  const 登录响应 = 登录页面('<img src=x onerror=alert(1)>', 401);
  const 登录HTML = await 登录响应.text();
  const 登录CSP = 登录响应.headers.get('Content-Security-Policy');
  assert.ok(登录HTML.includes('name="password"'), '登录表单字段名必须是 password（main.js 按此解析）');
  assert.ok(登录HTML.includes('autocomplete="current-password"'), '登录输入框应保留自动填充提示');
  assert.ok(登录HTML.includes('<style>'), '登录页应内联样式');
  assert.ok(登录CSP.includes("style-src 'unsafe-inline'"), '登录页 CSP 应允许内联样式');
  assert.ok(!登录CSP.includes('unsafe-scripts') && !/script-src/.test(登录CSP), '登录页 CSP 不得放开脚本');
  assert.ok(登录CSP.includes("default-src 'none'"), '登录页应保留 default-src none 兜底（阻断样式 url() 外发）');
  assert.ok(!登录HTML.includes('<img src=x'), '登录页错误消息必须转义');
  assert.ok(登录HTML.includes('&lt;img src=x onerror=alert(1)&gt;'), '登录页错误消息以转义形式出现');

  console.log('[test-ui] ui.html 结构 / XSS 断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });