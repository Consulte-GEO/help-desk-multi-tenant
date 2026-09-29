/** Narrow boundary to node-postgres. No SQL driver is needed by the domain/tests. */
export type SqlResult={command?:string;rows:Record<string,unknown>[];rowCount:number|null};
export interface SqlClient{on?(event:"error",listener:(error:Error)=>void):unknown;query(sql:string,values?:unknown[]):Promise<SqlResult>;release(error?:Error):void;}
export interface SqlPool{on?(event:"error",listener:(error:Error)=>void):unknown;connect():Promise<SqlClient>;query(sql:string,values?:unknown[]):Promise<SqlResult>;end():Promise<void>;}
