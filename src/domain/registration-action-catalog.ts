import {copyRegistrationValue, registrationFailure, registrationHash, registrationRecord, type RegistrationJson} from './registration-canonical.ts';
export const GRANT_WORK_ACTION = 'geo.user.grant_work.v1' as const;
export type RegistrationActionKey = typeof GRANT_WORK_ACTION;
export type GrantWorkPayload = Readonly<{kind:'add_work_link';preserveExistingLinks:true}>;
export type RegistrationEffects = Readonly<{addWorkLink:true;preserveExistingLinks:true;changeProfile:false;sendInvitation:false}>;
export type RegistrationActionDefinition = Readonly<{
  actionKey:RegistrationActionKey;schemaVersion:1;schemaHash:string;schema:RegistrationJson;
  status:'candidate';liveExecutionAllowed:false;effects:RegistrationEffects;
  missingFieldKeys:readonly string[];
}>;
const schema=copyRegistrationValue({type:'object',additionalProperties:false,required:['kind','preserveExistingLinks'],properties:{kind:{const:'add_work_link'},preserveExistingLinks:{const:true}}});
const action:RegistrationActionDefinition=Object.freeze({actionKey:GRANT_WORK_ACTION,schemaVersion:1,schemaHash:registrationHash(schema),schema,status:'candidate',liveExecutionAllowed:false,
  effects:Object.freeze({addWorkLink:true,preserveExistingLinks:true,changeProfile:false,sendInvitation:false}),missingFieldKeys:Object.freeze(['sourceBeneficiaryKey','sourceWorkKey','requestConfirmation'])});
const actions=Object.freeze([action]);
/** Code-owned closed catalog. Neither a form publication nor a prompt can add entries. */
export function getRegistrationAction(raw:unknown):RegistrationActionDefinition {
  if(raw!==GRANT_WORK_ACTION)throw registrationFailure('registration_action_unsupported',422);return action;
}
export function listRegistrationActions():readonly RegistrationActionDefinition[] {return actions;}
export function registrationActionDisposition(raw:unknown):Readonly<{mode:'manual'|'analysis_candidate';executionAllowed:false}> {
  return Object.freeze({mode:raw===GRANT_WORK_ACTION?'analysis_candidate':'manual',executionAllowed:false});
}
export function parseGrantWorkPayload(raw:unknown):GrantWorkPayload {
  const value=registrationRecord(raw,['kind','preserveExistingLinks']);
  if(value.kind!=='add_work_link'||value.preserveExistingLinks!==true)throw registrationFailure();
  return Object.freeze({kind:'add_work_link',preserveExistingLinks:true});
}
