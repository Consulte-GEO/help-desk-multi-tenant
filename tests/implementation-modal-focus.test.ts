import test from 'node:test';import assert from 'node:assert/strict';
import {setupModalA11y} from '../modules/implantacao/frontend/src/composables/useModalA11y.ts';
function fixture(){
 const names=['document','window','setTimeout'] as const,previous=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const),queued:Array<()=>void>=[],listeners=new Map<string,Function>();
 let queries=0,focuses=0;const doc={activeElement:null as unknown,querySelector:()=>{queries++;return container;},contains:()=>true,addEventListener:(name:string,fn:Function)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)};
 const field=()=>({focus(){focuses++;doc.activeElement=this;}}),trigger=field(),first=field(),second=field();doc.activeElement=trigger;
 const container={querySelectorAll:()=>[first,second],contains:(el:unknown)=>el===first||el===second};
 const set=(name:string,value:unknown)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
 set('document',doc);set('window',{getComputedStyle:()=>({display:'block',visibility:'visible'})});set('setTimeout',(fn:()=>void)=>{queued.push(fn);return queued.length;});
 return {doc,first,second,trigger,listeners,counts:()=>({queries,focuses}),run(){assert.ok(queued.length);queued.shift()!();},close(){for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}}};
}
test('modal deferred initial focus respects a field already selected inside the dialog',()=>{
 const f=fixture();try{const c=setupModalA11y({containerSelector:'#owned-modal'});c.activate();f.run();f.second.focus();f.run();assert.equal(f.doc.activeElement,f.second);assert.equal(f.counts().focuses,1);c.deactivate();}finally{f.close();}
});
test('modal still gives initial focus when the user has not selected an internal field',()=>{
 const f=fixture();try{const c=setupModalA11y({containerSelector:'#owned-modal'});c.activate();f.run();f.run();assert.equal(f.doc.activeElement,f.first);c.deactivate();assert.equal(f.doc.activeElement,f.trigger);}finally{f.close();}
});
test('a closed activation cannot adopt the container of a later opening',()=>{
 const f=fixture();try{const c=setupModalA11y({containerSelector:'#owned-modal'});c.activate();c.deactivate();c.activate();f.run();assert.equal(f.counts().queries,0);f.run();assert.equal(f.counts().queries,1);f.run();assert.equal(f.doc.activeElement,f.first);c.deactivate();}finally{f.close();}
});
test('a stale inner focus callback cannot focus the new opening after close/reopen',()=>{
 const f=fixture();try{const c=setupModalA11y({containerSelector:'#owned-modal'});c.activate();f.run();c.deactivate();c.activate();const stale=()=>f.run();
  // The stale inner callback runs before the new outer callback: it must do nothing.
  stale();assert.equal(f.doc.activeElement,f.trigger);f.run();f.second.focus();f.run();assert.equal(f.doc.activeElement,f.second);c.deactivate();
 }finally{f.close();}
});
test('modal preserves keyboard trapping, Escape and listener cleanup',()=>{
 const f=fixture();try{let escaped=0,prevented=0;const c=setupModalA11y({containerSelector:'#owned-modal',onEscape:()=>escaped++});c.activate();f.run();f.run();
  const key=(key:string,shiftKey=false)=>f.listeners.get('keydown')!({key,shiftKey,preventDefault:()=>prevented++,stopPropagation(){}});
  f.second.focus();key('Tab');assert.equal(f.doc.activeElement,f.first);key('Tab',true);assert.equal(f.doc.activeElement,f.second);key('Escape');assert.equal(escaped,1);assert.equal(prevented,2);c.deactivate();assert.equal(f.listeners.size,0);
 }finally{f.close();}
});
