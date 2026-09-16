const config缓存映射 = new Map();

const 用量缓存 = new Map();

const config缓存TTL = 30 * 1000;

let 配置缓存世代 = 0;

function 失效配置缓存() { 配置缓存世代++; config缓存映射.clear(); 用量缓存.clear(); }

export { config缓存TTL, config缓存映射, 失效配置缓存, 用量缓存, 配置缓存世代 };
