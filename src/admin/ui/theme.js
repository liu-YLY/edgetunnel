// 主题令牌与动效规则。颜色只在此处定义，其它样式一律引用变量。
// 零 import；只导出返回 CSS 文本的函数。

// 深色为默认（:root），浅色通过 [data-theme="light"] 覆盖同名变量。
//
// 视觉语言（克制工程风）：圆角卡面 + 1px 描边 + 柔和阴影；不再使用切角（clip-path）
// 与 L 形角标——那类几何在实机上只呈现为"缺角 + 碎块"，浅色主题里更像渲染错误。
// 身份改由深空配色、青蓝强调色、等宽数字与极轻的渐变点缀承担。
//
// 表面层级：--surf（卡面）/ --sunken（凹槽：输入框、代码块、导航轨道）/ --raised（浮层）。
// 浅色主题的 --surf 用纯白而非半透明——半透明白压在近白底上会让卡片边界消失。
//
// 对比度：浅色主题的 --acc2/--ok/--warn 都刻意压深到 4.5:1 以上
// （原 #0f9e93 约 3.4:1、#0f8a5f 约 4.35:1、#a06a00 约 4.6:1 已在边缘）。
// --btnfg 是强调色渐变（--acc2→--acc）上的前景色，必须随主题切换：浅色主题的强调色
// 压深后，深色文字压在其上只剩约 3.8:1。
//
// 字号与间距不设令牌：面板只有一套密度（无 compact/comfortable 切换），令牌化只会
// 增加间接层而不产生可变点。冻结的取值：
//   字号 11（hint/徽章）/12（标签、辅助）/13（正文）/14（基准）/17（H1）/26（大数值）
//   间距 4 的倍数：4/6/8/10/12/14/16/18/24
const 令牌 = `:root{color-scheme:dark;--bg1:#070b12;--bg2:#0b1220;--surf:#101828;--sunken:#0a101d;--raised:#151d30;--line:rgba(140,175,230,.16);--fg:#e6edf8;--mut:#8b9bb4;--acc:#5ea6ff;--acc2:#2fd4c8;--ok:#5ce6a0;--warn:#f2c14e;--err:#ff8a80;--btnfg:#06121f;--shadow:0 1px 2px rgba(0,0,0,.32),0 8px 24px rgba(0,0,0,.26);--shadow-lg:0 24px 64px rgba(0,0,0,.5)}
:root[data-theme="light"]{color-scheme:light;--bg1:#f7f9fc;--bg2:#eef2f8;--surf:#ffffff;--sunken:#f3f6fa;--raised:#ffffff;--line:rgba(16,36,72,.14);--fg:#111c2e;--mut:#5a6a83;--acc:#2563eb;--acc2:#0d7a72;--ok:#0b7a52;--warn:#96650a;--err:#c0392b;--btnfg:#ffffff;--shadow:0 1px 2px rgba(16,36,72,.06),0 8px 22px rgba(16,36,72,.07);--shadow-lg:0 20px 48px rgba(16,36,72,.18)}`;

// 动效三档：full 保留入场与图表动画；lite 只留状态反馈；off 全关。
// prefers-reduced-motion 优先级最高，一律按 off 处理。
const 动效 = `[data-motion="off"] *, [data-motion="off"] *::before, [data-motion="off"] *::after{transition:none!important;animation:none!important}
[data-motion="lite"] .page.on{animation:none!important}
[data-motion="full"] .page.on{animation:et-in .22s ease both}
@keyframes et-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}}`;

// 令牌行注入 <style> 开头，动效规则注入末尾，以保持既有的字节顺序（令牌在前、动效最后）。
function 主题CSS() {
  return '\n' + 令牌;
}

function 动效CSS() {
  return 动效 + '\n';
}

export { 主题CSS, 动效CSS };
