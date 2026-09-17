/** The capability ceiling is independent of role/account/resource authorization. */
export const SCOPES = Object.freeze(['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'] as const);
export type Scope=typeof SCOPES[number];
/** Strict, dense, unique list. An explicit empty list grants nothing; absence is not a default. */
export function parseScopeList(value:unknown):Scope[]{
 if(!Array.isArray(value)||value.length>SCOPES.length)throw new Error('Invalid capability list');
 const result:Scope[]=[];
 for(let i=0;i<value.length;i++){
  if(!Object.hasOwn(value,i)||typeof value[i]!=='string'||!SCOPES.includes(value[i] as Scope)||result.includes(value[i] as Scope))
   throw new Error('Invalid capability list');
  result.push(value[i] as Scope);
 }
 return result;
}
