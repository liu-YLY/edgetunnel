// 组件样式：布局、切角卡片、按钮、表格、弹层、图表容器、骨架屏、命令面板、diff 视图。
// 颜色一律引用 theme.js 的 CSS 变量。零 import。

const 组件样式 = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;color:var(--fg);background:linear-gradient(165deg,var(--bg1),var(--bg2) 60%,var(--bg3));background-attachment:fixed;font:400 14px/1.5 -apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(900px 480px at 12% -10%,rgba(40,90,170,.32),transparent 60%),radial-gradient(700px 400px at 92% -4%,rgba(53,224,216,.14),transparent 58%)}
body::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,transparent 0 15px,var(--grid) 15px 16px),repeating-linear-gradient(90deg,transparent 0 15px,var(--grid) 15px 16px)}
.wrap{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:20px 16px 84px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
h1{font-size:17px;margin:0;letter-spacing:.6px}
h1 small{color:var(--mut);font-weight:400;font-size:12px;letter-spacing:0}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
nav button{background:transparent;border:1px solid var(--line);color:var(--mut);padding:7px 15px;font-size:13px;cursor:pointer;clip-path:polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%)}
nav button:hover{color:var(--fg)}
nav button.on{background:linear-gradient(135deg,var(--acc2),var(--acc));color:#06121f;font-weight:600;border-color:transparent}
.page{display:none}.page.on{display:block}
.card{position:relative;background:var(--surf);border:1px solid var(--line);padding:16px;margin-bottom:14px;box-shadow:var(--shadow);clip-path:polygon(0 var(--cut),var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%)}
.card::before,.card::after{content:"";position:absolute;width:12px;height:12px;pointer-events:none}
.card::before{top:0;left:0;border-top:2px solid var(--acc2);border-left:2px solid var(--acc2)}
.card::after{bottom:0;right:0;border-bottom:2px solid var(--acc2);border-right:2px solid var(--acc2)}
.card h2{font-size:12px;margin:0 0 12px;color:var(--mut);letter-spacing:1px;text-transform:uppercase}
.hero{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.gauge{flex:0 0 120px}
label{font-size:12px;color:var(--mut);display:block;margin:10px 0 4px}
input,select,textarea{width:100%;background:color-mix(in srgb,var(--bg1) 55%,transparent);color:var(--fg);border:1px solid var(--line);padding:9px 10px;font-size:13px;outline:none;clip-path:polygon(0 6px,6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)}
input:focus,select:focus,textarea:focus{border-color:var(--acc2);box-shadow:0 0 0 2px color-mix(in srgb,var(--acc2) 28%,transparent)}
textarea{font:12px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;resize:vertical}
button.btn{min-height:42px;background:linear-gradient(135deg,var(--acc2),var(--acc));color:#06121f;border:0;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;clip-path:polygon(0 6px,6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)}
button.btn:disabled{opacity:.5;cursor:not-allowed}
button.ghost{background:transparent;color:var(--fg);border:1px solid var(--line);font-weight:400}
button.ghost:hover{background:color-mix(in srgb,var(--acc) 12%,transparent)}
button.iconbtn{min-height:34px;background:transparent;color:var(--fg);border:1px solid var(--line);padding:5px 13px;font-size:12px;cursor:pointer}
button.iconbtn:hover{background:color-mix(in srgb,var(--acc) 14%,transparent)}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{overflow-wrap:anywhere;padding:6px 8px;border-bottom:1px solid var(--line);text-align:left}
td.mn{width:200px;color:var(--mut)}
.qr svg{max-width:180px;height:auto;background:#fff;padding:8px}
.mono{font:12px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;word-break:break-all;background:color-mix(in srgb,var(--bg1) 55%,transparent);border:1px solid var(--line);padding:10px;margin:6px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dim{color:var(--mut);font-size:13px}
.kvList{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.kvList .item{background:color-mix(in srgb,var(--bg1) 40%,transparent);border:1px solid var(--line);padding:10px}
.kvList .item b{display:block;font-size:11px;color:var(--mut);letter-spacing:.5px;margin-bottom:4px}
.clock{display:flex;gap:10px;align-items:baseline;justify-content:flex-end;font-variant-numeric:tabular-nums;font-size:14px;margin-bottom:10px}
.clock .t{font-weight:600;letter-spacing:1.2px}
.badges{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}
.badge{font-size:11px;color:var(--fg);background:color-mix(in srgb,var(--acc) 14%,transparent);border:1px solid var(--line);padding:3px 10px;border-radius:999px;font-variant-numeric:tabular-nums}
#chart{position:relative}#chart svg{width:100%;height:auto}
#chart-tip{position:absolute;display:none;pointer-events:none;background:color-mix(in srgb,var(--bg1) 92%,transparent);border:1px solid var(--line);padding:6px 10px;font-size:12px;z-index:5;white-space:nowrap}
.sk{height:10px;margin:8px 0;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 8%,transparent),color-mix(in srgb,var(--acc) 20%,transparent),color-mix(in srgb,var(--acc) 8%,transparent))}
.err-inline{font-size:12px;color:var(--err);margin-top:8px}
#qr-modal,#kbd-help,#cmdk,#diff-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,#04070d 62%,transparent);z-index:20;padding:16px}
#qr-modal.open,#kbd-help.open,#cmdk.open,#diff-modal.open{display:flex}
#qr-modal .box,#kbd-help .box,#cmdk .box,#diff-modal .box{background:var(--surf);border:1px solid var(--line);padding:18px;max-width:92vw;max-height:86vh;overflow:auto;box-shadow:var(--shadow);clip-path:polygon(0 var(--cut),var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%)}
#qr-modal .box{background:#fff;color:#111}
#qr-modal .box svg{width:100%;max-width:280px;height:auto}
#kbd-help kbd{font:12px ui-monospace,monospace;background:color-mix(in srgb,var(--acc) 16%,transparent);border:1px solid var(--line);border-bottom-width:2px;padding:2px 6px}
#cmdk .box{width:min(560px,92vw)}
#cmdk input{margin-bottom:10px}
#cmdk .list{max-height:52vh;overflow:auto}
#cmdk .item{padding:7px 10px;font-size:13px;cursor:pointer;border:1px solid transparent}
#cmdk .item.sel{background:color-mix(in srgb,var(--acc) 16%,transparent);border-color:var(--line)}
#cmdk .item b{color:var(--acc2)}
#cmdk .empty{color:var(--mut);font-size:13px;padding:8px}
#diff-view{font:12px/1.55 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-all;max-height:46vh;overflow:auto;border:1px solid var(--line);padding:10px}
#diff-view .add{color:var(--ok)}#diff-view .del{color:var(--err)}
#cfg-check{font-size:12px;margin-top:8px;display:flex;flex-direction:column;gap:4px}
#cfg-check .bad{color:var(--err)}#cfg-check .good{color:var(--ok)}
#toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:color-mix(in srgb,var(--bg1) 92%,transparent);border:1px solid var(--line);padding:10px 18px;font-size:13px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:30;max-width:86vw;box-shadow:var(--shadow)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
#toast.ok{border-color:var(--ok);color:var(--ok)}#toast.ok::before{content:"✓ "}
#toast.err{border-color:var(--err);color:var(--err)}#toast.err::before{content:"✕ "}
.chk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.chk{min-height:118px;margin:0}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid var(--line);color:var(--mut);font-size:12px;line-height:1.6;background:var(--surf)}
.pill.ok{color:var(--ok);border-color:var(--ok)}
.pill.err{color:var(--err);border-color:var(--err)}
.pill.run{color:var(--warn);border-color:var(--warn);animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.45}}
@media(max-width:640px){
.hero{flex-direction:column}
nav{position:fixed;bottom:0;left:0;right:0;z-index:8;margin:0;padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg1) 88%,transparent);justify-content:space-around;border-top:1px solid var(--line)}
nav button{flex:1;padding:8px 6px}
.wrap{padding-bottom:96px}}
`;

function 样式CSS() {
  return 组件样式;
}

export { 样式CSS };
