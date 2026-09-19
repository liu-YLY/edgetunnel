# 当前架构边界

更新：2026-09-16。

| 项目 | 当前状态 | 尚需验证或限制 |
|---|---|---|
| 源码组织 | 显式 ES Modules + esbuild；模块边界与循环引用自动检查 | 路由仍集中于 main.js，详见 [模块说明](MODULES.md) |
| 请求配置隔离 | 局部配置 + 缓存副本 + AsyncLocalStorage；WS 事件显式恢复上下文 | 多 host 交错、缓存污染已有回归 |
| TCP 平台兼容 | cloudflare:sockets；不使用内置 CF IP 出口 | 真实边缘目标可达性需 staging 验证 |
| TLS | HTTPS 代理使用 secureTransport:on，移除自实现栈 | 真证书/过期证书/主机名错误的线上矩阵待验收 |
| 数据面 | 原配置/订阅测试 + 协议/竞速/超时回归 + workerd 双向 WS 测试 | 不等于所有客户端、gRPC/XHTTP、长期压力全覆盖 |
| 缓冲 | 上行队列 1MB/2048 项，首包分片重组和握手期限 | 队列溢出会关闭连接；下行慢消费者与总体内存须测量；本地 workerd 已验 512KB 单连接突发回环（含 3 字节最小分帧重组，内容逐字节校验） |
| KV | 30 秒本地缓存、保存失效与世代保护、单版本备份 | 最终一致；跨地区可能 60 秒或更久；并发编辑不是事务 |
| 日志 | 脱敏结构化日志，无 KV 大数组读改写 | 旧历史 KV 未删除；DEBUG 仅诊断时启用 |
| 订阅 | 两类原生最小配置可选；旧高级分流继续走转换器 | 五类全功能内化尚未完成，见 CF-DEPLOYMENT.md |
| 配额 | Free CPU 10ms、isolate 128MB | 网络等待不算 CPU；Paid 不提高 isolate 内存；容量必须实测 |

当前修复不提供“零错误”“128 并发”“贴满额度用户数”等未经本版本负载测试支持的保证。

## 验收记录（2026-09-19 更新）

- [x] 本地 workerd（miniflare）已验：gRPC VLESS/Trojan 双向回环、XHTTP VLESS/Trojan 双向回环、gRPC 突发 64KB×8 任意 3 字节分帧回环（scripts/test-grpc-xhttp.cjs，`npm run test:proto`）。
- [ ] 外部验收（需 staging 环境与 CF 凭据，本沙箱不可自验，不假报通过）：真实 CF 边缘 gRPC/XHTTP 各 1 小时长连接；证书过期/主机名错误矩阵；慢消费者与总体内存观测；长期压力。

### Phase C 决策（2026-09-19，M2-P2 传输纵深）

- **gRPC 头紧凑化：不实施。** 当前下行逐块封装 `5 字节头 + 0x0a + varint` 是 gRPC 线协议规范要求；偏离规范会破坏与标准 gRPC 客户端（xray/sing-box gun）的互操作，且无任何实测指标证明当前开销是瓶颈。改动即互操作风险（YAGNI）。
- **UDP over WS：现状即边界，不改实现。** `transport/udp.js` 的 UDP 路径为 **DNS-over-TCP 专用**（上游硬编码 8.8.4.4:53，非 53 端口的 VLESS/Trojan UDP 统一拒绝 "UDP is not supported"）。本地回环回归需真实外网连通性（连接 8.8.4.4），在 CI/沙箱不可确定性复现；改为可配置上游属超出本迭代的范围，无用户面收益，不做。
- 结论：M2-P2 无可验证的缺陷或收益支撑改动，维持现状并把"gRPC/XHTTP 真实边缘长连接"列为本条目唯一外部验收项。
