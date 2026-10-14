/** Presentation state only. No requests, credentials, business IDs generated or durable storage.
 * A successful review is never authorization. The existing controller owns the intent/receipt.
 */
const initialRuntime=()=>({status:'idle',canSubmit:false,pending:false,unresolved:false,ambiguous:false});
const asText=v=>typeof v==='string'?v:'';
export function openingFingerprint(values={},ambiguous=false){
 return JSON.stringify(['context','subject','description','priority','coverage'].map(k=>asText(values[k])).concat(ambiguous===true));
}
export function openingIssues(values={},runtime=initialRuntime()){
 const issues=[],add=(field,message)=>issues.push(Object.freeze({field,message}));
 if(!asText(values.context)||runtime.status!=='ready'||runtime.canSubmit!==true)add('context','Escolha uma opção autorizada e aguarde a consulta do catálogo.');
 const text=(value,min,max)=>{const v=asText(value).trim();return Array.from(v).length>=min&&v.length<=max&&!/[\u0000\p{Cs}]/u.test(v);};
 if(!text(values.subject,3,200))add('subject','Informe um assunto de 3 a 200 caracteres, sem contar os espaços nas pontas.');
 if(!text(values.description,1,12000))add('description','Descreva o pedido com até 12.000 caracteres, sem contar os espaços nas pontas.');
 if(!['low','normal','high','urgent'].includes(values.priority))add('priority','Selecione uma das prioridades disponíveis.');
 if(runtime.ambiguous===true&&!asText(values.coverage))add('coverage','Selecione explicitamente a cobertura elegível para este chamado.');
 return Object.freeze(issues);
}
export function createOpeningFlow(){
 let step=1,runtime=initialRuntime(),reviewed=null;
 const locked=()=>runtime.pending||runtime.unresolved;
 const view=()=>Object.freeze({step,pending:runtime.pending,recovering:runtime.unresolved&&!runtime.pending,locked:locked(),catalogReady:runtime.status==='ready'&&runtime.canSubmit});
 function update(next={}){
  const wasAmbiguous=runtime.ambiguous;
  runtime={status:typeof next.status==='string'?next.status:'idle',canSubmit:next.canSubmit===true,pending:next.pending===true,unresolved:next.unresolved===true,ambiguous:next.ambiguous===true};
  if(runtime.unresolved)step=3;
  else if(!runtime.pending&&(!runtime.canSubmit||runtime.status!=='ready')){step=1;reviewed=null;}
  if(wasAmbiguous!==runtime.ambiguous)reviewed=null;
 }
 function next(values){
  if(locked())return false;
  if(step===1){if(openingIssues(values,runtime).some(x=>x.field==='context'))return false;step=2;return true;}
  if(step===2){if(openingIssues(values,runtime).some(x=>x.field!=='coverage'))return false;step=3;reviewed=openingFingerprint(values,runtime.ambiguous);return true;}
  return false;
 }
 function allowSubmit(values){
  if(runtime.pending)return false;
  if(runtime.unresolved)return true; // Reuse original intent only; controller independently guards it.
  return step===3&&!openingIssues(values,runtime).length&&reviewed===openingFingerprint(values,runtime.ambiguous);
 }
 return Object.freeze({view,update,next,allowSubmit,
  back(){if(locked()||step===1)return false;step--;reviewed=null;return true;},
  edited(field){if(locked())return;reviewed=null;if(step===3&&field!=='coverage')step=field==='context'?1:2;},
  reviewCoverage(values){if(locked()||step!==3||openingIssues(values,runtime).length)return false;reviewed=openingFingerprint(values,runtime.ambiguous);return true;},
  reset(){step=1;runtime=initialRuntime();reviewed=null;}
 });
}
