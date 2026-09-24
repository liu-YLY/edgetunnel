// 组件样式：布局、圆角卡片、按钮、表格、弹层、图表容器、骨架屏、命令面板、diff 视图。
// 颜色一律引用 theme.js 的 CSS 变量。零 import。

const 组件样式 = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;color:var(--fg);background:linear-gradient(180deg,var(--bg1),var(--bg2));background-attachment:fixed;font:400 14px/1.5 -apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
/* 深色下留一层极淡的顶部辉光当"深空"暗示；浅色主题不发光——白底上的辉光只会显脏 */
:root[data-theme="dark"] body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(820px 440px at 10% -12%,rgba(64,120,200,.15),transparent 62%),radial-gradient(700px 380px at 92% -6%,rgba(47,212,200,.06),transparent 60%)}
.wrap{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:20px 16px 84px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
h1{font-size:17px;margin:0;letter-spacing:.2px;font-weight:600}
h1 small{color:var(--mut);font-weight:400;font-size:12px;letter-spacing:0;margin-left:4px}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
/* 图标：统一 24 viewBox + currentColor 继承，尺寸与描边只在此处定义，标记里不带内联样式 */
.ic{flex:0 0 auto;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.lnk{display:inline-flex;align-items:center;gap:5px;color:var(--mut);font-size:12px}
.lnk:hover{color:var(--fg);text-decoration:none}
/* 导航：凹槽轨道内嵌分段按钮，选中态用实心强调色——比"描边按钮 + 渐变"更干净，
   且选中态前景色走 --btnfg，两个主题下都满足对比度 */
nav{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:18px;padding:4px;background:var(--sunken);border:1px solid var(--line);border-radius:10px}
nav button{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid transparent;color:var(--mut);padding:8px 14px;font-size:13px;cursor:pointer;border-radius:7px;transition:background .16s,color .16s}
nav button:hover{color:var(--fg);background:color-mix(in srgb,var(--acc) 10%,transparent)}
nav button.on,nav button.on:hover{background:linear-gradient(135deg,var(--acc2),var(--acc));color:var(--btnfg);font-weight:600}
/* 导航全称/短名：默认只显示全称，移动端底栏换成短名（见文件末尾媒体查询） */
.ls{display:none}
.page{display:none}.page.on{display:block}
/* 卡片：圆角 + 1px 描边 + 柔和阴影。标题左侧一道渐变细条充当唯一的强调装饰，
   替代原先容易被读成"碎块"的 L 形角标。 */
.card{position:relative;background:var(--surf);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:14px;box-shadow:var(--shadow)}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.card h2{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin:0 0 14px;color:var(--fg);letter-spacing:.2px}
.card h2::before{content:"";flex:0 0 auto;width:3px;height:13px;border-radius:2px;background:linear-gradient(180deg,var(--acc2),var(--acc))}
.card-head h2{margin:0}
.hero{display:flex;gap:22px;flex-wrap:wrap;align-items:center}
.gauge{flex:0 0 92px}
.hero-fig{flex:1;min-width:240px}
.stat-val{font:600 26px/1.15 ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.5px;overflow-wrap:anywhere}
#usage-note{margin-top:8px;font-size:12px}
label{font-size:12px;color:var(--mut);display:block;margin:10px 0 4px}
input,select,textarea{width:100%;background:var(--sunken);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:9px 11px;font-size:13px;outline:none;transition:border-color .16s,box-shadow .16s}
select{appearance:none;-webkit-appearance:none;-moz-appearance:none;padding-right:30px;cursor:pointer;background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="%237d90ad" fill="none" stroke-width="1.5"/></svg>');background-repeat:no-repeat;background-position:right 12px center}
input:hover,select:hover,textarea:hover{border-color:color-mix(in srgb,var(--acc) 42%,var(--line))}
input:focus,select:focus,textarea:focus{border-color:var(--acc2);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc2) 20%,transparent)}
textarea{font:12px/1.6 ui-monospace,"SF Mono",Menlo,Consolas,monospace;resize:vertical}
button.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;background:linear-gradient(135deg,var(--acc2),var(--acc));color:var(--btnfg);border:1px solid transparent;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:filter .16s}
button.btn:hover{filter:brightness(1.07)}
button.btn:disabled{opacity:.45;cursor:not-allowed;filter:none}
button.ghost{background:transparent;color:var(--fg);border:1px solid var(--line);font-weight:500}
button.ghost:hover{background:color-mix(in srgb,var(--acc) 10%,transparent);border-color:color-mix(in srgb,var(--acc) 40%,transparent)}
button.iconbtn{display:inline-flex;align-items:center;gap:6px;min-height:36px;background:var(--surf);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;transition:background .16s,border-color .16s}
button.iconbtn:hover{background:color-mix(in srgb,var(--acc) 10%,transparent);border-color:color-mix(in srgb,var(--acc) 40%,transparent)}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{overflow-wrap:anywhere;padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}
tbody tr:last-child td,tbody tr:last-child th{border-bottom:0}
td.mn,th.mn{width:200px;color:var(--mut);font-size:12px}
th{color:var(--mut);font-size:12px;font-weight:500}
tbody tr:hover{background:var(--sunken)}
/* 客户端格式按钮：等宽网格。7 个按钮用 220px 断点排 4 列 → 4+3，
   比 auto-fill 收到 6 列后剩 1 个孤零零的第二行整齐。 */
#fmt-links{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.qr svg{max-width:180px;height:auto;background:#fff;padding:8px;border-radius:8px}
.mono{font:12px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;word-break:break-all;background:var(--sunken);border:1px solid var(--line);border-radius:8px;padding:10px;margin:6px 0}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dim{color:var(--mut);font-size:13px}
/* 规格网格分两级：主指标（协议/路径/出站）用 14px 高对比值，次要规格（12px+弱色）退到第二层。
   原先这些字段在卡内 kv 列表和下方 badges 行里各出现一次，属于同一批数据讲两遍。 */
.kvList{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:18px}
.kvList+.kvList{margin-top:10px}
.kvList .item{background:var(--sunken);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.kvList .item b{display:block;font-size:11px;color:var(--mut);letter-spacing:.4px;margin-bottom:5px;font-weight:500}
.kv-main .item{font-size:14px;font-weight:500;color:var(--fg)}
.kv-sub{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.kv-sub .item{font-size:12px;color:var(--mut)}
.kv-sub .item b{margin-bottom:3px}
.clock{display:flex;gap:10px;align-items:baseline;font-variant-numeric:tabular-nums;font-size:12px;color:var(--mut)}
.clock .t{font-weight:600;letter-spacing:.5px;color:var(--fg)}
#chart{position:relative}#chart svg{display:block;width:100%;height:auto}
/* SVG 内的颜色一律走主题变量：硬编码浅色会让浅色主题下的数值不可见 */
.g-track{stroke:color-mix(in srgb,var(--fg) 13%,transparent)}
.g-fill{stroke:var(--acc)}
.g-text{fill:var(--fg);font-size:15px;font-weight:600}
.g-base{stroke:var(--line)}
#chart rect{fill:var(--acc)}
#chart text{fill:var(--mut)}
#chart-tip{position:absolute;display:none;pointer-events:none;background:var(--raised);border:1px solid var(--line);border-radius:7px;padding:6px 10px;font-size:12px;z-index:5;white-space:nowrap;box-shadow:var(--shadow)}
.sk{height:10px;margin:8px 0;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 8%,transparent),color-mix(in srgb,var(--acc) 20%,transparent),color-mix(in srgb,var(--acc) 8%,transparent))}
.err-inline{font-size:12px;color:var(--err);margin-top:8px}
#qr-modal,#kbd-help,#cmdk,#diff-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,#04070d 55%,transparent);z-index:20;padding:16px}
#qr-modal.open,#kbd-help.open,#cmdk.open,#diff-modal.open{display:flex}
#qr-modal .box,#kbd-help .box,#cmdk .box,#diff-modal .box{background:var(--surf);border:1px solid var(--line);border-radius:14px;padding:18px;max-width:92vw;max-height:86vh;overflow:auto;box-shadow:var(--shadow-lg)}
#qr-modal .box{background:#fff;color:#111}
#qr-modal .box svg{width:100%;max-width:280px;height:auto}
#kbd-help kbd{font:12px ui-monospace,monospace;background:var(--sunken);border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:2px 6px}
#cmdk .box{width:min(560px,92vw)}
#cmdk input{margin-bottom:10px}
#cmdk .list{max-height:52vh;overflow:auto}
#cmdk .item{padding:8px 10px;font-size:13px;cursor:pointer;border-radius:7px}
#cmdk .item.sel{background:color-mix(in srgb,var(--acc) 14%,transparent)}
#cmdk .item b{color:var(--acc2)}
#cmdk .empty{color:var(--mut);font-size:13px;padding:8px}
#diff-view{font:12px/1.55 ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-all;max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:10px}
#diff-view .add{color:var(--ok)}#diff-view .del{color:var(--err)}
#cfg-check{font-size:12px;margin-top:8px;display:flex;flex-direction:column;gap:4px}
#cfg-check .bad{color:var(--err)}#cfg-check .good{color:var(--ok)}
#toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--raised);border:1px solid var(--line);border-radius:9px;padding:10px 18px;font-size:13px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:30;max-width:86vw;box-shadow:var(--shadow-lg)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
#toast.ok{border-color:var(--ok);color:var(--ok)}#toast.ok::before{content:"✓ "}
#toast.err{border-color:var(--err);color:var(--err)}#toast.err::before{content:"✕ "}
.chk-panel{margin-bottom:14px}
.chk-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.chk-bar{display:none;height:3px;margin:12px 0 0;border-radius:999px;background:color-mix(in srgb,var(--acc) 14%,transparent);overflow:hidden}
.chk-bar.on{display:block}
.chk-bar i{display:block;height:100%;width:34%;background:linear-gradient(90deg,var(--acc2),var(--acc));animation:chk-slide 1.1s ease-in-out infinite}
@keyframes chk-slide{0%{margin-left:-34%}100%{margin-left:100%}}
.chk-sum{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
/* 自检卡：6 张卡按 3 列排布 → 2 行整齐，避免 4+2 时第二行留两个空格 */
.chk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.chk{min-height:118px;margin:0;transition:border-color .18s,box-shadow .18s}
.chk:hover{border-color:color-mix(in srgb,var(--acc) 40%,var(--line));box-shadow:var(--shadow),0 4px 16px color-mix(in srgb,var(--acc) 10%,transparent)}
.chk-legend{margin:0 0 14px;font-size:12px}
.chk-legend b{color:var(--acc2);font-weight:600}
.chk-wide{grid-column:1/-1}
.chk-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.chk-name{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--mut);letter-spacing:.2px}
/* 与其他卡片标题共用同一道强调细条，避免自检卡看起来是"另一种卡" */
.chk-name::before{content:"";flex:0 0 auto;width:3px;height:11px;border-radius:2px;background:linear-gradient(180deg,var(--acc2),var(--acc))}
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
/* ================= 表单组件：字段组 / 开关 / 双列网格 / 按钮扫描光 ================= */
.fld-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 16px}
.field{display:flex;flex-direction:column;gap:6px}
.field .ctl{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mut);letter-spacing:.6px;text-transform:uppercase;margin:0}
.field .ctl::before{content:"";flex:0 0 auto;width:3px;height:12px;border-radius:2px;background:linear-gradient(var(--acc2),var(--acc))}
.field .hint{font-size:11px;color:var(--mut);opacity:.85}
.field input,.field select,.field textarea{margin:0}
/* 开关：checkbox 本体收起，可视滑块由 <i> 承担；checked 语义与 id 保持不变 */
.switch{position:relative;display:inline-flex;align-items:center;gap:9px;cursor:pointer;user-select:none;font-size:13px;color:var(--fg);margin:0;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--sunken);transition:border-color .16s,background .16s}
.switch input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.switch i{position:relative;flex:0 0 auto;width:36px;height:20px;border-radius:999px;background:color-mix(in srgb,var(--fg) 16%,transparent);transition:background .18s}
.switch i::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--surf);transition:left .18s,background .18s}
.switch:hover{border-color:color-mix(in srgb,var(--acc) 40%,var(--line))}
.switch input:checked + i{background:var(--acc)}
.switch input:checked + i::after{left:19px;background:var(--btnfg)}
.switch input:focus-visible + i{outline:2px solid var(--acc2);outline-offset:2px}
.switch:has(input:checked){background:color-mix(in srgb,var(--acc) 9%,transparent);border-color:color-mix(in srgb,var(--acc) 40%,transparent)}
/* 按钮扫描光：hover 时一道光从左扫过（保留为唯一的动效装饰，强度调低） */
button.btn{position:relative;overflow:hidden}
button.btn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.22),transparent);transform:skewX(-20deg);pointer-events:none;transition:left .45s ease}
button.btn:hover::after{left:130%}
button.iconbtn{overflow:hidden}
/* 危险操作按钮配色（保留 id 不变） */
#btn-init{background:transparent;border:1px solid color-mix(in srgb,var(--err) 55%,transparent);color:var(--err)}
#btn-init:hover{background:color-mix(in srgb,var(--err) 12%,transparent);filter:none}
/* ================= JSON 编辑器：行号 + overlay 语法高亮 + 状态栏 ================= */
.cfg-editor{position:relative;margin-top:6px}
.cfg-editor .cfg-ln{position:absolute;left:0;top:0;bottom:0;width:50px;overflow:hidden;text-align:right;padding:9px 8px 0 0;color:color-mix(in srgb,var(--fg) 42%,transparent);border-right:1px solid var(--line);background:var(--sunken);border-radius:8px 0 0 8px;font:12px/1.6 ui-monospace,"SF Mono",Menlo,Consolas,monospace;user-select:none;pointer-events:none;z-index:1;white-space:pre}
.cfg-editor pre{position:absolute;left:51px;top:0;right:0;bottom:0;margin:0;padding:9px 10px 9px 11px;overflow:hidden;white-space:pre;background:transparent;border:0;font:12px/1.6 ui-monospace,"SF Mono",Menlo,Consolas,monospace;pointer-events:none;z-index:0}
.cfg-editor textarea{position:relative;z-index:2;padding-left:62px;line-height:1.6;tab-size:2;background:transparent;color:transparent;caret-color:var(--fg)}
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
.hero{flex-direction:column;align-items:stretch}
.gauge{align-self:center}
/* 底栏：脱离凹槽轨道的分段外观，改为固定条；图标在上、短名在下，留足 48px 触控高度 */
nav{position:fixed;bottom:0;left:0;right:0;z-index:8;margin:0;padding:6px 6px calc(6px + env(safe-area-inset-bottom));background:var(--raised);border:0;border-top:1px solid var(--line);border-radius:0;justify-content:space-around;gap:2px}
nav button{flex:1;flex-direction:column;justify-content:center;gap:3px;min-height:48px;padding:6px 4px;font-size:12px;border-radius:8px}
.lb{display:none}.ls{display:inline}
/* 触控目标：Web 的 24px 目标尺寸规则在触屏上不够用，可点控件一律抬到 44px */
button.btn,button.iconbtn{min-height:44px}
input:not([type="checkbox"]),select,textarea{min-height:44px}
/* 环境变量表的 200px 固定标签列在窄屏会把值列压到不可读，改为按内容自适应 */
td.mn,th.mn{width:auto;min-width:88px}
.wrap{padding-bottom:96px}}
/* 节点工作区：双栏生成、渐进展示详情、分页结果，沿用现有主题变量。 */
[hidden]{display:none!important}
#page-nodes{min-width:0}
.node-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:8px 0 24px}
.node-heading h2{font-size:26px;line-height:1.25;margin:0;font-weight:650;letter-spacing:-.5px}
.node-eyebrow{font-size:12px;color:var(--acc2);margin:0 0 8px;letter-spacing:1px}
.node-heading .dim{margin:10px 0 0}
.node-jumps{display:flex;flex-wrap:wrap;gap:8px}
.node-jumps a{display:inline-flex;align-items:center;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surf);font-size:13px}
.node-workspace{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px}
#page-nodes .card{padding:22px;border-radius:14px}
#page-nodes .card h2{font-size:16px;letter-spacing:0}
#page-nodes .card-head .dim{margin:6px 0 0}
.node-quick .card-head{margin-bottom:0}
.node-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.node-form-grid .field{min-width:0}
.node-field-wide{grid-column:1/-1}
#page-nodes .field .ctl{font-size:12px;letter-spacing:0;text-transform:none}
#page-nodes .field .ctl::before{display:none}
#page-nodes .field .hint{font-size:12px;opacity:1}
#page-nodes input,#page-nodes select{min-height:44px}
#page-nodes button.btn,#page-nodes button.iconbtn{min-height:44px}
.node-submit{width:100%;margin-top:4px}
.node-form-feedback{min-height:54px;padding-top:8px}
.node-details{margin-top:14px;border-top:1px solid var(--line);padding-top:6px}
.node-details summary{cursor:pointer;min-height:44px;padding:12px 0;color:var(--mut);font-size:13px;overflow-wrap:anywhere}
.node-details summary:hover{color:var(--fg)}
summary:focus-visible{outline:2px solid var(--acc2);outline-offset:3px;border-radius:4px}
.node-preview{display:flex;flex-direction:column;min-width:0}
.node-preview .node-actions{margin-top:auto;padding-top:18px}
.node-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.node-note{font-size:12px;color:var(--mut);margin:14px 0 0;line-height:1.6}
.node-facts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);margin:8px 0 12px;font-size:13px;gap:0}
.node-facts:empty{display:none}
.node-facts dt,.node-facts dd{padding:10px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere;min-width:0}
.node-facts dt{color:var(--mut)}
.node-facts dd{margin:0;color:var(--fg);font-family:ui-monospace,"SF Mono",monospace}
.node-toolbar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.node-search{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px 0;border-top:1px solid var(--line)}
.node-search label{margin:0;color:var(--fg);font-size:13px}
.node-search input{flex:1;min-width:160px;max-width:360px}
.node-search .dim{font-size:12px}
.node-list{min-width:0}
.node-empty{color:var(--mut);text-align:center;padding:30px 16px;background:var(--sunken);border:1px dashed var(--line);border-radius:10px}
.node-item{padding:16px 0;border-bottom:1px solid var(--line);min-width:0}
.node-item-top{display:flex;justify-content:space-between;gap:16px;align-items:center;min-width:0}
.node-item-title{min-width:0;flex:1}
.node-item h3{font-size:14px;margin:0 0 5px;overflow-wrap:anywhere}
.node-item .dim{font-size:12px;overflow-wrap:anywhere;margin:0}
.node-item .node-details{margin:4px 0 0;border-top:0;padding:0}
.node-item .node-details summary{min-height:32px;padding:6px 0;font-size:12px}
.node-item .node-actions{margin:0}
#btn-batch-more{margin-top:16px;width:100%}
.node-checks{list-style:none;padding:0;margin:16px 0}
.node-checks li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;border-bottom:1px solid var(--line);padding:12px 0}
.node-checks b{display:block;font-size:13px;margin-bottom:4px}
.node-checks p{margin:0;font-size:13px;color:var(--mut);overflow-wrap:anywhere}
.node-check-state{font-size:12px;font-weight:600;padding-top:2px}
.node-check-state.ok{color:var(--ok)}.node-check-state.warning{color:var(--warn)}.node-check-state.error{color:var(--err)}
.node-egress>summary{font-size:15px;color:var(--fg);font-weight:600}
#n-form-error{padding:8px 12px;margin:0;border:1px solid var(--err);border-radius:8px}
[aria-invalid="true"]{border-color:var(--err)}
#qr-modal .box{background:var(--surf);color:var(--fg);overflow:auto}
@media(max-width:800px){.node-workspace{grid-template-columns:minmax(0,1fr)}.node-heading{align-items:flex-start;flex-direction:column}.node-preview{min-height:260px}}
@media(max-width:640px){#page-nodes .card{padding:16px}.node-heading h2{font-size:23px}.node-jumps{width:100%}.node-jumps a{flex:1;justify-content:center;padding:8px}.node-item-top{align-items:flex-start;flex-direction:column;gap:10px}.node-toolbar>.row{width:100%}.node-toolbar button{flex:1}.node-form-grid{gap:12px}.node-preview .node-actions button{flex:1}input:not([type="checkbox"]),select,textarea{font-size:16px}.node-facts{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)}.node-item .node-details summary{min-height:44px;padding:12px 0}.node-heading{margin-bottom:18px}}
`;

function 样式CSS() {
  return 组件样式;
}

export { 样式CSS };
