/** Run in the complete checked-out application, not an isolated visual fixture. */
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const app=read('web/app.js');
for(const marker of ['accessUX=mountAccessExperience(document,{simple:!ADVANCED_ACCESS})','accessUX?.phase(value.phase)','accessUX?.reset()','accessUX?.loginError(error.code)','accessConfiguration=!!s.demo||!!humanSession'])assert.ok(app.includes(marker),'Missing UX08 host bridge: '+marker);
assert.ok(app.includes("ADVANCED_ACCESS?error.message:(accessUX?.loginError(error.code)??"),'Simple feedback fallback must not reveal arbitrary messages');
assert.ok(!app.includes("import('./geo-auth-callback.js')")&&!app.includes("from './geo-auth-callback.js'"),'GEO callback must not scrub the main app URL');
const html=read('web/index.html');assert.equal((html.match(/data-advanced-access hidden inert/g)||[]).length,4);assert.ok(!html.includes('src="/geo-auth-callback.js"'));
for(const name of ['access-feedback.js','access-experience.js','access-experience.css','geo-auth-callback.js','geo-auth-state.js'])assert.ok(existsSync(new URL('../../dist/'+name,import.meta.url)),'Build missing '+name);
console.log('UX08 static bridge markers and built assets found; NOT proof of real Auth or hosted HTTP/CSP.');
