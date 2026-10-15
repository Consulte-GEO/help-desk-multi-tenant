/** Admission/cleanup helpers for an owned LOCAL test cluster, not a production connector. */
import {lstatSync,readFileSync,realpathSync,existsSync} from 'node:fs';
import {join,basename,resolve,isAbsolute} from 'node:path';

export function nativeBinaryVersion(name,stdout){
 if(!['initdb','pg_ctl'].includes(name)||typeof stdout!=='string'||stdout.length>500)return null;
 const match=new RegExp('^'+name+' \\(PostgreSQL\\) (17\\.\\d+)(?: \\([^()\\r\\n]*\\))?\\r?\\n?$').exec(stdout);
 return match?.[1]??null;
}
/** pg_ctl -o is parsed again by a shell. Put generated paths in postgresql.conf
 * instead, using PostgreSQL string escaping. No command/URL comes from the caller. */
export function isolatedPostgresSettings(socket){
 if(typeof socket!=='string'||!isAbsolute(socket)||/[\u0000-\u001f\u007f]/u.test(socket)||Buffer.byteLength(socket+'/.s.PGSQL.5432','utf8')>=108)throw Error('owned_socket_path_invalid');
 const escaped=socket.replace(/\\/g,'\\\\').replace(/'/g,"''");
 return "\nlisten_addresses = ''\nport = 5432\nunix_socket_directories = '"+escaped+"'\n";
}
/** This is an ownership check for cleanup, not a sandbox against the same OS user. */
export function ownsRegistrationCluster(dir,proof){
 try{
  if(typeof dir!=='string'||!isAbsolute(dir)||!basename(dir).startsWith('hda02-owned-')||typeof proof!=='string'||!/^[a-f0-9]{64}$/.test(proof))return false;
  const root=lstatSync(dir);if(!root.isDirectory()||root.isSymbolicLink()||realpathSync(dir)!==resolve(dir))return false;
  const marker=join(dir,'ownership'),m=lstatSync(marker);
  if(!m.isFile()||m.isSymbolicLink()||m.nlink!==1||readFileSync(marker,'utf8')!==proof)return false;
  for(const part of ['data','socket']){const p=join(dir,part);try{const s=lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory())return false;}catch(e){if(e?.code!=='ENOENT')return false;}}
  return true;
 }catch{return false;}
}
/** Necessary source/lock checks, not proof of native/full-core compatibility. */
export function registrationNativeSourceIssues(root){
 const issues=[];
 const required=['src/infrastructure/transaction.ts','src/infrastructure/database-security-contract.ts','src/application/helpdesk.ts','scripts/migration-files.ts','scripts/database-target.ts','supabase/migrations.manifest.json','shared/form-rules.js'];
 if(required.some(p=>!existsSync(join(root,p))))issues.push('complete_repository_required');
 try{const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));if(pkg.name!=='@consulte-geo/helpdesk')issues.push('canonical_package_required');if(pkg.dependencies?.pg!=='8.16.3')issues.push('pinned_pg_8_16_3_required');}
 catch{issues.push('canonical_package_required');}
 try{
  const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8')),pg=lock.packages?.['node_modules/pg'];
  if(![2,3].includes(lock.lockfileVersion)||lock.packages?.['']?.dependencies?.pg!=='8.16.3'||pg?.version!=='8.16.3'||typeof pg.integrity!=='string'||!/^sha512-[A-Za-z0-9+/]+=*$/.test(pg.integrity))issues.push('pinned_lock_required');
 }catch{issues.push('pinned_lock_required');}
 return Object.freeze([...new Set(issues)]);
}
