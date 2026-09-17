import type {HumanTransport} from './human-auth.js';
export type HumanPhase='signed_out'|'signing_in'|'active'|'refreshing'|'paused';
export type HumanState={readonly phase:HumanPhase;readonly generation:number;readonly workspace:string|null;readonly expiresAt:number|null};
export type Authorization={readonly accessToken:string;readonly workspace:string;readonly generation:number};
export interface HumanSession {state():HumanState;signIn(fields:{email:string;password:string;workspace:string}):Promise<void>;authorization():Promise<Authorization>;resume():Promise<Authorization>;signOut():Promise<'confirmed'|'unconfirmed'|'not_requested'>;reject(p:Authorization):boolean;current(p:Authorization):boolean;}
export function createHumanSession(transport:HumanTransport,options?:{now?:()=>number;onChange?:(state:HumanState)=>unknown}):HumanSession;
