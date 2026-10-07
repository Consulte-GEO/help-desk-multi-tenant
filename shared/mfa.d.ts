export type MfaFactor={readonly id:string;readonly type:'totp'|'phone'|'webauthn'|'recovery_code'};
export function verifiedMfaFactors(value:unknown):readonly MfaFactor[];
/** Parsing alone is not authentication. Backend must validate the exact bearer with Auth first. */
export function hasAal2Claims(token:string,userId:string,at:number):boolean;
export function sameUserClaims(token:string,userId:string,at:number):boolean;

export function sessionAssuranceLevel(token:string,userId:string,at:number):'aal1'|'aal2'|'unknown';
