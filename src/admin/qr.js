// 浏览器端二维码运行时：以字符串导出，嵌入面板 HTML <script>。
// 字节模式，纠错级别 M，版本 1–6（ASCII ≤106 字节，超长抛错）。
// 单测通过 new Function('window', 二维码运行时) 在 node 中求值验证。
// 注意：该字符串内不得出现反引号、${、或 </script>。
const 二维码运行时 = `window.QRCode = (function () {
  'use strict';
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) { EXP[j] = EXP[j - 255]; }
  })();
  function gmul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGen(ecc) {
    var p = [1];
    for (var i = 0; i < ecc; i++) {
      var n = new Array(p.length + 1);
      for (var k = 0; k < n.length; k++) n[k] = 0;
      for (var j = 0; j < p.length; j++) { n[j] ^= gmul(p[j], EXP[i]); n[j + 1] ^= p[j]; }
      p = n;
    }
    return p;
  }
  function rsRem(data, ecc) {
    var g = rsGen(ecc), buf = new Array(ecc);
    for (var i = 0; i < ecc; i++) buf[i] = 0;
    for (var i = 0; i < data.length; i++) {
      var f = data[i] ^ buf[0];
      for (var j = 0; j < ecc - 1; j++) buf[j] = buf[j + 1];
      buf[ecc - 1] = 0;
      for (var j = 0; j < ecc; j++) buf[j] ^= gmul(g[j + 1], f);
    }
    return buf;
  }
  var V = { 1: { blk: 1, ecc: 10, data: 16 }, 2: { blk: 1, ecc: 16, data: 28 }, 3: { blk: 1, ecc: 26, data: 44 },
            4: { blk: 2, ecc: 18, data: 32 }, 5: { blk: 2, ecc: 24, data: 43 }, 6: { blk: 4, ecc: 16, data: 27 } };
  var CAP = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106 };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
  function baseMatrix(size, align) {
    var m = [];
    for (var y = 0; y < size; y++) { var r = new Array(size); for (var x = 0; x < size; x++) r[x] = 0; m.push(r); }
    function finder(ox, oy) {
      for (var j = -1; j <= 7; j++) {
        for (var i = -1; i <= 7; i++) {
          var x = ox + i, y = oy + j;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          var in7 = j >= 0 && j <= 6 && i >= 0 && i <= 6;
          var dark = in7 && (j === 0 || j === 6 || i === 0 || i === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
          m[y][x] = dark ? 1 : 0;
        }
      }
    }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (var t = 8; t < size - 8; t++) { m[6][t] = (t % 2 === 0) ? 1 : 0; m[t][6] = (t % 2 === 0) ? 1 : 0; }
    for (var a = 0; a < align.length; a++) {
      for (var b = 0; b < align.length; b++) {
        var cx = align[a], cy = align[b];
        if (m[cy][cx] !== 0) continue;
        for (var j = -2; j <= 2; j++) {
          for (var i = -2; i <= 2; i++) {
            m[cy + j][cx + i] = (i === 0 && j === 0) ? 1 : ((i === -2 || i === 2 || j === -2 || j === 2) ? 1 : 0);
          }
        }
      }
    }
    // 格式信息位 + 暗色模块占位（值随意，仅用于占位使数据写入跳过这些单元）
    m[size - 8][8] = 1; // 暗色模块：列 8、行 size-8
    return m;
  }
  function encodeFormat(mask) {
    var data = mask; // EC=M（00）→ 高 3 位数据为 0
    var rem = data << 10;
    for (var i = 14; i >= 10; i--) { if ((rem >> i) & 1) rem ^= 0x537 << (i - 10); }
    return ((data << 10) | rem) ^ 0x5412;
  }
  var FORMAT_POS = null; // 惰性构建：每 bit 两个位置（竖排 x=8 + 横排 y=8），共 2×15
  function formatPositions(size) {
    if (FORMAT_POS && FORMAT_POS.size === size) return FORMAT_POS.list;
    var list = [];
    for (var i = 0; i < 15; i++) {
      var vx = 8, vy = i < 6 ? i : (i < 8 ? i + 1 : size - 15 + i);                       // 竖排（左/左下副本，x=8）
      var hx = i < 8 ? size - 1 - i : (i === 8 ? 7 : 15 - i - 1 + 8), hy = 8;             // 横排（上/右上副本，y=8）
      list.push({ x: vx, y: vy }, { x: hx, y: hy });
    }
    FORMAT_POS = { size: size, list: list };
    return list;
  }
  function maskBit(x, y, mask) {
    switch (mask) {
      case 0: return ((x + y) % 2) === 0;
      case 1: return (y % 2) === 0;
      case 2: return (x % 3) === 0;
      case 3: return ((x + y) % 3) === 0;
      case 4: return ((Math.floor(y / 2) + Math.floor(x / 3)) % 2) === 0;
      case 5: return (((x * y) % 2) + ((x * y) % 3)) === 0;
      case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
      default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
    }
  }
  function penalty(m) {
    var size = m.length, score = 0;
    for (var y = 0; y < size; y++) {
      var run = 1;
      for (var x = 1; x < size; x++) {
        if (m[y][x] === m[y][x - 1]) { run++; } else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (var x = 0; x < size; x++) {
      var runC = 1;
      for (var y = 1; y < size; y++) {
        if (m[y][x] === m[y - 1][x]) { runC++; } else { if (runC >= 5) score += 3 + (runC - 5); runC = 1; }
      }
      if (runC >= 5) score += 3 + (runC - 5);
    }
    for (var j = 0; j < size - 1; j++) {
      for (var i = 0; i < size - 1; i++) {
        var v = m[j][i];
        if (m[j][i + 1] === v && m[j + 1][i] === v && m[j + 1][i + 1] === v) score += 3;
      }
    }
    var dark = 0;
    for (var j = 0; j < size; j++) { for (var i = 0; i < size; i++) { dark += m[j][i]; } }
    var percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }
  function clone(m) { var out = []; for (var i = 0; i < m.length; i++) { out.push(m[i].slice()); } return out; }
  function generate(text) {
    if (typeof text !== 'string') text = String(text);
    var bytes = [];
    for (var i = 0; i < text.length; i++) { var c = text.charCodeAt(i); bytes.push(c <= 0xff ? c : 63); }
    var version = 1;
    while (version <= 6 && bytes.length > CAP[version]) version++;
    if (version > 6) throw new Error('内容过长，二维码仅支持不超过 106 个 ASCII 字符');
    var cfg = V[version], size = 17 + version * 4;
    var totalData = cfg.blk * cfg.data;
    var bits = [];
    function push(v, n) { for (var k = n - 1; k >= 0; k--) bits.push((v >> k) & 1); }
    push(4, 4); push(bytes.length, 8);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    var rem8 = 8 - (bits.length % 8); if (rem8 === 8) rem8 = 0;
    var term = Math.min(4, rem8); push(0, term === 0 ? 0 : term);
    while (bits.length % 8 !== 0) push(0, 8 - (bits.length % 8));
    var dataWords = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | (bits[i + k] || 0);
      dataWords.push(b);
    }
    while (dataWords.length < totalData) dataWords.push((dataWords.length % 2) === 0 ? 0xEC : 0x11);
    var per = cfg.data;
    var blocks = [];
    for (var b = 0; b < cfg.blk; b++) blocks.push(dataWords.slice(b * per, (b + 1) * per));
    var eccs = [];
    for (var b = 0; b < cfg.blk; b++) eccs.push(rsRem(blocks[b], cfg.ecc));
    var final = [];
    for (var i = 0; i < per; i++) { for (var b = 0; b < cfg.blk; b++) final.push(blocks[b][i]); }
    for (var i = 0; i < cfg.ecc; i++) { for (var b = 0; b < cfg.blk; b++) final.push(eccs[b][i]); }
    // 数据单元收集（跳过功能图案、格式位、暗色模块占位）
    var base = baseMatrix(size, ALIGN[version]);
    var fmt = [8, size - 8].join(',');
    var skip = formatPositions(size);
    function isFunc(x, y) { return base[y][x] !== 0 || (x === 8 && y === size - 8) || skip.some(function (p) { return p.x === x && p.y === y; }); }
    var cells = [];
    var dir = -1, col = size - 1;
    function walk() {
      if (col === 6) col--;
      for (var row = dir < 0 ? size - 1 : 0; row >= 0 && row < size; row += dir) {
        for (var k = 0; k < 2; k++) {
          var x = col - k;
          if (x < 0) continue;
          if (!isFunc(x, row)) cells.push({ x: x, y: row });
        }
      }
      if (col - 2 < 0) return;
      dir = -dir; col -= 2; walk();
    }
    walk();
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var trial = clone(base);
      trial[size - 8][8] = 1;
      for (var i = 0; i < cells.length && i < final.length; i++) {
        var c = cells[i];
        var v = final[i] ^ (maskBit(c.x, c.y, mask) ? 1 : 0);
        trial[c.y][c.x] = v;
      }
      var s = penalty(trial);
      if (!best || s < best.score) best = { mask: mask, m: trial, score: s };
    }
    var fmtBits = encodeFormat(best.mask);
    (function putFormat() {
      var list = formatPositions(size);
      for (var i = 0; i < 15; i++) {
        var bit = ((fmtBits >> i) & 1) === 1 ? 1 : 0;
        best.m[list[i * 2].y][list[i * 2].x] = bit;       // 竖排（左/左下副本）
        best.m[list[i * 2 + 1].y][list[i * 2 + 1].x] = bit; // 横排（上/右上副本）
      }
      best.m[size - 8][8] = 1; // 暗色模块（列 8、行 size-8）
    })();
    return best.m;
  }
  function generateSVG(text, scale) {
    var m = generate(text), size = m.length, s = scale || 3;
    var rects = [];
    for (var y = 0; y < size; y++) { for (var x = 0; x < size; x++) { if (m[y][x]) rects.push('<rect x="' + (x * s) + '" y="' + (y * s) + '" width="' + s + '" height="' + s + '" fill="#111" />'); } }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (size * s) + ' ' + (size * s) + '" width="' + (size * s) + '" height="' + (size * s) + '" shape-rendering="crispEdges" role="img" aria-label="节点二维码">' + rects.join('') + '</svg>';
  }
  return { generate: generate, generateSVG: generateSVG };
})();`;

export { 二维码运行时 };