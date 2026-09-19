// 主题令牌与动效规则。颜色只在此处定义，其它样式一律引用变量，便于切换主题。
// 本文件零 import（admin 层内自包含），只导出返回 CSS 文本的函数。

const 深色令牌 = `:root{--bg1:#0b1020;--bg2:#131a2e;--bg3:#0e1424;--glass-bg:rgba(255,255,255,.04);--glass-line:rgba(255,255,255,.09);--fg:#e6e8ee;--mut:#8b93a7;--acc:#6e8bff;--acc2:#22d3ee;--ok:#3fb950;--err:#f85149;--r:18px;--shadow:0 12px 32px rgba(0,0,0,.35)}`;

const 动效降级 = `@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto}}`;

// 令牌行注入 <style> 开头，动效降级行注入末尾，以保持与原单文件一致的字节顺序。
function 主题CSS() {
  return '\n' + 深色令牌;
}

function 动效CSS() {
  return 动效降级 + '\n';
}

export { 主题CSS, 动效CSS };
