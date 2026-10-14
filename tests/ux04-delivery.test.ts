import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('UX04 build explicitly copies helper and host CSS',()=>{const build=read('scripts/build.mjs');assert.match(build,/'portal-ui\.js'/);assert.match(build,/'support-intake\.css'/);assert.doesNotMatch(build,/copyFile.*(?:ux04.*fixture|ux04.*test)/);});
test('UX04 host styles are linked after the base theme without auto-mounting a new route',()=>{const html=read('web/index.html');for(const path of ['portal.css','support-intake.css'])assert.ok(html.indexOf('href="/'+path+'"')>html.indexOf('href="/consulte-theme.css"'));assert.doesNotMatch(html,/<script[^>]+src="\/(?:support-intake|portal-ui|customer-portal)\.js"/);});
test('UX04 demo serves new CSS with CSS MIME from an explicit allowlist',()=>{const demo=read('scripts/demo.ts');assert.match(demo,/\['design-tokens\.css'[^\]]*'portal\.css'[^\]]*'support-intake\.css'\].*text\/css/);});
test('UX04/UX10 intake controller matches the M09a operational reconciliation fix',()=>{
 // M09a PR31: rejected replay retains unknown; verified by ux10-compatibility behavior tests.
 const s=read('web/support-intake.js'),start=s.indexOf('export function createSupportIntakeState('),end=s.indexOf('\n/** Optional host.',start);
 assert.ok(start>=0&&end>start);const code=s.slice(start,end);
 assert.equal(createHash('sha256').update(code).digest('hex'),'51881a22811f9a0e08af01ef813388eee1cac9b3a49ed86ed43a75bcca412e06');
});
