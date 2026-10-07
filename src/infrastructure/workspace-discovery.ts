import {HelpdeskError} from '../domain/errors.ts';
import {UUID_PATTERN} from '../domain/input-values.ts';
export type WorkspaceOption={id:string;name:string};
export function workspaceOptions(value:unknown):WorkspaceOption[]{
 const invalid=()=>new HelpdeskError(503,'invalid_workspace_catalog','Não foi possível validar os workspaces autorizados.');
 if(!Array.isArray(value)||value.length>50)throw invalid();
 const seen=new Set<string>();
 return value.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).length!==2
   ||typeof item.id!=='string'||!UUID_PATTERN.test(item.id)||typeof item.name!=='string'
   ||!item.name.trim()||item.name.length>160||!item.name.isWellFormed()||/[\u0000-\u001f\u007f]/.test(item.name))throw invalid();
  const id=item.id.toLowerCase();if(seen.has(id))throw invalid();seen.add(id);
  return {id,name:item.name};
 });
}
