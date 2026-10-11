/** Test-only DOM port. Does not prove CSS, Chromium behavior or accessibility. */
export class TestElement{
 tagName:string;children:TestElement[]=[];attributes:Record<string,string>={};handlers:Record<string,Function[]>={};value='';checked=false;disabled=false;hidden=false;open=false;ownerDocument:any;parent:any;own='';
 constructor(tag:string,doc:any){this.tagName=tag;this.ownerDocument=doc;}
 set innerHTML(_v:string){throw Error('Unsafe HTML insertion');}set textContent(v:string){this.own=String(v);this.children=[];}get textContent():string{return this.own+this.children.map(c=>c.textContent).join('');}
 append(...items:TestElement[]){for(const c of items){this.children.push(c);c.parent=this;}}replaceChildren(...items:TestElement[]){this.own='';this.children=[];this.append(...items);}
 setAttribute(k:string,v:string){this.attributes[k]=String(v);}removeAttribute(k:string){delete this.attributes[k];}
 addEventListener(k:string,f:Function){(this.handlers[k]??=[]).push(f);}removeEventListener(k:string,f:Function){this.handlers[k]=(this.handlers[k]??[]).filter(g=>g!==f);}
 dispatch(k:string){for(const f of this.handlers[k]??[])f({preventDefault(){},target:this});}focus(){}showModal(){this.open=true;}close(){this.open=false;}
}
export function testDom(){const doc:any={createElement:(tag:string)=>new TestElement(tag,doc)};return new TestElement('main',doc);}
export function elements(root:TestElement):TestElement[]{return [root,...root.children.flatMap(elements)];}
