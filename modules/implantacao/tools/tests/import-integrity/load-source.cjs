'use strict';
// Executa os fontes UMD e TypeScript reais; não substitui o typecheck/build Vue.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const cache = new Map();
function loadSource(relative, optional = false) {
  const filename = path.resolve(root, relative);
  if (!fs.existsSync(filename) && optional) return {};
  if (cache.has(filename)) return cache.get(filename).exports;
  let source = fs.readFileSync(filename, 'utf8');
  if (filename.endsWith('.ts')) {
    const localRequire = createRequire(path.join(root, 'frontend', 'package.json'));
    const ts = localRequire('typescript');
    const result = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n',
    }));
    source = result.outputText;
  }
  const module = { exports: {} };
  cache.set(filename, module);
  function scopedRequire(specifier) {
    if (specifier.startsWith('.')) {
      let candidate = path.resolve(path.dirname(filename), specifier);
      if (!fs.existsSync(candidate)) candidate += '.ts';
      return loadSource(path.relative(root, candidate));
    }
    return createRequire(filename)(specifier);
  }
  new vm.Script('(function(require,module,exports){\n' + source + '\n})', { filename })
    .runInThisContext()(scopedRequire, module, module.exports);
  return module.exports;
}
module.exports = { loadSource, root };
