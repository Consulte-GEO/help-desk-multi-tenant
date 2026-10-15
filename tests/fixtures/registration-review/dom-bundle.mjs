/** Offline Chromium fixture: transpiles only local, trusted product modules.
 * No URL navigation, network request, CSP/policy change, or production bundling. */
import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {view,reviewContext} from './view.ts';
const require=createRequire(import.meta.url),ts=require(process.env.HDA_TYPESCRIPT_PATH??'typescript');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const paths=['web/registration-automation.js','web/registration-review-state.js','web/operations-ui.js','shared/registration-review.js','shared/form-rules.js','shared/cnpj.js'];
const sources=Object.fromEntries(paths.map(p=>[p,ts.transpileModule(readFileSync(join(root,p),'utf8'),{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText]));
const styles=['web/design-tokens.css','web/operations-experience.css','web/registration-automation.css'].map(p=>readFileSync(join(root,p),'utf8')).join('\n');
const html=`<!doctype html><html lang="pt-BR" data-helpdesk-ds="1" data-brand="consulte-geo" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rascunho — fixture DOM local</title><style>${styles}\nbody{margin:0;background:var(--hd-paper);color:var(--hd-ink)}main{max-width:1120px;margin:32px auto;padding:0 20px}h1{font-size:28px;letter-spacing:-.025em}header.fixture{border-bottom:3px solid var(--hd-accent);margin-bottom:24px;padding-bottom:12px}.fixture small{font-family:var(--hd-mono);color:var(--hd-muted)}@media(max-width:640px){main{margin:20px auto;padding:0 12px}}</style><main><header class="fixture"><small>CONSULTE GEO / HELP DESK</small><h1>Conferência do cadastro solicitado</h1><p>DEMONSTRAÇÃO LOCAL · Dados fictícios · Sem gravação ou aprovação</p></header><div id="root"></div></main></html>`;
const script=`(()=>{const sources=${JSON.stringify(sources)},cache={};
function normalize(base,id){if(!id.startsWith('.'))throw Error('external module refused');const parts=(base.slice(0,base.lastIndexOf('/')+1)+id).split('/'),out=[];for(const p of parts){if(p==='.'||p==='')continue;if(p==='..'){if(!out.length)throw Error('path');out.pop();}else out.push(p);}return out.join('/');}
function load(path){if(cache[path])return cache[path].exports;if(!Object.hasOwn(sources,path))throw Error('unknown fixture module');const m={exports:{}};cache[path]=m;new Function('require','module','exports',sources[path])(id=>load(normalize(path,id)),m,m.exports);return m.exports;}
const {mountRegistrationAutomation}=load('web/registration-automation.js'),data=${JSON.stringify({context:reviewContext,internal:view(),customer:view('customer')})};
let panel,session;window.configure=(audience='internal',mode='normal')=>{panel?.destroy();session?.abort();session=new AbortController();window.calls=[];window.pending=[];window.fixtureView=structuredClone(data[audience]);
 panel=mountRegistrationAutomation(document.querySelector('#root'),{context:{...data.context,audience},sessionSignal:session.signal,read:async(context,signal)=>{window.calls.push({method:'READ',context});if(mode==='pending')await new Promise((resolve,reject)=>window.pending.push({resolve,reject}));if(mode==='error')throw Error('PRIVATE_ERROR');return window.fixtureView;}});
 window.panel=panel;window.session=session;return true;};window.configure();window.ready=true;})()`;
console.log(JSON.stringify({mode:'offline-dom',typescriptVersion:ts.version,html,script}));
