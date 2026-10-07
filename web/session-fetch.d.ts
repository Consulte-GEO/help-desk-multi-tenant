import type {HumanSession} from './human-session.js';
export type SessionFetch=((path:string,options?:RequestInit)=>Promise<Response>)&{currentResponse(response:Response):boolean};
export function createSessionFetch(session:HumanSession,fetcher?:typeof fetch):SessionFetch;
