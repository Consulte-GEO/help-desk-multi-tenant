export interface EmailMetric {count:number|null;eligible:number;total:number}
export interface EmailSummary {sent:EmailMetric;delivered:EmailMetric;opened:EmailMetric;clicked:EmailMetric;states:Record<string,number>;attention:number}
export interface EmailCommunication {eventId:string;ticketId:string;protocol:string;subject:string;kind:string;createdAt:string;total:number;summary:EmailSummary}
export interface EmailCollection {asOf:string;total:number;nextCursor:string|null;items:EmailCommunication[]}
export type EmailAvailability='observed'|'not_observed'|'not_collected'|'unavailable';
export interface EmailRecipient {id:string;recipientDisplay:string;visibility:string;state:string;badge:string;sentAt:string|null;deliveredAt:string|null;openedAt:string|null;clickedAt:string|null;openAvailability:EmailAvailability;clickAvailability:EmailAvailability;attention:boolean}
export interface EmailDelivery extends Omit<EmailCommunication,'items'> {asOf:string;nextCursor:string|null;items:EmailRecipient[]}
export interface EmailRecipientDetail {asOf:string;id:string;eventId:string;recipientDisplay:string;visibility:string;state:string;attention:boolean;reason:string|null;nextAttemptAt:string|null;timeline:{kind:string;occurredAt:string|null;receivedAt:string|null}[];attempts:{number:number;startedAt:string}[];providerMessageId?:string;template?:{version?:string|number;hash?:string}}
export interface EmailMonitorSnapshot {phase:'idle'|'loading'|'ready'|'error'|'revoked'|'cleared';error:string;visible:boolean;filters:Record<string,string>;cursor:string|null;eventId:string|null;intentId:string|null;list:EmailCollection|null;delivery:EmailDelivery|null;recipient:EmailRecipientDetail|null}
export interface EmailMonitorOptions {request:(path:string,options:RequestInit)=>Promise<unknown>;onChange?:(value:EmailMonitorSnapshot)=>void;schedule?:(fn:()=>unknown,ms:number)=>unknown;cancel?:(handle:unknown)=>void}
export interface EmailMonitor {snapshot():EmailMonitorSnapshot;setVisible(value:boolean):Promise<void>;setFilters(value:Record<string,string>):Promise<void>;refresh():Promise<void>;openDelivery(eventId:string):Promise<void>;closeDelivery():Promise<void>;openRecipient(intentId:string):Promise<void>;closeRecipient():Promise<void>;nextPage():Promise<void>;firstPage():Promise<void>;clear():void}
export function createEmailMonitor(options:EmailMonitorOptions):EmailMonitor;
export function emailDate(value:string|null|undefined):string;
export function emailSignal(value:string|null,availability:EmailAvailability):string;
export function emailMetric(metric:EmailMetric|null|undefined,engagement?:boolean):{value:string;coverage:string};
export function emailFilterInstant(value:string):string;
export function emailTimelineLabel(kind:string):string;
export function emailStatusOptions():[string,string][];
export function mountEmailMonitor(root:HTMLElement,options:EmailMonitorOptions&{admin?:boolean}):{setVisible(value:boolean):Promise<void>;refresh():Promise<void>;snapshot():EmailMonitorSnapshot;destroy():void};
