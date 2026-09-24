# 当前架构边界

更新：2026-09-24。

| 项目 | 当前状态 | 尚需验证或限制 |
|---|---|---|
| 源码组织 | 显式 ES Modules + esbuild；模块边界与循环引用自动检查 | 路由仍集中于 main.js，详见 [模块说明](MODULES.md) |
| 请求配置隔离 | 局部配置 + 缓存副本 + AsyncLocalStorage；WS 事件显式恢复上下文 | 多 host 交错、缓存污染已有回归 |
| TCP 平台兼容 | cloudflare:sockets；不使用内置 CF IP 出口 | 真实边缘目标可达性需 staging 验证 |
| TLS | HTTPS 代理使用 secureTransport:on，移除自实现栈 | 真证书/过期证书/主机名错误的线上矩阵待验收 |
| 数据面 | 原配置/订阅测试 + 协议/竞速/超时回归 + workerd 双向 WS 与 gRPC/XHTTP 回环测试 | 不等于所有客户端、真实边缘长连接、长期压力全覆盖 |
| 缓冲 | 上行队列 1MB/2048 项，首包分片重组和握手期限；gRPC 帧重组使用可增长缓冲，无逐块整段拷贝的 O(n²) 累积 | 队列溢出会关闭连接；下行慢消费者与总体内存须测量 |
| KV | 30 秒本地缓存、保存失效与世代保护、单版本备份 | 最终一致；跨地区可能 60 秒或更久；并发编辑不是事务 |
| 日志 | 脱敏结构化日志，无 KV 大数组读改写 | 旧历史 KV 未删除；DEBUG 仅诊断时启用 |
| 订阅 | 两类原生最小配置可选；旧高级分流继续走转换器 | 五类全功能内化尚未完成，见 CF-DEPLOYMENT.md |
| 配额 | Free CPU 10ms、isolate 128MB | 网络等待不算 CPU；Paid 不提高 isolate 内存；容量必须实测 |

当前修复不提供“零错误”“128 并发”“贴满额度用户数”等未经本版本负载测试支持的保证。

## 验收记录（2026-09-24）

- [x] 本地 workerd（miniflare）已验：gRPC VLESS/Trojan 双向回环、XHTTP VLESS/Trojan 双向回环、gRPC 突发 64KB 单连接按 3 字节最小分片重组回环（内容逐字节校验）。见 `scripts/test-grpc-xhttp.cjs`（`npm run test:proto`，已接入 build.yml 与 deploy.yml 门禁）。
- [ ] 外部验收（需 staging 与真实 CF 边缘，本地沙箱不可自验，不假报通过）：gRPC/XHTTP 真实边缘长连接、证书过期/主机名错误矩阵、慢消费者与总体内存观测。
