import {record,copyJson,uuid} from '../import-process/canonical.ts';
import {createImportProcessController,copyProcessViewState} from './controller.ts';
import type {ControllerOptions,ProcessViewState} from './controller.ts';
import {presentImportProcess} from './presentation.ts';
export const IMPORT_PROCESS_NAMESPACE='importProcess';
interface ProcessModule {
 namespaced:true;state:()=>ProcessViewState;
 mutations:{replace:(s:ProcessViewState,next:ProcessViewState)=>void};
 actions:Record<string,(_context:unknown,payload?:unknown)=>unknown>;
 getters:{presentation:typeof presentImportProcess};
}
/** Structural subset of Vuex 4. Runtime Vuex remains supplied by the existing app. */
export interface VuexStorePort {
 readonly state:object;hasModule(path:string):boolean;
 registerModule(path:string,module:ProcessModule):void;unregisterModule(path:string):void;
 commit(type:string,payload:ProcessViewState):void;
}
export interface VuexSessionOptions extends Omit<ControllerOptions,'onChange'> {store:VuexStorePort;enabled?:boolean;}
/** Register only after server capability AND current authenticated session are resolved.
 * dispose is component teardown (keeps the locator); endSession is logout/scope change.
 * Neither operation is an authentication API.
 * Does not edit the root store, routes, or enable a server runtime by itself.
 */
export function registerImportProcessSession(o:VuexSessionOptions):{available:boolean;dispose:()=>void;endSession:()=>void} {
 if(o.enabled!==true)return {available:false,dispose(){},endSession(){}};
 const store=o.store,name=IMPORT_PROCESS_NAMESPACE;
 if(!store||!store.state||['hasModule','registerModule','unregisterModule','commit'].some(k=>typeof store[k as keyof VuexStorePort]!=='function'))throw Error('INVALID_VUEX_PORT');
 if(store.hasModule(name)||Object.hasOwn(store.state,name))throw Error('IMPORT_PROCESS_NAMESPACE_EXISTS');
 let live=true,owned:unknown;
 const current=()=>(store.state as Record<string,unknown>)[name];
 function assertOwned(){if(!live)throw Error('IMPORT_PROCESS_SESSION_CLOSED');if(current()!==owned)throw Error('IMPORT_PROCESS_NAMESPACE_REPLACED');}
 const controller=createImportProcessController({...o,onChange:next=>{if(live&&current()===owned)store.commit(name+'/replace',next);}});
 const wrap=(fn:(payload?:unknown)=>unknown)=>(_ctx:unknown,payload?:unknown)=>{assertOwned();return fn(payload);};
 const module:ProcessModule={
  namespaced:true,state:()=>controller.getState(),
  mutations:{replace:(s,next)=>{Object.assign(s,copyProcessViewState(next));}},
  getters:{presentation:presentImportProcess},
  actions:{
   open:wrap(payload=>{
    const x=record(copyJson(payload),Object.hasOwn(payload as object,'discardChanges')?['caseId','discardChanges']:['caseId']);
    uuid(x.caseId);if(x.discardChanges!==undefined&&typeof x.discardChanges!=='boolean')throw Error('INVALID_DISCARD');
    return controller.open(x.caseId as string,{discardChanges:x.discardChanges as boolean|undefined});
   }),
   edit:wrap(snapshot=>controller.edit(snapshot)),
   save:wrap(reason=>{if(typeof reason!=='string')throw Error('INVALID_REASON');return controller.save(reason);}),
   retry:wrap(()=>controller.retry()),recover:wrap(()=>controller.recover()),restorePending:wrap(()=>controller.restorePending()),
   clearSession:wrap(()=>controller.clearSession())
  }
 };
 store.registerModule(name,module);owned=current();
 if(!owned){live=false;throw Error('IMPORT_PROCESS_REGISTRATION_FAILED');}
 function teardown(clearRecovery:boolean){
  if(!live)return;
  // A replaced namespace is not ours; don't remove its state or its new marker.
  const ours=current()===owned;live=false;
  if(clearRecovery&&ours)controller.clearSession();else controller.detach();
  if(ours&&store.hasModule(name))store.unregisterModule(name);
 }
 return {available:true,dispose:()=>teardown(false),endSession:()=>teardown(true)};
}
