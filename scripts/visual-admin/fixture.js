// Test-only fixtures. Not imported by production and never included in dist.
window.ID=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
window.AUDIENCE={workspaceId:ID(1),principalId:ID(2)};
window.ROWS=[
 {principal_id:ID(2),principal_kind:'human',role:'admin',status:'active',effective_status:'active',revision:2,expires_at:null},
 {principal_id:ID(3),principal_kind:'human',role:'agent',status:'active',effective_status:'active',revision:1,expires_at:'2026-11-30T15:30:00.123456Z'},
 {principal_id:ID(4),principal_kind:'human',role:'admin',status:'active',effective_status:'active',revision:1,expires_at:null},
 {principal_id:ID(5),principal_kind:'human',role:'agent',status:'invited',effective_status:'invited',revision:1,expires_at:'2026-11-30T15:30:00.000Z'},
 {principal_id:ID(6),principal_kind:'human',role:'agent',status:'active',effective_status:'expired',revision:1,expires_at:'2026-09-01T15:30:00.000Z'},
 {principal_id:ID(7),principal_kind:'human',role:'agent',status:'revoked',effective_status:'revoked',revision:1,expires_at:null}
];
window.CFG_TYPES={accounts:'account',products:'product',instances:'instance',services:'service',bindings:'binding',contracts:'contract','contract-versions':'contract_version',coverages:'coverage'};
window.CONFIG_DATA={name:'Registro autorizado de teste com título comprido '+ 'semEspaco'.repeat(18),code:'SERVICO-TESTE',active:true,enabled:true,productId:ID(11),accountId:ID(12),productInstanceId:ID(13),connectionId:'connection-qualified',tenantId:'tenant-ref',environment:'production',status:'active',contractId:ID(14),serviceId:ID(15),contractVersionId:ID(16),validFrom:'2026-10-13T12:00:00.123456Z',validUntil:null,policyRef:'policy-approved',privatePayload:'DO_NOT_RENDER_EXTRA'};
window.SCHEMA={id:'FORM1',version:1,status:'draft',title:'Cadastro de solicitação',fields:[{key:'name',type:'text',label:'Nome para contato',required:true,public:true,config:{maxLength:80}},{key:'internal',type:'textarea',label:'Análise interna de teste',required:false,public:false,config:{maxLength:200}}]};
window.CALLS=[];window.MODE='ok';window.GET_REJECT=false;window.EMPTY=false;window.CAPABILITIES=['invite','set_role','revoke','expire','handoff'];window.WAIT_GET=false;
window.REQUEST=async(path,init={})=>{
 CALLS.push({path,method:init.method??'GET',headers:init.headers,body:init.body});
 const get=!init.method||init.method==='GET';
 if(get&&WAIT_GET)await new Promise(done=>window.GET_DONE=done);
 if(!get&&MODE==='delay')await new Promise(done=>window.MUTATION_DONE=done);
 if(!get&&MODE==='unknown')throw Error('PRIVATE_TRANSPORT_ERROR');
 if(get&&GET_REJECT||!get&&MODE==='reject')return {ok:false,status:get?403:412,json:async()=>({private:'PRIVATE_SERVER_ERROR'})};
 const members=path.startsWith('/v1/admin/members');
 if(get){
  const kind=CFG_TYPES[path.split('/')[3]?.split('?')[0]];
  return {ok:true,json:async()=>members?{workspace_id:ID(1),revision:7,total:EMPTY?0:42,available_actions:CAPABILITIES,next_cursor:null,items:EMPTY?[]:structuredClone(ROWS)}:{workspace_id:ID(1),revision:7,total:EMPTY?0:2,next_cursor:null,items:EMPTY?[]:[{id:ID(20),workspaceId:ID(1),kind,revision:1,data:{...CONFIG_DATA,published:false}},{id:ID(21),workspaceId:ID(1),kind,revision:2,data:{...CONFIG_DATA,name:'Versão já publicada',published:kind==='contract_version'}}]}};
 }
 const data=JSON.parse(init.body);
 const result={workspace_id:ID(1),actor_id:ID(2),revision:8,audit_id:ID(90),replayed:false};
 if(members){const target=data.principal_id??path.split('/')[4];const row=ROWS.find(r=>r.principal_id===target)??{principal_id:target,principal_kind:'human',role:'agent',status:'invited',effective_status:'invited',revision:1,expires_at:data.expires_at};return {ok:true,json:async()=>({...result,notification:'not_requested',member:{...row,revision:row.revision+1}})};}
 const kind=CFG_TYPES[path.split('/')[3]];
 return {ok:true,json:async()=>({...result,record:{id:path.split('/')[4]??ID(22),workspaceId:ID(1),kind,revision:2,data:data.data}})};
};
window.SUBMIT=async(intent)=>{CALLS.push(structuredClone(intent));if(MODE==='delay')await new Promise(done=>window.MUTATION_DONE=done);if(MODE==='unknown')throw Error('PRIVATE_SUBMIT_ERROR');return {state:MODE==='reject'?'rejected':'confirmed'};};
