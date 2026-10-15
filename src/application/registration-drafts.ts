import {parseRegistrationState} from '../domain/registration-automation.ts';
import {registrationRecord,registrationInstant,registrationFailure} from '../domain/registration-canonical.ts';
import {parseRegistrationReviewContext,parseRegistrationReviewView,REGISTRATION_REVIEW_LIMITS,type RegistrationReviewView,type ReviewField} from '../../shared/registration-review.js';
const labels:Readonly<Record<string,string>>=Object.freeze({requestConfirmation:'Confirmação do pedido',note:'Descrição do pedido',details:'Detalhes',email:'E-mail informado',name:'Nome informado'});
function display(value:unknown):string {
 if(value===null)return 'Não informado';if(value===true)return 'Sim';if(value===false)return 'Não';
 if(typeof value==='string')return value||'Texto vazio';if(typeof value==='number')return String(value);return JSON.stringify(value);
}
function field(key:string,label:string,value:unknown):ReviewField {
 const full=display(value),limit=REGISTRATION_REVIEW_LIMITS.fieldText;
 // Avoid splitting a Unicode surrogate pair when shortening a long field.
 let end=Math.min(full.length,limit);if(end<full.length&&/[\uD800-\uDBFF]/.test(full[end-1]??''))end--;
 return {key,label,value:full.slice(0,end),truncated:full.length>end};
}
/** PURE projection, not a reader, endpoint, authorization or approval.
 * The caller must first authorize THIS audience against current database grants
 * and read a consistent operation in its scoped transaction. A browser cannot
 * select internal visibility. No production route is installed by this module.
 * Only the current state is available: no fabricated history or model warnings.
 */
export function projectRegistrationDraftReview(rawState:unknown,rawExposure:unknown):RegistrationReviewView {
 const state=parseRegistrationState(rawState),e=registrationRecord(rawExposure,['audience','context','observedAt','expiresAt']);
 const context=registrationRecord(e.context,['workspaceId','accountId','ticketId','operationId']);
 const expected=parseRegistrationReviewContext({...context,audience:e.audience}),snapshot=state.snapshot;
 if(expected.workspaceId!==snapshot.target.workspaceId||expected.accountId!==snapshot.target.accountId||expected.ticketId!==snapshot.ticketId||expected.operationId!==snapshot.operationId)throw registrationFailure('registration_scope_changed',403);
 const observedAt=registrationInstant(e.observedAt),expiresAt=registrationInstant(e.expiresAt);
 const blockers=['Consulta de rascunho: edição, aprovação e criação ainda não habilitadas.','Prévia do cadastro no Novo GEO ainda não qualificada.'];
 if(state.status==='needs_information')blockers.push('A lista detalhada de informações pendentes ainda não está disponível nesta consulta. Confira o chamado com a equipe.');
 const detail=expected.audience==='customer'?null:{
  requested:Object.entries(snapshot.answers).map(([k,value])=>field(k,labels[k]??k,value)),
  targets:[field('sourceInstanceId','Instância de destino',snapshot.target.sourceInstanceId),field('sourceContractCode','Contrato na origem',snapshot.target.sourceContractCode),field('sourceWorkKey','Referência da obra',snapshot.target.sourceWorkKey),field('sourceBeneficiaryKey','Referência do usuário',snapshot.target.sourceBeneficiaryKey)],
  proposal:state.draft?[field('kind','Cadastro proposto','Adicionar vínculo com uma obra')]:[],
  effects:state.draft?['Adicionar somente o vínculo solicitado.','Preservar os vínculos com outras obras.','Não alterar o perfil e não enviar convite de acesso.']:[],
  blockers,draftRevision:state.draftRevision,draftHash:state.draft?.contentHash??null,historyLoaded:false as const
 };
 return parseRegistrationReviewView({schema:1,audience:expected.audience,context,revision:state.revision,inputRevision:snapshot.inputRevision,status:state.status,observedAt,expiresAt,detail,capabilities:{edit:false,approve:false,execute:false}},expected);
}
