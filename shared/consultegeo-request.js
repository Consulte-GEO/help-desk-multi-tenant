import {copyFormData,freezeFormData,parseFormVersion} from './form-rules.js';
export const CONSULTE_GEO_ACTION_LABELS=Object.freeze({include:'Novo cadastro',change:'Alterar usuário',disable:'Desativar usuário',resend_access:'Reenviar acesso',grant_work_access:'Liberar usuário em obra',request:'Solicitação'});
// Previously projected labels remain readable for the same exact actions.
// Normalize presentation only; service/action/version and access stay strict.
const historicalLabels=Object.freeze({include:'Incluir usuário',grant_work_access:'Liberar em nova obra'});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw Error();return v;};
/** Data contract only. An authenticated, authorized server read is still required;
 * parsing JSON, contentHash and published status never grant resource access. */
export function parseConsulteGeoCustomerConfiguration(raw){try{
 const d=exact(copyFormData(raw),['schema','product','id','version','contentHash','service','title','entries']);
 if(d.schema!==1||d.product!=='CONSULTE_GEO'||!uuid(d.id)||!positive(d.version)||typeof d.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(d.contentHash)||typeof d.title!=='string'||!d.title.trim()||d.title.length>200||/[\p{Cc}]/u.test(d.title))throw Error();
 const expected=d.service==='user_access'?['include','change','disable','resend_access','grant_work_access'].map(action=>[action,'normal']):d.service==='problem'?['urgent','high','normal','low'].map(priority=>['request',priority]):['questions','backup','new_work','structure_adjustment'].includes(d.service)?[['request','normal']]:null;
 if(!expected||!Array.isArray(d.entries)||d.entries.length!==expected.length)throw Error();
 const ids=new Set();d.entries=d.entries.map((raw,i)=>{const e=exact(raw,['action','priority','label','form','serviceWindow']);
  if(e.action!==expected[i][0]||e.priority!==expected[i][1]||!(e.label===CONSULTE_GEO_ACTION_LABELS[e.action]||Object.hasOwn(historicalLabels,e.action)&&e.label===historicalLabels[e.action]))throw Error();
  e.label=CONSULTE_GEO_ACTION_LABELS[e.action];
  e.form=parseFormVersion(e.form);if(!uuid(e.form.id)||e.form.status!=='published'||e.form.version!==d.version||ids.has(e.form.id))throw Error();ids.add(e.form.id);
  const publicFields=fields=>fields.every(f=>f.public&&(!f.config.fields||publicFields(f.config.fields)));if(!publicFields(e.form.fields))throw Error();
  const w=exact(e.serviceWindow,['firstResponseHours','resolutionHours','reopenDays','timeZone']);
  if(!positive(w.firstResponseHours)||w.firstResponseHours>2000||!positive(w.resolutionHours)||w.resolutionHours>2000||w.firstResponseHours>w.resolutionHours||!Number.isSafeInteger(w.reopenDays)||w.reopenDays<0||w.reopenDays>30||w.timeZone!=='America/Sao_Paulo')throw Error();
  return e;
 });return freezeFormData(d);
 }catch{throw Object.assign(new Error('Formulários Consulte GEO indisponíveis ou incompatíveis.'),{code:'consultegeo_customer_configuration_invalid'});}}
/** Selectors only; caller must obtain them from the authorized server context. */
export function parseConsulteGeoRequestContext(raw){try{
 const c=exact(copyFormData(raw),['workspaceId','principalId','accountId','refs','coverageId']);
 if(![c.workspaceId,c.principalId,c.accountId].every(uuid)||c.coverageId!==null&&!uuid(c.coverageId)||!Array.isArray(c.refs)||c.refs.length<1||c.refs.length>100)throw Error();
 const keys=new Set();for(const v of c.refs){exact(v,['connectionId','tenantId','type','id']);if(!uuid(v.connectionId)||typeof v.type!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(v.type)||[v.tenantId,v.id].some(x=>typeof x!=='string'||!x.length||x.length>256||x.trim()!==x||/[\p{Cc}]/u.test(x)))throw Error();const k=JSON.stringify([v.connectionId,v.tenantId,v.type,v.id]);if(keys.has(k)||v.connectionId!==c.refs[0].connectionId||v.tenantId!==c.refs[0].tenantId)throw Error();keys.add(k);}
 return freezeFormData(c);
 }catch{throw new Error('Contexto Consulte GEO indisponível.');}}
