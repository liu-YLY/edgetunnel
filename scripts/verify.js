// 校验脚本：剥离构建产物中的 HEADER / FOOTER / 分隔注释 / 锚点注释后，
// 与 /tmp/original_worker.js（git main:_worker.js 备份）逐字节比对。
'use strict';
const fs = require('fs');

const ROOT = '/workspace';
const PRODUCT = process.argv[2] || `${ROOT}/_worker.js`;
const ORIGINAL = '/tmp/original_worker.js';

const product = fs.readFileSync(PRODUCT, 'utf8');
const original = fs.readFileSync(ORIGINAL, 'utf8');

// 与 build.js 中定义保持一致
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
  '// --- 以下为 src 模块串联产物（构建时生成，校验时剥离）---',
  '// ===========================================================================',
  '',
].join('\n');

function stripAll(text) {
  let t = text;
  if (t.startsWith(HEADER_COMMENT)) t = t.slice(HEADER_COMMENT.length);
  else console.error('[check] 警告：产物未以 HEADER 开头');
  if (t.endsWith(FOOTER_COMMENT)) t = t.slice(0, t.length - FOOTER_COMMENT.length);
  else console.error('[check] 警告：产物未以 FOOTER 结尾');
  // 剥离文件间分隔注释
  t = t.split(FILE_SEPARATOR_COMMENT).join('');
  // 剥离残余锚点注释（构建时已剥离，此处兜底）
  t = t.replace(/\/\*# anchor[\s\S]*?\*\/\r?\n?/g, '');
  return t;
}

const stripped = stripAll(product);

const same = stripped === original;
console.log(`[check] 产物字节数: ${product.length}`);
console.log(`[check] 剥离后字节数: ${stripped.length}`);
console.log(`[check] 原始备份字节数: ${original.length}`);
console.log(`[check] 逐字节一致: ${same ? '是' : '否'}`);

if (!same) {
  // 定位首个差异位置
  let i = 0;
  const max = Math.max(stripped.length, original.length);
  while (i < max && stripped.charCodeAt(i) === original.charCodeAt(i)) i++;
  console.error(`[check] 首个差异偏移: ${i}`);
  console.error('[check]  被剥离产物: ' + JSON.stringify(stripped.slice(Math.max(0, i - 40), i + 60)));
  console.error('[check]  原始备份  : ' + JSON.stringify(original.slice(Math.max(0, i - 40), i + 60)));
  process.exit(1);
}
console.log('[check] 通过');