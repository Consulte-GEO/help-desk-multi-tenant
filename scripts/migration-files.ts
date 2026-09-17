import {constants} from 'node:fs';
import {lstat,open,readdir,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

export interface VerifiedMigration {readonly file:string;readonly sha256:string;readonly sql:string}
export interface MigrationBundle {readonly schemaVersion:string;readonly migrations:readonly VerifiedMigration[]}
const MAX_MANIFEST_BYTES=64*1024;
const MAX_SQL_BYTES=2*1024*1024;
const FILE_NAME=/^\d{14}_[a-z0-9_]+\.sql$/;
const HASH=/^[a-f0-9]{64}$/;
function invalid():never {throw new Error('Migration bundle is invalid or changed. Review the manifest and candidate files before executing SQL.');}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,expected:string[]):boolean{return Object.keys(value).length===expected.length&&expected.every(k=>Object.hasOwn(value,k));}
async function directory(path:string):Promise<void>{const stat=await lstat(path);if(!stat.isDirectory()||stat.isSymbolicLink())invalid();}
/** Bounded read through one descriptor; a post-validation path replacement cannot change returned SQL. */
async function readRegular(path:string,maxBytes:number):Promise<Buffer>{
 const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)invalid();
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const actual=await handle.stat();if(!actual.isFile()||actual.size>maxBytes)invalid();
  const chunks:Buffer[]=[];let total=0;
  while(true){const chunk=Buffer.alloc(Math.min(16*1024,maxBytes+1-total));const result=await handle.read(chunk,0,chunk.length,null);
   if(!result.bytesRead)break;total+=result.bytesRead;if(total>maxBytes)invalid();chunks.push(chunk.subarray(0,result.bytesRead));}
  return Buffer.concat(chunks,total);
 }finally{await handle.close();}
}
function text(bytes:Buffer):string{try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return invalid();}}
/** No driver, DB access, manifest rewriting or automatic repair. Call before opening test connections. */
export async function loadMigrationBundle(root:string):Promise<MigrationBundle>{
 try{
  const base=await realpath(root),supabase=join(base,'supabase'),dir=join(supabase,'migrations');
  await directory(supabase);await directory(dir);
  const value:unknown=JSON.parse(text(await readRegular(join(supabase,'migrations.manifest.json'),MAX_MANIFEST_BYTES)));
  if(!object(value)||!keys(value,['format','schemaVersion','migrations'])||value.format!==1||typeof value.schemaVersion!=='string'
   ||!/^\d+\.\d+\.\d+$/.test(value.schemaVersion)||!Array.isArray(value.migrations)||!value.migrations.length||value.migrations.length>1000)invalid();
  const expected:{file:string;sha256:string}[]=[];
  for(const entry of value.migrations){
   if(!object(entry)||!keys(entry,['file','sha256'])||typeof entry.file!=='string'||!FILE_NAME.test(entry.file)
    ||typeof entry.sha256!=='string'||!HASH.test(entry.sha256))invalid();
   if(expected.length&&entry.file<=expected[expected.length-1]!.file)invalid();
   expected.push({file:entry.file,sha256:entry.sha256});
  }
  const listing=await readdir(dir,{withFileTypes:true});
  if(listing.length!==expected.length||listing.some(e=>!e.isFile()||!expected.some(m=>m.file===e.name)))invalid();
  const migrations:VerifiedMigration[]=[];
  for(const entry of expected){
   const bytes=await readRegular(join(dir,entry.file),MAX_SQL_BYTES);
   if(!bytes.length||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)invalid();
   migrations.push(Object.freeze({...entry,sql:text(bytes)}));
  }
  return Object.freeze({schemaVersion:value.schemaVersion,migrations:Object.freeze(migrations)});
 }catch{return invalid();}
}
