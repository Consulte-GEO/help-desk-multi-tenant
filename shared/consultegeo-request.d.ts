import type {FormVersion} from './form-rules.js';
export type ConsulteGeoCustomerConfiguration=Readonly<{schema:1;product:'CONSULTE_GEO';id:string;version:number;contentHash:string;service:'user_access'|'questions'|'backup'|'new_work'|'structure_adjustment'|'problem';title:string;entries:readonly Readonly<{action:string;priority:string;label:string;form:FormVersion;serviceWindow:Readonly<{firstResponseHours:number;resolutionHours:number;reopenDays:number;timeZone:'America/Sao_Paulo'}>}>[]}>;
export const CONSULTE_GEO_ACTION_LABELS:Readonly<Record<string,string>>;
export function parseConsulteGeoCustomerConfiguration(raw:unknown):ConsulteGeoCustomerConfiguration;
export type ConsulteGeoRequestContext=Readonly<{workspaceId:string;principalId:string;accountId:string;refs:readonly Readonly<{connectionId:string;tenantId:string;type:string;id:string}>[];coverageId:string|null}>;
export function parseConsulteGeoRequestContext(raw:unknown):ConsulteGeoRequestContext;
