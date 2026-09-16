import test from 'node:test';import assert from 'node:assert/strict';
async function validate(req:Request){const modulePath='../src/http/empty-body.ts';const m=await import(modulePath).catch(()=>null);assert.equal(typeof m?.requireEmptyBody,'function');return m.requireEmptyBody(req,{timeoutMs:15});}
const request=(body:ReadableStream|Uint8Array|string,headers:Record<string,string>={})=>new Request('https://hd.test',{method:'DELETE',headers,body,duplex:'half'} as RequestInit);
test('no-body check rejects content even when content-length claims zero',async()=>{
 await assert.rejects(()=>validate(request('x',{'content-length':'0'})),{status:400});
});
test('no-body check bounds a stream which never finishes and cancels it',async()=>{
 let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(()=>validate(request(body)),{status:408});assert.equal(cancelled,true);
});
test('no-body check redacts a failed transport stream',async()=>{
 const body=new ReadableStream({start(c){c.error(Error('PRIVATE-TRANSPORT'));}});
 await assert.rejects(()=>validate(request(body)),(e:unknown)=>{assert.equal((e as {status:number}).status,400);assert.doesNotMatch(String(e),/PRIVATE-TRANSPORT/);return true;});
});
test('no-body check rejects declared nonempty length before calling revocation',async()=>{
 const body=new ReadableStream({start(c){c.close();}});
 await assert.rejects(()=>validate(request(body,{'content-length':'2'})),{status:400});
});
test('no-body check tolerates a zero-byte chunk followed by EOF',async()=>{
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array());c.close();}});
 await validate(request(body));
});
