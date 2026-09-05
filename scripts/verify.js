// 校验脚本（M0-3 起职责：结构校验 + 可重现性，不再做逐字节比对——
// 切分任务已结束，业务逻辑已允许演进）。
// 校验点：
//   1. 由 src/ 重新构建产物，与仓库内 _worker.js 完全一致（防漂移，本地版）
//   2. 产物通过 node --check 语法校验
//   3. 关键全局函数存在性检查
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// 仓库根：基于脚本位置推导（verify.js 位于 scripts/ 下），
// 兼容本地沙箱与 CI checkout（两者工作目录不同，禁止硬编码绝对路径）。
const ROOT = path.resolve(__dirname, '..');
const PRODUCT = path.join(ROOT, '_worker.js');
const TMP_OUT = path.join(os.tmpdir(), `verify-${process.pid}-${Date.now()}.js`);

// 关键全局函数/常量清单（拼接态顶层作用域，按 build 后产物检查）
const KEY_FUNCTIONS = [
  '处理WS请求',
  '处理gRPC请求',
  '处理叉HTTP请求',
  '读取config_JSON',
  '全局读取配置',
  'buildClientHello',
  'forwardataTCP',
  'Clash订阅配置文件热补丁',
  'Singbox订阅配置文件热补丁',
];

function build() {
  execFileSync(process.execPath, [path.join(ROOT, 'build.js'), '--force', '--out', TMP_OUT], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function fail(msg) {
  console.error(`[check] FAIL: ${msg}`);
  try { fs.rmSync(TMP_OUT, { force: true }); } catch (_) {}
  process.exit(1);
}

try {
  // 1) 重新构建到临时文件并语法校验
  build();
  execFileSync(process.execPath, ['--check', TMP_OUT], { stdio: ['ignore', 'inherit', 'inherit'] });
  console.log('[check] 重新构建 + node --check 通过');

  // 2) 与仓库内产物逐字节一致（确认未漂移）
  const built = fs.readFileSync(TMP_OUT, 'utf8');
  const stored = fs.readFileSync(PRODUCT, 'utf8');
  if (built !== stored) fail(`构建产物与仓库 _worker.js 不一致（构建后可重现性被破坏），diff 大小: ${built.length - stored.length}`);
  console.log(`[check] 构建产物与仓库内一致（${built.length} 字节）`);

  // 3) 关键全局函数存在性
  for (const name of KEY_FUNCTIONS) {
    if (!built.includes(name)) fail(`缺少关键全局函数: ${name}`);
  }
  console.log(`[check] ${KEY_FUNCTIONS.length} 个关键全局函数均存在`);

  console.log('[check] 通过');
} catch (e) {
  fail(e.message || String(e));
} finally {
  fs.rmSync(TMP_OUT, { force: true });
}