import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const blocks = config.split('[[headers]]').slice(1);
function header(path: string): string {
  const block = blocks.find(value => value.includes(`for = "${path}"`));
  assert.ok(block, `header for ${path}`);
  return block;
}
test('Wiki private videos permit only same-origin and local Blob media', () => {
  for (const path of ['/wiki', '/wiki/*']) {
    const block = header(path);
    assert.match(block, /media-src 'self' blob:;/);
    assert.match(block, /frame-src https:\/\/www\.youtube-nocookie\.com;/);
    assert.match(block, /script-src 'self';/);
    assert.match(block, /object-src 'none'/);
    assert.doesNotMatch(block, /media-src[^;]*(?:https:|\*|data:)/);
  }
});
test('HelpDesk keeps its own strict policy outside the Wiki', () => {
  const block = header('/*');
  assert.doesNotMatch(block, /blob:|media-src|youtube-nocookie|unsafe-inline/);
  assert.match(block, /X-Frame-Options = "DENY"/);
  assert.match(block, /frame-ancestors 'none'/);
});
