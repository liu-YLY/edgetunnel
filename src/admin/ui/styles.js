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
select{appearance:none;-webkit-appearance:none;-moz-appearance:none;padding-right:30px;cursor:pointer;background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="%237d90ad" fill="none" stroke-width="1.5"/></svg>');background-repeat:no-repeat;background-position:right 12px center}
input:focus,select:focus,textarea:focus{border-color:var(--acc2);box-shadow:0 0 0 2px color-mix(in srgb,var(--acc2) 26%,transparent),0 0 16px color-mix(in srgb,var(--acc2) 14%,transparent)}
textarea{font:12px/1.6 ui-monospace,"SF Mono",Menlo,Consolas,monospace;resize:vertical}
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
/* SVG 内的颜色一律走主题变量：硬编码浅色会让浅色主题下的数值不可见 */
.g-track{stroke:color-mix(in srgb,var(--fg) 20%,transparent)}
.g-fill{stroke:var(--acc)}
.g-text{fill:var(--fg);font-size:12px}
#chart rect{fill:var(--acc)}
#chart text{fill:var(--mut)}
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
.chk-panel{margin-bottom:14px}
.chk-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.chk-bar{display:none;height:3px;margin:12px 0 0;background:color-mix(in srgb,var(--acc) 14%,transparent);overflow:hidden}
.chk-bar.on{display:block}
.chk-bar i{display:block;height:100%;width:34%;background:linear-gradient(90deg,var(--acc2),var(--acc));animation:chk-slide 1.1s ease-in-out infinite}
@keyframes chk-slide{0%{margin-left:-34%}100%{margin-left:100%}}
.chk-sum{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
.chk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.chk{min-height:118px;margin:0;transition:border-color .18s,transform .18s}
.chk:hover{border-color:color-mix(in srgb,var(--acc) 55%,transparent);transform:translateY(-1px)}
.chk-legend{margin:0 0 14px;font-size:12px}
.chk-legend b{color:var(--acc2);font-weight:600}
.chk-wide{grid-column:1/-1}
.chk-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.chk-name{font-size:12px;color:var(--mut);letter-spacing:1px;text-transform:uppercase}
.chk-val{font:600 20px/1.2 ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;margin-bottom:8px;overflow-wrap:anywhere}
.chk-kv{display:flex;flex-direction:column;gap:4px;font-size:12px}
.chk-row{display:flex;gap:8px;align-items:baseline}
.chk-row b{flex:0 0 74px;color:var(--mut);font-weight:400}
.chk-row span{flex:1;overflow-wrap:anywhere}
.chk-row span.bad{color:var(--err)}
.chk-row span.warn{color:var(--warn)}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid var(--line);color:var(--mut);font-size:12px;line-height:1.6;background:var(--surf);white-space:nowrap}
.pill.ok{color:var(--ok);border-color:var(--ok)}
.pill.warn{color:var(--warn);border-color:var(--warn)}
.pill.err{color:var(--err);border-color:var(--err)}
.pill.run{color:var(--warn);border-color:var(--warn);animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.45}}
/* ================= HUD 表单组件：字段组 / 科幻开关 / 双列网格 / 按钮扫描光 ================= */
.fld-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 16px}
.field{display:flex;flex-direction:column;gap:6px}
.field .ctl{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mut);letter-spacing:.6px;text-transform:uppercase;margin:0}
.field .ctl::before{content:"";flex:0 0 auto;width:3px;height:12px;background:linear-gradient(var(--acc2),var(--acc));box-shadow:0 0 6px color-mix(in srgb,var(--acc) 60%,transparent)}
.field .hint{font-size:11px;color:var(--mut);opacity:.85}
.field input,.field select,.field textarea{margin:0}
/* 科幻开关：checkbox 本体收起，可视滑块由 <i> 承担；checked 语义与 id 保持不变 */
.switch{position:relative;display:inline-flex;align-items:center;gap:9px;cursor:pointer;user-select:none;font-size:13px;color:var(--fg);margin:0;padding:8px 12px;border:1px solid var(--line);background:color-mix(in srgb,var(--bg1) 40%,transparent);clip-path:polygon(0 6px,6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%);transition:border-color .18s,background .18s}
.switch input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.switch i{position:relative;flex:0 0 auto;width:36px;height:19px;border-radius:999px;background:color-mix(in srgb,var(--bg3) 90%,transparent);border:1px solid var(--line);transition:background .18s,border-color .18s}
.switch i::after{content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:var(--mut);transition:left .18s,background .18s,box-shadow .18s}
.switch:hover{border-color:color-mix(in srgb,var(--acc) 45%,transparent)}
.switch input:checked + i{background:linear-gradient(135deg,var(--acc2),var(--acc));border-color:transparent}
.switch input:checked + i::after{left:19px;background:#06121f;box-shadow:0 0 8px var(--acc2)}
.switch input:focus-visible + i{outline:2px solid var(--acc2);outline-offset:2px}
.switch:has(input:checked){background:color-mix(in srgb,var(--acc) 10%,transparent);border-color:color-mix(in srgb,var(--acc) 45%,transparent)}
/* 按钮扫描光：hover 时一道光从左扫过 */
button.btn{position:relative;overflow:hidden}
button.btn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.32),transparent);transform:skewX(-20deg);pointer-events:none;transition:left .45s ease}
button.btn:hover::after{left:130%}
button.iconbtn{overflow:hidden}
/* 危险操作按钮配色（保留 id 不变） */
#btn-init{background:transparent;border:1px solid color-mix(in srgb,var(--err) 60%,transparent);color:var(--err)}
#btn-init:hover{background:color-mix(in srgb,var(--err) 14%,transparent)}
/* ================= JSON 编辑器：行号 + overlay 语法高亮 + 状态栏 ================= */
.cfg-editor{position:relative;margin-top:6px}
.cfg-editor .cfg-ln{position:absolute;left:0;top:0;bottom:0;width:46px;overflow:hidden;text-align:right;padding:9px 8px 0 0;color:color-mix(in srgb,var(--fg) 42%,transparent);border-right:1px solid var(--line);background:color-mix(in srgb,var(--bg1) 42%,transparent);font:12px/1.6 ui-monospace,"SF Mono",Menlo,Consolas,monospace;user-select:none;pointer-events:none;z-index:1}
.cfg-editor pre{position:absolute;left:47px;top:0;right:0;bottom:0;margin:0;padding:9px 10px 9px 11px;overflow:hidden;white-space:pre;background:transparent;border:0;font:12px/1.6 ui-monospace,"SF Mono",Menlo,Consolas,monospace;pointer-events:none;z-index:0}
.cfg-editor textarea{position:relative;z-index:2;padding-left:58px;line-height:1.6;tab-size:2;background:transparent;color:transparent;caret-color:var(--fg)}
.cfg-editor textarea::placeholder{color:color-mix(in srgb,var(--mut) 75%,transparent)}
.cfg-editor textarea::selection{background:color-mix(in srgb,var(--acc) 34%,transparent);color:transparent}
.cfg-bar{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-variant-numeric:tabular-nums;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line)}
.cfg-bar .bad{color:var(--err)}
.cfg-bar .good{color:var(--ok)}
/* 语法高亮 token（客户端状态机生成，不依赖配置内容） */
.tk-key{color:var(--acc2)}
.tk-str{color:var(--ok)}
.tk-num{color:var(--warn)}
.tk-bool{color:var(--err)}
.tk-null{color:var(--err)}
/* ================= 弹窗细化：顶部装饰线 + 打开动效 ================= */
#qr-modal .box,#kbd-help .box,#cmdk .box,#diff-modal .box{position:relative;overflow:hidden}
#qr-modal .box::before,#kbd-help .box::before,#cmdk .box::before,#diff-modal .box::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--acc2),var(--acc) 55%,transparent);z-index:2}
#qr-modal.open,#kbd-help.open,#cmdk.open,#diff-modal.open{animation:pop-in .16s ease}
@keyframes pop-in{from{opacity:0;transform:scale(.965)}to{opacity:1;transform:none}}
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
