import {requestHash} from '../domain/canonical.ts';
import {HelpdeskError} from '../domain/errors.ts';
import type {Cursor} from './ports.ts';
export type PageOptions={limit:number;cursor?:string};
export type PageWindow={limit:number;cursor:Cursor|null};
export type Page<T>={items:T[];nextCursor:string|null};
export function pagination(options:PageOptions,context:unknown):{window:PageWindow;filter:string}{
 if(!Number.isInteger(options.limit)||options.limit<1||options.limit>100)throw new HelpdeskError(400,'invalid_input','Limite entre 1 e 100.');
 const filter=requestHash(context);let cursor:Cursor|null=null;
 if(options.cursor!==undefined){try{
  if(options.cursor.length>700||!options.cursor.length)throw Error();
  const c=JSON.parse(Buffer.from(options.cursor,'base64url').toString());
  if(!c||Object.keys(c).sort().join(',')!=='at,filter,id'||typeof c.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(c.id)
    ||typeof c.at!=='string'||new Date(c.at).toISOString()!==c.at||c.filter!==filter)throw Error();
  cursor=c;
 }catch{throw new HelpdeskError(400,'invalid_cursor','Cursor inválido para este contexto.');}}
 return {window:{limit:options.limit+1,cursor},filter};
}
export function page<T extends {id:string;createdAt:string}>(rows:T[],limit:number,filter:string):Page<T>{
 const items=rows.slice(0,limit),last=items.at(-1);
 return {items,nextCursor:rows.length>limit&&last?Buffer.from(JSON.stringify({id:last.id,at:last.createdAt,filter})).toString('base64url'):null};
}
