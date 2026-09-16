'use strict';
const assert = require('node:assert/strict');
const { validateModules } = require('./check-modules.cjs');
const fixtures = entries => new Map(entries);
assert.throws(() => validateModules(fixtures([['src/core/a.js', 'missing();']])), /未声明引用/);
assert.throws(() => validateModules(fixtures([['src/core/a.js', "import './missing.js';"]])), /模块不存在/);
assert.throws(() => validateModules(fixtures([
  ['src/core/a.js', "import './b.js';"], ['src/core/b.js', "import './a.js';"],
])), /循环依赖/);
assert.throws(() => validateModules(fixtures([
  ['src/transport/a.js', "import '../protocol/a.js';"], ['src/protocol/a.js', 'export const value = 1;'],
])), /跨层反向依赖/);
assert.throws(() => validateModules(fixtures([
  ['src/config/a.js', "import '../protocol/a.js';"], ['src/protocol/a.js', 'export const value = 1;'],
])), /跨层反向依赖/);
assert.throws(() => validateModules(fixtures([
  ['src/core/a.js', "import { connect } from 'cloudflare:sockets';"],
])), /平台依赖位置错误/);
assert.doesNotThrow(() => validateModules(fixtures([
  ['src/transport/a.js', "import { value } from '../core/a.js'; export const result = value;"],
  ['src/core/a.js', 'export const value = 1;'],
])));
console.log('[modules] 依赖检查器反例与合法依赖测试通过');
