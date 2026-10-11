import {memberFixture,id,NOW} from './member-admin-fixture.ts';
export {id,NOW};
export const inputForm=(version=1)=>({id:id(701),version,status:'draft',title:'Synthetic support request',fields:[{key:'summary',type:'text',label:'Resumo',required:true,public:true,config:{maxLength:200}}]});
/** Tests only: serialized transactional state, not a production persistence adapter. */
export function formFixture(){
 const f=memberFixture();for(const [i,capability] of ['forms.read','forms.write','forms.publish'].entries())f.state().capabilityGrants.push({id:id(300+i),workspaceId:id(1),principalId:id(2),capability,revision:1,reason:'Synthetic explicit permission',policyRef:'TEST-C07',approvedBy:id(99),expiresAt:null,active:true});
 let data:any={workspaceId:id(1),revision:1,versions:[]},receipts=new Map(),audits:any[]=[],queue=Promise.resolve();
 const controls={failAudit:false,loseCommit:false,categoryActive:true,files:false,beforeCommit:()=>{}};
 const store={transaction:async(p:any,check:()=>void,fn:(t:any)=>Promise<any>)=>{const previous=queue;let release!:()=>void;queue=new Promise(r=>release=r);await previous;
  const d=structuredClone(data),r=new Map(receipts),a=structuredClone(audits);try{check();const result=await fn({readWorkspace:async()=>structuredClone(f.state()),readCatalog:async()=>d,getReceipt:async(key:string)=>structuredClone(r.get(p.id+':'+key)??null),
   readCategory:async(profileId:string,categoryCode:string)=>({workspaceId:p.workspaceId,profileId,categoryCode,active:controls.categoryActive,sourceRef:'SYNTHETIC-NOT-TAXONOMY'}),
   readRegistry:async()=>({types:['text','file','boolean','select','decimal','lookup','info','download','repeater','table_paste','integer','date','cnpj','multiselect','textarea'],lookups:[],files:controls.files,downloads:[]}),
   commitVersion:async(expected:number,record:any,audit:any,receipt:any)=>{check();if(expected!==d.revision)throw Error('CAS');if(controls.failAudit)throw Error('private audit failure');const i=d.versions.findIndex((v:any)=>v.schema.id===record.schema.id&&v.schema.version===record.schema.version);if(i<0)d.versions.push(structuredClone(record));else d.versions[i]=structuredClone(record);d.revision++;r.set(p.id+':'+receipt.key,structuredClone(receipt));a.push(structuredClone(audit));}
  });controls.beforeCommit();check();data=d;receipts=r;audits=a;if(controls.loseCommit){controls.loseCommit=false;throw Error('lost COMMIT');}return result;}finally{release();}}};
 const save=(s=inputForm(),expectedRevision=1,expectedEntityRevision=0)=>({action:'save',schema:s,profileId:'SYNTHETIC',categoryCode:'SYNTHETIC-TEST',expectedRevision,expectedEntityRevision,reason:'Explicit test draft'});
 return {...f,store,controls,data:()=>data,receipts:()=>receipts,audits:()=>audits,save};
}
