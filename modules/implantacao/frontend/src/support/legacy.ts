import {runtime,implementationMessage} from './runtime';
import {mountController as mountImporter} from 'implementation-legacy:importa';
import {mountController as mountIntake} from 'implementation-legacy:intake';
import {mountController as mountLaudo} from 'implementation-legacy:laudo';
import importerHtml from 'implementation-legacy:importa-html';
import intakeHtml from 'implementation-legacy:intake-html';
import laudoHtml from 'implementation-legacy:laudo-html';
const pending=new Map<string,Promise<void>>();
const scripts=['vendor/xlsx.full.min.js','assets/intake-auditor.js','assets/intake-selftest.js','assets/similarity-engine.js','assets/import-integrity.js','assets/import-legacy-adapter.js','assets/laudo-perfis.js','assets/laudo-invariantes.js','assets/laudo-parser-core.js'];
async function engines(){for(const path of scripts){let promise=pending.get(path);if(!promise){promise=new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src='/implantacao/'+path;s.onload=()=>{s.remove();resolve();};s.onerror=()=>{s.remove();pending.delete(path);reject(Error('Não foi possível carregar o motor de implantação.'));};document.head.append(s);});pending.set(path,promise);}await promise;}}
function htmlBody(source:string){return (source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]??source).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<header\b[^>]*>[\s\S]*?<\/header>/i,'').replace(/href="\.\/importa\.html"/g,'href="#planilhas"').replace(/<a[^>]*href="\/"[^>]*>[\s\S]*?<\/a>/gi,'');}
export async function mountLegacy(root:HTMLElement,mode:string,options:{file?:File;diagnosis?:unknown;navigate:(mode:string)=>void;handoff:(file:File,diagnosis:unknown)=>void}){
 const rt=runtime(),life=new AbortController(),timers=new Set<ReturnType<typeof setTimeout>>(),urls=new Set<string>();let controller:any;
 const destroy=()=>{if(life.signal.aborted)return;controller?.destroy();life.abort();for(const timer of timers)clearTimeout(timer);for(const url of urls)URL.revokeObjectURL(url);root.replaceChildren();};
 rt.life.signal.addEventListener('abort',destroy,{once:true});
 await engines();if(!rt.live||life.signal.aborted)throw Error('Sessão encerrada.');
 root.innerHTML=htmlBody(mode==='laudo'?laudoHtml:mode==='intake'?intakeHtml:importerHtml);
 // Keep harmless legacy event targets present; the host owns theme and AI settings.
 if(mode==='laudo'||mode==='intake'){const button=document.createElement('button');button.id=mode==='laudo'?'theme-toggle':'btnTheme';button.hidden=true;root.append(button);}
 const globals=new Map<PropertyKey,unknown>();
 const doc=new Proxy(document,{get(target,key){if(key==='body'||key==='documentElement')return root;if(key==='querySelector')return (q:string)=>root.querySelector(q);if(key==='querySelectorAll')return (q:string)=>root.querySelectorAll(q);if(key==='getElementById')return (id:string)=>root.querySelector('#'+CSS.escape(id));if(key==='addEventListener')return (name:string,listener:EventListener,config?:any)=>{if(name==='DOMContentLoaded'){listener(new Event(name));return;}root.addEventListener(name,listener,{...config,signal:life.signal});};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 const win=new Proxy(rt.window,{get(target,key){if(globals.has(key))return globals.get(key);if(key==='document')return doc;return Reflect.get(target,key);},set(_target,key,value){if(!life.signal.aborted)globals.set(key,value);return true;}});
 const scopedURL=Object.create(URL);scopedURL.createObjectURL=(blob:Blob)=>{if(life.signal.aborted)throw Error('Sessão encerrada.');const url=URL.createObjectURL(blob);urls.add(url);return url;};scopedURL.revokeObjectURL=(url:string)=>{urls.delete(url);URL.revokeObjectURL(url);};
 const ports:any={window:win,document:doc,localStorage:rt.storage,sessionStorage:rt.storage,location:{search:''},navigator,
  setTimeout:(fn:()=>void,ms=0)=>{const id=setTimeout(()=>{timers.delete(id);if(!life.signal.aborted&&rt.live)fn();},ms);timers.add(id);return id;},clearTimeout:(id:ReturnType<typeof setTimeout>)=>{timers.delete(id);clearTimeout(id);},URL:scopedURL,
  fetch:async(input:string,init:RequestInit={})=>{if(!input.startsWith('/v1/implementation-support/ai/'))throw Error('Destino de IA inválido.');const headers=new Headers(init.headers);headers.set('Idempotency-Key',crypto.randomUUID());const body={...JSON.parse(String(init.body||'{}')),account_id:rt.accountId};const response=await rt.request(input,{...init,headers,body:JSON.stringify(body),signal:init.signal?AbortSignal.any([init.signal,life.signal]):life.signal});return response.ok?response:Response.json({ok:false,error:implementationMessage(response.status)},{status:response.status});},
  async aiImport(body:unknown){const response=await ports.fetch('/v1/implementation-support/ai/importa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result?.message||result?.error||'IA indisponível.');return result.choices?JSON.parse(result.choices[0].message.content):result;},
  navigate:options.navigate,handoff:options.handoff,XLSX:(window as any).XLSX,IntakeAuditor:(window as any).IntakeAuditor,IntakeSelfTest:(window as any).IntakeSelfTest};
 controller=(mode==='laudo'?mountLaudo:mode==='intake'?mountIntake:mountImporter)(ports);
 if(mode!=='laudo'&&mode!=='intake')controller.start(mode==='post'?'post':'pre',options.file,options.diagnosis);
 root.addEventListener('click',event=>{const a=(event.target as Element).closest('a');if(a&&a.getAttribute('href')==='#planilhas'){event.preventDefault();options.navigate('pre');}},{signal:life.signal});
 return {...controller,destroy};
}
