/** Offline, read-only integration inspection. Never applies a patch or approves a release. */
import {createHash} from 'node:crypto';
import {open, lstat, realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve, join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sourceFingerprint} from './homologation-core.mjs';

const HASH=/^[a-f0-9]{64}$/;
const MANIFEST_LIMIT=2*1024*1024;
const FILE_LIMIT=8*1024*1024;
const failure=code=>Object.assign(new Error('Inspeção de integração não aprovada.'),{integrationCode:code});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const flags={writes_performed:false,tests_executed:false,homologated:false,operational:false};

function safePath(value){
 if(typeof value!=='string'||!value.length||value.length>240||!/^[a-zA-Z0-9_.\-/]+$/.test(value))return false;
 return value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..'&&!part.endsWith('.')
  &&part.toLowerCase()!=='.git'&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part));
}
function validManifest(m){
 if(!m||m.schema!=='helpdesk.cumulative-increments.v1'||!HASH.test(m.source_fingerprint??'')
  ||!Array.isArray(m.variants)||m.variants.length<1||m.variants.length>8)return false;
 const names=new Set();
 for(const v of m.variants){
  if(!v||typeof v.name!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(v.name)||names.has(v.name)
   ||!safePath(v.patch)||!v.patch.startsWith('patches/')||!HASH.test(v.patch_sha256??'')
   ||!HASH.test(v.expected_base_source_fingerprint??'')||!Array.isArray(v.files)||!v.files.length||v.files.length>512)return false;
  names.add(v.name);const paths=new Set();
  for(const file of v.files){
   if(!file||!safePath(file.path)||paths.has(file.path.toLowerCase())||!HASH.test(file.after_sha256??'')
    ||!['add','modify'].includes(file.operation)
    ||(file.operation==='add'?file.before_sha256!==null:!HASH.test(file.before_sha256??'')))return false;
   paths.add(file.path.toLowerCase());
  }
 }
 return true;
}
const inside=(root,path)=>{const rel=relative(root,path);return rel!==''&&!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep);};

/** Do not follow a manifest-controlled symlink, including intermediate directories. */
async function readContained(root,path,limit,optional=false){
 let candidate=root;const parts=path.split('/');
 for(let i=0;i<parts.length;i++){
  candidate=join(candidate,parts[i]);
  let info;
  try{info=await lstat(candidate);}catch(error){if(error.code==='ENOENT'&&optional)return null;throw failure('missing_file');}
  if(info.isSymbolicLink())throw failure('unsafe_path');
  if(i<parts.length-1?!info.isDirectory():!info.isFile())throw failure('unsafe_path');
  if(i===parts.length-1&&info.size>limit)throw failure('resource_limit');
 }
 if(!inside(root,await realpath(candidate)))throw failure('unsafe_path');
 // O_NOFOLLOW protects the final component on systems that provide it. The caller
 // must keep checkout/package quiescent; these checks are NOT an atomic write lock.
 const handle=await open(candidate,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{
  const info=await handle.stat();if(!info.isFile())throw failure('unsafe_path');
  if(info.size>limit)throw failure('resource_limit');
  const bytes=Buffer.alloc(limit+1);let used=0;
  while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,null);if(!bytesRead)break;used+=bytesRead;}
  if(used>limit)throw failure('resource_limit');return bytes.subarray(0,used);
 }finally{await handle.close();}
}

function validatePatch(bytes,files){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(text.includes('\0')||text.includes('\r'))throw failure('unsupported_patch');
 const blocks=text.split(/(?=^diff --git )/m).filter(Boolean);
 if(blocks.length!==files.length)throw failure('patch_paths_mismatch');
 const seen=new Set();
 for(const block of blocks){
  const lines=block.split('\n'),header=lines[0].match(/^diff --git a\/(.+) b\/(.+)$/);
  if(!header||header[1]!==header[2]||!safePath(header[1]))throw failure('unsupported_patch');
  const path=header[1],file=files.find(item=>item.path===path);
  if(!file||seen.has(path))throw failure('patch_paths_mismatch');seen.add(path);
  const firstHunk=lines.findIndex(line=>line.startsWith('@@ '));
  if(firstHunk<0)throw failure('unsupported_patch');
  const metadata=lines.slice(1,firstHunk);
  const expectedFrom=file.operation==='add'?'--- /dev/null':'--- a/'+path;
  if(metadata.filter(line=>line.startsWith('--- ')).join()!==expectedFrom
   ||metadata.filter(line=>line.startsWith('+++ ')).join()!=='+++ b/'+path)throw failure('patch_paths_mismatch');
  if(metadata.some(line=>!/^index [a-f0-9]+\.\.[a-f0-9]+(?: 100644)?$/.test(line)
   &&line!==expectedFrom&&line!=='+++ b/'+path&&!(file.operation==='add'&&line==='new file mode 100644')))throw failure('unsupported_patch');
  if((file.operation==='add')!==metadata.includes('new file mode 100644'))throw failure('unsupported_patch');
 }
 return text;
}

function gitReadOnly(checkout,patch,check){
 const env={...process.env,GIT_OPTIONAL_LOCKS:'0'};
 for(const key of Object.keys(env))if(/^GIT_(DIR|COMMON_DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG.*)$/.test(key))delete env[key];
 const args=['--no-pager','-c','core.worktree='+checkout,'apply',...(check?['--check']:['--numstat','-z'])];
 const result=spawnSync('git',args,{cwd:checkout,env,input:patch,encoding:'utf8',maxBuffer:1024*1024,timeout:10000,windowsHide:true});
 if(result.error||result.signal)throw failure('git_unavailable');
 if(result.status!==0)throw failure(check?'patch_not_applicable':'unsupported_patch');
 return result.stdout;
}

export async function inspectIntegration({checkoutRoot,packageRoot,variantName,stage='before'}){
 if(!['before','after'].includes(stage))throw failure('invalid_arguments');
 const checkout=await realpath(checkoutRoot),pack=await realpath(packageRoot);
 if(!(await lstat(checkout)).isDirectory()||!(await lstat(pack)).isDirectory())throw failure('unsafe_path');
 const raw=await readContained(pack,'manifest.json',MANIFEST_LIMIT);
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{throw failure('invalid_manifest');}
 if(!validManifest(manifest))throw failure('invalid_manifest');
 const variant=manifest.variants.find(v=>v.name===variantName);if(!variant)throw failure('unknown_variant');
 const bytes=await readContained(pack,variant.patch,FILE_LIMIT);
 if(digest(bytes)!==variant.patch_sha256)throw failure('patch_mismatch');
 const patch=validatePatch(bytes,variant.files);
 const stats=gitReadOnly(checkout,patch,false).split('\0').filter(Boolean).map(line=>line.split('\t'));
 if(stats.length!==variant.files.length||stats.some(row=>row.length!==3||!/^\d+$/.test(row[0])||!/^\d+$/.test(row[1])
  ||!variant.files.some(file=>file.path===row[2])))throw failure('patch_paths_mismatch');
 for(const file of variant.files){
  const expected=stage==='before'?file.before_sha256:file.after_sha256;
  const content=await readContained(checkout,file.path,FILE_LIMIT,true);
  if(expected===null?content!==null:content===null||digest(content)!==expected)throw failure('file_mismatch');
 }
 let actual;try{actual=await sourceFingerprint(checkout);}catch{throw failure('unsafe_path');}
 const expected=stage==='before'?variant.expected_base_source_fingerprint:manifest.source_fingerprint;
 if(actual!==expected)throw failure('source_mismatch');
 if(stage==='before')gitReadOnly(checkout,patch,true);
 // Check again for ordinary edits made during inspection. No claim of race-free integration.
 if(await sourceFingerprint(checkout)!==actual)throw failure('source_changed');
 return{schema:'helpdesk.integration-inspection.v1',ok:true,stage,variant:variant.name,checked_files:variant.files.length,
  source_fingerprint:actual,patch_sha256:variant.patch_sha256,...flags};
}

function argumentsFrom(argv){
 const accepted=new Set(['--checkout','--package','--variant','--stage']),values=new Map();
 for(let i=0;i<argv.length;i+=2){const key=argv[i],value=argv[i+1];
  if(!accepted.has(key)||values.has(key)||!value||value.startsWith('--'))throw failure('invalid_arguments');values.set(key,value);
 }
 if(!values.has('--checkout')||!values.has('--package')||!values.has('--variant'))throw failure('invalid_arguments');
 return{checkoutRoot:values.get('--checkout'),packageRoot:values.get('--package'),variantName:values.get('--variant'),stage:values.get('--stage')??'before'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await inspectIntegration(argumentsFrom(process.argv.slice(2))),null,2));}
 catch(error){console.log(JSON.stringify({schema:'helpdesk.integration-inspection.v1',ok:false,code:error.integrationCode??'inspection_failed',...flags},null,2));process.exitCode=1;}
}
