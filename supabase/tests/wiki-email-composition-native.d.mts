import type {SpawnSyncOptionsWithStringEncoding,SpawnSyncReturns} from 'node:child_process';
type Spawn=(command:string,args:readonly string[],options:SpawnSyncOptionsWithStringEncoding)=>Partial<SpawnSyncReturns<string>>;
export function createNativePostgresRunner(options:{bin:string;suffix:string;env:NodeJS.ProcessEnv;temp:string;platform?:string;spawn?:Spawn}):(name:string,args:string[],input?:string)=>string|undefined;
export function configureTlsLoopbackPostgres(data:string,files:{cert:string;key:string}):void;
