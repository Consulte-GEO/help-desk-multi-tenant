/** Explicit local, stable/private-copy inspection. No database, credentials,
 * providers, file writes or recovery effects. Filesystem metadata checks detect
 * ordinary changes; they are not an atomic snapshot against a hostile writer. */
import {open,lstat,realpath,opendir} from 'node:fs/promises';
import {constants,type Stats} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {RECOVERY_COMPONENTS,digestRecoveryRows,type RecoveryInventory} from '../domain/recovery-plan.ts';
import {freezeFormData} from '../../shared/form-rules.js';

const invalid=()=>Object.assign(new Error('Inspeção local de recuperação indisponível ou inválida.'),{code:'recovery_files_invalid'});
const same=(a:Stats,b:Stats)=>a.ino===b.ino&&a.dev===b.dev&&a.mode===b.mode&&a.nlink===b.nlink&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.replace(/[A-Z]/g,c=>c.toLowerCase())===b.replace(/[A-Z]/g,c=>c.toLowerCase()):a===b;
type Limits={maxEntries?:number;maxBytes?:number;timeoutMs?:number;signal?:AbortSignal};
type Row={key:string;value:{kind:'directory'}|{kind:'file';bytes:number;sha256:string}};

export async function inventoryRecoveryFiles(root:string,options:Limits={}):Promise<RecoveryInventory>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,listener:(()=>void)|undefined;
 try{
  const maxEntries=options.maxEntries??10000,maxBytes=options.maxBytes??268435456,timeoutMs=options.timeoutMs??30000;
  if(typeof root!=='string'||!root||root.includes('\0')||Object.keys(options).some(k=>!['maxEntries','maxBytes','timeoutMs','signal'].includes(k))||!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>10000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>268435456||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||options.signal!==undefined&&!(options.signal instanceof AbortSignal))throw invalid();
  const started=performance.now(),full=resolve(root),observed:{path:string;stat:Stats}[]=[];let entries=0,bytes=0;
  const check=()=>{if(controller.signal.aborted||options.signal?.aborted||performance.now()-started>=timeoutMs)throw invalid();};
  const cancelled=new Promise<never>((_resolve,reject)=>{listener=()=>{controller.abort();reject(invalid());};options.signal?.addEventListener('abort',listener,{once:true});timer=setTimeout(listener!,timeoutMs);});
  const inspect=async(path:string)=>{check();const stat=await lstat(path);check();if(stat.isSymbolicLink()||!samePath(await realpath(path),path)||!stat.isDirectory()&&(!stat.isFile()||stat.nlink!==1))throw invalid();check();observed.push({path,stat});return stat;};
  const fileHash=async(path:string,before:Stats)=>{
   if(before.size>maxBytes-bytes)throw invalid();let file;
   try{
    check();file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));check();const opened=await file.stat();if(!opened.isFile()||!same(before,opened))throw invalid();
    const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let size=0;
    for(;;){check();const part=await file.read(buffer,0,buffer.length,null);check();if(!part.bytesRead)break;size+=part.bytesRead;bytes+=part.bytesRead;if(bytes>maxBytes||size>before.size)throw invalid();hash.update(buffer.subarray(0,part.bytesRead));}
    if(size!==before.size||!same(before,await file.stat()))throw invalid();check();return {kind:'file' as const,bytes:size,sha256:hash.digest('hex')};
   }finally{if(file)await file.close();}
  };
  const children=async function*(path:string){check();const directory=await opendir(path);try{for(;;){check();const item=await directory.read();check();if(!item)break;if(!item.name||/[\p{Cc}\p{Cs}\\\uFFFD]/u.test(item.name))throw invalid();yield item.name;}}finally{await directory.close();}};
  const walk=async(path:string,relative:string,depth:number,rows:Row[])=>{
   for await(const name of children(path)){
    if(++entries>maxEntries)throw invalid();const child=join(path,name),keyPath=relative?relative+'/'+name:name,stat=await inspect(child),key=createHash('sha256').update(keyPath,'utf8').digest('hex');
    if(stat.isDirectory()){if(depth>=12)throw invalid();rows.push({key,value:{kind:'directory'}});await walk(child,keyPath,depth+1,rows);}else rows.push({key,value:await fileHash(child,stat)});
   }
  };
  const work=async()=>{
   check();if(!(await inspect(full)).isDirectory())throw invalid();const names=[];for await(const name of children(full)){if(names.length>=6||!(RECOVERY_COMPONENTS as readonly string[]).includes(name))throw invalid();names.push(name);}if(names.length!==6)throw invalid();
   const inventory={} as Record<typeof RECOVERY_COMPONENTS[number],RecoveryInventory[typeof RECOVERY_COMPONENTS[number]]>;
   for(const component of RECOVERY_COMPONENTS){const path=join(full,component);if(!(await inspect(path)).isDirectory())throw invalid();const rows:Row[]=[];await walk(path,'',0,rows);rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);async function* stream(){for(const row of rows){check();yield row;}}inventory[component]=await digestRecoveryRows(stream(),{signal:controller.signal,timeoutMs:Math.max(1,Math.ceil(timeoutMs-(performance.now()-started)))});}
   for(const entry of observed){check();if(!same(entry.stat,await lstat(entry.path))||!samePath(await realpath(entry.path),entry.path))throw invalid();}check();return freezeFormData(inventory);
  };
  // Every continuation checks cancellation; no partial inventory is returned.
  return await Promise.race([work(),cancelled]);
 }catch{throw invalid();}
 finally{controller.abort();clearTimeout(timer);if(listener)options.signal?.removeEventListener('abort',listener);}
}
