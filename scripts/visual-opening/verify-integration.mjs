/** Static composition check. Run only in the complete checkout after applying
 * UX03. A green result does NOT prove Auth, PostgreSQL, E2E, deployment or acceptance.
 * Reads source only; never opens the operational gate or issues requests.
 */
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const assets=['opening-flow.js','opening-wizard.js','form-feedback.js','form-experience.css'];
const required=['web/app.js','web/index.html','scripts/build.mjs','scripts/demo.ts',...assets.map(a=>'web/'+a),'web/dynamic-form.js','web/dynamic-form.css'];
const missing=required.filter(p=>!existsSync(path.join(root,p)));
const scope='Static source composition only. Integration, existing suites, Auth, PostgreSQL, HTTP/CSP and E2E need independent evidence.';
if(missing.length){
 console.log(JSON.stringify({scope,status:'blocked',integrated:false,missing},null,2));process.exitCode=2;
}else{
 const read=p=>readFileSync(path.join(root,p),'utf8');
 const app=read('web/app.js'),html=read('web/index.html'),build=read('scripts/build.mjs'),demo=read('scripts/demo.ts'),dynamic=read('web/dynamic-form.js'),css=read('web/dynamic-form.css');
 const checks=[];const check=(name,passed)=>checks.push({name,passed:!!passed});
 check('optional deferred import',app.includes("import('./opening-wizard.js').then(({mountOpeningWizard})=>{")&&app.includes('let openingUX=null;'));
 check('late mounting waits for active dialog close',app.includes("if($('create-dialog').open)$('create-dialog').addEventListener('close',mount,{once:true});"));
 check('mount synchronizes actual catalog state',app.includes('openingUX=mountOpeningWizard(document);renderCatalog();'));
 const clearSession=app.slice(app.indexOf('function clearSession(){'),app.indexOf('const serviceAvailable='));
 check('identity reset preserves inbox and clears opening presentation',['inboxUX?.reset();','openingUX?.reset();','recoveryPanel.clear();'].every(marker=>clearSession.includes(marker)));
 check('catalog supplies existing pending and uncertainty state',app.includes("openingUX?.update({status,canSubmit:catalog.canSubmit(),pending:!!s.createPending,unresolved:unresolvedCreate(),ambiguous:!$('coverage-label').hidden});"));
 check('opening displays wizard after native showModal',app.includes("resetOpening();$('create-dialog').showModal();openingUX?.open();if(unresolvedCreate())"));
 check('original create intent remains authoritative',app.includes('retryCreateIntent(operation,createIdentity())')&&app.includes('creation.confirm(operation,t)'));
 check('wizard captures presentation submit without creating an API adapter',read('web/opening-wizard.js').includes('capture:true,signal')&&!/\bfetch\s*\(/.test(read('web/opening-wizard.js')));
 check('experience CSS is linked',html.includes('href="/form-experience.css"'));
 check('dynamic renderer consumes shared feedback',dynamic.includes("from './form-feedback.js'"));
 check('dynamic renderer still consumes the bounded parser',dynamic.includes("from '../shared/form-rules.js'"));
 check('optional dynamic CSS consumes the same theme',css.includes("@import url('./form-experience.css');"));
 // Inspect the fixed loops rather than searching a filename anywhere in the file.
 const loops=[...demo.matchAll(/for\(const file of \[[^\]]+\]\) assets\['\/'\+file\]=\{file,type:'[^']+'\};/g)].map(m=>m[0]);
 for(const asset of assets){
  check('build includes '+asset,build.includes("'"+asset+"'"));
  check('local demo includes correct MIME for '+asset,loops.some(loop=>loop.includes("'"+asset+"'")&&loop.includes(asset.endsWith('.css')?'text/css':'application/javascript')));
 }
 check('UX02 stylesheet MIME regression remains fixed',loops.some(loop=>loop.includes("'inbox-workspace.css'")&&loop.includes('text/css'))&&!loops.some(loop=>loop.includes("'inbox-workspace.css'")&&loop.includes('application/javascript')));
 for(const id of ['create-dialog','create-form','context-choice','context-status','subject','description','priority','coverage-label','coverage-choice','create-help','submit-create']){
  check('unique original control '+id,(html.match(new RegExp('\\bid="'+id+'"','g'))??[]).length===1);
 }
 const failed=checks.filter(c=>!c.passed).length;
 console.log(JSON.stringify({scope,status:failed?'failed':'passed',integrated:false,passed:checks.length-failed,failed,checks},null,2));process.exitCode=failed?1:0;
}
