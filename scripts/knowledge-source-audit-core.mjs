/** Operator-only source inventory. Read-only, no network. A source inventory is
 * neither an editorial approval nor a credential/PII sanitization certificate. */
import {open,opendir,lstat,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join,relative,sep,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectSourceIndicators,sourceLinks,sourceMarkers,isInstructionPath} from './knowledge-source-safety.mjs';
import {samePrivateKnowledgePath} from './knowledge-local-input.mjs';
export const KNOWLEDGE_LIMITS=Object.freeze({sources:500,entries:4096,depth:12,fileBytes:1048576,totalBytes:33554432,candidates:10000,links:10000});
const error=(code='knowledge_source_unavailable')=>Object.assign(new Error('Inspeção não concluída. Fonte ou política indisponível; nenhum conteúdo foi publicado.'),{code});
const sha=value=>createHash('sha256').update(value).digest('hex');
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
function record(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw error('knowledge_policy_invalid');
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))throw error('knowledge_policy_invalid');
 const output={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw error('knowledge_policy_invalid');output[k]=d.value;}return output;
}
function array(value,max){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)throw error('knowledge_policy_invalid');
 const n=Object.getOwnPropertyDescriptor(value,'length')?.value;
 if(!Number.isInteger(n)||n>max||Reflect.ownKeys(value).length!==n+1)throw error('knowledge_policy_invalid');
 return Array.from({length:n},(_,i)=>{const d=Object.getOwnPropertyDescriptor(value,''+i);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw error('knowledge_policy_invalid');return d.value;});
}
function sourcePath(value){
 if(typeof value!=='string'||value.length>220||!value.endsWith('.md')||!value.split('/').every(p=>/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p)&&p!=='.'&&p!=='..'))throw error('knowledge_policy_invalid');return value;
}
export function validateKnowledgeSourcePolicy(input){
 try{
  const p=record(input,['schemaVersion','corpusId','revision','status','sources']);
  if(p.schemaVersion!==1||p.status!=='draft'||typeof p.corpusId!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.corpusId)||!Number.isSafeInteger(p.revision)||p.revision<1)throw error();
  const sources=array(p.sources,KNOWLEDGE_LIMITS.sources).map(item=>{
   const keys=['path','sha256','classification','generation','basis','target'];if(Object.getOwnPropertyDescriptor(item,'units'))keys.push('units');const s=record(item,keys);sourcePath(s.path);
   if(s.units!==undefined&&!['auto','faq','table','sections','none'].includes(s.units))throw error();
   if(typeof s.sha256!=='string'||!/^[a-f0-9]{64}$/.test(s.sha256)||!['editorial','internal','legacy'].includes(s.classification)||!['NOVO_GEO','LEGADO','HELP_DESK','MIXED','UNKNOWN'].includes(s.generation))throw error();
   const basis=array(s.basis,6);if(!basis.length||new Set(basis).size!==basis.length||basis.some(b=>!['wiki_herdada','treinamento','demonstracao','codigo','banco','decisao_aprovada','unknown'].includes(b)))throw error();
   if(s.target!==null){sourcePath(s.target);if(!s.path.startsWith('patches/arquivos-sanitizados/')||s.path.slice('patches/arquivos-sanitizados/'.length)!==s.target||s.target.startsWith('patches/')||s.target==='README.md')throw error();}
   return {...s,basis:[...basis].sort()};
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(!sources.length||sources.some(s=>s.target!==null&&sources.some(b=>b.path.toLowerCase()===s.target.toLowerCase()&&b.path!==s.target)))throw error();
  if(new Set(sources.map(s=>s.path.toLowerCase())).size!==sources.length||new Set(sources.filter(s=>s.target!==null).map(s=>s.target)).size!==sources.filter(s=>s.target!==null).length)throw error();
  return freeze({...p,sources});
 }catch{throw error('knowledge_policy_invalid');}
}
const issue=(code,severity='block',line=null)=>({code,severity,startLine:line,endLine:line,column:null});
const sameFile=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
async function readRegular(path,root,before){
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1)throw Object.assign(error(),{reason:'source_not_regular'});
 if(before.size>KNOWLEDGE_LIMITS.fileBytes)throw Object.assign(error(),{reason:'source_size_limit'});
 const actual=await realpath(path);if(relative(root,actual).startsWith('..'+sep)||relative(root,actual)==='..')throw error();
 const f=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{
  const first=await f.stat();if(!sameFile(before,first)||!first.isFile()||first.nlink!==1)throw error();
  const bytes=Buffer.alloc(Math.min(before.size+1,KNOWLEDGE_LIMITS.fileBytes+1));let count=0;
  while(count<bytes.length){const r=await f.read(bytes,count,bytes.length-count,null);if(!r.bytesRead)break;count+=r.bytesRead;}
  const last=await f.stat();if(count!==before.size||!sameFile(first,last)||!sameFile(last,await lstat(path))||!samePrivateKnowledgePath(await realpath(path),actual))throw Object.assign(error(),{reason:'source_changed'});
  const body=bytes.subarray(0,count);let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body);}catch{throw Object.assign(error(),{reason:'source_encoding_invalid'});}
  if(text.includes('\u0000'))throw Object.assign(error(),{reason:'source_encoding_invalid'});
  return {bytes:count,sha256:sha(body),text};
 }finally{await f.close();}
}
function selectors(text,units='auto'){
 const lines=text.split(/\r?\n/);if(lines.at(-1)==='')lines.pop();
 const faq=[];for(let i=0;i<lines.length;i++)if(/^\s*-\s*\*\*P:\*\*.*\*\*R:\*\*/.test(lines[i]))faq.push({startLine:i+1,endLine:i+1,kind:'faq_item'});
 if(units==='none')return [];
 if(units==='faq')return faq;
 if(units==='auto'&&faq.length)return faq;
 if(units==='table'){const rows=[];let table=false;for(let i=0;i<lines.length;i++){if(/^\s*\|\s*:?-{3,}/.test(lines[i])){table=true;continue;}if(table&&/^\s*\|/.test(lines[i]))rows.push({startLine:i+1,endLine:i+1,kind:'table_row'});else if(table)table=false;}return rows;}
 const heads=[];let fence=null;
 for(let i=0;i<lines.length;i++){const fm=/^\s{0,3}(`{3,}|~{3,})/.exec(lines[i]);if(fm){if(fence===fm[1][0])fence=null;else if(fence===null)fence=fm[1][0];continue;}if(!fence&&/^##\s+/.test(lines[i]))heads.push(i+1);}
 if(!heads.length){
  // One top-level Markdown table: inventory each data row, not its title/copy.
  const rows=[];let table=false;
  for(let i=0;i<lines.length;i++){
   if(/^\s*\|\s*:?-{3,}/.test(lines[i])){table=true;continue;}
   if(table&&/^\s*\|/.test(lines[i]))rows.push({startLine:i+1,endLine:i+1,kind:'table_row'});
   else if(table)table=false;
  }
  return rows.length?rows:lines.length?[{startLine:1,endLine:lines.length,kind:'document'}]:[];
 }
 return heads.map((start,i)=>({startLine:start,endLine:(heads[i+1]??(lines.length+1))-1,kind:'section'}));
}

export async function auditKnowledgeSource(root,input,options={}){
 const policy=validateKnowledgeSourcePolicy(input);
 let at;try{const keys=Reflect.ownKeys(options);if(keys.some(k=>k!=='at'))throw error();const d=Object.getOwnPropertyDescriptor(options,'at');if(d&&!Object.hasOwn(d,'value'))throw error();at=d?.value??new Date().toISOString();if(typeof at!=='string'||at.length!==24||new Date(at).toISOString()!==at)throw error();}catch{throw error('knowledge_policy_invalid');}
 let base,rootStat;
 try{if(typeof root!=='string'||!root||root.includes('\0'))throw error();base=resolve(root);rootStat=await lstat(base);if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||!samePrivateKnowledgePath(await realpath(base),base))throw error();}catch{throw error();}
 const planned=new Map(policy.sources.map(s=>[s.path,s])),seen=new Set(),entries=[],unlisted=[],rootFindings=[];
 let total=0,count=0,complete=true;
 const sourceId=p=>'KBS-'+sha(policy.corpusId+'\0'+p).slice(0,24);
 async function visit(dir,depth){
  if(depth>KNOWLEDGE_LIMITS.depth)throw error();
  const before=await lstat(dir);if(!before.isDirectory()||before.isSymbolicLink()||!samePrivateKnowledgePath(await realpath(dir),dir))throw error();
  const names=[];const handle=await opendir(dir);
  for await(const entry of handle){if(++count>KNOWLEDGE_LIMITS.entries)throw error();names.push(entry.name);}
  names.sort();
  for(const name of names){
   const path=join(dir,name),rel=relative(base,path).split(sep).join('/');const s=planned.get(rel);
   const st=await lstat(path);
   if(st.isDirectory()&&!st.isSymbolicLink()){await visit(path,depth+1);continue;}
   if(st.isSymbolicLink()&&!s){complete=false;rootFindings.push(issue('directory_link_refused'));}
   if(!s){unlisted.push({id:sourceId(rel),path:null,reason:'unlisted_source',bytes:st.isFile()?st.size:null});continue;}
   seen.add(rel);
   const item={id:sourceId(s.target??s.path),path:s.path,logicalPath:s.target??s.path,expectedSha256:s.sha256,sha256:null,bytes:null,lineCount:null,
    classification:s.classification,generation:s.generation,basis:s.basis,verification:'not_verified',selection:'active',inspection:'blocked',findings:[],links:[],markers:[],publicationAllowed:false};
   try{
    if(total+st.size>KNOWLEDGE_LIMITS.totalBytes)throw Object.assign(error(),{reason:'corpus_size_limit'});
    const data=await readRegular(path,base,st);total+=data.bytes;item.bytes=data.bytes;item.sha256=data.sha256;
    const lines=data.text.split(/\r?\n/);item.lineCount=lines.length-(lines.at(-1)===''?1:0);item.inspection='inspected';item.markers=sourceMarkers(data.text);
    if(data.sha256!==s.sha256)item.findings.push(issue('source_hash_mismatch'));
    item.findings.push(...inspectSourceIndicators(data.text));
    entries.push({item,text:data.text});
   }catch(e){complete=false;item.findings.push(issue(['source_not_regular','source_size_limit','corpus_size_limit','source_changed','source_encoding_invalid'].includes(e.reason)?e.reason:'source_read_failed'));entries.push({item,text:null});}
  }
  const after=await lstat(dir);if(before.dev!==after.dev||before.ino!==after.ino||before.mtimeMs!==after.mtimeMs||!samePrivateKnowledgePath(await realpath(dir),dir))throw error();
 }
 try{await visit(base,0);const last=await lstat(base);if(last.ino!==rootStat.ino||last.dev!==rootStat.dev||!samePrivateKnowledgePath(await realpath(base),base))throw error();}catch{throw error();}
 for(const s of policy.sources)if(!seen.has(s.path)){
  complete=false;entries.push({text:null,item:{id:sourceId(s.target??s.path),path:s.path,logicalPath:s.target??s.path,expectedSha256:s.sha256,sha256:null,bytes:null,lineCount:null,classification:s.classification,generation:s.generation,basis:s.basis,verification:'not_verified',selection:'active',inspection:'blocked',findings:[issue('source_missing')],links:[],markers:[],publicationAllowed:false}});
 }
 entries.sort((a,b)=>a.item.path<b.item.path?-1:a.item.path>b.item.path?1:0);
 const replacements=new Map(policy.sources.filter(s=>s.target!==null).map(s=>[s.target,s.path]));
 for(const {item} of entries){
  const s=planned.get(item.path);
  if(replacements.has(item.path))item.selection='superseded';
  if(item.path.startsWith('patches/')&&s.target===null){item.selection='excluded';item.findings.push(issue('overlay_not_declared','review'));}
  if(isInstructionPath(item.logicalPath)){item.findings.push(issue('instruction_document','review'));}
 }
 const effective=new Map(entries.filter(e=>e.item.selection==='active').map(e=>[e.item.logicalPath,{id:e.item.id,blocked:e.item.inspection!=='inspected'||e.item.findings.some(f=>f.severity==='block')}])) ;
 let linkCount=0;
 for(const entry of entries){const {item,text}=entry;if(text===null)continue;
  try{item.links=sourceLinks(text,item.logicalPath,effective);}catch{complete=false;item.findings.push(issue('source_link_limit'));}
  linkCount+=item.links.length;if(linkCount>KNOWLEDGE_LIMITS.links)throw error();
  for(const l of item.links)if(['unsafe_link','relative_outside_root','reference_ambiguous'].includes(l.status))item.findings.push(issue(l.status,'block',l.line));
 }
 // Resolve visibility again after link inspection: a target's own rejected link
 // must not remain labeled resolved merely because it was scanned later.
 const rejectedTargets=new Set(entries.filter(e=>e.item.selection==='active'&&(e.item.inspection!=='inspected'||e.item.findings.some(f=>f.severity==='block'))).map(e=>e.item.id));
 for(const {item} of entries)for(const link of item.links)if(link.targetSourceId&&rejectedTargets.has(link.targetSourceId))link.status='target_quarantined';
 const candidates=[];
 for(const {item,text} of entries){
  if(text===null||item.inspection!=='inspected'||item.selection!=='active'||item.classification!=='editorial'||item.generation==='LEGADO'||item.findings.some(f=>f.severity==='block'||['instruction_document','instruction_marker','personal_data_marker'].includes(f.code)))continue;
  const lines=text.split(/\r?\n/);
  for(const loc of selectors(text,planned.get(item.path).units??'auto')){
   if(candidates.length>=KNOWLEDGE_LIMITS.candidates)throw error();
   const section=lines.slice(loc.startLine-1,loc.endLine).join('\n');
   candidates.push({id:'KBC-'+sha(item.id+'\0'+item.sha256+'\0'+loc.startLine+':'+loc.endLine).slice(0,24),sourceId:item.id,logicalPath:item.logicalPath,sourcePath:item.path,sourceSha256:item.sha256,...loc,sectionSha256:sha(section),
    // Source-level caveats are retained conservatively, in addition to the range.
    markers:sourceMarkers(section),sourceMarkers:item.markers,generation:item.generation,basis:item.basis,
    status:'candidate',audience:'editorial_private',applicabilityVerified:false,bodyIncluded:false,publicationAllowed:false,
    referencesResolved:item.links.every(l=>l.status==='resolved_in_corpus'&&!l.fragmentPresent)});
  }
 }
 const documents=entries.map(e=>e.item);
 const blocked=!complete||unlisted.length>0||rootFindings.length>0||documents.some(d=>d.findings.some(f=>f.severity==='block'));
 const sourceSetSha256=sha(canonical(documents.map(d=>({path:d.path,sha256:d.sha256,selection:d.selection,inspection:d.inspection}))));
 const links=documents.flatMap(d=>d.links);
 return freeze({schemaVersion:1,kind:'knowledge_source_audit',corpusId:policy.corpusId,policyRevision:policy.revision,policySha256:sha(canonical(policy)),sourceSetSha256,
  observedAt:at,status:blocked?'blocked':'review_required',complete,publicationAllowed:false,operational:false,secretScan:'heuristic_not_a_clearance',sourceReadOnly:true,
  summary:{configuredSources:policy.sources.length,inspectedSources:documents.filter(d=>d.inspection==='inspected').length,effectiveDocuments:documents.filter(d=>d.selection==='active').length,
   supersededSources:documents.filter(d=>d.selection==='superseded').length,quarantinedSources:documents.filter(d=>d.findings.some(f=>f.severity==='block')).length,
   unlistedSources:unlisted.length,bytesRead:total,linkOccurrences:links.length,missingRelativeLinks:links.filter(l=>l.status==='missing_in_overlay').length,candidateLocators:candidates.length},
  rootFindings,unlisted:unlisted.sort((a,b)=>a.id.localeCompare(b.id)),documents,
  candidateBatch:{kind:'editorial_locator_batch',publicationAllowed:false,bodyIncluded:false,items:candidates}});
}
