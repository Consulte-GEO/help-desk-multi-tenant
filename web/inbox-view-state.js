/** Ephemeral presentation state. Never contains auth, draft text or permissions. */
export function createInboxViewState() {
 let generation=0,request=null,pane='list',phase='idle',selected=null,target=null,error=null,focusDetail=false;
 const view=()=>Object.freeze({pane,phase,selected,target,error,focusDetail});
 function begin(id,navigate=false) {
  if(typeof id!=='string'||!id||id.length>200)throw new TypeError('Invalid presentation selection');
  request=Object.freeze({generation:++generation,id});
  target=id;phase='loading';error=null;focusDetail=navigate===true;
  if(navigate===true)pane='detail';
  return request;
 }
 function current(op){return op!==null&&request===op;}
 function finish(op){if(!current(op))return false;selected=op.id;target=op.id;phase='ready';error=null;request=null;return true;}
 function fail(op,kind='unavailable'){if(!current(op))return false;phase='error';selected=null;error=kind==='forbidden'?'forbidden':'unavailable';request=null;focusDetail=false;return true;}
 function back(){pane='list';focusDetail=false;}
 function consumeFocus(){const result=focusDetail;focusDetail=false;return result;}
 function reset(){generation++;request=null;pane='list';phase='idle';selected=target=null;error=null;focusDetail=false;}
 return Object.freeze({view,begin,finish,fail,back,consumeFocus,reset});
}
export function normalizeInboxFilters(value={}) {
 const result={};
 for(const key of ['q','status','priority','assignment']) {
  const text=typeof value?.[key]==='string'?value[key].trim():'';
  if(text)result[key]=text;
 }
 return result;
}
export function inboxFiltersDiffer(draft,applied){return JSON.stringify(normalizeInboxFilters(draft))!==JSON.stringify(normalizeInboxFilters(applied));}
