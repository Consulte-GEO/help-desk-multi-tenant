/** Test-only DOM port. Does not prove CSS, Chromium behavior or accessibility. */
export class TestElement{
 tagName:string;children:TestElement[]=[];attributes:Record<string,string>={};handlers:Record<string,Function[]>={};value='';checked=false;disabled=false;hidden=false;open=false;ownerDocument:any;parent:any;own='';
 // UX04: DOM primitives consumed by the real renderer; browser proof remains separate.
 get id(){return this.attributes.id??'';}set id(v:string){this.attributes.id=v;}
 get className(){return this.attributes.class??'';}set className(v:string){this.attributes.class=v;}
 get parentElement():TestElement|null{return this.parent??null;}
 get parentNode():TestElement|null{return this.parent??null;}
 get isConnected():boolean{return this===this.ownerDocument.body||!!this.parent?.isConnected;}
 classList={add:(...names:string[])=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names:string[])=>{this.className=this.className.split(/\s+/).filter(x=>!names.includes(x)).join(' ');},contains:(name:string)=>this.className.split(/\s+/).includes(name)};
 getAttribute(k:string){return this.attributes[k]??null;}
 contains(e:TestElement|null|undefined):boolean{return !!e&&(e===this||this.children.some(c=>c.contains(e)));}
 remove(){if(this.parent){this.parent.children=this.parent.children.filter((c:TestElement)=>c!==this);this.parent=null;}}
 insertBefore(item:TestElement,before:TestElement|null){item.remove();const i=before?this.children.indexOf(before):-1;if(i<0)this.append(item);else{this.children.splice(i,0,item);item.parent=this;}}
 after(item:TestElement){if(this.parent){const parent=this.parent;item.remove();parent.children.splice(parent.children.indexOf(this)+1,0,item);item.parent=parent;}}
 replaceWith(item:TestElement){if(this.parent){const parent=this.parent,index=parent.children.indexOf(this);item.remove();parent.children.splice(index,1,item);item.parent=parent;this.parent=null;}}
 matches(selector:string):boolean{
  if(selector.includes(','))return selector.split(',').some(s=>this.matches(s.trim()));
  if(selector===':disabled')return this.disabled||!!this.parentElement?.matches(':disabled');
  if(selector.endsWith(':not(:disabled)'))return this.matches(selector.slice(0,-':not(:disabled)'.length))&&!this.matches(':disabled');
  if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
  if(selector.startsWith('#'))return this.id===selector.slice(1);
  const m=/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);
  if(m)return m[2]===undefined?Object.hasOwn(this.attributes,m[1]!):this.attributes[m[1]!]===m[2];
  return this.tagName.toLowerCase()===selector.toLowerCase();
 }
 querySelectorAll(selector:string):TestElement[]{return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
 querySelector(selector:string):TestElement|null{return this.querySelectorAll(selector)[0]??null;}
 constructor(tag:string,doc:any){this.tagName=tag;this.ownerDocument=doc;}
 set innerHTML(_v:string){throw Error('Unsafe HTML insertion');}set textContent(v:string){this.own=String(v);for(const c of this.children)c.parent=null;this.children=[];}get textContent():string{return this.own+this.children.map(c=>c.textContent).join('');}
 append(...items:TestElement[]){for(const c of items){c.remove();this.children.push(c);c.parent=this;}}replaceChildren(...items:TestElement[]){this.own='';for(const c of this.children)c.parent=null;this.children=[];this.append(...items);}
 setAttribute(k:string,v:string){this.attributes[k]=String(v);}removeAttribute(k:string){delete this.attributes[k];}
 addEventListener(k:string,f:Function){(this.handlers[k]??=[]).push(f);}removeEventListener(k:string,f:Function){this.handlers[k]=(this.handlers[k]??[]).filter(g=>g!==f);}
 dispatch(k:string){for(const f of this.handlers[k]??[])f({preventDefault(){},target:this});}focus(){if(!this.matches(':disabled'))this.ownerDocument.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;}
}
export function testDom(){const events=new EventTarget(),doc:any={createElement:(tag:string)=>new TestElement(tag,doc),createComment:()=>new TestElement('#comment',doc),addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};const root=new TestElement('main',doc);doc.body=root;doc.activeElement=root;doc.getElementById=(id:string)=>elements(root).find(e=>e.id===id)??null;return root;}
export function elements(root:TestElement):TestElement[]{return [root,...root.children.flatMap(elements)];}
