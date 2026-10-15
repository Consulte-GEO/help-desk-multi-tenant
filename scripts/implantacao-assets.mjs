import {readdir,lstat,mkdir,copyFile,access} from 'node:fs/promises';
import {join,extname} from 'node:path';

const allowed=new Set(['.js','.mjs','.css','.json','.png','.svg','.jpg','.jpeg','.xlsx']);
const forbidden=/(^|\/)(?:node_modules|supabase|private|tests?|evidence|\.git)(\/|$)/i;
export async function implementationAssetFiles(source){
  await access(join(source,'support-app.js'));
  const files=[];
  async function walk(relative=''){
    for(const entry of await readdir(join(source,relative),{withFileTypes:true})){
      const name=relative?relative+'/'+entry.name:entry.name;
      if(entry.isSymbolicLink()||forbidden.test(name)||entry.name.startsWith('.'))throw new Error('Unsafe implantation asset: '+name);
      const stat=await lstat(join(source,name));
      if(stat.isDirectory())await walk(name);
      else if(stat.isFile()&&allowed.has(extname(name).toLowerCase()))files.push(name);
      else throw new Error('Unreviewed implantation asset: '+name);
    }
  }
  await walk();return files.sort();
}
export async function copyImplementationAssets(source,destination){
  const files=await implementationAssetFiles(source);
  // Validate the entire graph before copying any bytes.
  for(const file of files){const parts=file.split('/');parts.pop();await mkdir(join(destination,...parts),{recursive:true});await copyFile(join(source,file),join(destination,file));}
  return files;
}
