import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

// The subprocess is controlled: these tests must never install packages or access a registry.
for (const fail of [false, true]) test(`dependency resolver launches npm CLI without a shell and ${fail ? 'stops on failure' : 'completes ordered gates'}`, async () => {
 const dir = await mkdtemp(join(tmpdir(), 'helpdesk npm cli '));
 try {
  const cli = join(dir, 'npm fixture.cjs'), log = join(dir, 'calls.jsonl');
  await writeFile(cli, `require('node:fs').appendFileSync(process.env.TEST_NPM_LOG, JSON.stringify(process.argv.slice(2))+'\\n'); process.exit(${fail ? 7 : 0});`);
  const r = spawnSync(process.execPath, ['scripts/prepare-dependencies.mjs', '--resolve'], {
   encoding: 'utf8', env: {...process.env, npm_execpath: cli, TEST_NPM_LOG: log},
  });
  assert.equal(r.status, fail ? 1 : 0, r.stderr);
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls, fail ? [['install','--package-lock-only','--ignore-scripts','--fetch-timeout=10000','--fetch-retries=0']] : [
   ['install','--package-lock-only','--ignore-scripts','--fetch-timeout=10000','--fetch-retries=0'],
   ['ci','--ignore-scripts'], ['audit','--audit-level=high'],
  ]);
 } finally { await rm(dir, {recursive: true, force: true}); }
});

test('homologation command runner executes npm CLI with literal arguments and preserves failure', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'helpdesk npm runner '));
 try {
  const cli = join(dir, 'npm fixture.cjs');
  await writeFile(cli, "console.log(JSON.stringify(process.argv.slice(2))); process.exit(7);");
  const modulePath = '../scripts/local-process.mjs';
  const {runCommand} = await import(modulePath);
  const result = await runCommand({command: ['npm', 'audit', 'literal & argument'],
   env: {...process.env, npm_execpath: cli}, timeoutMs: 5000});
  assert.equal(result.exit_code, 7);
  assert.equal(result.reason, null);
  assert.deepEqual(JSON.parse(result.stdout), ['audit', 'literal & argument']);
 } finally { await rm(dir, {recursive: true, force: true}); }
});
