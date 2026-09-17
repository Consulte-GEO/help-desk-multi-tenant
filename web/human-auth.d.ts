export type HumanCredentials = {accessToken:string;refreshToken:string;expiresAt:number;userId:string};
export type HumanTransport={signIn:(email:string,password:string)=>Promise<HumanCredentials>;refresh:(token:string)=>Promise<HumanCredentials>;signOut:(accessToken:string)=>Promise<void>};
export class HumanAuthError extends Error{constructor(code:string);code:string;status:number;requestSent?:false;}
export function workspaceId(value:unknown):string;
export function createHumanAuthTransport(config:{supabase_url:string;publishable_key:string},options?:{fetcher?:typeof fetch;now?:()=>number;timeoutMs?:number}):HumanTransport;
