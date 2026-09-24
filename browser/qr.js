// 管理面板专用二维码运行时。构建时内联，浏览器本地编码节点链接。
// qrcode-generator: MIT, https://github.com/kazuhikoarase/qrcode-generator
import qrcode from 'qrcode-generator';
import { 检查节点链接 } from '../src/core/link-diagnostics.js';

function generateSVG(content) {
  if (typeof content !== 'string' || !content || new TextEncoder().encode(content).length > 2048) throw new Error('二维码内容长度必须在 1–2048 字节之间');
  const qr = qrcode(0, 'M');
  try { qr.addData(content, 'Byte'); qr.make(); }
  catch (_) { throw new Error('链接过长，无法生成二维码；仍可复制链接'); }
  const n = qr.getModuleCount(), padding = 4, scale = 5, size = (n + padding * 2) * scale;
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) cells.push(`<rect x="${(x + padding) * scale}" y="${(y + padding) * scale}" width="${scale}" height="${scale}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="节点二维码"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#111">${cells.join('')}</g></svg>`;
}

window.QRCode = { generateSVG };
window.NodeDiagnostics = { inspect: 检查节点链接 };
