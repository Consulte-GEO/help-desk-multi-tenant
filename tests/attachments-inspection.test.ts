import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const load=async()=>{const p='../src/integrations/files/inspection.ts';const m=await import(p).catch(()=>({}));assert.equal(typeof m.inspectAttachmentStream,'function');return m;};
const png=Buffer.from('89504e470d0a1a0a0000000d49484452','hex');
const scan=async(s:AsyncIterable<Uint8Array>)=>{for await(const _ of s){}return {verdict:'clean',engine:'synthetic-test-engine',definitions:'test-1',complete:true};};
async function* bytes(value:Uint8Array){yield value.subarray(0,3);yield value.subarray(3);}
const options=()=>({expectedBytes:png.length,maxBytes:1024,declaredMime:'image/png',allowedMime:['image/png','application/pdf','image/jpeg'],timeoutMs:500,scanner:{scan}});
test('C09 computes exact SHA256 and size of bytes consumed by scanner',async()=>{const m=await load(),r=await m.inspectAttachmentStream(bytes(png),options());assert.equal(r.status,'clean');assert.equal(r.sha256,createHash('sha256').update(png).digest('hex'));assert.equal(r.bytes,png.length);});
for(const [name,edit,status] of [
 ['missing scanner',(o:any)=>{o.scanner=undefined;},'scan_error'],['scanner timeout',(o:any)=>{o.timeoutMs=15;o.scanner={scan:()=>new Promise(()=>{})};},'scan_error'],
 ['early clean without consuming bytes',(o:any)=>{o.scanner={scan:async()=>({verdict:'clean',engine:'x',definitions:'1',complete:true})};},'scan_error'],
 ['partial scan',(o:any)=>{o.scanner={scan:async(s:any)=>{for await(const _ of s)break;return {verdict:'clean',engine:'x',definitions:'1',complete:false};}};},'scan_error'],
 ['declared MIME mismatch',(o:any)=>{o.declaredMime='application/pdf';},'rejected'],['size mismatch',(o:any)=>{o.expectedBytes++;},'rejected'],
 ['unsupported scanner',(o:any)=>{o.scanner={scan:async(s:any)=>{for await(const _ of s){}return {verdict:'unsupported',engine:'x',definitions:'1',complete:true};}};},'unsupported'],
 ['infected scan',(o:any)=>{o.scanner={scan:async(s:any)=>{for await(const _ of s){}return {verdict:'infected',engine:'x',definitions:'1',complete:true};}};},'rejected'],
 ['oversized object',(o:any)=>{o.maxBytes=8;},'rejected'],['throwing provider',(o:any)=>{o.scanner={scan:()=>{throw Error('secret marker');}};},'scan_error'],
] as const)test('C09 '+name,async()=>{const m=await load(),o=options();edit(o);const r=await m.inspectAttachmentStream(bytes(png),o);assert.equal(r.status,status);assert.ok(!JSON.stringify(r).includes('secret marker'));});
for(const [name,b] of [['zip bomb',Buffer.from('504b0304ffffffffffffffff','hex')],['OLE/macros',Buffer.from('d0cf11e0a1b11ae1','hex')],['HTML active',Buffer.from('<html><script>bad()</script>')],['unknown',Buffer.from('no file handler')]] as const)test('C09 '+name+' is never clean even with a clean scanner response',async()=>{const m=await load(),o=options();o.expectedBytes=b.length;const r=await m.inspectAttachmentStream(bytes(b),o);assert.equal(r.status,'unsupported');});
test('C09 aborted scan never succeeds',async()=>{const m=await load(),abort=new AbortController();abort.abort();const r=await m.inspectAttachmentStream(bytes(png),{...options(),signal:abort.signal});assert.equal(r.status,'scan_error');});
test('C09 does not retain file content or raw provider finding in the scan report',async()=>{const m=await load(),r=await m.inspectAttachmentStream(bytes(png),options());assert.deepEqual(Object.keys(r).sort(),['bytes','definitions','engine','mime','reason','sha256','status'].sort());});
test('C09 rejects a source error after the valid prefix',async()=>{const m=await load();async function* broken(){yield png;throw Error('private storage path');}const r=await m.inspectAttachmentStream(broken(),options());assert.equal(r.status,'scan_error');assert.ok(!JSON.stringify(r).includes('private'));});
