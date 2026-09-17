import type {Principal,Role} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier as identifier} from '../domain/input-values.ts';
import {parseScopeList} from '../domain/scopes.ts';
/** Validate the private SQL helper contract, not JWT metadata. Never infer or promote a role. */
export function validatePrincipal(value:unknown,workspace:string,kind:Principal['kind']):Principal{
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  const p=value as Record<string,unknown>;
  if(p.kind!==kind||identifier(p.workspaceId)!==workspace||![null,'admin','agent'].includes(p.workspaceRole as null|string))throw Error();
  if(!Array.isArray(p.grants))throw Error();
  const scopes=parseScopeList(p.scopes);
  const grants=p.grants.map((g:unknown)=>{
   if(!g||typeof g!=='object'||Array.isArray(g))throw Error();
   const item=g as Record<string,unknown>;
   if(!['requester','account_manager','agent'].includes(item.role as string))throw Error();
   return {accountId:identifier(item.accountId),role:item.role as Role};
  });
  if(new Set(grants.map(g=>g.accountId)).size!==grants.length)throw Error();
  const result:Principal={id:identifier(p.id),kind,workspaceId:workspace,workspaceRole:p.workspaceRole as Principal['workspaceRole'],grants,scopes};
  if(kind==='integration'){
   if(p.workspaceRole!==null||grants.some(g=>g.role!=='requester')||result.scopes.some(s=>s.startsWith('notes:'))
     ||!Array.isArray(p.productInstanceIds)||p.productInstanceIds.length!==1)throw Error();
   result.connectionId=identifier(p.connectionId);result.productInstanceIds=p.productInstanceIds.map(identifier);
  }else if(p.connectionId!==undefined||p.productInstanceIds!==undefined)throw Error();
  return result;
 }catch{throw new HelpdeskError(503,'invalid_principal','Contexto de autenticação incompatível. Acesso não concedido.');}
}
