export type Page={rows:any[];more:boolean;cursor:string|null};
export type Pager={more:boolean;cursor:string|null;direction:'prepend'|'append';next:(cursor:string)=>Promise<Page>};
const registry=new WeakMap<object,Pager>();
export function attachPage(rows:any[],more:boolean,cursor:string|null,next:Pager['next'],direction:Pager['direction']='append'){if(Array.isArray(rows)&&more&&cursor)registry.set(rows,{more,cursor,next,direction});return rows;}
export function pageOf(rows:object){return registry.get(rows);}
export async function collectPages<T>(rows:T[]):Promise<T[]>{const pager=pageOf(rows);if(!pager)return rows;const result=[...rows],seen=new Set(result.map((row:any)=>row.id));let cursor=pager.cursor,more=pager.more;while(more&&cursor){const page=await pager.next(cursor);for(const row of page.rows)if(!seen.has(row.id)){seen.add(row.id);result.push(row);}if(page.more&&page.cursor===cursor)throw Error('Não foi possível consultar o restante do histórico. Tente novamente.');cursor=page.cursor;more=page.more;}return result;}
export function inheritPage<T>(rows:T[],source:object,filter?:(row:any)=>boolean){const pager=registry.get(source);if(pager)registry.set(rows,filter?{...pager,next:async cursor=>{const page=await pager.next(cursor);return {...page,rows:page.rows.filter(filter)};}}:pager);return rows;}
