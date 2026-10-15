/* Gate de CI — Pré-análise (C1–C20 + extras). Uso: node tools/run-intake-tests.js */
var path = require('path');
var fs = require('fs');
var Module = require('module');
var XLSX;
// Aceita SheetJS instalado quando disponível; o gate tem fallback vendorizado.
var candidatos = ['xlsx', 'xlsx-js-style',
  path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx-js-style'),
  path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx')];
for (var i = 0; i < candidatos.length && !XLSX; i++) {
  try { XLSX = require(candidatos[i]); } catch (e) { /* tenta o próximo */ }
}
if (!XLSX) {
  // O bundle UMD vendorizado vive dentro de um package "type: module".
  // Compilamos como CommonJS em memória para manter o gate independente de npm.
  try {
    var vendor = path.join(__dirname, '..', 'frontend', 'public', 'vendor', 'xlsx.full.min.js');
    var mod = new Module(vendor + '.cjs', module);
    mod.filename = vendor + '.cjs';
    mod.paths = Module._nodeModulePaths(path.dirname(vendor));
    mod._compile(fs.readFileSync(vendor, 'utf8'), mod.filename);
    XLSX = mod.exports;
  } catch (e) { /* mensagem única abaixo */ }
}
if (!XLSX) { console.error('SheetJS indisponível: execute `npm ci` em frontend/ ou restaure frontend/public/vendor/xlsx.full.min.js.'); process.exit(2); }
// frontend/package.json declara "type": "module": ao exigir um .js de dentro de
// frontend/, o Node o interpreta como ESM e module.exports fica indisponível.
// O wrapper UMD então publica em globalThis — aceitamos as duas formas.
function carregar(rel, nomeGlobal) {
  var mod = require(path.join(__dirname, '..', 'frontend', 'public', 'assets', rel));
  if (mod && (mod.analyze || mod.run)) return mod;
  return globalThis[nomeGlobal];
}
var IA = carregar('intake-auditor.js', 'IntakeAuditor');
var ST = carregar('intake-selftest.js', 'IntakeSelfTest');
if (!IA || !ST) { console.error('Não foi possível carregar os módulos da Pré-análise.'); process.exit(2); }
var out = ST.run(IA, XLSX);
out.results.forEach(function (r) { console.log((r.pass ? 'OK   ' : 'FALHA') + ' ' + r.id + ' - ' + r.name + (r.pass ? '' : ' -> ' + r.info)); });
console.log(out.passed + '/' + out.total + ' verdes');
process.exit(out.failed ? 1 : 0);
