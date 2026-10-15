import type {ProcessViewState,Phase} from './controller.ts';
export interface ImportProcessPresentation {
 label:string;message:string|null;serverVersion:number|null;receiptVersion:number|null;
 canEdit:boolean;canSave:boolean;canRecover:boolean;canReload:boolean;shouldWarnBeforeUnload:boolean;
}
const LABELS:Record<Phase,string>={
 idle:'Nenhum processo aberto',loading:'Consultando processo',ready:'Versão consultada',saving:'Aguardando confirmação',
 recovering:'Consultando recibo',uncertain:'Gravação sem confirmação',conflict:'Conflito de edição',
 refresh_required:'Gravação confirmada; atualização pendente',cleanup_required:'Limpeza de recuperação pendente',error:'Consulta indisponível'
};
/** Pure view model shared by the Vuex getter and UI. No HTML or fictitious progress. */
export function presentImportProcess(s:ProcessViewState):ImportProcessPresentation {
 if(!Object.hasOwn(LABELS,s.phase))throw Error('INVALID_PRESENTATION_PHASE');
 const busy=['loading','saving','recovering'].includes(s.phase),pending=!!s.pendingOperationId;
 const editable=s.data?.process.status==='draft'&&!pending;
 return {
  label:s.phase==='ready'&&s.lastReceipt?'Gravação confirmada':LABELS[s.phase],message:s.message,
  serverVersion:s.data?.process.version??null,receiptVersion:s.lastReceipt?.version??null,
  canEdit:editable&&['ready','conflict'].includes(s.phase),
  canSave:editable&&s.phase==='ready'&&s.dirty&&s.draft!==null,
  canRecover:pending&&['uncertain','cleanup_required'].includes(s.phase),
  canReload:!!s.caseId&&!busy&&!pending,
  shouldWarnBeforeUnload:s.dirty||pending||['saving','recovering'].includes(s.phase)
 };
}
