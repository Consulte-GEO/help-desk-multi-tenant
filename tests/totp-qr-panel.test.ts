import test from 'node:test';import assert from 'node:assert/strict';import {createMfaEnrollmentPanel} from '../web/account-security.js';
const id='44444444-4444-4444-8444-444444444444',secret='JBSWY3DPEHPK3PXP';
function fixture(registration:any,contextAvailable=true){
 const element=()=>({textContent:'',value:'',hidden:false,disabled:false,replaceChildren(){},addEventListener(){}});
 const elements:any=Object.fromEntries(['label','secret','code','factor','provision','status','start','confirm','title','description'].map(k=>[k,element()]));
 elements.dialog={...element(),open:false,showModal(){this.open=true;},close(){this.open=false;}};
 const fills:any[]=[];elements.qr={...element(),width:0,height:0,hidden:true,getContext:()=>contextAvailable?{fillStyle:'',fillRect(...args:any[]){fills.push(args);}}:null};
 let generation=1;const session={state:()=>({phase:'active',generation}),beginMfaEnrollment:async()=>registration,signOut:async()=>{generation++;return 'confirmed';}};
 const original=globalThis.document;(globalThis as any).document={createElement:()=>element()};
 const panel=createMfaEnrollmentPanel({elements,getSession:()=>session as any,getEpoch:()=>1,blocked:()=>false,onResult:()=>{}});
 return {elements,panel,fills,restore(){(globalThis as any).document=original;}};
}
test('new own enrollment draws local QR and cancellation wipes raster and manual seed',async()=>{
 const f=fixture({generated:true,factors:[{id}],secret});try{f.panel.open();await f.panel.start();assert.equal(f.elements.qr.hidden,false);assert.ok(f.elements.qr.width>0);assert.ok(f.fills.length>100);await f.panel.cancel();assert.equal(f.elements.qr.width,0);assert.equal(f.elements.qr.height,0);assert.equal(f.elements.qr.hidden,true);assert.equal(f.elements.secret.textContent,'');}finally{f.restore();}
});
test('resumed enrollment never recreates a previous QR or secret',async()=>{
 const f=fixture({generated:false,factors:[{id}]});try{f.panel.open();await f.panel.start();assert.equal(f.elements.qr.hidden,true);assert.equal(f.elements.qr.width,0);assert.equal(f.elements.secret.textContent,'');assert.equal(f.fills.length,0);}finally{f.panel.clear();f.restore();}
});
test('QR renderer failure leaves explicit manual provisioning and no stale bitmap',async()=>{
 const f=fixture({generated:true,factors:[{id}],secret},false);try{f.panel.open();await f.panel.start();assert.equal(f.elements.secret.textContent,secret);assert.equal(f.elements.qr.hidden,true);assert.equal(f.elements.qr.width,0);assert.match(f.elements.status.textContent,/QR indisponível/);}finally{f.panel.clear();f.restore();}
});
test('late enrollment after close cannot repopulate QR or manual seed',async()=>{
 let resolve!:(v:any)=>void;const delayed=new Promise(r=>resolve=r),f=fixture(delayed);try{f.panel.open();const start=f.panel.start();await f.panel.cancel();resolve({generated:true,factors:[{id}],secret});await start;assert.equal(f.elements.qr.width,0);assert.equal(f.elements.qr.hidden,true);assert.equal(f.elements.secret.textContent,'');assert.equal(f.fills.length,0);}finally{f.restore();}
});
