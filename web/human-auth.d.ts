export type HumanCredentials = {accessToken:string;refreshToken:string;expiresAt:number;userId:string};
export type HumanTransport={reauthenticate?:(accessToken:string)=>Promise<void>;changePassword?:(accessToken:string,userId:string,currentPassword:string,password:string,nonce?:string)=>Promise<void>;signIn:(email:string,password:string)=>Promise<HumanCredentials>;refresh:(token:string)=>Promise<HumanCredentials>;signOut:(accessToken:string,scope?:'local'|'global')=>Promise<void>;workspaces?:(accessToken:string)=>Promise<readonly {id:string;name:string}[]>};
export class HumanAuthError extends Error{constructor(code:string);code:string;status:number;requestSent?:false;}
export function workspaceId(value:unknown):string;
export function createHumanAuthTransport(config:{supabase_url:string;publishable_key:string},options?:{fetcher?:typeof fetch;now?:()=>number;timeoutMs?:number}):HumanTransport;

export function validatePasswordChange(currentPassword:unknown,password:unknown,nonce?:unknown):void;
