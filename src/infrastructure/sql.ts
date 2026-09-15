/** Narrow boundary to node-postgres. No SQL driver is needed by the domain/tests. */
export type SqlResult={rows:Record<string,unknown>[];rowCount:number|null};
export interface SqlClient{query(sql:string,values?:unknown[]):Promise<SqlResult>;release(error?:Error):void;}
export interface SqlPool{connect():Promise<SqlClient>;query(sql:string,values?:unknown[]):Promise<SqlResult>;end():Promise<void>;}
