import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,command,scope,id} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
const H=await import('../../../modules/import-process/http.ts').catch(()=>({}));
const origin='https://setup.example.test',base=origin+'/v1/import-processes';
export function httpEnvironment(){
 const e=environment(),o=e.options();
 const original=o.authority.resolve;
 o.authority.resolve=async(c,s,op,signal)=>{
  if(c?.session!=='trusted' || s.workspaceId!==scope.workspaceId || s.accountId!==scope.accountId) return {...await original(c,s,op,signal),accountId:scope.accountId};
  return original(c,s,op,signal);
 };
 const options={origin,service:createImportProcessService(o),enabled:()=>true,
  authenticate:async req=>req.headers.get('authorization')==='Bearer valid-test-token'?{session:'trusted'}:null,
  locate:async(_c,caseId)=>e.repo.stored({...scope,caseId})?{...scope,caseId}:null,
  admit:async()=>true,timeouts:{portMs:40,bodyMs:40}};
 assert.equal(typeof H.createImportProcessHttpHandler,'function','handler HTTP precisa existir');
 return {e,options,make:()=>H.createImportProcessHttpHandler(options)};
}
function request(path='',method='GET',body,headers={}){
 return new Request(base+path,{method,headers:{Authorization:'Bearer valid-test-token',...(method==='POST'?{Origin:origin,'Content-Type':'application/json','Idempotency-Key':body?.operationId,...(body?.expectedVersion>0?{'If-Match':`"imp:${scope.caseId}:${body.expectedVersion}"`}:{})}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
}
async function created(){const x=httpEnvironment();const h=x.make();const res=await h(request('','POST',command()));assert.equal(res.status,201);return {...x,h,res};}
const save=(v=1,op=20)=>({operationId:id(op),expectedVersion:v,snapshot:{schemaVersion:'1',records:[],findings:[],decisions:[],artifactIds:[]},reason:'Correção confirmada'});
async function code(res,status,c){assert.equal(res.status,status,await res.clone().text());assert.equal((await res.json()).code,c);}
test('R03 HTTP disabled por padrão sem autenticar nem abrir storage',async()=>{const x=httpEnvironment();delete x.options.enabled;x.options.authenticate=()=>{throw Error('não chamar')};await code(await x.make()(request()),503,'PROCESS_GATE_CLOSED');assert.equal(x.e.repo.calls,0)});
test('R03 HTTP cria com recibo, ETag e privacidade sem inventar execução',async()=>{const {res}=await created();assert.equal(res.headers.get('etag'),`"imp:${scope.caseId}:1"`);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.headers.get('x-content-type-options'),'nosniff');assert.match(res.headers.get('x-request-id'),/^[a-f0-9-]{36}$/);const r=await res.json();assert.equal(r.status,'draft');assert.equal(r.version,1)});
test('R03 HTTP GET usa localizador do servidor, não query de conta',async()=>{const {h}=await created();const r=await h(request('/'+scope.caseId));assert.equal(r.status,200);assert.equal((await r.json()).process.accountId,scope.accountId);await code(await h(request('/'+scope.caseId+'?accountId='+id(99))),400,'QUERY_NOT_ALLOWED')});
test('R03 HTTP replay da criação retorna recibo original sem duplicar',async()=>{const {h,e}=await created();const r=await h(request('','POST',command()));assert.equal(r.status,200);assert.equal((await r.json()).replayed,true);assert.equal(e.repo.stored().events.length,1)});
test('R03 HTTP revisão imutável é legível e não usa ETag de edição',async()=>{const {h}=await created();const r=await h(request('/'+scope.caseId+'/revisions/1'));assert.equal(r.status,200);assert.match(r.headers.get('etag'),/^"rev:/);assert.equal((await r.json()).number,1)});
test('R03 HTTP grava revisão com seleção reconstruída e confirma recibo',async()=>{const {h,e}=await created();const r=await h(request('/'+scope.caseId+'/revisions','POST',save()));assert.equal(r.status,200);assert.equal((await r.json()).revision,2);assert.equal(e.repo.stored().revisions.length,2)});
for(const [header,value,status,c] of [
 ['Origin','https://attacker.test',403,'ORIGIN_DENIED'],['Origin','null',403,'ORIGIN_DENIED'],
 ['Authorization','',401,'AUTHENTICATION_REQUIRED'],['Authorization','Bearer wrong',401,'AUTHENTICATION_REQUIRED'],
 ['Authorization','Bearer one, Bearer two',401,'AUTHENTICATION_REQUIRED'],
 ['Idempotency-Key','',400,'IDEMPOTENCY_KEY_REQUIRED'],['Idempotency-Key',id(70),400,'IDEMPOTENCY_KEY_MISMATCH'],
 ['If-Match','',428,'PRECONDITION_REQUIRED'],['If-Match','W/"imp:'+scope.caseId+':1"',400,'INVALID_PRECONDITION'],
 ['If-Match','"imp:'+id(90)+':1"',400,'INVALID_PRECONDITION'],
 ['If-Match','"imp:'+scope.caseId+':2"',400,'PRECONDITION_BODY_MISMATCH'],
 ['Content-Type','text/plain',415,'JSON_REQUIRED'],['Content-Encoding','gzip',415,'CONTENT_ENCODING_NOT_SUPPORTED']
]) test('R03 HTTP recusa '+header+' '+value,async()=>{const {h,e}=await created();await code(await h(request('/'+scope.caseId+'/revisions','POST',save(),{[header]:value})),status,c);assert.equal(e.repo.stored().revisions.length,1)});
test('R03 HTTP seleção de outra conta não adquire autorização',async()=>{const {h,e}=await created();const c=command(30);c.scope.accountId=id(99);await code(await h(request('','POST',c)),403,'ACCESS_DENIED');assert.equal(e.repo.data.size,1)});
test('R03 HTTP JSON do usuário não injeta escopo/artefato ready/permissão',async()=>{for(const extra of [{scope},{approved:true},{objectKey:'private'},{status:'ready'},{actorId:id(99)}]){const {h,e}=await created();await code(await h(request('/'+scope.caseId+'/revisions','POST',{...save(),...extra})),422,'INVALID_COMMAND');assert.equal(e.repo.stored().revisions.length,1)}});
test('R03 HTTP versão concorrente retorna 412 sem substituir edição',async()=>{const {h,e}=await created();const replies=await Promise.all([h(request('/'+scope.caseId+'/revisions','POST',save(1,21))),h(request('/'+scope.caseId+'/revisions','POST',save(1,22)))]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,412]);assert.equal(e.repo.stored().events.length,2)});
test('R03 HTTP localizador e autenticação indisponíveis falham fechados',async()=>{for(const k of ['authenticate','locate']){const x=await created();x.options[k]=async()=>{throw new Error('SECRET SQL credential')};const r=await x.make()(request('/'+scope.caseId));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('SECRET'));}});
test('R03 HTTP rate limit recusa antes de localizar ou acessar banco',async()=>{const x=await created();x.options.admit=async()=>false;const count=x.e.repo.calls;await code(await x.make()(request('/'+scope.caseId)),429,'RATE_LIMITED');assert.equal(x.e.repo.calls,count)});
test('R03 HTTP porta travada expira sem chegar ao banco',async()=>{const x=httpEnvironment();x.options.authenticate=()=>new Promise(()=>{});await code(await x.make()(request('','POST',command())),503,'AUTHENTICATION_UNAVAILABLE');assert.equal(x.e.repo.calls,0)});
test('R03 HTTP origem incorreta e cookie não autenticam',async()=>{const {h}=await created();await code(await h(request('/'+scope.caseId,'GET',undefined,{Authorization:'',Cookie:'session=anything'})),401,'AUTHENTICATION_REQUIRED')});
test('R03 HTTP corpo grande bloqueado pelo conteúdo, não só Content-Length',async()=>{const x=httpEnvironment();const c=command();c.reason='x'.repeat(1024*1024+1);await code(await x.make()(request('','POST',c)),413,'PAYLOAD_TOO_LARGE');assert.equal(x.e.repo.calls,0)});
test('R03 HTTP JSON malformado e UTF8 inválido não chegam ao serviço',async()=>{const {h,e}=await created();for(const body of ['{"broken":',new Uint8Array([0xff,0xfe])]){const req=request('','POST',command());const r=await h(new Request(req.url,{method:'POST',headers:req.headers,body}));await code(r,400,'INVALID_JSON')}assert.equal(e.repo.stored().version,undefined);assert.equal(e.repo.stored().process.version,1)});
test('R03 HTTP body lento expira e cancela o reader',async()=>{const x=httpEnvironment();let cancelled=false;const template=request('','POST',command());const body=new ReadableStream({pull(){},cancel(){cancelled=true}});const req=new Request(template.url,{method:'POST',headers:template.headers,body,duplex:'half'});await code(await x.make()(req),408,'BODY_TIMEOUT');assert.equal(cancelled,true);assert.equal(x.e.repo.calls,0)});
test('R03 HTTP request abortada antes de escrita não grava',async()=>{const x=httpEnvironment(),abort=new AbortController();abort.abort();const req=request('','POST',command());await code(await x.make()(new Request(req,{signal:abort.signal})),409,'REQUEST_ABORTED');assert.equal(x.e.repo.calls,0)});
test('R03 HTTP falha desconhecida após início da escrita é incerta, sem mensagem SQL',async()=>{const x=httpEnvironment();x.options.service={...x.options.service,createCase:async()=>{throw Error('postgres://secret')}};const r=await x.make()(request('','POST',command()));assert.equal(r.status,503);const b=await r.json();assert.equal(b.outcome,'unknown');assert.equal(b.code,'WRITE_OUTCOME_UNKNOWN');assert.ok(!JSON.stringify(b).includes('postgres'))});
test('R03 HTTP registro não significa upload e verificação usa somente porta privada',async()=>{const {h,e}=await created();const payload={operationId:id(31),expectedVersion:1,name:'laudo.pdf',mime:'application/pdf',bytes:100,sha256:'a'.repeat(64)};const registered=await h(request('/'+scope.caseId+'/artifacts','POST',payload));assert.equal(registered.status,200);const a=await registered.json();assert.equal(a.artifactStatus,'pending');const verified=await h(request('/'+scope.caseId+'/artifacts/'+a.artifactId+'/verification','POST',{operationId:id(32),expectedVersion:2}));assert.equal(verified.status,200);assert.equal((await verified.json()).artifactStatus,'ready');const read=await h(request('/'+scope.caseId));assert.ok(!(await read.text()).includes('objectKey'));assert.equal(e.inspections.length,1)});
test('R03 HTTP cancelamento é ação explícita versionada',async()=>{const {h,e}=await created();const r=await h(request('/'+scope.caseId+'/cancellation','POST',{operationId:id(40),expectedVersion:1,reason:'Cancelado a pedido'}));assert.equal(r.status,200);assert.equal(e.repo.stored().process.status,'cancelled')});
test('R03 HTTP rotas desconhecidas e métodos indevidos não chegam ao serviço',async()=>{const {h,e}=await created();const count=e.repo.calls;assert.equal((await h(request('/anything/execute'))).status,404);assert.equal((await h(request('/'+scope.caseId,'DELETE'))).status,405);assert.equal(e.repo.calls,count)});
test('R03 HTTP request abortada depois de commit não informa cancelamento concluído',async()=>{
 const x=httpEnvironment(),control=new AbortController(),original=x.options.service.createCase;
 x.options.service={...x.options.service,createCase:async(...args)=>{const r=await original(...args);control.abort();return r}};
 const r=await x.make()(new Request(request('','POST',command()),{signal:control.signal}));
 assert.equal(r.status,503);assert.equal((await r.json()).outcome,'unknown');assert.equal(x.e.repo.stored().process.version,1);
});
test('R03 HTTP localizador malformado é falha de servidor, não input do usuário',async()=>{
 const x=await created();x.options.locate=async()=>({...scope,workspaceId:'wrong'});
 await code(await x.make()(request('/'+scope.caseId)),503,'DIRECTORY_UNAVAILABLE');
});
test('R03 HTTP limite do bearer é aplicado antes da porta de autenticação',async()=>{const x=httpEnvironment();let calls=0;x.options.authenticate=async()=>{calls++;return null};await code(await x.make()(request('','POST',command(),{Authorization:'Bearer '+'a'.repeat(9000)})),401,'AUTHENTICATION_REQUIRED');assert.equal(calls,0)});
test('R03 HTTP inconsistência semântica do snapshot retorna 422 e nenhuma mutação',async()=>{const x=httpEnvironment(),c=command();c.snapshot.records=[{id:'r1',kind:'result',links:{},fields:{strength:{rawValue:30,rawUnit:'MPa',value:30,unit:'MPa',presence:'present',provenance:'proposed',semanticRole:'measured',locations:[]}}}];await code(await x.make()(request('','POST',c)),422,'INVALID_COMMAND');assert.equal(x.e.repo.calls,0)});
