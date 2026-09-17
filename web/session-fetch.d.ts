import type {HumanSession} from './human-session.js';
export function createSessionFetch(session:HumanSession,fetcher?:typeof fetch):(path:string,options?:RequestInit)=>Promise<Response>;
