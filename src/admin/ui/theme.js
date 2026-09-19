// 主题令牌与动效规则。颜色只在此处定义，其它样式一律引用变量。
// 零 import；只导出返回 CSS 文本的函数。

// 深色为默认（:root），浅色通过 [data-theme="light"] 覆盖同名变量。
const 令牌 = `:root{--bg1:#060a12;--bg2:#0a1120;--bg3:#070c16;--grid:rgba(120,170,255,.055);--surf:rgba(18,28,46,.78);--line:rgba(120,170,255,.22);--fg:#dce7f5;--mut:#7d90ad;--acc:#4da3ff;--acc2:#35e0d8;--ok:#5ce6a0;--warn:#f2c14e;--err:#ff8a80;--cut:10px;--r:12px;--shadow:0 10px 28px rgba(0,0,0,.38)}
:root[data-theme="light"]{--bg1:#f6f9fd;--bg2:#e9eef7;--bg3:#f2f6fc;--grid:rgba(30,60,110,.05);--surf:rgba(255,255,255,.86);--line:rgba(30,60,110,.2);--fg:#16233a;--mut:#5b6b85;--acc:#2f6fe4;--acc2:#0f9e93;--ok:#0f8a5f;--warn:#a06a00;--err:#c0392b;--shadow:0 10px 24px rgba(20,40,80,.12)}`;

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
