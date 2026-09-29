import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import type {TLSSocket} from 'node:tls';
import {assertVerifiedPreflightTls} from '../src/infrastructure/runtime-preflight.ts';
import type {SqlClient} from '../src/infrastructure/sql.ts';
import {loopbackTls} from './helpers/loopback-tls.ts';
let fixture:Awaited<ReturnType<typeof loopbackTls>>;
before(async()=>{fixture=await loopbackTls();});
after(async()=>{await fixture?.close();});
const client=(stream:TLSSocket):SqlClient&{connection:{stream:TLSSocket}}=>({connection:{stream},
 query:async()=>{throw Error('TLS fixture does not execute SQL');},release:()=>{}});

test('real loopback TLS with trusted certificate and matching hostname passes',async()=>{
 const socket=await fixture.open();try{
  assert.equal(socket.authorized,true);assert.equal(socket.encrypted,true);assert.match(socket.getProtocol()??'',/^TLSv1\.[23]$/);
  assert.doesNotThrow(()=>assertVerifiedPreflightTls(client(socket)));
 }finally{socket.destroy();}
});
test('real TLS handshake refuses an untrusted self-signed certificate',async()=>{
 await assert.rejects(()=>fixture.open({ca:[]}),{code:'DEPTH_ZERO_SELF_SIGNED_CERT'});
});
test('real TLS handshake refuses the wrong hostname',async()=>{
 await assert.rejects(()=>fixture.open({servername:'other.invalid'}),{code:'ERR_TLS_CERT_ALTNAME_INVALID'});
});
test('diagnostic rejects an encrypted connection whose authorization was disabled in the fixture',async()=>{
 // Test-only negative transport: untrusted CA accepted by client, then refused by the diagnostic.
 const socket=await fixture.open({ca:[],rejectUnauthorized:false});try{
  assert.equal(socket.authorized,false);assert.equal(socket.encrypted,true);
  assert.throws(()=>assertVerifiedPreflightTls(client(socket)),{code:'tls_not_verified'});
 }finally{socket.destroy();}
});
test('destroyed real TLS socket is not current proof of usable secure transport',async()=>{
 const socket=await fixture.open();socket.destroy();
 assert.equal(socket.authorized,true);assert.equal(socket.destroyed,true);
 assert.throws(()=>assertVerifiedPreflightTls(client(socket)),{code:'tls_not_verified'});
});
test('real TLS socket ending its writable side cannot pass the diagnostic',async()=>{
 const socket=await fixture.open();try{
  socket.end();assert.equal(socket.writableEnded,true);assert.equal(socket.authorized,true);
  assert.throws(()=>assertVerifiedPreflightTls(client(socket)),{code:'tls_not_verified'});
 }finally{socket.destroy();}
});
