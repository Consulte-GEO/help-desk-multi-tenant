/** Pure state only: authorization always remains on the server. No persistent storage. */
export function createConversationState(){
 let generation=0;let owner='';let data={messages:{items:[],next:null},notes:{items:[],next:null}};
 return {
  reset(identity){owner=identity;generation++;data={messages:{items:[],next:null},notes:{items:[],next:null}};return generation;},
  accept(expected,kind,page){
   if(expected!==generation||!owner)return false;
   if(!Object.hasOwn(data,kind)||!Array.isArray(page.items))throw Error('Invalid conversation page');
   const current=data[kind],byId=new Map(current.items.map(m=>[m.id,m]));
   for(const item of page.items)byId.set(item.id,item);
   current.items=[...byId.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
   current.next=page.next_cursor??null;return true;
  },
  items(kind){return data[kind].items.slice();},next(kind){return data[kind].next;},generation(){return generation;}
 };
}
