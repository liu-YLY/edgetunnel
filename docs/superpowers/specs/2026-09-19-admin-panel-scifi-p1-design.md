# 管理面板 P1：科幻视觉重构 + 主题/动效 + 交互效率

日期：2026-09-19
状态：设计已确认（方案 1：拆模块 + A+D 融合）
前置交付物：`2026-09-19-glassmorphism-admin-panel-design.md`（面板四 Tab 基线）、`2026-09-19-local-admin-panel-design.md`（面板诞生）、CI 部署链路收敛（部署目标 `edgetunnel`）

## 1. 背景与目标

当前面板是 564 行单文件 `src/admin/ui.js`（CSS 字符串 + HTML 字符串 + 客户端 IIFE），视觉为 Glassmorphism 深色。用户反馈三个问题：

1. **视觉呆板**，不够科幻/科技风；
2. **功能项太少**；
3. **操作交互不够顺畅**。

经可视化对比（浏览器伴侣渲染 4 个方向），确定视觉方向为 **A+D 融合**：战术 HUD 的切角骨架 + 深空极简的克制配色。

**本轮范围（P1）**：视觉融合重构、主题与可访问性、交互效率。**P2（另一个 spec，本轮不做）**：运维自检（连通性自检面板、用量阈值告警、配置多版本历史——需新增后端 KV 列键端点）与节点订阅增强（批量导出、二维码进阶、节点备注、随机 PATH——含会断客户端的高风险项）。

拆分理由：P2 含"需后端改动"与"会改变客户端可见行为"两类高风险项，与前端的纯样式/交互改动混在一个变更里会让回归面失控。

## 2. 方案选择

| 方案 | 说明 | 取舍 | 结论 |
|---|---|---|---|
| **1（选定）** | 拆到 `src/admin/ui/` 子模块，仍由 esbuild 打成单文件 `_worker.js` | 零构建链改动；仅需改 2 处 import | ✅ |
| 2 | 继续在单个 `ui.js` 内堆叠 | P1 后预期 1000+ 行单文件，编辑可靠性下降 | 不选 |
| 3 | CSS/JS 抽成真文件走 esbuild text loader | 需修改 `build.js` 与 `verify.js`，回归风险高 | 排除 |

**方案 1 的可行性依据（已实测）**：

- `scripts/check-modules.cjs` 的 `layer(file) = file.split('/')[1]`，故 `src/admin/ui/*.js` 归属 `admin` 层；`admin` 允许依赖 `['admin','core','security.js']`，层内互引合法。
- `readSources()` 递归扫描 `src/**`，新增子目录文件自动纳入校验。
- `scripts/verify.js` 不依赖文件清单，只做「重新构建 → `node --check` → 与仓库产物逐字节比对」。
- 全仓库仅有 2 处代码引用 `src/admin/ui.js`：`src/main.js:4`、`scripts/test-ui.mjs:1`。

## 3. 架构

```
src/admin/ui/
├─ index.js     渲染入口：拼装 shell + 各 Tab，导出 管理面板HTML(env, config_JSON)
├─ theme.js     主题令牌（深/浅）与动效档位的 CSS 变量定义
├─ styles.js    布局与组件样式（切角、角标、网格、卡片、按钮、表格、Modal、骨架屏、命令面板）
├─ client.js    客户端运行时（API 封装、Toast、Tab、快捷键、命令面板、加载/重试、草稿与 diff）
└─ tabs/
   ├─ overview.js  概览 Tab 的 HTML 片段
   ├─ nodes.js     节点与订阅
   ├─ config.js    配置
   └─ ops.js       运维
```

**依赖方向**（单向，无环）：

- `index.js → theme.js, styles.js, client.js, tabs/*.js`
- `tabs/*.js → core/html.js`（只做模板拼接与 `转义HTML`，无逻辑、无状态；`admin` 层允许依赖 `core`）
- `client.js → 无（自带 API/Toast/选择器工具，不 import 样式，避免把 CSS 拖进 JS）`
- `theme.js / styles.js → 无`
- `index.js` 仍依赖 `core/html.js`（转义、掩码）与 `admin/qr.js`（二维码运行时）

**单元边界与接口**：

| 单元 | 做什么 | 怎么用 | 依赖 |
|---|---|---|---|
| `theme.js` | 导出 `主题CSS()`：`:root` 默认深色令牌 + `[data-theme="light"]` 覆盖 + 动效档位规则 | `主题CSS()` 返回字符串，拼进 `<style>` | 无 |
| `styles.js` | 导出 `样式CSS()`：所有布局/组件规则，颜色只引用 `theme.js` 的变量 | `样式CSS()` 返回字符串 | 无 |
| `tabs/overview.js` 等 | 导出 `概览Tab(摘)` 等，返回该 Tab 的 `<section>` HTML | 由 `index.js` 调用并拼接 | `core/html.js` |
| `client.js` | 导出 `客户端脚本(摘)`：返回 `<script>` 内容（IIFE） | `index.js` 拼进页面 | 无 |
| `index.js` | 计算注入摘要，按序拼接 head/shell/tabs/脚本 | 导出 `管理面板HTML(env, config_JSON)`（签名不变） | theme/styles/client/tabs + core/html + admin/qr |

## 4. 视觉系统（A+D 融合）

**结构语言（来自 A）**：卡片用 `clip-path` 切去左上/右下角（`--cut: 10px`）；四角用 L 形角标（`::before`/`::after` 的 2px 边框段）强调；背景叠极淡网格（16px 网格，透明度深色 `.055` / 浅色 `.05`）；数字统一 `font-variant-numeric: tabular-nums`。

**配色与质感（来自 D）**：深色为深蓝黑渐变 + 局部蓝色径向辉光；表面半透明 + 1px 冷蓝描边；**不使用霓虹泛光堆叠**。圆角克制（容器 10–12px，胶囊 999px）。

**令牌表**：

| 令牌 | 深色 | 浅色 |
|---|---|---|
| `--bg1/--bg2/--bg3` | `#060a12` / `#0a1120` / `#070c16` | `#f6f9fd` / `#e9eef7` / `#f2f6fc` |
| `--grid` | `rgba(120,170,255,.055)` | `rgba(30,60,110,.05)` |
| `--surf` | `rgba(18,28,46,.78)` | `rgba(255,255,255,.86)` |
| `--line` | `rgba(120,170,255,.22)` | `rgba(30,60,110,.20)` |
| `--fg` / `--mut` | `#dce7f5` / `#7d90ad` | `#16233a` / `#5b6b85` |
| `--acc` / `--acc2` | `#4da3ff` / `#35e0d8` | `#2f6fe4` / `#0f9e93` |
| `--ok` / `--warn` / `--err` | `#5ce6a0` / `#f2c14e` / `#ff8a80` | `#0f8a5f` / `#a06a00` / `#c0392b` |

**保持不变的 DOM 契约**：上一轮全部 hooks 继续存在（`#toast`、`#chart`/`#chart-tip`、`#ubar-fill`/`#utext`、`#clock-*`、`#badges`、`#qr`/`#qr-modal`/`#qr-big`、`#kbd-help`、`#diag`、`#cfg`/`#cfg-status`、`#c-*`、`#o-*`、全部 `#btn-*`、`nav [data-tab]`、`.page[data-page]`）。本轮只增加新元素，不重命名既有 id/class。

## 5. 主题与动效

- 根属性：`<html data-theme="dark|light" data-motion="full|lite|off">`。
- **无闪策略**：`<head>` 内联一段极短脚本，在首屏渲染前读取 `localStorage`（键 `et_admin_theme` / `et_admin_motion`），无记录时按 `prefers-color-scheme` 与 `prefers-reduced-motion` 决定，并立即写入根属性。
- 动效档位：`full` = 面板入场、卡片 hover 位移、用量环/趋势图动画；`lite` = 仅保留必要状态反馈（hover/focus/Toast），去掉入场与图表动画；`off` = 全部关闭。
- **优先级**：`prefers-reduced-motion: reduce` 时无论档位设置一律按 `off` 渲染。
- 切换入口：顶栏两个按钮 + 命令面板动作；切换只改根属性并写 `localStorage`，不重载页面。

## 6. 可访问性

- Tab：`nav` 加 `role="tablist"`，按钮 `role="tab"` + `aria-selected` + `aria-controls`；页面面板 `role="tabpanel"` + `aria-labelledby`。
- 模态（二维码、快捷键帮助、命令面板）：`role="dialog"` + `aria-modal="true"`，打开时焦点移入、循环聚焦、Esc 关闭、关闭后焦点回到触发元素。
- 全部交互元素可键盘到达；统一 `:focus-visible` 焦点环（用 `--acc2`）。
- 装饰性角标/网格为纯 CSS 伪元素，不进可访问性树；状态变化（保存成功、刷新结果）通过既有的 `#toast[role=status][aria-live=polite]` 播报。

## 7. 交互效率

**7.1 命令面板（⌘/Ctrl+K）**

- 单一浮层，输入框 + 结果列表；本地模糊匹配（自实现子序列匹配 + 高亮命中字符，零第三方库）。
- 内置动作（全部复用既有 `#btn-*` 的 click 或既有函数）：切 4 个 Tab；复制主节点链接/通用订阅/Clash 原生/sing-box 原生；打开二维码/下载 PNG；刷新用量/刷新全部；配置页重新加载/保存到 KV/导出到剪贴板/从剪贴板导入/恢复上一版本/重置为默认；运维页保存 TG/CF/ADD.txt、复制诊断 JSON；切换主题（深/浅/跟随系统）；切换动效（三档）；打开快捷键帮助；跳转 Workers Logs 控制台。
- 键盘：`↑`/`↓` 移动，`Enter` 执行，`Esc` 关闭；鼠标可点。
- 打开时禁用页面滚动；与既有全局快捷键（`1-4`/`c`/`r`/`?`）互不冲突（面板打开时仅面板响应按键）。

**7.2 配置编辑器增强**

- **保存前 diff 预览**：点「保存到 KV」时先与"上次加载的服务端配置"做本地 JSON 差异比较，弹出统一 diff 视图（`+`/`-` 行 + 行号 + 变更计数），确认后才真正 POST。
- **内联校验**（镜像后端 `src/config/validation.js` 规则，仅客户端预检、不替代服务端校验）：
  JSON 合法性；`协议类型 ∈ {vless,trojan,ss}`；`传输协议 ∈ {ws,grpc,xhttp}`；`gRPC模式 ∈ {gun,multi}`；`SS.加密方式 ∈ {aes-128-gcm,aes-256-gcm}`；`PATH` 以 `/` 开头；`优选订阅生成.SUBUpdateTime ∈ [1,168]`；`优选订阅生成.本地IP库.随机数量 ∈ [1,100]` 整数；`HOSTS` 非空且无 `\s/@?#`；禁止 `__proto__`/`constructor`/`prototype`；字符串 ≤8192、数组 ≤512、嵌套 ≤12。
  错误在编辑器下方逐条列出并标注字段路径；有错误时禁用「保存」并说明原因。
- **草稿自动保存**：编辑内容防抖 1s 写入 `localStorage`（键 `et_admin_draft_cfg`）；重新打开面板时若草稿与服务端配置不同，提示"检测到未保存草稿"并提供「恢复」/「丢弃」。
- **撤销/重做**：编辑器维护撤销栈（上限 50 步），`Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`；不依赖浏览器原生 undo。

**7.3 加载与失败处理**

- 每个卡片首屏渲染骨架屏（灰阶渐变条），数据到达后替换；不再出现"加载中…"纯文本。
- API 失败：卡片内联错误文案 + 「重试」按钮；自动重试最多 2 次（退避 500ms / 1500ms），仅对幂等 GET 生效（POST 不自动重试，避免重复写入）。
- Toast 队列化：同时只显示 1 条，其余排队，每条 3.2s，保留 ✓/✕ 前缀与颜色语义。

## 8. 数据流与接口

- **不新增任何服务端接口**。全部数据来自现有 `window.__ET__` 注入摘要与既有 `/admin` 路由：`/admin/config.json`、`/admin/api/usage-history`、`/admin/config`、`/admin/config/restore`、`/admin/cf.json`、`/admin/tg.json`、`/admin/ADD.txt`、`/admin/init`、`/admin/getCloudflareUsage`。
- 主题、动效、上次 Tab、编辑器草稿只写 `localStorage`，**不参与服务端状态**，不含任何凭据。
- 无新增外部网络请求；命令面板的模糊匹配、diff、校验全部在浏览器本地完成。

## 9. 错误处理与安全

- 新增 DOM 一律通过 `textContent` 或服务端已转义的字符串写入；`__ET__` 注入沿用现有 `<` 转义；XSS 断言保持并扩展。
- `localStorage` 只存：主题、动效档位、上次 Tab、编辑器草稿（草稿可能含配置内容，但配置本身不含明文凭据——凭据在服务端单独存储且面板始终掩码展示）。
- 命令面板与 diff 弹层不引入 `innerHTML` 拼接动态值。
- 服务端校验、会话鉴权、同源写校验、限流逻辑**均不改动**。

## 10. 测试

| 层级 | 内容 |
|---|---|
| `scripts/test-ui.mjs`（随 `npm test`） | 结构断言扩展：`data-theme`/`data-motion` 属性与首屏预设脚本存在；命令面板容器与输入框；骨架屏元素；diff 容器；`role="tablist"`/`aria-selected` 存在性；四 Tab 与新 id 均存在；XSS 用例保持（host/LINK/SUBNAME 注入仍被转义） |
| 构建 | `npm run build` 重生成 `_worker.js`；`verify.js` 字节比对通过 |
| 全量 | `npm run check` 全绿（模块边界含新子目录模块 + 全部测试） |
| 人工验收（部署后） | 深浅主题切换无闪烁、动效三档生效、`prefers-reduced-motion` 覆盖、⌘K 全动作可执行、diff 预览正确、草稿恢复/丢弃、键盘可达与焦点环、移动端底栏 |

## 11. 变更文件

| 文件 | 类型 |
|---|---|
| `src/admin/ui/index.js` | 新增（渲染入口，替代原 `ui.js`） |
| `src/admin/ui/theme.js` | 新增 |
| `src/admin/ui/styles.js` | 新增 |
| `src/admin/ui/client.js` | 新增 |
| `src/admin/ui/tabs/overview.js`、`nodes.js`、`config.js`、`ops.js` | 新增 |
| `src/admin/ui.js` | 删除（内容迁移至上述模块） |
| `src/main.js` | 修改 import 路径 |
| `scripts/test-ui.mjs` | 修改 import 路径 + 扩展断言 |
| `_worker.js` | 重新生成 |

## 12. 交付与发布

1. TDD：先扩展断言，再实现；每个模块实现后跑 `test-ui.mjs`
2. `npm run build` → `npm run check` 全绿
3. 提交并 push `main` → CI（`deploy.yml`）自动校验 + 自愈 secrets + 部署 `edgetunnel`
4. 生产冒烟 + 浏览器人工验收（见 §10）

## 13. 裁剪（YAGNI）

不做：多语言 i18n、拖拽式布局、自定义配色器、第三方模糊搜索库、前端路由、P2 的全部内容（运维自检与节点订阅增强，另立 spec）。

## 14. P2 待办（不在本 spec 内）

- 运维自检：连通性自检面板（复用 `/admin/check`）、用量阈值告警、配置多版本历史与回滚（需新增 KV 列键端点）
- 节点与订阅：批量复制/导出、二维码进阶（尺寸/深色底/SVG 下载）、节点备注编辑、随机 PATH 生成器（**会改节点链接 → 必须做"生成 → 预览 → 二次确认"**）