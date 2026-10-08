import test from 'node:test';import assert from 'node:assert/strict';
const load=()=>import('../web/totp-qr.js');
const secret='JBSWY3DPEHPK3PXP',id='44444444-4444-4444-8444-444444444444';
test('local provisioning uses fixed issuer and full owned factor label, never provider URI',async()=>{
 const {totpProvisioningUri}=await load();const uri=new URL(totpProvisioningUri(secret,id));
 assert.equal(uri.protocol,'otpauth:');assert.equal(uri.host,'totp');assert.equal(decodeURIComponent(uri.pathname),'/Consulte Help Desk:'+id);
 assert.deepEqual(Object.fromEntries(uri.searchParams),{secret,issuer:'Consulte Help Desk',algorithm:'SHA1',digits:'6',period:'30'});
});
test('local QR rejects malformed seed, factor ID and injected provisioning parameters',async()=>{
 const {totpProvisioningUri}=await load();for(const key of ['',secret.toLowerCase(),secret+'&issuer=foreign','A'.repeat(129),'A'.repeat(15),secret+'\0'])assert.throws(()=>totpProvisioningUri(key,id));
 for(const factor of ['',id+'/foreign',id+'\0','foreign'])assert.throws(()=>totpProvisioningUri(secret,factor));
});
test('canvas QR has integer modules and four-module quiet zone, no network/image/URI attribute',async()=>{
 const {drawTotpQr}=await load();const fills:any[]=[];const context:any={fillStyle:'',fillRect(...args:any[]){fills.push({color:this.fillStyle,args});}};
 const canvas:any={width:0,height:0,hidden:true,getContext:()=>context};drawTotpQr(canvas,secret,id);
 assert.equal(canvas.hidden,false);assert.equal(canvas.width,canvas.height);assert.equal(canvas.width%4,0);
 assert.deepEqual(fills[0],{color:'#fff',args:[0,0,canvas.width,canvas.height]});
 assert.ok(fills.length>100);for(const {color,args:[x,y,w,h]} of fills.slice(1)){assert.equal(color,'#000');assert.equal(w,4);assert.equal(h,4);assert.ok(x>=16&&y>=16&&x<canvas.width-16&&y<canvas.height-16);assert.equal(x%4,0);assert.equal(y%4,0);}
 assert.doesNotMatch(JSON.stringify(canvas),/otpauth|JBSWY|https|data:/);
});
test('canvas failure refuses QR without weakening the manual provisioning contract',async()=>{
 const {drawTotpQr,totpProvisioningUri}=await load();assert.throws(()=>drawTotpQr({getContext:()=>null} as any,secret,id));assert.ok(totpProvisioningUri(secret,id).includes('secret='+secret));
});
