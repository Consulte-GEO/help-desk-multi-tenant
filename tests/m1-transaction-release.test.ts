import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

/** Each case runs real transaction code in an isolated Node process with synthetic SQL.
 * These cases are NOT evidence of physical disposal or PostgreSQL operation.
 */
function scenario(mode:string, logger='capture') {
 const script=`
 import assert from 'node:assert/strict';
 import {runTransaction,withControlTransactions} from './src/infrastructure/transaction.ts';
 import {HelpdeskError} from './src/domain/errors.ts';
 import {transactionEventFixture} from './tests/helpers/transaction-event-fixture.ts';
 const mode=${JSON.stringify(mode)}, logger=${JSON.stringify(logger)}, h=transactionEventFixture();
 const privateError=Error('PRIVATE_RELEASE_SENTINEL synthetic password and SQL');
 const events=[];let releaseCalls=0,works=0,borrowed,firstError=null,value=null;
 console.warn=line=>{events.push(JSON.parse(line));
  if(logger==='throws')throw privateError;
  if(logger==='rejects')return Promise.reject(privateError);
 };
 const release=h.client.release.bind(h.client);
 h.client.release=error=>{releaseCalls++;release(error);
  if(mode==='hostile')throw new Proxy({}, {get(){throw privateError;}});
  throw privateError;
 };
 const query=h.client.query.bind(h.client);
 h.client.query=async(sql,args)=>{
  if(sql==='COMMIT'&&mode==='lost-commit'){h.calls.push(sql);throw privateError;}
  const r=await query(sql,args);
  if(sql==='COMMIT'&&mode==='rollback-tag')return {...r,command:'ROLLBACK'};
  if(sql==='ROLLBACK'&&mode==='failed-rollback')throw privateError;
  return r;
 };
 const expected=new HelpdeskError(mode==='conflict'?409:mode==='precondition'?412:404,
  mode==='conflict'?'conflict':mode==='precondition'?'precondition_failed':'resource_not_found','Synthetic domain denial');
 try{value=mode==='control'
   ?(await withControlTransactions(h.pool).query('select 42')).rows[0].answer
   :await runTransaction(h.pool,undefined,async c=>{
    works++;borrowed=c;
    if(['denied','conflict','precondition','failed-rollback'].includes(mode))throw expected;
    await c.query('select 42');return {receipt:'same-receipt',snapshot:{version:1}};
   });
 }catch(error){firstError={same:error===expected,status:error.status,code:error.code??'raw',message:error.message};}
 let reuse=null;
 if(mode==='reuse'){
  const count=h.calls.length;
  try{await runTransaction(h.pool,undefined,async()=>{works++;return 9;});}
  catch(e){reuse={code:e.code,status:e.status,sql_after_failure:h.calls.length-count};}
 }
 let late=null;
 if(mode==='late'){
  const count=h.calls.length;
  try{await borrowed.query('select MUST_NOT_RUN');}catch(e){late={code:e.code,sql_after_close:h.calls.length-count};}
 }
 await new Promise(resolve=>setImmediate(resolve));
 console.log(JSON.stringify({value,firstError,events,works,releaseCalls,calls:h.calls,reuse,late,
  discard_requested:h.releases.map(e=>!!e)}));
 `;
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{
  cwd:new URL('../',import.meta.url),env,encoding:'utf8',timeout:5000,
 });
 assert.equal(result.status,0,'Transaction/reporter must not crash the process: '+result.stderr);
 assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_RELEASE_SENTINEL|synthetic password and SQL/,
  'Cleanup must never replace the result with a raw driver error or print its payload');
 return JSON.parse(result.stdout);
}
function closedEvent(out:ReturnType<typeof scenario>,commitState:string,count=1){
 assert.equal(out.events.length,count);
 assert.deepEqual(out.events[0],{component:'helpdesk.database',event:'connection_release_failed',commit_state:commitState});
}

test('confirmed commit retains the exact receipt despite a synchronous release failure',()=>{
 const out=scenario('confirmed');assert.equal(out.firstError,null);
 assert.deepEqual(out.value,{receipt:'same-receipt',snapshot:{version:1}});
 assert.equal(out.works,1);assert.equal(out.releaseCalls,1);
 assert.equal(out.calls.at(-1),'COMMIT');assert.equal(out.calls.filter((q:string)=>q==='COMMIT').length,1);
 closedEvent(out,'confirmed');
});
for(const mode of ['lost-commit','rollback-tag'])test('release failure preserves uncertain commit for '+mode,()=>{
 const out=scenario(mode);assert.equal(out.value,null);assert.equal(out.firstError.code,'transaction_outcome_unknown');
 assert.equal(out.firstError.status,503);assert.equal(out.works,1);assert.equal(out.releaseCalls,1);
 assert.deepEqual(out.discard_requested,[true]);closedEvent(out,'unknown');
});
for(const [mode,status,code] of [['denied',404,'resource_not_found'],['conflict',409,'conflict'],['precondition',412,'precondition_failed'],['failed-rollback',404,'resource_not_found']] as const)
 test('release failure never replaces prior '+mode,()=>{
  const out=scenario(mode);assert.equal(out.firstError.same,true);assert.equal(out.firstError.status,status);assert.equal(out.firstError.code,code);
  assert.equal(out.value,null);assert.equal(out.works,1);assert.equal(out.releaseCalls,1);assert.ok(!out.calls.includes('COMMIT'));
  closedEvent(out,'not_requested');
 });
test('uncertain physical release poisons the client without executing another SQL statement',()=>{
 const out=scenario('reuse');assert.equal(out.firstError,null);assert.equal(out.works,1);
 assert.deepEqual(out.reuse,{code:'database_unavailable',status:503,sql_after_failure:0});
 assert.equal(out.releaseCalls,2);assert.deepEqual(out.discard_requested,[false,true]);
 closedEvent(out,'confirmed',2);assert.equal(out.events[1].commit_state,'not_requested');
});
test('failed release cannot reactivate the borrowed callback connection',()=>{
 const out=scenario('late');assert.equal(out.firstError,null);
 assert.deepEqual(out.late,{code:'database_unavailable',sql_after_close:0});closedEvent(out,'confirmed');
});
test('control query returns its confirmed result without replay after release failure',()=>{
 const out=scenario('control');assert.equal(out.firstError,null);assert.equal(out.value,42);assert.equal(out.releaseCalls,1);
 assert.equal(out.calls.filter((q:string)=>q==='select 42').length,1);closedEvent(out,'confirmed');
});
for(const logger of ['throws','rejects'])test('cleanup telemetry '+logger+' cannot change the confirmed transaction',()=>{
 const out=scenario('confirmed',logger);assert.equal(out.firstError,null);assert.equal(out.value.receipt,'same-receipt');closedEvent(out,'confirmed');
});
test('hostile non-Error release payload is never inspected or serialized',()=>{
 const out=scenario('hostile');assert.equal(out.firstError,null);assert.equal(out.value.receipt,'same-receipt');closedEvent(out,'confirmed');
});
test('release gate requires the release regression suite and connected scenarios',async()=>{
 const modulePath='../scripts/homologation-core.mjs';const {steps}=await import(modulePath);
 assert.ok(steps.find((s:{id:string})=>s.id==='application').minTests>=1177);
 assert.ok(steps.find((s:{id:string})=>s.id==='postgres').minTests>=209);
});
