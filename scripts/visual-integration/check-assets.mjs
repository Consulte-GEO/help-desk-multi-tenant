/** Read-only static output audit. Does NOT qualify HTTP headers, CSP, Auth or SQL. */
import {existsSync,readFileSync,readdirSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const origin='https://asset-check.example.invalid';
export function verifyBuiltAssets(root){
 const dist=path.resolve(root,'dist'),issues=[],files=[];let references=0;
 const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isSymbolicLink()){issues.push('Symlink in output: '+entry.name);continue;}if(entry.isDirectory())walk(f);else if(entry.isFile())files.push(f);}};
 if(!existsSync(dist))return {scope:'static-output-only',files:0,references:0,failed:1,issues:['dist absent']};walk(dist);
 const check=(from,spec)=>{
  if(spec.startsWith('#')||spec.startsWith('data:'))return;references++;
  let u;try{u=new URL(spec,origin+'/'+path.relative(dist,from).split(path.sep).join('/'));}catch{issues.push('Invalid asset reference in '+path.basename(from));return;}
  if(u.origin!==origin){issues.push('External asset: '+path.basename(from));return;}
  const name=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html',f=path.resolve(dist,name);
  if(!f.startsWith(dist+path.sep)||!existsSync(f)||!lstatSync(f).isFile())issues.push('Missing asset: '+name);
 };
 for(const f of files){
  const relative=path.relative(dist,f),ext=path.extname(f).toLowerCase();
  if(!['.html','.js','.css','.png'].includes(ext)){issues.push('Unexpected/private output: '+relative);continue;}
  if(!['.html','.js','.css'].includes(ext))continue;
  // The audit is intentionally limited to literal imports/URLs, not arbitrary JS evaluation.
  const s=readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  const patterns=ext==='.html'?[/\b(?:src|href)=["']([^"']+)["']/g]:ext==='.css'?[/\burl\(\s*["']?([^\s"')]+)["']?\s*\)/g,/@import\s+["']([^"']+)["']/g]:[/\b(?:import|export)\s+[^;\n"']*?\bfrom\s*["']([^"']+)["']/g,/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,/\bimport\s*["']([^"']+)["']/g];
  for(const pattern of patterns)for(const m of s.matchAll(pattern))check(f,m[1]);
 }
 return {scope:'static-output-only; not HTTP/CSP/Auth/SQL',files:files.length,references,failed:issues.length,issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../../',import.meta.url)),report=verifyBuiltAssets(root);console.log(JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
}
