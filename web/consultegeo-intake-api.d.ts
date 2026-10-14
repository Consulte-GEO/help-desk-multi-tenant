import type {ConsulteGeoRequestContext} from '../shared/consultegeo-request.js';import type {IntakeUiOptions,IntakeUiApi} from './support-intake.js';
export function createConsulteGeoIntakeApi(options:{context:ConsulteGeoRequestContext;draft:IntakeUiOptions['draft'];profileVersionId:string;request:(path:string,init:RequestInit)=>Promise<Response>}):IntakeUiApi;
