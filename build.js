// M0-1 源码骨架与构建器雏形
// 零第三方依赖，仅使用 node 内置模块（fs/path/os/child_process）。
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = __dirname;

// 构建清单：按此顺序拼接各文件内容（共享顶层作用域）。
// 顺序必须与原 _worker.js 行号一致（顶层作用域共享、function 提升依赖原顺序）。
const BUILD_MANIFEST = [
  'src/main.js',
  'src/protocol/xhttp.js',
  'src/protocol/grpc.js',
  'src/protocol/ws.js',
  'src/protocol/trojan.js',
  'src/protocol/vless.js',
  'src/protocol/ss.js',
  'src/transport/forward.js',
  'src/transport/grain.js',
  'src/transport/dial.js',
  'src/transport/tls-client.js',
  'src/transport/proxy.js',
  'src/utils.js',
  'src/subscribe/format-clash.js',
  'src/subscribe/format-singbox.js',
  'src/subscribe/format-surge.js',
  'src/subscribe/format-loon.js',
  'src/subscribe/format-quanx.js',
  'src/subscribe/format-shadowrocket.js',
  'src/subscribe/format-v2rayn.js',
  'src/admin/panel.js',
  'src/doh.js',
  'src/config.js',
  'src/proxy/preferred.js',
  'src/proxy/account.js',
  'src/deploy.js',
];

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

// 文件间分隔注释（固定文本，校验产物时按此精确剥离）。
const FILE_SEPARATOR_COMMENT = [
  '',
  '// ===========================================================================',
  '// --- 以下为 src 模块串联产物（构建时生成，校验时剥离）---',
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
 * 剥离 src 源文件中锚点块注释（含其后换行），保证拼接产物与原始字节逐字节等价。
 * 使用规则要求的正则锚点匹配（见下方实现），并额外吸收锚点所在行的换行。
 * @param {string} content
 * @returns {string}
 */
function stripAnchorComment(content) {
  return content.replace(/\/\*# anchor[\s\S]*?\*\/\r?\n?/, '');
}

/**
 * 从清单读取并拼接所有文件内容。
 * @returns {string}
 */
function buildBundle() {
  // 直接拼接（不使用 join('\n')，避免引入多余换行字节）：
  //   HEADER + slice1 + SEP + slice2 + ... + SEP + sliceN + FOOTER
  // 剥离 HEADER/SEP/FOOTER 后，剩余即各 slice 连续拼接 = 原 _worker.js。
  let out = HEADER_COMMENT;
  for (let i = 0; i < BUILD_MANIFEST.length; i++) {
    const rel = BUILD_MANIFEST[i];
    const abs = path.join(ROOT, rel);
    if (!fileExists(abs)) {
      console.error(`[build] 错误：清单文件不存在: ${rel}`);
      process.exit(1);
    }
    if (i > 0) out += FILE_SEPARATOR_COMMENT;
    out += stripAnchorComment(fs.readFileSync(abs, 'utf8'));
  }
  out += FOOTER_COMMENT;
  return out;
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
 * @returns {{out: string|null, check: boolean, force: boolean}}
 */
function parseArgs(argv) {
  let out = null;
  let check = false;
  let force = false;
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
    } else if (arg === '--force') {
      force = true;
    } else {
      console.error(`[build] 错误：未知参数 "${arg}"`);
      process.exit(1);
    }
  }
  return { out, check, force };
}

function main() {
  const { out, check, force } = parseArgs(process.argv.slice(2));

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
      if (!force) {
        console.error(`[build] 错误：目标文件已存在，拒绝覆盖: ${out}（使用 --force 覆盖）`);
        process.exit(1);
      }
      console.log(`[build] --force：覆盖已存在的目标文件: ${out}`);
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