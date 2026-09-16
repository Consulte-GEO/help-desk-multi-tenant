import test from 'node:test';import assert from 'node:assert/strict';
import {httpObservation} from '../src/observability/http.ts';
async function summary(){const path='../src/observability/summary.ts';const m=await import(path).catch(()=>null);assert.equal(typeof m?.HttpLogSummary,'function');return m;}
const event=(status=200,elapsed=30,route='/v1/tickets')=>httpObservation({request:new Request('https://hd.test'+route),requestId:'12345678-1234-4234-8234-123456789abc',status,phase:'http',errorCode:status>=400?'forbidden':null,started:0,finished:elapsed});
test('summary aggregates per route/method, with histogram and no raw request identifiers',async()=>{
 const {HttpLogSummary}=await summary();const s=new HttpLogSummary();for(const e of [event(),event(403,200),event(503,800)])s.consumeLine(JSON.stringify(e));
 const r=s.snapshot();assert.equal(r.accepted,3);assert.equal(r.routes.length,1);assert.equal(r.routes[0].count,3);assert.equal(r.routes[0].statuses['403'],1);assert.equal(r.routes[0].errors.forbidden,2);assert.equal(r.routes[0].latency.observed,3);assert.equal(r.routes[0].latency.histogram.reduce((a:any,b:any)=>a+b.count,0),3);assert.doesNotMatch(JSON.stringify(r),/12345678/);
});
test('unknown log components are ignored but malformed HTTP observations are rejected',async()=>{
 const {HttpLogSummary}=await summary();const s=new HttpLogSummary();for(const line of ['', 'not json',JSON.stringify({component:'other',token:'PRIVATE'})])s.consumeLine(line);
 s.consumeLine(JSON.stringify({...event(),route:'/PRIVATE/customer',status:200}));const r=s.snapshot();assert.equal(r.accepted,0);assert.equal(r.ignored_lines,3);assert.equal(r.rejected_lines,1);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('records with extra private fields are rejected instead of copied or silently approved',async()=>{
 const {HttpLogSummary}=await summary();const s=new HttpLogSummary();s.consumeLine(JSON.stringify({...event(),authorization:'PRIVATE'}));s.consumeLine(JSON.stringify({...event(),request_id:'TOKEN_PRIVATE'}));assert.equal(s.snapshot().rejected_lines,2);assert.equal(s.snapshot().accepted,0);
});
test('invalid severity, phase, status class, time, code and timings cannot pollute aggregates',async()=>{
 const {HttpLogSummary}=await summary();const s=new HttpLogSummary();
 for(const changed of [{severity:'error'},{phase:'PRIVATE'},{status:999},{status_class:'5xx'},{duration_ms:-1},{error_code:'PRIVATE'},{occurred_at:'yesterday'},{method:'CUSTOM_METHOD'},{release:'TOKEN_PRIVATE'},{event_schema:2}])s.consumeLine(JSON.stringify({...event(),...changed}));
 assert.equal(s.snapshot().accepted,0);assert.equal(s.snapshot().rejected_lines,10);
});
test('missing valid duration never becomes a zero-latency measurement',async()=>{
 const {HttpLogSummary}=await summary();const s=new HttpLogSummary();s.consumeLine(JSON.stringify({...event(),duration_ms:null}));assert.equal(s.snapshot().accepted,1);assert.equal(s.snapshot().routes[0].latency.observed,0);assert.equal(s.snapshot().routes[0].latency.mean_ms,null);
});
test('finite route aggregation does not grow with request IDs',async()=>{
 const {HttpLogSummary}=await summary();const s=new HttpLogSummary();for(let i=0;i<1500;i++)s.consumeLine(JSON.stringify({...event(),request_id:`12345678-1234-4234-8234-${i.toString(16).padStart(12,'0')}`}));
 assert.equal(s.snapshot().accepted,1500);assert.equal(s.snapshot().routes.length,1);assert.equal(s.snapshot().routes[0].count,1500);
});
test('bounded line parser discards overlong records once and resumes on the next line',async()=>{
 const {HttpLogSummary,summarizeChunks}=await summary();const s=new HttpLogSummary();
 async function* chunks(){yield Buffer.from('x'.repeat(50));yield Buffer.from('x'.repeat(50)+'\n'+JSON.stringify(event())+'\n');}
 await summarizeChunks(chunks(),s,80);assert.equal(s.snapshot().rejected_lines,2);assert.equal(s.snapshot().accepted,0);
 async function* valid(){const b=Buffer.from(JSON.stringify(event())+'\r\n'+JSON.stringify(event()));yield b.subarray(0,51);yield b.subarray(51);}
 await summarizeChunks(valid(),s);assert.equal(s.snapshot().accepted,2);
});
test('stream parser accepts split Unicode and rejects malformed UTF-8 without retaining raw bytes',async()=>{
 const {HttpLogSummary,summarizeChunks}=await summary();const s=new HttpLogSummary();async function* chunks(){yield Buffer.from([0xff,0xfe,10]);yield Buffer.from(JSON.stringify(event())+'\n');}
 await summarizeChunks(chunks(),s);assert.equal(s.snapshot().accepted,1);assert.equal(s.snapshot().rejected_lines,1);
});
test('object-valued diagnostic labels cannot throw coercion errors or stop subsequent ingestion',async()=>{
 const {HttpLogSummary}=await summary();const s=new HttpLogSummary();for(const key of ['phase','route','method'])assert.doesNotThrow(()=>s.consumeLine(JSON.stringify({...event(),[key]:{toString:null}})));
 s.consumeLine(JSON.stringify(event()));assert.equal(s.snapshot().accepted,1);assert.equal(s.snapshot().rejected_lines,3);
});
