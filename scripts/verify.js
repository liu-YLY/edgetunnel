// 检查模块边界、构建可重现性与产物语法。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// 仓库根：基于脚本位置推导（verify.js 位于 scripts/ 下），
// 兼容本地沙箱与 CI checkout（两者工作目录不同，禁止硬编码绝对路径）。
const ROOT = path.resolve(__dirname, '..');
const PRODUCT = path.join(ROOT, '_worker.js');
const TMP_OUT = path.join(os.tmpdir(), `verify-${process.pid}-${Date.now()}.mjs`);

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
  const { validateModules, readSources } = require('./check-modules.cjs');
  const graph = validateModules(new Map(readSources()));
  console.log(`[check] ${graph.size} 个模块：无隐式引用、无循环、依赖边界通过`);
  // 1) 重新构建到临时文件并语法校验
  build();
  execFileSync(process.execPath, ['--check', TMP_OUT], { stdio: ['ignore', 'inherit', 'inherit'] });
  console.log('[check] 重新构建 + node --check 通过');

  // 2) 与仓库内产物逐字节一致（确认未漂移）
  const built = fs.readFileSync(TMP_OUT, 'utf8');
  const stored = fs.readFileSync(PRODUCT, 'utf8');
  if (built !== stored) fail(`构建产物与仓库 _worker.js 不一致（构建后可重现性被破坏），diff 大小: ${built.length - stored.length}`);
  console.log(`[check] 构建产物与仓库内一致（${Buffer.byteLength(built)} 字节）`);

  console.log('[check] 通过');
} catch (e) {
  fail(e.message || String(e));
} finally {
  fs.rmSync(TMP_OUT, { force: true });
}
