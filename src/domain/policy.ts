import type { Principal, Ticket } from './model.ts';
export function hasScope(p:Principal,scope:string):boolean{return p.scopes.includes(scope);}
export function canAccessAccount(p:Principal,workspaceId:string,accountId:string):boolean{
  if(p.workspaceId!==workspaceId)return false;
  return (p.kind==='human'&&p.workspaceRole==='admin')||p.grants.some(g=>g.accountId===accountId);
}
export function canUseProduct(p:Principal,productInstanceId:string):boolean{
  return p.kind==='human'||(p.productInstanceIds??[]).includes(productInstanceId);
}
export function isOperator(p:Principal,workspaceId:string,accountId:string):boolean{
  return p.kind==='human'&&p.workspaceId===workspaceId&&(p.workspaceRole==='admin'||p.grants.some(g=>g.accountId===accountId&&g.role==='agent'));
}
export function canReadTicket(p:Principal,t:Ticket):boolean{
  if(!hasScope(p,'tickets:read')||!canAccessAccount(p,t.workspaceId,t.accountId)||!canUseProduct(p,t.productInstanceId))return false;
  if(isOperator(p,t.workspaceId,t.accountId))return true;
  if(p.kind==='human'&&p.grants.some(g=>g.accountId===t.accountId&&g.role==='account_manager'))return true;
  return t.createdBy===p.id;
}
export function canReadInternalNote(p:Principal,t:Ticket):boolean{
  return hasScope(p,'notes:read')&&canReadTicket(p,t)&&isOperator(p,t.workspaceId,t.accountId);
}
export function canWriteInternalNote(p:Principal,t:Ticket):boolean{
  return hasScope(p,'notes:write')&&canReadTicket(p,t)&&isOperator(p,t.workspaceId,t.accountId);
}
