#!/usr/bin/env node
/**
 * Recompila o writer XLSX usado pela página standalone de laudos.
 * Fonte única: frontend/src/vendor/xlsxStyleLite.ts.
 * Saída versionada: frontend/public/assets/xlsx-style-lite.js.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = resolve(root, 'frontend');
const temp = resolve(frontend, '.laudo-build');
const source = resolve(frontend, 'src/vendor/xlsxStyleLite.ts');
const target = resolve(frontend, 'public/assets/xlsx-style-lite.js');

rmSync(temp, { recursive: true, force: true });
mkdirSync(temp, { recursive: true });
const tsc = resolve(frontend, 'node_modules/typescript/bin/tsc');
const result = spawnSync(process.execPath, [
  tsc, source,
  '--target', 'ES2020',
  '--module', 'ES2020',
  '--moduleResolution', 'node',
  '--lib', 'ES2020,DOM',
  '--skipLibCheck',
  '--outDir', temp,
], { cwd: frontend, stdio: 'inherit', shell: false });
if (result.status !== 0) process.exit(result.status || 1);
cpSync(resolve(temp, 'xlsxStyleLite.js'), target);
rmSync(temp, { recursive: true, force: true });
console.log(`✔ writer XLSX de laudos gerado: ${target}`);
