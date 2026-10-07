import type {HumanTransport} from './human-auth.js';
export type HumanPhase='signed_out'|'signing_in'|'selecting_workspace'|'active'|'refreshing'|'paused'|'signing_out';
export type HumanState={readonly phase:HumanPhase;readonly generation:number;readonly workspace:string|null;readonly expiresAt:number|null;readonly workspaceOptions:readonly {id:string;name:string}[]};
export type Authorization={readonly accessToken:string;readonly workspace:string;readonly generation:number};
export interface HumanSession {state():HumanState;signIn(fields:{email:string;password:string;workspace:string}):Promise<void>;selectWorkspace(id:string):void;authorization():Promise<Authorization>;resume():Promise<Authorization>;signOut(options?:{scope:'local'|'global'}):Promise<'confirmed'|'unconfirmed'|'not_requested'>;reject(p:Authorization):boolean;current(p:Authorization):boolean;}
export function createHumanSession(transport:HumanTransport,options?:{now?:()=>number;onChange?:(state:HumanState)=>unknown}):HumanSession;
