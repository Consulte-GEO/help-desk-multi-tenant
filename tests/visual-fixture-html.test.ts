import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('private visual fixture loader removes parsed scripts while preserving unrelated HTML bytes',()=>{
 const program=String.raw`
import sys
sys.path.insert(0, 'scripts')
from visual_fixture_html import without_scripts
cases = [
 ('<p>antes</p><script src="/app.js"></script><p>depois</p>', '<p>antes</p><p>depois</p>'),
 ('<head><SCRIPT SRC="/app.js"></SCRIPT></head>', '<head></head>'),
 ('<p>x</p><script>run()</script ><p>y</p>', '<p>x</p><p>y</p>'),
 ('<script data-value=">">run()</script><div>ok &amp; sim</div>', '<div>ok &amp; sim</div>'),
 ('<!doctype html>\n<script>first()</script>\n<script src="/app.js"></script>\n<p>fim</p>', '<!doctype html>\n\n\n<p>fim</p>'),
 ('<!-- <script>comment()</script> --><p title="<script>">literal</p>', '<!-- <script>comment()</script> --><p title="<script>">literal</p>'),
 ('<div>ok</div><script>unterminated()', '<div>ok</div>'),
 ('<script src="/app.js"/><div>ok</div>', '<div>ok</div>'),
]
for source, expected in cases:
 actual = without_scripts(source)
 assert actual == expected, repr((source, actual, expected))
print('8 fixture HTML cases passed')
`;
 const r=spawnSync(process.platform==='win32'?'python':'python3',['-c',program],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr||String(r.error));
 assert.match(r.stdout,/8 fixture HTML cases passed/);
});
