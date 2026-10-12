/** Offline, conservative indicators. NOT a secret scanner clearance, Markdown renderer,
 * instruction executor, antivirus or an authority on product behavior. No values leave
 * the detector: only fixed codes and line/column locators. */
import {posix} from 'node:path';

const severity = {
 cryptographic_literal:'block',credential_literal:'block',otp_material:'block',
 token_literal:'block',private_key_material:'block',url_credentials:'block',
 instruction_marker:'review',personal_data_marker:'review',internal_address:'review'
};
const placeholder = value => /^(?:<[^<>\r\n]{1,100}>|\$\{[^{}\r\n]{1,100}\}|\*{3,}|\[REDACTED\]|REDACTED|\.\.\.|…|\{\d+\})$/i.test(value);
export function inspectSourceIndicators(text) {
 const found=[],breaks=[-1];let limited=false;
 for(let i=0;i<text.length;i++)if(text[i]==='\n')breaks.push(i);
 const position=index=>{let lo=0,hi=breaks.length;while(lo+1<hi){const m=(lo+hi)>>1;if(breaks[m]<index)lo=m;else hi=m;}return {line:lo+1,column:index-breaks[lo]};};
 const add=(code,start,end=start)=>{const a=position(start),b=position(end);found.push({code,severity:severity[code],startLine:a.line,endLine:b.line,column:a.column});};
 const scan=(code,re,accept=()=>true)=>{if(limited)return;for(const m of text.matchAll(re))if(accept(m)){if(found.length>=1024){limited=true;found.push({code:'indicator_limit',severity:'block',startLine:null,endLine:null,column:null});break;}add(code,m.index,m.index+m[0].length-1);}};
 scan('cryptographic_literal',/(?:AddEncryptionKey|AddSigningKey|SymmetricSecurityKey|EncryptionKey|SigningKey)[\s\S]{0,300}?FromBase64String\s*\(\s*["']([A-Za-z0-9+/=]{16,})["']/gi);
 scan('cryptographic_literal',/\b(?:EncryptionKey|SigningKey|SymmetricKey)\s*(?:=|:)\s*["']([^"'\r\n]{8,})["']/gi,m=>!placeholder(m[1]));
 scan('credential_literal',/\b(?:Password|Passwd|Pwd|Senha|Client[_-]?Secret|Api[_-]?Key|Access[_-]?Token|Refresh[_-]?Token)\b["']?\s*(?::|=)\s*["']([^"'\r\n]+)["']/gi,m=>!placeholder(m[1]));
 scan('credential_literal',/\b(?:Password|Pwd|Senha|Client[_-]?Secret)\s*=\s*([^\s;"'<>`][^\s;"'`]{2,})/gi,m=>!placeholder(m[1]));
 scan('otp_material',/otpauth(?:-migration)?:\/\/[^\s<>()]+/gi);
 scan('token_literal',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{12,}\b/g);
 scan('token_literal',/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g);
 scan('private_key_material',/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g);
 scan('url_credentials',/https?:\/\/[^\s\/@<>]+:[^\s\/@<>]+@[^\s<>]+/gi);
 scan('url_credentials',/[?&#](?:access_token|refresh_token|token|secret|password|client_secret|api_key)=([^\s&#)<>`"']+)/gi,m=>!placeholder(m[1]));
 scan('instruction_marker',/(?:ignore (?:all )?(?:previous|prior) instructions|ignore (?:todas )?as instruções anteriores|<\/?(?:system|developer)>|REQUIRED SUB-SKILL)/gi);
 scan('personal_data_marker',/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,m=>!/@(?:[\w.-]*\.)?example\.(?:invalid|test|com|org)$/i.test(m[0]));
 scan('internal_address',/\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g);
 const seen=new Set();return found.sort((a,b)=>a.startLine-b.startLine||a.column-b.column||a.code.localeCompare(b.code)).filter(x=>{const k=`${x.code}:${x.startLine}:${x.column}`;if(seen.has(k))return false;seen.add(k);return true;});
}
export function sourceMarkers(text) {
 const flags=[];
 if(/\[LEGADO(?:\b|\])/i.test(text))flags.push('legacy');
 if(/\[TREINO(?:\b|:)/i.test(text))flags.push('training');
 if(/\[a confirmar(?:\b|\])/i.test(text))flags.push('unconfirmed');
 if(/\[WIKI(?:\b|:)/i.test(text))flags.push('wiki');
 return flags;
}
export function isInstructionPath(path) {
 return /(?:^|\/)(?:AGENTE|AGENTS?|CLAUDE|GEMINI|INSTRUCTIONS|DOCPLAN|PROMPT(?:[-_][A-Za-z0-9_-]+)?)\.md$/i.test(path);
}

/** Deliberately audits a bounded Markdown subset: inline links, images, named
 * references, autolinks and HTML href/src. Code examples are inventoried separately.
 * It neither expands Markdown nor follows any target. Targets stay inside this module. */
export function sourceLinks(text,logicalPath,knownTargets) {
 const lines=text.split(/\r?\n/),definitions=new Map(),items=[];
 // Bound work before regex scanning: an unterminated label can otherwise cause
 // repeated scans of the remainder of a legal 1 MiB source line.
 if(lines.some(line=>line.length>4096))throw Error('link_limit');
 const normalLabel=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
 for(const line of lines){const m=/^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/.exec(line);if(m){const k=normalLabel(m[1]);definitions.set(k,definitions.has(k)?null:m[2]);}}
 let fence=null;
 function classify(raw) {
  let target=raw.replace(/^<|>$/g,'');
  if(target.length>2048||/[\u0000-\u0020\u007f\\]/.test(target))return {status:'unsafe_link',targetSourceId:null};
  // No destination, even an external hostname or credential, is returned.
  if(/^(?:javascript|data|file|vbscript):/i.test(target)||target.startsWith('//'))return {status:'unsafe_link',targetSourceId:null};
  if(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)){
   if(/^https?:\/\//i.test(target)){
    try{const u=new URL(target);if(u.username||u.password||/[?&#](?:token|access_token|refresh_token|secret|password|api_key)=/i.test(target))return {status:'unsafe_link',targetSourceId:null};}
    catch{return {status:'unsafe_link',targetSourceId:null};}
    return {status:'external_not_fetched',targetSourceId:null};
   }
   return {status:target.startsWith('mailto:')?'external_not_fetched':'unsafe_link',targetSourceId:null};
  }
  if(target.startsWith('#'))return {status:'anchor_not_verified',targetSourceId:null};
  if(target.startsWith('/')||target.startsWith('~'))return {status:'relative_outside_root',targetSourceId:null};
  const plain=target.split(/[?#]/,1)[0];let decoded;
  try{decoded=decodeURIComponent(plain);}catch{return {status:'unsafe_link',targetSourceId:null};}
  if(decoded.includes('%')||/[\u0000-\u001f\u007f\\]/.test(decoded)||decoded.startsWith('/'))return {status:'unsafe_link',targetSourceId:null};
  const destination=posix.normalize(posix.join(posix.dirname(logicalPath),decoded));
  if(destination==='..'||destination.startsWith('../'))return {status:'relative_outside_root',targetSourceId:null};
  const known=knownTargets.get(destination);
  if(known)return {status:known.blocked?'target_quarantined':'resolved_in_corpus',targetSourceId:known.id};
  return {status:'missing_in_overlay',targetSourceId:null};
 }
 for(let i=0;i<lines.length;i++){
  const line=lines[i];const fm=/^\s{0,3}(`{3,}|~{3,})/.exec(line);const inCode=fence!==null||fm!==null;
  if(fm){if(!fence)fence=fm[1][0];else if(fence===fm[1][0])fence=null;}
  const tokens=[];
  for(const m of line.matchAll(/!?\[[^\]\r\n]*\]\(\s*(<[^>\r\n]+>|[^\s)]+)(?:\s+["'][^\r\n]*?["'])?\s*\)/g))tokens.push({column:m.index+1,kind:'inline',raw:m[1]});
  const def=/^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/.exec(line);if(def)tokens.push({column:1,kind:'definition',raw:def[2]});
  for(const m of line.matchAll(/\[([^\]]+)\]\[([^\]]*)\]/g)){const ref=definitions.get(normalLabel(m[2]||m[1]));tokens.push({column:m.index+1,kind:'reference',raw:ref,unresolved:ref===undefined,ambiguous:ref===null});}
  for(const m of line.matchAll(/<(https?:\/\/[^>\s]+)>/gi))tokens.push({column:m.index+1,kind:'autolink',raw:m[1]});
  for(const m of line.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi))tokens.push({column:m.index+1,kind:'html',raw:m[1]});
  if(tokens.length>256)throw Error('link_limit');
  for(const t of tokens.sort((a,b)=>a.column-b.column)){
   if(items.length>=10000)throw Error('link_limit');
   items.push({line:i+1,column:t.column,kind:t.kind,inCode,fragmentPresent:typeof t.raw==='string'&&t.raw.includes('#'),fragmentVerified:false,...(t.unresolved?{status:'reference_not_defined',targetSourceId:null}:t.ambiguous?{status:'reference_ambiguous',targetSourceId:null}:classify(t.raw))});
  }
 }
 return items;
}
