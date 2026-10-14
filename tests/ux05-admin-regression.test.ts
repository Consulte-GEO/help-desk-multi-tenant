import test from 'node:test';import assert from 'node:assert/strict';import {testDom,elements} from './helpers/dom-port.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');const audience={workspaceId:id(1),principalId:id(2)};
const schema=()=>({id:'FORM1',version:1,status:'draft',title:'Título',fields:[{key:'summary',type:'text',label:'Resumo',required:true,public:true,config:{maxLength:200}}]});
async function config(){const path='../web/admin-configuration.js';return import(path);}
async function editor(){const path='../web/admin-forms.js';return import(path);}
for(const kind of ['account','product','instance','service','binding','contract','contract_version','coverage'])test('UX05 configuration '+kind+' uses original fields and retains unchanged values while sending',async()=>{
 const m=await config(),root=testDom();let release!:(value:unknown)=>void;const calls:any[]=[];
 const p=m.mountConfigurationPanel(root,{audience,request:async(path:string,init:any={})=>{if(!init.method)return {ok:true,json:async()=>({workspace_id:id(1),revision:7,total:0,items:[],next_cursor:null})};calls.push({path,...init});return new Promise(r=>release=r);}});
 await p.controller.load(kind);p.controller.open('create');const initial=elements(root).filter(e=>e.attributes['data-config-field']);assert.equal(initial.length,m.configurationForms[kind].fields.length);
 const reason=root.querySelector('[data-config-reason]')!;reason.value='Motivo explícito';reason.dispatch('input');const result=p.controller.confirm();
 assert.equal(root.querySelector('[data-config-reason]'),reason);assert.equal(reason.value,'Motivo explícito');assert.equal(reason.disabled,true);assert.equal(p.controller.view().busy,true);assert.equal(calls.length,1);
 release({ok:false,status:412});await result;assert.equal(p.controller.view().dialog,null);assert.match(root.textContent,/recusada/);p.destroy();assert.equal(reason.value,'');
});
test('UX05 configuration unknown replay preserves exact bytes and key',async()=>{
 const m=await config(),root=testDom(),calls:any[]=[];let mutations=0;
 const p=m.mountConfigurationPanel(root,{audience,request:async(path:string,init:any={})=>{if(!init.method)return {ok:true,json:async()=>({workspace_id:id(1),revision:7,total:0,items:[],next_cursor:null})};calls.push({path,body:init.body,headers:init.headers});mutations++;throw Error('uncertain');}});
 await p.controller.load();p.controller.open('create');p.controller.setField('active',false);p.controller.setReason('Justificativa');await p.controller.confirm();assert.equal(p.controller.view().uncertain,true);await p.controller.reconcile();assert.equal(mutations,2);assert.deepEqual(calls[0],calls[1]);assert.equal(JSON.parse(calls[0].body).data.active,false);p.destroy();
});
test('UX05 editor rejects byte overflow, retains last parsed preview and never submits',async()=>{
 const m=await editor(),root=testDom();let calls=0;const p=m.mountFormEditor(root,{schema:schema(),submit:async()=>{calls++;return {state:'confirmed'};}});
 assert.throws(()=>p.preview('á'.repeat(131073)));assert.equal(calls,0);assert.deepEqual(p.diff(),[]);assert.equal(p.state(),'idle');assert.match(root.textContent,/inválida/);p.destroy();
});
test('UX05 editor renders markup as plain data, including differences and confirmation',async()=>{
 const m=await editor(),root=testDom(),p=m.mountFormEditor(root,{schema:schema()});const value=schema();value.title='<img src=x onerror=alert(1)>';p.preview(JSON.stringify(value));p.prepare('save','<script>private reason</script>');assert.match(root.textContent,/<img/);assert.equal(elements(root).filter(e=>['img','script'].includes(e.tagName)).length,0);p.clearAudience();assert.doesNotMatch(root.textContent,/private reason|<img/);p.destroy();
});
test('UX05 two editor mounts have unique input and preview IDs',async()=>{
 const m=await editor(),a=testDom(),b=testDom();const p=m.mountFormEditor(a,{schema:schema()}),q=m.mountFormEditor(b,{schema:schema()});const ids=[...elements(a),...elements(b)].map(e=>e.id).filter(Boolean);assert.equal(ids.length,new Set(ids).size);p.destroy();q.destroy();
});
test('UX05 published config record remains immutable in the controller',async()=>{
 const m=await config(),root=testDom();const p=m.mountConfigurationPanel(root,{audience,request:async()=>({ok:true,json:async()=>({workspace_id:id(1),revision:7,total:1,next_cursor:null,items:[{kind:'contract_version',workspaceId:id(1),id:id(20),revision:2,data:{published:true}}]})})});await p.controller.load('contract_version');assert.equal(p.controller.open('update',id(20)),false);assert.equal(p.controller.open('publish',id(20)),false);assert.match(root.textContent,/somente leitura/);p.destroy();
});
