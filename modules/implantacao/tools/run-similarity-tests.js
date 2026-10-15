#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console });
context.globalThis = context;
context.self = context;

function load(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  vm.runInContext(source, context, { filename });
}

load('frontend/public/assets/similarity-engine.js');
load('frontend/public/assets/similarity-selftest.js');

if (!context.SimilaritySelfTest || typeof context.SimilaritySelfTest.run !== 'function') {
  throw new Error('SimilaritySelfTest não foi carregado corretamente');
}

const result = context.SimilaritySelfTest.run();
result.results.forEach((r) => {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.id} ${r.name}${r.error ? ` — ${r.error}` : ''}`);
});
console.log(`\nSimilarityEngine: ${result.passed}/${result.total} verdes`);
process.exit(result.ok ? 0 : 1);
