/** Shared, bounded JSON read for explicit operator CLIs. Does not read on import.
 * Intended for a stable private local directory, not a hostile concurrent writer. */
import {open,lstat,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
const invalid=()=>Object.assign(new Error('Arquivo de entrada indisponível ou inválido.'),{code:'knowledge_input_invalid'});
const same=(a,b)=>a.ino===b.ino&&a.dev===b.dev&&a.size===b.size&&a.nlink===b.nlink&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
// realpath preserves on-disk spelling. Windows resolves drive/directory casing
// independently of that spelling; aliases to a different path remain refused.
const asciiCase=path=>path.replace(/[A-Z]/g,c=>c.toLowerCase());
export const samePrivateKnowledgePath=(a,b)=>process.platform==='win32'?asciiCase(a)===asciiCase(b):a===b;
export async function readPrivateKnowledgeJson(path,maxBytes=262144){
 let file;
 try{
  if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>4194304||typeof path!=='string'||!path||path.includes('\0'))throw invalid();
  const full=resolve(path),before=await lstat(full);
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>maxBytes||!samePrivateKnowledgePath(await realpath(full),full))throw invalid();
  file=await open(full,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  const opened=await file.stat();if(!same(before,opened)||!opened.isFile())throw invalid();
  const bytes=Buffer.alloc(Math.min(opened.size+1,maxBytes+1));let count=0;
  while(count<bytes.length){const part=await file.read(bytes,count,bytes.length-count,null);if(!part.bytesRead)break;count+=part.bytesRead;}
  const after=await file.stat();if(count!==opened.size||count>maxBytes||!same(opened,after)||!same(after,await lstat(full))||!samePrivateKnowledgePath(await realpath(full),full))throw invalid();
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count)));
 }catch{throw invalid();}finally{if(file)await file.close();}
}
