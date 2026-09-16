# ES Modules 与依赖边界

更新：2026-09-16。源码使用真正的 `import` / `export`；`src/package.json` 声明 ESM。构建与部分测试工具仍使用 CommonJS，两者通过明确的文件边界区分。

## 构建和部署

`src/main.js` 是唯一 Worker 入口。`build.js` 使用锁定版本的 esbuild，根据 import 图生成单文件 ESM `_worker.js`，不再维护拼接清单或共享顶层作用域。新增文件只需从调用方显式导入。

`cloudflare:sockets` 和 `node:async_hooks` 保留为平台外部模块，不注入 Node polyfill。Wrangler 仍部署 `_worker.js`；现有 KV、Secrets、compatibility_date 和 `nodejs_als` 配置不因模块拆分而变化。esbuild、Acorn、eslint-scope 仅用于构建和校验，不进入 Worker 运行时依赖。

```sh
npm ci
npm run build
npm run check
npm run test:runtime
npm run deploy:check
```

修改源码后必须重新生成产物；`check` 会验证 `_worker.js` 与当前源码可重现构建一致。打包解析或链接失败时不覆盖已有产物。

## 职责与允许的依赖

| 模块 | 职责 | 可依赖 |
|---|---|---|
| `core/` | 字节、加密、字符串、路径选项、常量、请求上下文 | core |
| `config/` | env/KV 配置读取、校验、快照缓存、保存与缓存失效 | config、core、services |
| `services/` | Cloudflare 用量查询 | services、core |
| `transport/` | sockets、DoH、代理握手、连接生命周期、流转发与背压 | transport、core |
| `protocol/` | VLESS/Trojan/SS 解析及 WS/gRPC/XHTTP 入站处理 | protocol、transport、core |
| `proxy/` | 出站选项解析、账号、优选地址来源 | proxy、transport、core |
| `subscribe/` | 节点链接、客户端格式生成与修正 | subscribe、proxy、core |
| `admin/` | 管理页面、访问日志 | admin、core、security |
| `security.js` | 请求限制、会话、同源校验 | core |
| `main.js` | HTTP 路由与各模块的装配 | 上述模块 |

配置层不调用协议处理器；传输层不导入配置读取、入站协议、订阅或页面模块。共用工具下沉到 core，避免通过管理面板或协议处理器导入纯工具函数。

`cloudflare:sockets` 只在 `transport/dial.js` 导入，`AsyncLocalStorage` 只在 `core/context.js` 导入。请求状态通过已有参数及请求上下文访问；拆模块不会把请求状态变成跨请求共享变量。缓存状态归 `config/cache.js` 管理；世代计数通过 ESM live binding 读取，外部通过失效函数修改。

`protocol/` 中仍保留入站处理的编排，`main.js` 仍保留路由分支。本次没有重写协议和路由算法；后续可以在现有边界内分别细化。

## 自动防护与测试边界

- `scripts/check-modules.cjs` 检查未声明引用、全局写入、相对模块路径、平台模块位置、跨层依赖和循环依赖。规则集中在 `LAYERS`；`test-modules.cjs` 验证非法依赖会被拒绝。
- 配置、订阅、回归测试直接 import 源码，不再改写部署产物或通过 `new Function` 读取隐藏全局。
- Node 测试仅用 ESM loader 替换 `cloudflare:sockets` 为显式可配置的 fixture；MD5 适配也只存在于测试中。
- workerd 集成测试运行实际 `_worker.js` 和平台 sockets，验证登录、鉴权、配置写入及分帧 VLESS/Trojan/SS WebSocket 双向流转发。
- Wrangler dry-run 验证本地部署打包，未发布到 Cloudflare。gRPC/XHTTP、TURN/SSTP、真实 CF 边缘及长期负载仍需独立验收。

迁移时对照修改前快照，172 个顶层声明的语法树保持一致；仅为原先使用未声明编码器的 TURN/SSTP 传输文件补充本地 TextEncoder/TextDecoder。该结构比对不替代运行时和线上测试。
