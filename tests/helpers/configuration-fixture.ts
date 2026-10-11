import {memberFixture,id,NOW,LATER} from './member-admin-fixture.ts';
export {id,NOW,LATER};
/** TEST ONLY: serialized snapshots, not a SQL implementation or runtime fallback. */
export function configurationFixture(){
 const f=memberFixture();
 const capabilities=['accounts.read','accounts.write','bindings.read','bindings.write','catalog.read','catalog.write','contracts.read','contracts.write','contracts.publish'];
 f.state().capabilityGrants.push(...capabilities.map((capability,i)=>({id:id(100+i),workspaceId:id(1),principalId:id(2),capability,revision:1,reason:'Synthetic explicit policy',policyRef:'TEST-C05',approvedBy:id(99),expiresAt:null,active:true})));
 let config:any={workspaceId:id(1),revision:1,records:[]}, receipts=new Map<string,any>(),audits:any[]=[],serial=Promise.resolve();
 const controls={loseCommit:false,failAudit:false,beforeCommit:()=>{},policyActive:true,connectionActive:true};
 const counters={reads:0,writes:0};
 const store={transaction:async(p:any,check:()=>void,work:(tx:any)=>Promise<any>)=>{
  const before=serial;let done!:()=>void;serial=new Promise(r=>done=r);await before;
  const next=structuredClone(config),rs=new Map(receipts),as=structuredClone(audits);
  try{
   check();const result=await work({
    readWorkspace:async()=>structuredClone(f.state()),
    readConfiguration:async()=>{counters.reads++;return structuredClone(next);},
    getReceipt:async(key:string)=>structuredClone(rs.get(p.id+':'+key)??null),
    readConnection:async(connectionId:string)=>({id:connectionId,workspaceId:id(1),productInstanceId:next.records.find((r:any)=>r.kind==='instance')?.id,active:controls.connectionActive,qualified:true}),
    readApprovedPolicy:async(reference:string)=>({reference,workspaceId:id(1),active:controls.policyActive,validFrom:'2020-01-01T00:00:00.000Z',validUntil:null}),
    commitChange:async(expected:number,record:any,audit:any,receipt:any)=>{
     check();if(expected!==next.revision)throw Error('CAS conflict');if(controls.failAudit)throw Error('private audit failure');
     const i=next.records.findIndex((r:any)=>r.id===record.id);if(i===-1)next.records.push(structuredClone(record));else next.records[i]=structuredClone(record);
     next.revision++;rs.set(p.id+':'+receipt.key,structuredClone(receipt));as.push(structuredClone(audit));counters.writes++;
    }
   });
   controls.beforeCommit();check();config=next;receipts=rs;audits=as;
   if(controls.loseCommit){controls.loseCommit=false;throw Error('lost confirmation');}return result;
  }finally{done();}
 }};
 return {...f,store,controls,counters,configuration:()=>config,audits:()=>audits,receipts:()=>receipts};
}
