/** Run in the COMPLETE checkout after applying UX02. No network or writes.
 * This is a static composition gate, not a replacement for existing E2E tests. */
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFileSync(path.join(root,p),'utf8');
const app=read('web/app.js'),html=read('web/index.html'),build=read('scripts/build.mjs'),demo=read('scripts/demo.ts');
const checks=[];
function check(name,ok){assert.ok(ok,name);checks.push(name);}
check('optional, nonblocking import',app.includes("import('./inbox-workspace.js').then(")&&app.includes('let inboxUX=null;'));
check('explicit navigation enters existing detail method',app.includes('detail(t.id,{navigate:true})'));
const clearSession=app.slice(app.indexOf('function clearSession(){'),app.indexOf('const serviceAvailable='));
check('identity reset clears presenter',clearSession.includes('inboxUX?.reset();'));
check('identity reset clears access presentation',!app.includes("import('./access-experience.js')")||clearSession.includes('accessUX?.reset();'));
check('identity reset clears opening presentation',clearSession.includes('openingUX?.reset();'));
check('stable list focus identifier',app.includes("setAttribute('data-ticket-id',t.id)"));
check('authoritative success callback',app.includes('if(current())inboxUX?.finishDetail(uxRead??inboxUX.beginDetail(id,navigate));'));
check('bounded error callback',app.includes('inboxUX?.failDetail(uxRead??inboxUX.beginDetail(id,navigate),error.status);'));
check('navigation respects outstanding operation guard',app.includes('if(navigate&&workspaceChangeBlocked())'));
check('effective filter state from existing controller',app.includes('inboxUX?.setFilters(inbox.filters(),inbox.busy())'));
check('runtime availability from existing app',app.includes('inboxUX?.setAvailability(!!s.me,serviceAvailable())'));
check('distinguishable internal action',app.includes("'Salvar nota interna':'Enviar resposta'"));
check('new stylesheet is linked',html.includes('href="/inbox-workspace.css"'));
for(const asset of ['inbox-view-state.js','inbox-workspace.js','inbox-workspace.css']){
 check(asset+' exists',existsSync(path.join(root,'web',asset)));check(asset+' is built',build.includes("'"+asset+"'"));check(asset+' is allowlisted by local demo',demo.includes("'"+asset+"'"));
}
const ids=JSON.parse(read('scripts/visual-inbox/original-dom-ids.json'));
for(const id of ids){const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');check('preserved unique DOM id '+id,(html.match(new RegExp('\\bid="'+escaped+'"','g'))??[]).length===1);}
console.log(JSON.stringify({scope:'Static composition only. Run existing browser/API/DB gates too.',passed:checks.length,checks},null,2));
