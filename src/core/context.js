import { 默认SOCKS5白名单 } from './constants.js';
import { AsyncLocalStorage } from 'node:async_hooks';
const 请求存储 = new AsyncLocalStorage();

function 当前请求配置() { return 请求存储.getStore() || { 调试日志打印: false, TCP并发拨号数: 2, 反代并发拨号数: 1, 预加载竞速拨号: false, SOCKS5白名单: 默认SOCKS5白名单 }; }

function log(...args) {
	if (当前请求配置().调试日志打印) console.log(...args);
}

export { log, 当前请求配置, 请求存储 };
