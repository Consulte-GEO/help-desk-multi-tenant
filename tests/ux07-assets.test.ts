import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('UX07 additional assets are explicitly built and demo CSS has the correct MIME',()=>{
 const build=read('scripts/build.mjs'),demo=read('scripts/demo.ts');for(const name of ['support-presentation.js','support-experience.css']){assert.ok(build.includes("'"+name+"'"),name+' build');assert.ok(demo.includes("'"+name+"'"),name+' demo');}assert.match(demo,/support-experience\.css[^\n]*text\/css/);assert.ok(demo.includes("'optional-support.js'"));
});
test('UX07 stylesheet is connected without enabling optional panels or test fixtures',()=>{
 const html=read('web/index.html');assert.ok(html.includes('href="/support-experience.css"'));assert.doesNotMatch(html,/mountCsat|renderKnowledge|renderPackage|visual-support\/fixture/);assert.ok(html.includes('hidden inert'));
});
test('UX07 new styles remain scoped and use existing tokens',()=>{
 const css=read('web/support-experience.css');assert.match(css,/data-support-panel/);assert.match(css,/var\(--hd-/);assert.doesNotMatch(css,/@font-face|https?:|@import/);
});
test('UX07 optional module never fetches, persists, copies to clipboard or injects raw HTML',()=>{
 const js=read('web/optional-support.js');assert.doesNotMatch(js,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|\.innerHTML\s*=|navigator\.clipboard|window\.open|location\.href|setInterval/);
});
test('UX07 keeps original operations UI helper byte-identical',()=>{
 const b=Buffer.from(read('web/operations-ui.js'));assert.equal(createHash('sha256').update(b).digest('hex'),'b5b04cc7e4b62e876bfd7ae9281ddd7c5991cff0197a707c9c9313ed492c3e7f');
});
test('UX07 the original date formatter is untouched',()=>{
 const b=Buffer.from(read('web/portal-format.js'));assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),'95879d2308b486631d6b644561be0ebb664dd646');
});
