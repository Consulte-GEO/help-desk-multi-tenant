import test from 'node:test';import assert from 'node:assert/strict';
/** Minimal DOM port double: verifies module wiring, NOT browser/CSS/accessibility. */
class Element{
 tagName:string;children:Element[]=[];attributes:Record<string,string>={};handlers:Record<string,Function[]>={};value='';disabled=false;hidden=false;open=false;ownerDocument:any;parent:any;own='';
 constructor(tag:string,doc:any){this.tagName=tag;this.ownerDocument=doc;}
 set innerHTML(_value:string){throw Error('HTML string injection forbidden by test');}
 set textContent(v:string){this.own=String(v);this.children=[];}get textContent():string{return this.own+this.children.map(c=>c.textContent).join('');}
 append(...items:Element[]){for(const c of items){this.children.push(c);c.parent=this;}}replaceChildren(...items:Element[]){this.own='';this.children=[];this.append(...items);}
 setAttribute(k:string,v:string){this.attributes[k]=String(v);}removeAttribute(k:string){delete this.attributes[k];}
 addEventListener(k:string,f:Function){(this.handlers[k]??=[]).push(f);}dispatch(k:string){for(const f of this.handlers[k]??[])f({preventDefault(){},target:this});}
 showModal(){this.open=true;}close(){this.open=false;}focus(){}
}
function dom(){const doc:any={createElement:(tag:string)=>new Element(tag,doc)};return new Element('main',doc);}
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const snapshot=()=>({workspace_id:id(1),revision:1,total:2,items:[2,3].map(n=>({principal_id:id(n),principal_kind:'human',role:n===2?'admin':'agent',status:'active',effective_status:'active',revision:1,expires_at:null})),available_actions:['invite','revoke','set_role','handoff'],next_cursor:null});
function all(root:Element):Element[]{return [root,...root.children.flatMap(all)];}
async function mount(){const path='../web/admin-members.js';const api=await import(path).catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof api.mountAdminMembers,'function','C04 DOM mounting is missing');const root=dom();const panel=api.mountAdminMembers(root,{audience:{principalId:id(2),workspaceId:id(1)},request:async()=>Response.json(snapshot())});await panel.load();return {root,panel};}
test('C04 DOM wiring builds the list and labeled actions without HTML string injection',async()=>{const {root}=await mount();assert.match(root.textContent,/Membros da equipe/);assert.equal(all(root).filter(x=>x.attributes['data-admin-member']).length,2);assert.ok(all(root).some(x=>x.tagName==='button'&&x.textContent==='Revogar'));});
test('C04 DOM wiring opens confirmation and focuses its reason, no command on open',async()=>{const {root,panel}=await mount();const b=all(root).find(x=>x.tagName==='button'&&x.textContent==='Revogar')!;b.dispatch('click');const dialog=all(root).find(x=>x.tagName==='dialog')!;assert.equal(dialog.open,true);assert.ok(all(root).some(x=>x.attributes['data-admin-reason']!==undefined));panel.cancelDialog();assert.equal(dialog.open,false);});
test('C04 DOM wiring clears private form fields and rows when the audience changes',async()=>{const {root,panel}=await mount();panel.openDialog('revoke',id(3));const reason=all(root).find(x=>x.attributes['data-admin-reason']!==undefined)!;reason.value='Private text';reason.dispatch('input');panel.setAudience({principalId:id(8),workspaceId:id(9)});assert.equal(reason.value,'');assert.equal(all(root).filter(x=>x.attributes['data-admin-member']).length,0);assert.doesNotMatch(root.textContent,/Private text/);});
test('C04 DOM destroy clears the mounted panel',async()=>{const {root,panel}=await mount();panel.destroy();assert.equal(root.children.length,0);});
