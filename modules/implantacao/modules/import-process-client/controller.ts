import {copyJson,uuid,text,parseSnapshot,contentHash} from '../import-process/canonical.ts';
import type {Snapshot} from '../import-process/canonical.ts';
import type {WriteResult} from '../import-process/contracts.ts';
import {ProcessHttpError} from './client.ts';
import type {CaseData,ImportProcessClient} from './client.ts';
import {parseRecoveryIdentity} from './recovery-journal.ts';
import type {RecoveryIdentity,RecoveryJournal,RecoveryMarker} from './recovery-journal.ts';

export type Phase='idle'|'loading'|'ready'|'saving'|'recovering'|'uncertain'|'conflict'|'refresh_required'|'cleanup_required'|'error';
export interface ProcessViewState {
 phase:Phase;caseId:string|null;data:CaseData|null;draft:Snapshot|null;dirty:boolean;
 pendingOperationId:string|null;lastReceipt:WriteResult|null;message:string|null;
}
type SaveCommand={operationId:string;expectedVersion:number;snapshot:Snapshot;reason:string};
interface Pending {caseId:string;command:SaveCommand|null;marker?:RecoveryMarker;uncertain:boolean;refused?:boolean;}
export interface ControllerOptions {
 client:Pick<ImportProcessClient,'getCase'|'saveRevision'>&Partial<Pick<ImportProcessClient,'getOperationReceipt'>>;
 newId:()=>string;onChange?:(state:ProcessViewState)=>void;
 recovery?:{identity:RecoveryIdentity;journal:RecoveryJournal};
}
function idle():ProcessViewState{return {phase:'idle',caseId:null,data:null,draft:null,dirty:false,pendingOperationId:null,lastReceipt:null,message:null};}
/** State contains two independently bounded snapshots. Keep input node limits intact. */
export function copyProcessViewState(state:ProcessViewState):ProcessViewState {
 return {...copyJson({...state,data:null,draft:null},4*1024*1024),
  data:state.data===null?null:copyJson(state.data,4*1024*1024),
  draft:state.draft===null?null:copyJson(state.draft)};
}
/** Presentation state; no auth credentials in state. Recovery is explicitly injected.
 * Unsaved content stays in memory. A reload can recover a receipt, not an unsent draft.
 */
export function createImportProcessController(o:ControllerOptions){
 if(!o.client||typeof o.client.getCase!=='function'||typeof o.client.saveRevision!=='function'||typeof o.newId!=='function')throw Error('INVALID_CONTROLLER_PORTS');
 const recovery=o.recovery?{identity:parseRecoveryIdentity(o.recovery.identity),journal:o.recovery.journal}:undefined;
 if(recovery&&(!recovery.journal||['read','write','clear'].some(k=>typeof recovery.journal[k as keyof RecoveryJournal]!=='function')||typeof o.client.getOperationReceipt!=='function'))throw Error('INVALID_RECOVERY_PORTS');
 let state=idle(),epoch=0,control:AbortController|undefined,pending:Pending|null=null;
 const getState=()=>copyProcessViewState(state);
 function update(next:Partial<ProcessViewState>){state={...state,...next};try{o.onChange?.(getState());}catch{/* Rendering cannot change a transaction outcome. */}}
 function resetRequest(){epoch++;control?.abort();control=new AbortController();return epoch;}
 function assertNoStoredPending(){if(recovery?.journal.read(recovery.identity))throw Error('RECOVERY_REQUIRED');}
 async function refresh(generation:number){
  try{
   const d=await o.client.getCase(state.caseId!,control!.signal);
   if(generation!==epoch)return;
   if(recovery&&(d.process.workspaceId!==recovery.identity.workspaceId||d.process.accountId!==recovery.identity.accountId))throw Error('RECOVERY_SCOPE_MISMATCH');
   update({phase:'ready',data:d,draft:copyJson(d.currentRevision.snapshot),dirty:false,pendingOperationId:null,message:null});
  }catch{
   if(generation!==epoch)return;
   update({phase:state.lastReceipt?'refresh_required':'error',message:state.lastReceipt?
    'Gravação confirmada pelo recibo. Recarregue para consultar a versão atual.':'Não foi possível carregar o processo.'});
  }
 }
 function clearMarker(intent:Pending){if(recovery&&intent.marker)recovery.journal.clear(intent.marker);}
 async function confirmed(intent:Pending,r:WriteResult,generation:number){
  if(generation!==epoch)return;
  update({lastReceipt:r,dirty:false});
  try{clearMarker(intent);}catch{
   update({phase:'cleanup_required',message:'Gravação confirmada. Não foi possível limpar o marcador de recuperação; consulte o recibo novamente antes de editar.'});return;
  }
  pending=null;update({pendingOperationId:null});await refresh(generation);
 }
 async function recover(){
  const intent=pending;
  if(!intent||!['uncertain','cleanup_required'].includes(state.phase))throw Error('NO_PENDING_WRITE');
  if(intent.refused){
   try{clearMarker(intent);pending=null;update({phase:'ready',pendingOperationId:null,message:'Gravação recusada. Sua edição foi preservada.'});}
   catch{update({message:'Gravação recusada. O marcador local ainda não pôde ser removido.'});}return;
  }
  if(!intent.marker||!o.client.getOperationReceipt)throw Error('RECOVERY_NOT_CONFIGURED');
  const generation=epoch;update({phase:'recovering',message:'Consultando a confirmação, sem reenviar a gravação.'});
  try{
   const m=intent.marker,result=await o.client.getOperationReceipt(m.caseId,m.operationId,m.expectedVersion,m.requestHash,control!.signal);
   if(generation!==epoch)return;
   if(result.status==='confirmed')await confirmed(intent,result.receipt,generation);
   else update({phase:'uncertain',message:'Ainda não foi encontrado recibo. Isso não comprova falha da gravação. Nenhum dado foi reenviado.'});
  }catch{
   if(generation!==epoch)return;
   update({phase:state.lastReceipt?'cleanup_required':'uncertain',message:state.lastReceipt?
    'Gravação já confirmada. A recuperação local continua pendente.':'Não foi possível consultar o recibo. A operação continua sem confirmação.'});
  }
 }
 async function runPending(){
  const intent=pending;if(!intent||!intent.command)throw Error('NO_PENDING_WRITE');const generation=epoch;
  update({phase:'saving',pendingOperationId:intent.command.operationId,message:null});
  try{
   const r=await o.client.saveRevision(intent.caseId,copyJson(intent.command),control!.signal);
   if(generation!==epoch)return;
   await confirmed(intent,r,generation);
  }catch(e){
   if(generation!==epoch)return;
   // A refusal now cannot establish the outcome of a prior uncertain attempt.
   if(intent.uncertain||!(e instanceof ProcessHttpError)||e.outcome==='unknown'){
    intent.uncertain=true;update({phase:'uncertain',message:'Gravação sem confirmação. Recupere o recibo com a mesma operação.'});
   }else{
    try{clearMarker(intent);}catch{
     intent.refused=true;update({phase:'cleanup_required',message:'Gravação recusada. Não foi possível limpar o marcador local; sua edição foi preservada.'});return;
    }
    pending=null;update({phase:e.code==='VERSION_CONFLICT'?'conflict':'ready',pendingOperationId:null,message:
     e.code==='VERSION_CONFLICT'?'Outra sessão alterou o processo. Sua edição foi preservada.':'Gravação recusada. Sua edição foi preservada.'});
   }
  }
 }
 return {
  getState,
  async open(caseId:string,options:{discardChanges?:boolean}={}){
   uuid(caseId);if(pending)throw Error('PENDING_WRITE');if(state.dirty&&options.discardChanges!==true)throw Error('UNSAVED_CHANGES');
   assertNoStoredPending();const generation=resetRequest();state={...idle(),phase:'loading',caseId};update({});await refresh(generation);
  },
  edit(snapshot:unknown){
   if(pending)throw Error('PENDING_WRITE');if(!['ready','conflict'].includes(state.phase)||state.data?.process.status!=='draft')throw Error('NOT_READY');
   update({draft:parseSnapshot(snapshot),dirty:true,message:null});
  },
  async save(reason:string){
   if(pending)throw Error('PENDING_WRITE');if(state.phase!=='ready'||!state.data||!state.draft||state.data.process.status!=='draft')throw Error('NOT_READY');
   assertNoStoredPending();const generation=epoch;
   const cmd={operationId:uuid(o.newId()),expectedVersion:state.data.process.version,snapshot:copyJson(state.draft),reason:text(reason,1,1000)};
   const intent:Pending={caseId:state.caseId!,command:cmd,uncertain:false};pending=intent;
   update({phase:'saving',lastReceipt:null,pendingOperationId:cmd.operationId,message:null});
   if(recovery){
    try{
     const p=state.data!.process,scope={workspaceId:p.workspaceId,accountId:p.accountId,caseId:p.caseId,workRef:p.workRef};
     const requestHash=await contentHash({operation:'revise',command:{...cmd,scope}});
     if(generation!==epoch)return;
     intent.marker={schemaVersion:'1',...recovery.identity,caseId:intent.caseId,operationId:cmd.operationId,expectedVersion:cmd.expectedVersion,requestHash};
     recovery.journal.write(intent.marker);
    }catch{
     if(generation!==epoch)return;
     // write() can fail after persisting the marker. No POST was attempted.
     try{clearMarker(intent);}catch{
      intent.refused=true;update({phase:'cleanup_required',message:'Nenhuma gravação foi enviada. Limpe o marcador local para continuar; sua edição foi preservada.'});return;
     }
     pending=null;update({phase:'ready',pendingOperationId:null,message:'Não foi possível preparar a recuperação local. Nenhuma gravação foi enviada; sua edição foi preservada.'});return;
    }
   }
   await runPending();
  },
  async retry(){if(state.phase!=='uncertain'||!pending)throw Error('NO_PENDING_WRITE');if(pending.command)await runPending();else await recover();},
  recover,
  /** Call after the host restores the authenticated identity. Never replays a POST. */
  async restorePending():Promise<boolean>{
   if(!recovery)throw Error('RECOVERY_NOT_CONFIGURED');
   if(pending)throw Error('PENDING_WRITE');if(state.dirty)throw Error('UNSAVED_CHANGES');
   const marker=recovery.journal.read(recovery.identity);if(!marker)return false;
   resetRequest();state={...idle(),phase:'uncertain',caseId:marker.caseId,pendingOperationId:marker.operationId};
   pending={caseId:marker.caseId,command:null,marker,uncertain:true};update({});await recover();return true;
  },
  /** Component teardown/reload: wipe memory but preserve the receipt locator. */
  detach(){resetRequest();pending=null;state=idle();update({});},
  /** Logout/scope revocation must call this. It never cancels the server write. */
  clearSession(){
   resetRequest();const intent=pending;pending=null;state=idle();let message:string|null=null;
   try{
    if(recovery){const marker=intent?.marker??recovery.journal.read(recovery.identity);if(marker)recovery.journal.clear(marker);}
   }catch{message='Os dados da sessão foram removidos da memória, mas o marcador local não pôde ser limpo.';}
   update({message});
  }
 };
}
