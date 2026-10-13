'use strict';

const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');

const webRequire = createRequire(path.join(__dirname, '../apps/web/package.json'));
const tailwindRequire = createRequire(webRequire.resolve('tailwindcss'));
const micromatchRequire = createRequire(tailwindRequire.resolve('micromatch'));
const braces = micromatchRequire('braces');

assert.deepEqual(braces.expand('{a,b}'), ['a', 'b']);

const deeplyNested = '{'.repeat(3500) + 'a' + '}'.repeat(3500);
for (const options of [{}, { expand: true }]) {
  assert.throws(
    () => braces(deeplyNested, options),
    (error) => error instanceof SyntaxError && /maximum depth/.test(error.message),
    'The patched braces parser must reject deeply nested patterns'
  );
}

console.log('braces depth guard is active');
