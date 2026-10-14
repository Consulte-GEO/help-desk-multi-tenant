export type SupportTone='neutral'|'info'|'warning';
export function externalWorkView(state:unknown):Readonly<{label:string;tone:SupportTone;description:string}>;
export const CSAT_RATINGS:readonly Readonly<{value:string;label:string}>[];
export function csatIssues(rating:unknown,comment:unknown):{rating:string;comment:string};
export function knowledgeView(result:unknown):{state:'unavailable'|'empty'|'ready';items:{title:string;snippet:string}[]};
export function packageAvailability(grant:unknown,now?:number):{state:'unavailable'|'invalid'|'expired'|'ready';canRequest:boolean;expiresLabel:string};
