/** Structural/provenance guard. npm ci verifies bytes; npm audit is a separate gate. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const same=(a={},b={})=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
export function validateLockfile(manifest,lock){
 const root=lock?.packages?.[''];
 if(lock?.lockfileVersion!==3||lock?.name!==manifest.name||lock?.version!==manifest.version||!root
   ||!same(root.dependencies,manifest.dependencies)||!same(root.devDependencies,manifest.devDependencies))
  throw Error('Lockfile ausente, incompleto ou incompatível com package.json. Gere e revise antes de publicar.');
 for(const name of Object.keys({...manifest.dependencies,...manifest.devDependencies}))
  if(!lock.packages['node_modules/'+name])throw Error('Dependência direta ausente no lockfile.');
 for(const [name,pkg] of Object.entries(lock.packages)){
  if(!name)continue;
  if(pkg.link||!pkg.version)throw Error('Dependência não resolvida/referência local no lockfile.');
  // Bundled contents are verified by the containing npm archive, not a separate tarball.
  if(pkg.inBundle===true)continue;
  let url;try{url=new URL(pkg.resolved);}catch{throw Error('Origem de dependência ausente.');}
  if(url.protocol!=='https:'||url.hostname!=='registry.npmjs.org'||url.username||url.password||url.search||url.hash
    ||!/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity??''))throw Error('Origem ou integridade de dependência não aprovada.');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{validateLockfile(JSON.parse(await readFile(new URL('../package.json',import.meta.url))),JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url))));console.log('Lockfile coerente; instalação limpa e auditoria continuam sendo gates independentes.');}
 catch(error){console.error(error.code==='ENOENT'?'PUBLICAÇÃO BLOQUEADA: package-lock.json ainda não foi gerado e revisado.':error.message);process.exitCode=1;}
}
