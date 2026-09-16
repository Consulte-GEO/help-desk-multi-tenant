/** UI state only. The API, not this catalogue or a selected option, grants authorization. */
export function createSupportCatalogState() {
 let generation=0,pending=null,status='idle',items=[],cursor=null,selected='',loaded=false;
 const seenCursors=new Set();
 const key=v=>JSON.stringify([v.account_id,v.product_instance_id,v.service_code]);
 const copy=v=>v?{...v}:null;
 const current=op=>!!op&&pending===op&&op.generation===generation;
 const nonblank=(v,max)=>typeof v==='string'&&!!v.trim()&&[...v].length<=max&&!/\p{Cc}/u.test(v);
 function project(v) {
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid');
  for(const f of ['account_id','product_instance_id'])if(typeof v[f]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v[f]))throw Error('invalid');
  for(const f of ['account_name','product_name','service_name'])if(!nonblank(v[f],160))throw Error('invalid');
  if(!nonblank(v.service_code,80)||!['development','staging','production'].includes(v.environment))throw Error('invalid');
  return Object.fromEntries(['account_id','account_name','product_instance_id','product_name','environment','service_code','service_name'].map(f=>[f,v[f]]));
 }
 return {
  reset(){generation++;pending=null;status='idle';items=[];cursor=null;selected='';loaded=false;seenCursors.clear();},
  begin(){if(pending||(loaded&&cursor===null&&status!=='error'))return null;pending=Object.freeze({generation,cursor});status='loading';return pending;},
  accept(op,page){
   if(!current(op))return false;
   try{
    if(!page||!Array.isArray(page.items)||page.items.length>100||!(page.next_cursor===null||typeof page.next_cursor==='string'&&/^[A-Za-z0-9_-]{1,1600}$/.test(page.next_cursor)))throw Error('invalid');
    if(page.next_cursor!==null&&(!page.items.length||seenCursors.has(page.next_cursor)))throw Error('invalid');
    const next=page.items.map(project),keys=new Set(items.map(key));
    for(const value of next){if(keys.has(key(value)))throw Error('invalid');keys.add(key(value));}
    items=[...items,...next];cursor=page.next_cursor;loaded=true;
    if(cursor!==null)seenCursors.add(cursor);
    if(!selected&&items.length===1&&cursor===null)selected=key(items[0]);
    status=items.length?'ready':'empty';pending=null;return true;
   }catch{pending=null;status='error';return false;}
  },
  fail(op){if(!current(op))return false;pending=null;status='error';return true;},
  select(value){selected=items.some(v=>key(v)===value)?value:'';return !!selected;},
  selection:()=>copy(items.find(v=>key(v)===selected)),
  selectedKey:()=>selected,
  choices:()=>items.map(copy),
  next:()=>cursor,
  status:()=>status,
  canSubmit:()=>status==='ready'&&!!selected,
  current
 };
}
