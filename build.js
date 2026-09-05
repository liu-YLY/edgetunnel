// M0-1 源码骨架与构建器雏形
// 零第三方依赖，仅使用 node 内置模块（fs/path/os/child_process）。
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = __dirname;

// 构建清单：按此顺序拼接各文件内容（共享顶层作用域）。
const BUILD_MANIFEST = ['src/main.js'];

// 头部/尾部/每个文件间分隔注释
const HEADER_COMMENT = [
  '// ===========================================================================',
  '// M0 单文件 Worker 构建产物（由 build.js 生成，请勿手动编辑）',
  '// ===========================================================================',
  '',
].join('\n');

const FOOTER_COMMENT = [
  '// ===========================================================================',
  '// 构建结束',
  '// ===========================================================================',
  '',
].join('\n');

const FILE_SEPARATOR_COMMENT = [
  '',
  '// ===========================================================================',
  '// 以下内容来自文件: ${FILE}',
  '// ===========================================================================',
  '',
].join('\n');

/**
 * 检查给定路径是否存在。
 * @param {string} filePath
 * @returns {boolean}
 */
function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 从清单读取并拼接所有文件内容。
 * @returns {string}
 */
function buildBundle() {
  const parts = [HEADER_COMMENT];
  for (const rel of BUILD_MANIFEST) {
    const abs = path.join(ROOT, rel);
    if (!fileExists(abs)) {
      console.error(`[build] 错误：清单文件不存在: ${rel}`);
      process.exit(1);
    }
    parts.push(FILE_SEPARATOR_COMMENT.replace('${FILE}', rel));
    parts.push(fs.readFileSync(abs, 'utf8'));
  }
  parts.push(FOOTER_COMMENT);
  return parts.join('\n');
}

/**
 * 将捆绑内容写入临时文件并做语法校验，失败即报错退出。
 * @param {string} bundle
 * @returns {void}
 */
function syntaxCheck(bundle) {
  const tmpFile = path.join(
    os.tmpdir(),
    `m0-build-${process.pid}-${Date.now()}.js`
  );
  try {
    fs.writeFileSync(tmpFile, bundle, 'utf8');
    execFileSync(process.execPath, ['--check', tmpFile], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } catch (e) {
    fs.rmSync(tmpFile, { force: true });
    console.error('[build] 语法校验失败，不写出任何产物。');
    process.exit(1);
  }
  fs.rmSync(tmpFile, { force: true });
}

/**
 * 解析命令行参数。
 * @param {string[]} argv
 * @returns {{out: string|null, check: boolean}}
 */
function parseArgs(argv) {
  let out = null;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      if (i + 1 >= argv.length) {
        console.error('[build] 错误：--out 缺少路径参数');
        process.exit(1);
      }
      out = argv[++i];
    } else if (arg === '--check') {
      check = true;
    } else {
      console.error(`[build] 错误：未知参数 "${arg}"`);
      process.exit(1);
    }
  }
  return { out, check };
}

function main() {
  const { out, check } = parseArgs(process.argv.slice(2));

  const bundle = buildBundle();

  // 无论何种模式，先以临时文件方式做语法校验（绝不写产物）。
  syntaxCheck(bundle);

  const lineCount = bundle.split('\n').length;
  const byteCount = Buffer.byteLength(bundle, 'utf8');
  console.log(
    `[build] 拼接完成：${lineCount} 行，${byteCount} 字节`
  );

  if (out) {
    const abs = path.resolve(ROOT, out);
    if (fileExists(abs)) {
      console.error(`[build] 错误：目标文件已存在，拒绝覆盖: ${out}`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bundle, 'utf8');
    console.log(`[build] 已写出产物: ${out} (${byteCount} 字节)`);
    return;
  }

  if (!check) {
    // 默认 CHECK_ONLY 模式：只输出到 stdout，不写任何文件。
    process.stdout.write(bundle);
    console.error(
      '[build] CHECK_ONLY 模式：产物未落盘（使用 --out <path> 显式写出）'
    );
  } else {
    console.log('[build] --check：仅校验，未写出任何文件。');
  }
}

main();