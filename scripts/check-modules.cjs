'use strict';
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const scope = require('eslint-scope');
const ROOT = path.resolve(__dirname, '..');
const GLOBALS = new Set(('AbortController AbortSignal Array ArrayBuffer Boolean DataView Date Error Headers IdentityTransformStream JSON Map Math NaN Number Object Promise Proxy ReadableStream RegExp Request Response Set String TextDecoder TextEncoder TransformStream URL URLSearchParams Uint16Array Uint8Array WebSocket WebSocketPair WritableStream atob btoa clearTimeout console crypto decodeURIComponent encodeURIComponent fetch isNaN parseInt performance queueMicrotask setTimeout structuredClone undefined unescape').split(' '));
const LAYERS = {
  core: ['core'],
  config: ['config', 'core', 'services'],
  services: ['services', 'core'],
  transport: ['transport', 'core'],
  protocol: ['protocol', 'transport', 'core'],
  proxy: ['proxy', 'transport', 'core'],
  subscribe: ['subscribe', 'proxy', 'core'],
  admin: ['admin', 'core', 'security.js'],
  'security.js': ['core'],
  'main.js': ['config', 'core', 'services', 'transport', 'protocol', 'proxy', 'subscribe', 'admin', 'security.js'],
};
const PLATFORM = { 'cloudflare:sockets': 'src/transport/dial.js', 'node:async_hooks': 'src/core/context.js' };
function layer(file) { return file.split('/')[1]; }
function validateModules(sources) {
  const graph = new Map();
  for (const [file, source] of sources) {
    if (!LAYERS[layer(file)]) throw new Error(`未声明模块层: ${file}`);
    const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
    const scopes = scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
    for (const ref of scopes.globalScope.through) {
      if (!GLOBALS.has(ref.identifier.name)) throw new Error(`未声明引用: ${file}: ${ref.identifier.name}`);
      if (ref.isWrite()) throw new Error(`禁止写入全局: ${file}: ${ref.identifier.name}`);
    }
    const deps = [];
    for (const node of ast.body) {
      if (!node.source) continue;
      const spec = node.source.value;
      if (!spec.startsWith('.')) {
        if (PLATFORM[spec] !== file) throw new Error(`平台依赖位置错误: ${file} -> ${spec}`);
        continue;
      }
      const dest = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (!spec.endsWith('.js') || !sources.has(dest)) throw new Error(`模块不存在或缺少 .js 扩展名: ${file} -> ${spec}`);
      if (!LAYERS[layer(file)].includes(layer(dest))) throw new Error(`跨层反向依赖: ${file} -> ${dest}`);
      deps.push(dest);
    }
    graph.set(file, deps);
  }
  const done = new Set(), visiting = new Set();
  function visit(file, chain) {
    if (visiting.has(file)) throw new Error(`循环依赖: ${[...chain, file].join(' -> ')}`);
    if (done.has(file)) return;
    visiting.add(file);
    for (const dep of graph.get(file)) visit(dep, [...chain, file]);
    visiting.delete(file); done.add(file);
  }
  for (const file of graph.keys()) visit(file, []);
  return graph;
}
function readSources(dir = 'src') {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const file = `${dir}/${entry.name}`;
    return entry.isDirectory() ? readSources(file) : file.endsWith('.js') ? [[file, fs.readFileSync(path.join(ROOT, file), 'utf8')]] : [];
  });
}
if (require.main === module) {
  const graph = validateModules(new Map(readSources()));
  console.log(`[modules] ${graph.size} 个 ES Modules：引用已声明、依赖边界正确、无循环`);
}
module.exports = { validateModules, readSources };
