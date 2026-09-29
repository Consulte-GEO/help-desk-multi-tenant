export type DatabaseProbeResult={version:number;database:string};
export function waitForPostgresConnection(
 probe:()=>Promise<DatabaseProbeResult>,
 options?:{attempts?:number;sleep?:()=>Promise<void>}
):Promise<void>;
