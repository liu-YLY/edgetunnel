# 管理面板 UI 现代化（Glassmorphism 深色 + 功能增强）设计文档

日期：2026-09-19
状态：已确认（方案 A）
前置交付物：`2026-09-19-local-admin-panel-design.md`（本地内嵌面板基线）、Commit `1bb7927` 的 GitHub→CF 自动部署链路

## 1. 背景与目标

生产面板（`edgetunnel` / v20251104 服务，自定义域 `edt2.liuyong.eu.org`）已具备四个 Tab（概览 / 节点与订阅 / 配置 / 运维）的本地内嵌单页应用，复用 `src/admin/ui.js`（372 行，单文件 HTML 字符串，零外部依赖）。

用户反馈：当前页面"有点丑"，希望更现代化、更美观、功能更丰富。经澄清确认：

- 视觉风格：**Glassmorphism 深色**（深色渐变背景、半透明磨砂卡片、发光强调色、微动效）
- 功能范围：**四项全部纳入**（节点体验增强、概览页增强、运维工具增强、交互细节增强）

## 2. 方案选择

| 方案 | 说明 | 取舍 | 结论 |
|---|---|---|---|
| **A（选定）** | 在现有 `ui.js` 内整容 + 增强；保持四个 Tab DOM 骨架与 `/admin` API 复用不变，`src/main.js` 零改动 | 改动集中、风险低、可增量验证 | ✅ |
| B | 客户端脚本拆独立文件走 esbuild 文本 loader 内联 | 需动构建链与校验器（`check-modules.cjs`、verify），回归风险高 | 不选 |
| C | 引入 CDN 前端框架（Tailwind/HTMX/alpine 等） | 违背"零外部依赖、运行时零 fetch"约束，性能与风控差 | 排除 |

## 3. 设计

### 3.1 视觉系统（重构 CSS 层）

- **背景**：`linear-gradient(160deg,#0b1020,#131a2e,#0e1424)` + 顶部 `radial-gradient` 蓝紫辉光（`#6e8bff → #22d3ee`），整体深色
- **玻璃卡片**：`background: rgba(255,255,255,.04)` + `backdrop-filter: blur(20px) saturate(140%)` + 1px 渐变内描边（`border-image` 或 `::before` 渐变层）+ 圆角 18px + `box-shadow: 0 12px 32px rgba(0,0,0,.35)`
- **组件**：胶囊 Tab（激活态渐变底 + 发光阴影）、主按钮（渐变蓝紫）/ ghost 按钮（描边玻璃）/ 危险按钮（红调）、玻璃输入框（聚焦发光）、Toast（滑入 + 自动消失）、二维码 Modal（含下载 PNG）
- **字体/数字**：系统字体栈 + `font-feature-settings:"tnum"`（tabular-nums）
- **微动效**：页面切换 fade/slide（CSS transition + JS class 切换）、用量环 `stroke-dashoffset` 动画、卡片 hover 轻微上浮、按钮 active 缩小反馈
- **无障碍**：focus-visible 环形、aria 标签（Tab、Modal、Toast 层级）、`prefers-reduced-motion` 关闭动效

### 3.2 功能增强（客户端 JS，全部原生实现）

**节点体验增强**
- 主节点二维码 **Modal 弹窗**：大图渲染 + "下载 PNG"按钮（把 QRCode 矩阵绘制到 `<canvas>`，`toDataURL` 导出下载，零依赖）
- 复制按钮 Toast 文案/图标强化（成功=绿色对勾、失败=红色叹号）

**概览页增强**
- 实时时钟：本地时间 + UTC，每秒 `setInterval` 刷新
- 用量环：百分比渐变（两种颜色按使用率临界切换）+ 动画
- 运行状态徽章：协议 / 传输 / 出站模式 / KV 状态（基于 `__ET__` 注入摘要渲染）
- 30 天趋势柱状图：hover 高亮柱体 + 跟随鼠标 div tooltip（原生）

**运维工具增强**
- 诊断信息卡：版本 / host / UUID / 出站模式 / 当前时间 / UA，一键"复制诊断 JSON"
- 配置 JSON **导出到剪贴板 / 从剪贴板导入**（配合现有 JSON 编辑器 + 保存流程）
- 登录限流/保护说明文案（挂在运维页说明区）

**交互细节增强**
- 快捷键：`1-4` 切换 Tab、`c` 复制主订阅链接、`r` 刷新用量、`?` 打开快捷键帮助浮层
- **记住上次 Tab**：`localStorage`（键前缀 `et_admin_`，防冲突；异常时静默忽略）
- `document.visibilitychange` → 回到页面时自动刷新用量接口
- Header 右侧：刷新按钮 + 回到顶部锚点
- 移动端：`max-width` 断点下 Tab 落到底部固定条，卡片单列

### 3.3 数据流与接口

- **不新增任何 `/admin` 接口**：全部复用现有会话鉴权 + `__ET__` 注入 + `/admin/config.json`、`/admin/api/usage-history`、`/admin/config`、`/admin/config/restore` 等
- 客户端仅做本地渲染/交互；写操作仍走现有鉴权与 `同源写请求` 校验
- 新增浏览器端资源均为代码（canvas 绘制、CSS 动画），无外部网络请求
- `localStorage` 仅存 UI 偏好（上次 Tab），不含任何凭据

### 3.4 错误处理与安全

- 所有 fetch 保留 try/catch + Toast 展示；4xx/5xx 解析 JSON `error` 字段
- 新增 DOM 一律 `textContent` 注入，XSS 面不扩大；`__ET__` 注入继续走服务端转义
- Toast/Modal 有显式关闭路径；快捷键仅在非输入聚焦时生效

### 3.5 测试

| 层级 | 内容 |
|---|---|
| 单元（test-ui.mjs，随 `npm test` 跑） | 结构断言更新：新 id/标记（时钟容器、QR Modal、诊断卡、帮助浮层等）存在且正确；XSS 断言保持（`<script>`/`"` 注入仍被转义）；快捷键映射表导出可断言 |
| 构建（verif） | `npm run build` 重生成 `_worker.js` + verify 字节比对通过 |
| 全量 | `npm run check` 全绿（模块边界 + 构建 + 全部测试） |
| 人工验收（staging/生产） | 四 Tab 视觉与交互动效、QR 下载 PNG（浏览器行为，自动化无法覆盖）、快捷键、移动端布局 |

## 4. 变更文件

| 文件 | 类型 |
|---|---|
| `src/admin/ui.js` | 重构（CSS 层重写 + JS 增强），预期 ≤ 700 行 |
| `_worker.js` | 构建产物，重新生成并提交 |
| `scripts/test-ui.mjs` | 更新结构断言 + 新增快捷键映射断言 |
| （无其他源码改动：`main.js`、`utils.js`、服务层均不动） | |

## 5. 交付与发布

1. TDD：先更新/新增断言，再实现
2. `npm run build` 重生成 `_worker.js`，`npm run check` 全绿
3. 提交到 `trae/agent-*` 分支 → 推送 `main` → GitHub CI（Build Drift Check）通过 + Deploy 工作流自动上线生产（凭据已可配，未配时跳过部署由人工/手动触发）
4. 人工验收清单：视觉风格、四个 Tab 交互、QR 下载、快捷键、移动端

## 6. 裁剪（YAGNI）

不做：浅色/暗色主题切换按钮、多语言 i18n、WebSocket 实时推送、第三方图表库、图表导出 PNG。