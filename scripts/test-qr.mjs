// 求值浏览器端二维码运行时，验证结构正确性（矩阵尺寸/定位图案/抛错/SVG 输出）。
import { 二维码运行时 } from '../src/admin/qr.js';
import assert from 'node:assert/strict';

function evalQR() {
  const sandbox = { window: {} };
  new Function('window', 二维码运行时)(sandbox.window);
  return sandbox.window.QRCode;
}

;(async () => {
  const QR = evalQR();
  assert.ok(QR && typeof QR.generate === 'function' && typeof QR.generateSVG === 'function', '运行时暴露 generate/generateSVG');

  // 1) 短内容 → 版本 1，21x21
  const m = QR.generate('A');
  assert.strictEqual(m.length, 21, 'v1 尺寸 21');
  assert.ok(m.every(row => Array.isArray(row) && row.length === 21), '矩阵为 21x21');

  // 2) 三个定位眼（finder）：每行/列首尾 7 位全 1
  const eye = (x, y) => {
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const v = (j === 0 || j === 6 || i === 0 || i === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) ? 1 : 0;
      assert.strictEqual(m[y + j][x + i], v, `定位眼 (${x},${y}) 内 (${i},${j})`);
    }
  };
  eye(0, 0); eye(14, 0); eye(0, 14);

  // 3) 时序图案：行 6 / 列 6（8..12 范围）交替
  for (let t = 8; t <= 12; t++) {
    assert.strictEqual(m[6][t], (t % 2 === 0) ? 1 : 0, `横向时序 (6,${t})`);
    assert.strictEqual(m[t][6], (t % 2 === 0) ? 1 : 0, `纵向时序 (${t},6)`);
  }

  // 4) 超长抛错（v6-M 上限 106 字节）
  assert.throws(() => QR.generate('A'.repeat(120)), /过长/, '超长内容应抛错');

  // 5) SVG 输出
  const svg = QR.generateSVG('hello');
  assert.ok(typeof svg === 'string' && svg.startsWith('<svg'), 'generateSVG 返回 svg 字符串');

  console.log('[test-ui] qr 运行时结构断言通过');
  process.exit(0);
})().catch((e) => { console.error('[test-ui] FAIL:', e); process.exit(1); });