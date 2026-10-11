import {createAuthentication} from '../../src/infrastructure/authentication.ts';
import type {Principal} from '../../src/domain/model.ts';
export const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const NOW='2026-10-09T12:00:00.123000Z',LATER='2026-10-10T12:00:00.123000Z';
/** TEST ONLY transactional model. No SQL, persisted permissions or production fallback. */
export function memberFixture(){
 let now=NOW;const counters={transactions:0,writes:0,commits:0,auth:0};
 const principal:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:[],scopes:['contexts:resolve','tickets:read']};
 const caps=['members.read','members.invite','members.write','members.revoke','members.succession'];
 const grant=(p:string,c:string,n:number)=>({id:id(n),workspaceId:id(1),principalId:p,capability:c,revision:1,reason:'Approved test policy',policyRef:'SYNTHETIC-POLICY-1',approvedBy:id(99),expiresAt:null,active:true});
 let state:any={workspaceId:id(1),revision:1,members:[
  {principalId:id(2),principalKind:'human',role:'admin',status:'active',revision:1,expiresAt:null},
  {principalId:id(3),principalKind:'human',role:'admin',status:'active',revision:1,expiresAt:null},
  {principalId:id(4),principalKind:'human',role:'agent',status:'active',revision:1,expiresAt:null}],
  capabilityGrants:[...caps.map((c,i)=>grant(id(2),c,10+i)),grant(id(3),'members.write',20)]};
 let receipts=new Map<string,any>(),audit:any[]=[];let queue=Promise.resolve();
 const switches:any={loseCommit:false,failBeforeWrite:false,readHook:()=>{},beforeCommit:()=>{}};
 const store={transaction:async(p:Principal,admission:()=>void,work:(tx:any)=>Promise<any>)=>{
  counters.transactions++;admission();const previous=queue;let unlock!:()=>void;queue=new Promise(r=>{unlock=r;});await previous;
  const next=structuredClone(state),nextReceipts=new Map(receipts),nextAudit=[...audit];
  try{
   admission();
   const result=await work({
    readWorkspace:async()=>{switches.readHook();return structuredClone(next);},
    findPerson:async(target:string)=>target===id(90)?null:{principalId:target,principalKind:'human',active:true},
    getReceipt:async(key:string)=>structuredClone(nextReceipts.get(p.id+':'+key)??null),
    commitChange:async(expected:number,member:any,event:any,receipt:any)=>{
     admission();if(switches.failBeforeWrite)throw Error('private SQL detail');
     if(next.revision!==expected)throw Object.assign(Error('conflict'),{code:'member_version_conflict'});
     const index=next.members.findIndex((m:any)=>m.principalId===member.principalId);
     if(index<0)next.members.push(structuredClone(member));else next.members[index]=structuredClone(member);
     next.revision++;nextAudit.push(structuredClone(event));nextReceipts.set(p.id+':'+receipt.key,structuredClone(receipt));counters.writes++;
    }
   });
   switches.beforeCommit();admission();state=next;receipts=nextReceipts;audit=nextAudit;counters.commits++;
   if(switches.loseCommit){switches.loseCommit=false;throw Error('private lost COMMIT');}return result;
  }finally{unlock();}
 }};
 const auth=createAuthentication({connect:async()=>{throw Error('unexpected');},query:async()=>({rows:[{principal}],rowCount:1}),end:async()=>{}},
  {supabaseUrl:'https://auth.example.invalid',publishableKey:'synthetic'},async()=>{counters.auth++;return Response.json({id:id(200),factors:[{id:id(201),status:'verified',factor_type:'totp'}]});},()=>new Date(now));
 const request=(aal='aal2')=>new Request('https://helpdesk.example.test/v1/admin/members',{headers:{'x-workspace-id':id(1),authorization:'Bearer '+Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id(200),aal,exp:Math.floor(Date.parse(LATER)/1000)})).toString('base64url')+'.synthetic'}});
 return {principal,store,auth,request,counters,switches,clock:()=>now,setTime:(at:string)=>{now=at;},state:()=>state,audit:()=>audit,receipts:()=>receipts,
  withProof:<T>(work:(p:Principal,proof:any)=>Promise<T>)=>auth.withAdministrativeAssurance(request(),work)};
}
