/** EXPLICIT TEST FIXTURE ONLY. Never imported by production, never a runtime
 * fallback. Exercises the real HTTP/application contract, not PostgreSQL RLS. */
import type {Principal} from '../../src/domain/model.ts';
import {isOperator} from '../../src/domain/policy.ts';
import type {ImplementationDocument,ImplementationEvent,ImplementationReceipt,ImplementationStore,ImplementationTransaction} from '../../src/infrastructure/implementation-support.ts';
import {implementationSummary,implementationEventSummary} from '../../src/infrastructure/implementation-support.ts';

export class ImplementationSupportMemoryStore implements ImplementationStore{
 docs=new Map<string,ImplementationDocument>();log:ImplementationEvent[]=[];receipts=new Map<string,ImplementationReceipt>();quotaCalls=0;
 private quotas=new Map<string,{hour:string;units:number}>();
 private queue:Promise<void>=Promise.resolve();
 private directory:{id:string;name:string}[];
 constructor(directory:{id:string;name:string}[]=[]){this.directory=structuredClone(directory);}
 async accounts(p:Principal){return this.directory.filter(a=>isOperator(p,p.workspaceId,a.id)).map(a=>({...a}));}
 async run<T>(p:Principal,a:string,work:(tx:ImplementationTransaction)=>Promise<T>):Promise<T>{
  // A single fixture transaction prevents artificial lost updates between the
  // real handler's concurrent autosave/audit calls. SQL qualification is separate.
  const previous=this.queue;let release:()=>void=()=>{};this.queue=new Promise<void>(resolve=>{release=resolve;});await previous;
  const snapshot=structuredClone({docs:this.docs,log:this.log,receipts:this.receipts,quotas:this.quotas});
  const visible=(d:ImplementationDocument)=>d.workspaceId===p.workspaceId&&d.accountId===a;
  const tx:ImplementationTransaction={
   list:async kind=>[...this.docs.values()].filter(d=>visible(d)&&(kind?d.kind===kind:!['help_image','ai_request'].includes(d.kind))).map(d=>implementationSummary(structuredClone(d))),
   read:async id=>{const d=this.docs.get(id);return d&&visible(d)?structuredClone(d):null;},
   byAlias:async alias=>{const d=[...this.docs.values()].find(d=>visible(d)&&(d.id===alias||d.alias===alias||d.body.client_access_token===alias));return d?structuredClone(d):null;},
   save:async(d,expected)=>{const old=this.docs.get(d.id);if((old?.version??0)!==expected)throw Object.assign(Error('version conflict'),{status:412,code:'implementation_version_conflict'});this.docs.set(d.id,structuredClone(d));},
   append:async e=>{this.log.push(structuredClone(e));},
   events:async(id,snapshots=false,before,versionsOnly=false,types,excludeTypes)=>{let values=this.log.filter(e=>e.workspaceId===p.workspaceId&&e.accountId===a&&(!id||e.documentId===id)&&(!(snapshots||versionsOnly)||e.body.snapshot!==undefined)&&(!types||types.includes(e.type))&&(!excludeTypes||!excludeTypes.includes(e.type))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));if(before){const cursor=this.log.find(e=>e.workspaceId===p.workspaceId&&e.accountId===a&&e.id===before&&(!id||e.documentId===id));values=cursor?values.filter(e=>e.createdAt<cursor.createdAt||e.createdAt===cursor.createdAt&&e.id<cursor.id):[];}const matchingTotal=values.length,publicTotal=values.filter(e=>e.body.internal_only!==true).length;return values.slice(0,snapshots?1:101).map(e=>({...snapshots?structuredClone(e):implementationEventSummary(structuredClone(e)),matchingTotal,publicTotal}));},
   event:async(documentId,eventId)=>{const e=this.log.find(e=>e.workspaceId===p.workspaceId&&e.accountId===a&&e.documentId===documentId&&e.id===eventId);return e?structuredClone(e):null;},
   receipt:async key=>this.receipts.get(p.id+a+key)??null,
   remember:async(key,v)=>{this.receipts.set(p.id+a+key,structuredClone(v));},
   quota:async units=>{this.quotaCalls++;const key=p.id+a,hour=new Date().toISOString().slice(0,13),old=this.quotas.get(key),used=old?.hour===hour?old.units:0;this.quotas.set(key,{hour,units:used+units});return used+units<=100;},
  };
  try{return await work(tx);}catch(e){this.docs=snapshot.docs;this.log=snapshot.log;this.receipts=snapshot.receipts;this.quotas=snapshot.quotas;throw e;}finally{release();}
 }
}
