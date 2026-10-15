// TEST-ONLY transaction double. Not a PostgreSQL implementation or persistence proof.
const copyJson = value => JSON.parse(JSON.stringify(value)); // test storage clone, not command validation
export const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const scope={workspaceId:id(1),accountId:id(2),caseId:id(3),workRef:null};
export const empty=()=>({schemaVersion:'1',records:[],decisions:[],findings:[],artifactIds:[]});
export const command=(n=10)=>({scope:{...scope},operationId:id(n),expectedVersion:0,purpose:'new_work',target:{system:'novo_geo',contractVersion:'pending'},snapshot:empty(),reason:'Cadastro inicial'});
export class MemoryRepository {
 data=new Map();tail=Promise.resolve();calls=0;failAt='';
 async transaction(s,fn){
  this.calls++;const previous=this.tail;let unlock;this.tail=new Promise(resolve=>unlock=resolve);await previous;
  const key=[s.workspaceId,s.accountId,s.caseId].join(':');
  const local=copyJson(this.data.get(key)||{process:null,revisions:[],artifacts:[],receipts:[],events:[]});
  const fail=name=>{if(this.failAt===name)throw new Error('SIMULATED_STORAGE_FAILURE')};
  const tx={
   readProcess:async()=>copyJson(local.process),
   readRevision:async n=>copyJson(local.revisions.find(r=>r.number===n)||null),
   listArtifacts:async()=>copyJson(local.artifacts),
   readArtifact:async n=>copyJson(local.artifacts.find(a=>a.id===n)||null),
   readReceipt:async(actor,op)=>copyJson(local.receipts.find(r=>r.actorId===actor&&r.operationId===op)||null),
   insertProcess:async p=>{fail('insertProcess');if(local.process)throw Error('CASE_EXISTS');local.process=copyJson(p)},
   updateProcess:async(p,version)=>{fail('updateProcess');if(!local.process||local.process.version!==version)throw Error('VERSION_CONFLICT');local.process=copyJson(p)},
   insertRevision:async r=>{fail('insertRevision');if(local.revisions.some(x=>x.number===r.number))throw Error('REVISION_EXISTS');local.revisions.push(copyJson(r))},
   insertArtifact:async a=>{fail('insertArtifact');if(local.artifacts.some(x=>x.id===a.id))throw Error('ARTIFACT_EXISTS');local.artifacts.push(copyJson(a))},
   updateArtifact:async a=>{fail('updateArtifact');const i=local.artifacts.findIndex(x=>x.id===a.id);if(i<0||local.artifacts[i].status!=='pending')throw Error('ARTIFACT_STATE');local.artifacts[i]=copyJson(a)},
   insertReceipt:async r=>{fail('insertReceipt');local.receipts.push(copyJson(r))},
   insertEvent:async e=>{fail('insertEvent');local.events.push(copyJson(e))},
  };
  try {const result=await fn(tx);fail('commit');this.data.set(key,local);return copyJson(result)}finally{unlock()}
 }
 stored(s=scope){return this.data.get([s.workspaceId,s.accountId,s.caseId].join(':'))}
}
export function environment() {
  let now = new Date('2026-10-14T12:00:00Z'), serial = 100, grants = 0;
  const repo = new MemoryRepository();
  const env = {
    repo, get now() { return now; }, advance(ms) { now = new Date(+now + ms); },
    actor:id(4), requester:id(4), role:'requester', accessVersion:1,
    deny:false, changeOnSecond:false, grants:()=>grants,
    inspection:{sha256:'a'.repeat(64),bytes:100,mime:'application/pdf',private:true,contentValidated:true,scan:'clean',objectVersion:'v1'},
    inspections:[], inspectFailure:false,
    options() {
      return {
        repository:repo, clock:()=>new Date(now), newId:()=>id(serial++), retentionDays:90,
        authority: {
          async resolve(_credential, selection, _operation) {
            grants++;
            if (env.deny) throw Error('ACCESS_DENIED');
            return {...selection, actorId:env.actor, requesterId:env.requester, role:env.role,
              accessVersion:env.accessVersion+(env.changeOnSecond&&grants%2===0?1:0),
              expiresAt:new Date(+now+60000).toISOString()};
          }
        },
        inspector: {
          async inspect(key) {
            env.inspections.push(key);
            if (env.inspectFailure) throw Error('OFFLINE');
            return copyJson(env.inspection);
          }
        }
      };
    }
  };
  return env;
}
