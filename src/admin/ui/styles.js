// 组件样式：布局、卡片、按钮、表格、弹层、图表容器等。
// 颜色一律引用 theme.js 定义的 CSS 变量。本文件零 import。

const 组件样式 = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;color:var(--fg);font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;min-height:100vh;background:linear-gradient(160deg,var(--bg1),var(--bg2) 55%,var(--bg3));background-attachment:fixed}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(900px 500px at 15% -10%,rgba(110,139,255,.22),transparent 60%),radial-gradient(700px 420px at 90% 0%,rgba(34,211,238,.16),transparent 60%)}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 84px;position:relative;z-index:1}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
h1{font-size:19px;margin:0;letter-spacing:.2px}h1 small{color:var(--mut);font-weight:400;font-size:13px}
a{color:#9db8ff;text-decoration:none}a:hover{text-decoration:underline}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
nav button{background:transparent;border:1px solid var(--glass-line);color:var(--mut);border-radius:999px;padding:8px 16px;font-size:14px;cursor:pointer;transition:all .18s ease}
nav button:hover{color:var(--fg);border-color:rgba(255,255,255,.22)}
nav button.on{background:linear-gradient(135deg,var(--acc),var(--acc2));border-color:transparent;color:#fff;box-shadow:0 4px 18px rgba(110,139,255,.4)}
.page{display:none;opacity:0;transform:translateY(6px);transition:opacity .22s ease,transform .22s ease}
.page.on{display:block;opacity:1;transform:none}
.card,.glass-card{background:var(--glass-bg);border:1px solid var(--glass-line);border-radius:var(--r);padding:18px;margin-bottom:14px;backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);box-shadow:var(--shadow);transition:transform .18s ease}
.card:hover,.glass-card:hover{transform:translateY(-2px)}
.card h2,.glass-card h2{font-size:15px;margin:0 0 12px;color:#c9d2e3}
.hero{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.gauge{flex:0 0 120px}
label{font-size:12px;color:var(--mut);display:block;margin:10px 0 4px}
input,select,textarea{width:100%;background:rgba(11,16,32,.5);color:#d8e0ee;border:1px solid var(--glass-line);border-radius:10px;padding:9px 10px;font-size:13px;outline:none;transition:border-color .15s ease,box-shadow .15s ease}
input:focus,select:focus,textarea:focus{border-color:rgba(110,139,255,.6);box-shadow:0 0 0 3px rgba(110,139,255,.18)}
textarea{font:12px/1.5 monospace;resize:vertical}
button.btn{min-height:44px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;border:0;border-radius:10px;padding:9px 18px;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(110,139,255,.28);transition:all .18s ease}
button.btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
button.btn:active{transform:translateY(0) scale(.98)}
button.ghost{background:var(--glass-bg);color:var(--fg);border:1px solid var(--glass-line);box-shadow:none}
button.ghost:hover{background:rgba(255,255,255,.08)}
button.iconbtn{min-height:36px;background:var(--glass-bg);color:var(--fg);border:1px solid var(--glass-line);border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer}
button.iconbtn:hover{background:rgba(255,255,255,.08)}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:13px}td{overflow-wrap:anywhere;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06)}td.mn{width:200px;color:var(--mut)}
.qr svg{max-width:180px;height:auto;background:#fff;padding:8px;border-radius:10px}
.mono{font:12px/1.5 monospace;word-break:break-all;background:rgba(11,16,32,.5);border:1px solid var(--glass-line);border-radius:10px;padding:10px;margin:6px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.kvList{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.kvList .item{background:rgba(11,16,32,.5);border:1px solid var(--glass-line);border-radius:12px;padding:10px}
.kvList .item b{display:block;font-size:12px;color:var(--mut);margin-bottom:4px}
.dim{color:var(--mut);font-size:13px}
/* 概览增强 */
.clock{display:flex;gap:10px;align-items:baseline;justify-content:flex-end;font-variant-numeric:tabular-nums;font-size:14px;margin-bottom:10px}
.clock .t{font-weight:600;letter-spacing:1px}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.badge{font-size:12px;color:#d8e0ee;background:rgba(110,139,255,.14);border:1px solid rgba(110,139,255,.35);border-radius:999px;padding:4px 10px}
#chart{position:relative}
#chart svg{width:100%;height:auto}
#chart-tip{position:absolute;display:none;pointer-events:none;background:rgba(11,16,32,.92);border:1px solid var(--glass-line);border-radius:8px;padding:6px 10px;font-size:12px;z-index:5;white-space:nowrap;box-shadow:var(--shadow)}
/* 节点 Modal */
#qr-modal{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:rgba(6,9,18,.6);backdrop-filter:blur(6px)}
#qr-modal.open{display:flex}
#qr-modal .box{background:#fff;border-radius:14px;padding:18px;max-width:88vw;box-shadow:0 24px 60px rgba(0,0,0,.5)}
#qr-modal .box svg{width:100%;max-width:280px;height:auto}
/* 快捷键帮助浮层 */
#kbd-help{position:fixed;inset:0;z-index:19;display:none;align-items:center;justify-content:center;background:rgba(6,9,18,.6);backdrop-filter:blur(6px)}
#kbd-help.open{display:flex}
#kbd-help .box{background:var(--glass-bg);border:1px solid var(--glass-line);border-radius:var(--r);padding:20px;max-width:88vw;backdrop-filter:blur(20px)}
#kbd-help table{font-size:13px}
#kbd-help kbd{font:12px ui-monospace,monospace;background:rgba(255,255,255,.1);border:1px solid var(--glass-line);border-bottom-width:2px;border-radius:6px;padding:2px 6px}
#toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:rgba(11,16,32,.92);border:1px solid var(--glass-line);border-radius:999px;padding:10px 18px;font-size:14px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:30;max-width:86vw;box-shadow:var(--shadow)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
#toast.ok{border-color:var(--ok);color:#baf0c3}#toast.ok::before{content:"✓ "}
#toast.err{border-color:var(--err);color:#ffb3b0}#toast.err::before{content:"✕ "}
@media(max-width:640px){.hero{flex-direction:column}
nav{position:fixed;bottom:0;left:0;right:0;z-index:8;margin:0;padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:rgba(11,16,32,.85);backdrop-filter:blur(20px);justify-content:space-around}
nav button{flex:1;padding:8px 6px}.wrap{padding-bottom:96px}}
`;

function 样式CSS() {
  return 组件样式;
}

export { 样式CSS };
