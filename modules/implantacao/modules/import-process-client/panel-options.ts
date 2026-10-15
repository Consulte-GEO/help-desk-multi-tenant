import {copyJson} from '../import-process/canonical.ts';
import type {Snapshot} from '../import-process/canonical.ts';
import type {ProcessViewState} from './controller.ts';
import type {ImportProcessPresentation} from './presentation.ts';
import {correctSnapshotField,correctionValueType,projectReviewFields} from './field-review.ts';
import type {FieldCorrection,ReviewRow,ReviewQuery} from './field-review.ts';
interface PanelStore {
 state:{importProcess?:ProcessViewState};getters:Record<string,ImportProcessPresentation|undefined>;
 dispatch(type:string,payload?:unknown):Promise<unknown>;
}
interface PanelData {
 query:string;kind:ReviewQuery['kind'];page:number;revisionReason:string;
 editor:FieldCorrection|null;confirmEditor:boolean;confirmReload:boolean;confirmExit:boolean;
 busy:boolean;localMessage:string|null;generation:number;
}
interface PanelContext extends PanelData {
 active:boolean;initialCaseId:string;$store?:PanelStore;
 available:boolean;s:ProcessViewState|null;view:ImportProcessPresentation|null;
 fieldPage:ReturnType<typeof projectReviewFields>;hasLocalChanges:boolean;
 run(action:string,payload?:unknown):Promise<boolean>;initialize():Promise<void>;requestExit():Promise<boolean>;
 resetForms():void;finishExit(leave:boolean):void;reloadConfirmed():Promise<void>;beforeUnload(event:BeforeUnloadEvent):void;
}
const exits=new WeakMap<object,(leave:boolean)=>void>();
const ERRORS:Record<string,string>={
 CORRECTION_TYPE_CONFLICT:'Mantenha o tipo do valor que já foi identificado neste campo.',
 INVALID_CORRECTION_NUMBER:'Informe um número sem unidade ou separadores de milhar. Use vírgula ou ponto para os decimais.',
 INVALID_CORRECTION_BOOLEAN:'Selecione Sim ou Não.',INVALID_CORRECTION_TEXT:'Informe o valor ou marque sua ausência.',
 PRESENCE_VALUE_CONFLICT:'Um campo ausente ou ilegível não pode ter um valor final.',
 CORRECTION_REASON_REQUIRED:'Explique a correção com base no documento ou na confirmação do responsável.',
 FIELD_CHANGED:'Este campo mudou depois de abrir o editor. Cancele a correção e confira o valor atual.',
 NO_FIELD_CHANGE:'Nenhuma alteração identificada neste campo.',
 IDENTIFIER_MUST_REMAIN_TEXT:'Identificadores devem ser tratados como texto para preservar zeros à esquerda.',
};
/** Vue 3 Options API. The store/session are supplied by the authenticated host.
 * A module's presence is only a UI capability; the service still authorizes every operation.
 */
export const importProcessPanel={
 name:'ImportProcessPanel',
 props:{active:{type:Boolean,default:false},initialCaseId:{type:String,default:''}},
 emits:['changed'],
 data():PanelData{return{query:'',kind:'all',page:1,revisionReason:'',editor:null,confirmEditor:false,confirmReload:false,confirmExit:false,busy:false,localMessage:null,generation:0};},
 computed:{
  available(this:PanelContext):boolean{return this.active===true&&!!this.$store?.state.importProcess&&!!this.$store?.getters['importProcess/presentation'];},
  s(this:PanelContext):ProcessViewState|null{return this.available?this.$store!.state.importProcess!:null;},
  view(this:PanelContext):ImportProcessPresentation|null{return this.available?this.$store!.getters['importProcess/presentation']!:null;},
  fieldPage(this:PanelContext):ReturnType<typeof projectReviewFields>{return this.s?.draft?projectReviewFields(this.s.draft,{query:this.query,kind:this.kind,page:this.page,pageSize:25}):{rows:[],total:0,page:1,pages:1,recordCount:0};},
  hasLocalChanges(this:PanelContext):boolean{return !!this.editor||this.revisionReason.trim()!=='';},
 },
 watch:{
  available(this:PanelContext,value:boolean){if(!value){this.generation++;this.busy=false;this.resetForms();this.finishExit(false);}},
  s(this:PanelContext,value:ProcessViewState|null,previous:ProcessViewState|null){
   if(value===previous)return;this.generation++;this.busy=false;this.resetForms();this.finishExit(false);
   if(value)queueMicrotask(()=>{if(this.available)void this.initialize();});
  },
  's.caseId'(this:PanelContext){this.generation++;this.busy=false;this.resetForms();},
  query(this:PanelContext){this.page=1;},kind(this:PanelContext){this.page=1;},
 },
 mounted(this:PanelContext){if(typeof window!=='undefined')window.addEventListener('beforeunload',this.beforeUnload);void this.initialize();},
 beforeUnmount(this:PanelContext){this.generation++;if(typeof window!=='undefined')window.removeEventListener('beforeunload',this.beforeUnload);this.finishExit(false);this.resetForms();},
 methods:{
  resetForms(this:PanelContext){this.query='';this.kind='all';this.page=1;this.revisionReason='';this.editor=null;this.confirmEditor=false;this.confirmReload=false;this.localMessage=null;},
  async initialize(this:PanelContext){
   if(!this.available||this.busy)return;
   if(this.s?.phase!=='idle'){
    if(this.initialCaseId&&this.initialCaseId!==this.s?.caseId&&await this.requestExit())await this.run('open',{caseId:this.initialCaseId,discardChanges:true});
    return;
   }
   const state=this.s,generation=this.generation;this.busy=true;
   try{
    const recovered=await this.$store!.dispatch('importProcess/restorePending');
    if(generation!==this.generation||!this.available||this.s!==state)return;
    if(!recovered&&this.initialCaseId)await this.$store!.dispatch('importProcess/open',{caseId:this.initialCaseId});
   }catch{if(generation===this.generation&&this.available)this.localMessage='Não foi possível retomar a revisão. Verifique sua sessão e a recuperação pendente.';}
   finally{if(generation===this.generation)this.busy=false;}
  },
  async run(this:PanelContext,action:string,payload?:unknown):Promise<boolean>{
   if(!this.available||this.busy)return false;
   const state=this.s,generation=this.generation;this.busy=true;this.localMessage=null;
   try{await this.$store!.dispatch('importProcess/'+action,payload);return generation===this.generation&&this.available&&this.s===state;}
   catch{if(generation===this.generation&&this.available)this.localMessage='Não foi possível concluir a ação. Os dados não foram importados; confira o estado da revisão.';return false;}
   finally{if(generation===this.generation)this.busy=false;}
  },
  startCorrection(this:PanelContext,row:ReviewRow){
   if(!this.view?.canEdit||this.busy)return;
   if(this.editor){this.localMessage='Aplique ou cancele a correção atual antes de abrir outro campo.';return;}
   this.localMessage=null;
   this.editor={recordId:row.recordId,field:row.name,expectedField:copyJson(row.field),presence:row.field.presence,
    value:row.field.value===null?'':String(row.field.value),valueType:correctionValueType(row.field),reason:''};
  },
  async applyCorrection(this:PanelContext){
   if(!this.editor||!this.s?.draft||!this.view?.canEdit||this.busy)return;
   try{
    const next:Snapshot=correctSnapshotField(this.s.draft,this.editor);
    if(await this.run('edit',next)){this.editor=null;this.confirmEditor=false;this.localMessage='Correção aplicada ao rascunho. Salve a revisão para gravá-la no servidor.';}
   }catch(e){this.localMessage=ERRORS[e instanceof Error?e.message:'']??'A correção não é válida. Confira o valor, a situação e a justificativa.';}
  },
  changePresence(this:PanelContext){if(this.editor&&this.editor.presence!=='present')this.editor.value='';},
  cancelCorrection(this:PanelContext){if(this.editor)this.confirmEditor=true;},
  discardCorrection(this:PanelContext){this.editor=null;this.confirmEditor=false;},
  async saveRevision(this:PanelContext){
   if(!this.view?.canSave||this.busy)return;
   if(this.editor){this.localMessage='Aplique ou cancele a correção aberta antes de salvar a revisão.';return;}
   if(!this.revisionReason.trim()){this.localMessage='Informe a justificativa desta revisão.';return;}
   if(await this.run('save',this.revisionReason.trim())){if(this.s?.lastReceipt&&!this.s.dirty)this.revisionReason='';}
  },
  async recoverReceipt(this:PanelContext){if(this.view?.canRecover)await this.run('recover');},
  async requestReload(this:PanelContext){
   if(!this.view?.canReload||this.busy)return;
   if(this.s?.dirty||this.hasLocalChanges){this.confirmReload=true;return;}
   await this.reloadConfirmed();
  },
  async reloadConfirmed(this:PanelContext){
   if(!this.view?.canReload||this.busy||!this.s?.caseId)return;
   const caseId=this.s.caseId;this.confirmReload=false;
   if(await this.run('open',{caseId,discardChanges:true})){if(this.s?.phase==='ready')this.resetForms();}
  },
  beforeUnload(this:PanelContext,event:BeforeUnloadEvent){
   if(this.available&&(this.view?.shouldWarnBeforeUnload||this.hasLocalChanges||this.busy)){event.preventDefault();event.returnValue='';}
  },
  async requestExit(this:PanelContext):Promise<boolean>{
   if(!this.available)return true;
   if(this.busy||this.s?.pendingOperationId){this.localMessage='Há uma operação em andamento ou sem confirmação. Consulte o recibo antes de sair desta revisão.';return false;}
   if(!this.s?.dirty&&!this.hasLocalChanges)return true;
   this.finishExit(false);this.confirmExit=true;
   return new Promise(resolve=>exits.set(this,resolve));
  },
  finishExit(this:PanelContext,leave:boolean){this.confirmExit=false;const resolve=exits.get(this);exits.delete(this);resolve?.(leave);},
 },
};
